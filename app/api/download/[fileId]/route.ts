import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getSignedDownloadUrl } from "@/lib/r2"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

const POPULAR_FILE_PRICE_PLUS_1_THRESHOLD = 1000
const POPULAR_FILE_PRICE_PLUS_2_THRESHOLD = 5000

type MembershipLevel = "standard" | "premium" | "platinum" | "admin"

interface ProfileRow {
  id?: string
  role?: string | null
  membership?: string | null
  is_premium?: boolean | null
  coins?: number | null
}

interface FileRow {
  id: string
  title?: string | null
  slug?: string | null
  visibility?: "free" | "premium" | "platinum" | "private" | null
  status?: string | null
  downloads_count?: number | null
  monetization_enabled?: boolean | null
}

interface FileVersionRow {
  id: string
  file_id: string
  object_key?: string | null
  bucket_name?: string | null
  archive_type?: string | null
  mime_type?: string | null
  file_size_bytes?: number | null
  is_current?: boolean | null
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizeMembership(profile?: ProfileRow | null): MembershipLevel {
  const role = String(profile?.role || "").trim().toLowerCase()
  const membership = String(profile?.membership || "").trim().toLowerCase()

  if (role === "admin") return "admin"
  if (membership === "platinum") return "platinum"
  if (membership === "premium" || profile?.is_premium) return "premium"

  return "standard"
}

function getBaseDownloadCoinCost(level: MembershipLevel): number {
  if (level === "admin") return 0
  if (level === "platinum") return 60
  if (level === "premium") return 80
  return 100
}

function getDownloadCoinCost(level: MembershipLevel, file?: FileRow | null): number {
  let cost = getBaseDownloadCoinCost(level)

  if (level !== "admin" && file) {
    const downloadsCount = Number(file.downloads_count || 0)
    if (downloadsCount >= POPULAR_FILE_PRICE_PLUS_2_THRESHOLD) cost += 5
    else if (downloadsCount >= POPULAR_FILE_PRICE_PLUS_1_THRESHOLD) cost += 2
  }

  return Math.max(0, cost)
}

function buildSafeFilename(file: FileRow, version: FileVersionRow): string {
  const extension = version.archive_type?.trim()?.toLowerCase() || "zip"
  const baseName = (file.slug || file.title || file.id || "download")
    .toString()
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")

  return `${baseName || "download"}.${extension}`
}

function getClientIp(req: NextRequest): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for")
  return forwardedFor ? forwardedFor.split(",")[0]?.trim() : null
}

function createAdminDb() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null

  return createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await context.params
    if (!fileId) return NextResponse.json({ error: "Missing file id" }, { status: 400 })

    const url = new URL(req.url)
    const mode = url.searchParams.get("mode")

    const referer = req.headers.get("referer")
    const currentHost = req.nextUrl.hostname.replace(/^www\./, "")
    const envSiteHost = process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname.replace(/^www\./, "")
      : currentHost

    if (referer) {
      try {
        const refererHost = new URL(referer).hostname.replace(/^www\./, "")
        if (refererHost !== currentHost && refererHost !== envSiteHost) {
          return NextResponse.json({ error: "Direct download not allowed from external site" }, { status: 403 })
        }
      } catch {
        return NextResponse.json({ error: "Invalid referer header" }, { status: 403 })
      }
    }

    const supabase = await createClient()
    const adminDb = createAdminDb()
    const dbClient = adminDb || supabase

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    let profile: ProfileRow | null = null

    if (adminDb) {
      const { data } = await adminDb.from("profiles").select("id, role, membership, is_premium, coins").eq("id", user.id).maybeSingle()
      profile = data as ProfileRow | null
    }

    if (!profile) {
      const { data, error } = await supabase.from("profiles").select("id, role, membership, is_premium, coins").eq("id", user.id).maybeSingle()
      if (error) return NextResponse.json({ error: "Failed to read user coins", details: error.message }, { status: 500 })
      profile = data as ProfileRow | null
    }

    if (!profile) return NextResponse.json({ error: "User profile not found" }, { status: 404 })

    const membershipLevel = normalizeMembership(profile)
    const userCoins = Number(profile.coins || 0)

    const baseFileQuery = supabase.from("files").select("id, title, slug, visibility, status, downloads_count, monetization_enabled")
    const { data: fileData, error: fileError } = isUuid(fileId)
      ? await baseFileQuery.eq("id", fileId).maybeSingle()
      : await baseFileQuery.eq("slug", fileId).maybeSingle()

    if (fileError) return NextResponse.json({ error: "Failed to read file record", details: fileError.message }, { status: 500 })
    if (!fileData) return NextResponse.json({ error: "File row not found" }, { status: 404 })

    const fileOnly = fileData as FileRow
    const realFileId = fileOnly.id
    const downloadCoinCost = getDownloadCoinCost(membershipLevel, fileOnly)

    if (fileOnly.status !== "published") {
      return NextResponse.json({ error: `File is not published. Current status: ${fileOnly.status}` }, { status: 404 })
    }

    const { data: versionsData, error: versionsError } = await supabase
      .from("file_versions")
      .select("id, file_id, object_key, bucket_name, archive_type, mime_type, file_size_bytes, is_current")
      .eq("file_id", realFileId)
      .order("is_current", { ascending: false })

    if (versionsError) return NextResponse.json({ error: "Failed to read file versions", details: versionsError.message }, { status: 500 })
    if (!versionsData?.length) return NextResponse.json({ error: "No file_versions rows found for this file" }, { status: 404 })

    const versions = versionsData as FileVersionRow[]
    const currentVersion = versions.find((v) => v.is_current) || versions[0]

    if (!currentVersion?.object_key?.trim()) {
      return NextResponse.json({ error: "No valid current file version found" }, { status: 404 })
    }

    const visibility = (fileOnly.visibility || "free").toLowerCase() as "free" | "premium" | "platinum" | "private"
    let allowed = false

    switch (visibility) {
      case "free": allowed = true; break
      case "premium": allowed = ["premium", "platinum", "admin"].includes(membershipLevel); break
      case "platinum": allowed = ["platinum", "admin"].includes(membershipLevel); break
      case "private": allowed = membershipLevel === "admin"; break
    }

    if (!allowed) {
      await dbClient.from("download_logs").insert({
        user_id: user.id, file_id: realFileId, file_version_id: currentVersion.id,
        result: "denied", ip_address: getClientIp(req), user_agent: req.headers.get("user-agent"),
      })

      const errorMsg = visibility === "platinum" ? "Platinum membership required" : visibility === "premium" ? "Premium membership required" : "You do not have access to this file"
      return NextResponse.json({ error: errorMsg }, { status: 403 })
    }

    if (downloadCoinCost > 0 && userCoins < downloadCoinCost) {
      await dbClient.from("download_logs").insert({
        user_id: user.id, file_id: realFileId, file_version_id: currentVersion.id,
        result: "insufficient_coins", ip_address: getClientIp(req), user_agent: req.headers.get("user-agent"),
      })

      return NextResponse.json({ error: "Not enough JB Coins", requiredCoins: downloadCoinCost, currentCoins: userCoins }, { status: 402 })
    }

    if (downloadCoinCost > 0) {
      if (!adminDb) return NextResponse.json({ error: "Coin system unavailable. Missing service role config." }, { status: 500 })

      let deducted = false

      const { error: spendError } = await adminDb.rpc("handle_coin_change", {
        p_user_id: user.id,
        p_amount: -downloadCoinCost,
        p_type: "download_spend",
        p_description: `Download spend for ${fileOnly.title || fileOnly.slug || realFileId}`,
        p_reference: `download_spend:${user.id}:${realFileId}:${Date.now()}`,
      })

      if (!spendError) {
        deducted = true
      } else {
        const newBalance = userCoins - downloadCoinCost
        if (newBalance >= 0) {
          const { error: updateError } = await adminDb
            .from("profiles")
            .update({ coins: newBalance })
            .eq("id", user.id)

          if (!updateError) deducted = true
        }
      }

      if (!deducted) {
        return NextResponse.json({ error: "Failed to deduct JB Coins. Please try again." }, { status: 500 })
      }
    }

    const safeFilename = buildSafeFilename(fileOnly, currentVersion)
    const signedUrl = await getSignedDownloadUrl({
      key: currentVersion.object_key.trim(),
      bucket: currentVersion.bucket_name?.trim() || undefined,
      expiresInSeconds: 300,
      downloadFilename: safeFilename,
    })

    const { error: logError } = await dbClient.from("download_logs").insert({
      user_id: user.id,
      file_id: realFileId,
      file_version_id: currentVersion.id,
      result: "success",
      ip_address: getClientIp(req),
      user_agent: req.headers.get("user-agent"),
    })

    if (logError) {
      console.error("Error writing download_log:", logError.message)
    }

    try {
      await dbClient.rpc('increment_downloads_count', { row_id: realFileId })
    } catch {
      await dbClient.from("files").update({ downloads_count: (fileOnly.downloads_count || 0) + 1 }).eq("id", realFileId)
    }

    if (mode === "json") {
      return NextResponse.json({
        downloadUrl: signedUrl,
        coinsUsed: downloadCoinCost,
      })
    }

    return NextResponse.redirect(signedUrl, { status: 302 })

  } catch (error) {
    console.error("Download route error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ fileId: string }> }) {
  return GET(req, context)
}