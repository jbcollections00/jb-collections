import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getSignedDownloadUrl } from "@/lib/r2"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

type MembershipLevel = "standard" | "premium" | "platinum" | "admin"

type ProfileRow = {
  id?: string
  role?: string | null
  membership?: string | null
  is_premium?: boolean | null
  jb_points?: number | null
}

type FileRow = {
  id: string
  title?: string | null
  slug?: string | null
  visibility?: "free" | "premium" | "platinum" | "private" | null
  status?: string | null
  downloads_count?: number | null
  linkvertise_url?: string | null
  shrinkme_url?: string | null
  monetization_enabled?: boolean | null
}

type FileVersionRow = {
  id: string
  file_id: string
  object_key?: string | null
  bucket_name?: string | null
  archive_type?: string | null
  mime_type?: string | null
  file_size_bytes?: number | null
  is_current?: boolean | null
}

function normalizeSiteUrl(url: string) {
  return url.trim().replace(/\/$/, "")
}

function normalizeMembership(profile?: ProfileRow | null): MembershipLevel {
  const role = String(profile?.role || "").trim().toLowerCase()
  const membership = String(profile?.membership || "").trim().toLowerCase()

  if (role === "admin") return "admin"
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  if (profile?.is_premium) return "premium"
  return "standard"
}

function getDailyDownloadCoinCap(level: MembershipLevel) {
  if (level === "platinum") return 1500
  if (level === "premium") return 1000
  if (level === "admin") return 0
  return 50
}

function buildSafeFilename(file: FileRow, version: FileVersionRow) {
  const extension = version.archive_type?.trim()?.toLowerCase() || "zip"

  const baseName = (file.slug || file.title || file.id || "download")
    .toString()
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")

  return `${baseName || "download"}.${extension}`
}

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for")
  if (!forwardedFor) return null
  return forwardedFor.split(",")[0]?.trim() || null
}

function getTodayBoundsInManila() {
  const now = new Date()

  const manilaDateString = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)

  const startIso = `${manilaDateString}T00:00:00+08:00`

  const nextDay = new Date(`${manilaDateString}T00:00:00+08:00`)
  nextDay.setDate(nextDay.getDate() + 1)

  const nextDayString = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nextDay)

  const endIso = `${nextDayString}T00:00:00+08:00`

  return { startIso, endIso }
}

async function awardDownloadCoins(params: {
  userId: string
  fileId: string
  fileTitle: string
  membershipLevel: MembershipLevel
}) {
  const { userId, fileId, fileTitle, membershipLevel } = params

  if (membershipLevel === "admin") {
    return { awarded: 0, reason: "admin_skipped" as const }
  }

  const dailyCap = getDailyDownloadCoinCap(membershipLevel)
  const rewardAmount = 5

  if (dailyCap <= 0) {
    return { awarded: 0, reason: "cap_disabled" as const }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("Download coin reward skipped: missing service role env vars.")
    return { awarded: 0, reason: "missing_env" as const }
  }

  const adminDb = createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { startIso, endIso } = getTodayBoundsInManila()

  const { data: existingRewardRows, error: existingRewardError } = await adminDb
    .from("jb_coin_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("file_id", fileId)
    .eq("action_type", "download_reward")
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .limit(1)

  if (existingRewardError) {
    throw new Error(existingRewardError.message || "Failed checking existing reward.")
  }

  if (Array.isArray(existingRewardRows) && existingRewardRows.length > 0) {
    return { awarded: 0, reason: "already_rewarded_today" as const }
  }

  const { data: todayRewardRows, error: todayRewardError } = await adminDb
    .from("jb_coin_transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("action_type", "download_reward")
    .gte("created_at", startIso)
    .lt("created_at", endIso)

  if (todayRewardError) {
    throw new Error(todayRewardError.message || "Failed checking daily reward cap.")
  }

  const earnedToday = Array.isArray(todayRewardRows)
    ? todayRewardRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    : 0

  if (earnedToday >= dailyCap) {
    return { awarded: 0, reason: "daily_cap_reached" as const }
  }

  const remainingToday = dailyCap - earnedToday
  const finalReward = Math.min(rewardAmount, remainingToday)

  if (finalReward <= 0) {
    return { awarded: 0, reason: "no_remaining_reward" as const }
  }

  const description = `Download reward for ${fileTitle || fileId}`

  const { data: insertedTx, error: insertTxError } = await adminDb
    .from("jb_coin_transactions")
    .insert({
      user_id: userId,
      file_id: fileId,
      amount: finalReward,
      action_type: "download_reward",
      description,
    })
    .select("id")
    .single()

  if (insertTxError) {
    if ((insertTxError as { code?: string }).code === "23505") {
      return { awarded: 0, reason: "already_rewarded_today" as const }
    }

    throw new Error(insertTxError.message || "Failed creating coin transaction.")
  }

  const insertedTxId = insertedTx?.id

  const { data: latestProfile, error: latestProfileError } = await adminDb
    .from("profiles")
    .select("jb_points")
    .eq("id", userId)
    .single()

  if (latestProfileError) {
    if (insertedTxId) {
      await adminDb.from("jb_coin_transactions").delete().eq("id", insertedTxId)
    }
    throw new Error(latestProfileError.message || "Failed reading latest profile.")
  }

  const nextCoins = Number(latestProfile?.jb_points || 0) + finalReward

  const { error: updateProfileError } = await adminDb
    .from("profiles")
    .update({
      jb_points: nextCoins,
    })
    .eq("id", userId)

  if (updateProfileError) {
    if (insertedTxId) {
      await adminDb.from("jb_coin_transactions").delete().eq("id", insertedTxId)
    }
    throw new Error(updateProfileError.message || "Failed updating JB Coins.")
  }

  return { awarded: finalReward, reason: "awarded" as const }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await context.params

    if (!fileId) {
      return NextResponse.json({ error: "Missing file id" }, { status: 400 })
    }

    const referer = req.headers.get("referer") || ""
    const allowedHost = normalizeSiteUrl(String(process.env.NEXT_PUBLIC_SITE_URL || ""))

    if (allowedHost && referer) {
      const normalizedReferer = referer.replace(/\/$/, "")
      if (!normalizedReferer.startsWith(allowedHost)) {
        return NextResponse.json(
          { error: "Direct download not allowed" },
          { status: 403 }
        )
      }
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, membership, is_premium, jb_points")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("Profile fetch error:", profileError)
    }

    const profile = profileData as ProfileRow | null
    const membershipLevel = normalizeMembership(profile)
    const isAdmin = membershipLevel === "admin"
    const isPremiumUser =
      membershipLevel === "admin" ||
      membershipLevel === "premium" ||
      membershipLevel === "platinum"
    const isPlatinumUser =
      membershipLevel === "admin" || membershipLevel === "platinum"

    const { data: fileData, error: fileError } = await supabase
      .from("files")
      .select(
        "id, title, slug, visibility, status, downloads_count, linkvertise_url, shrinkme_url, monetization_enabled"
      )
      .eq("id", fileId)
      .maybeSingle()

    if (fileError) {
      return NextResponse.json(
        { error: "Failed to read file record", details: fileError.message },
        { status: 500 }
      )
    }

    if (!fileData) {
      return NextResponse.json({ error: "File row not found" }, { status: 404 })
    }

    const fileOnly = fileData as FileRow

    if (fileOnly.status !== "published") {
      return NextResponse.json(
        { error: `File is not published. Current status: ${fileOnly.status}` },
        { status: 404 }
      )
    }

    const { data: versionsData, error: versionsError } = await supabase
      .from("file_versions")
      .select(
        "id, file_id, object_key, bucket_name, archive_type, mime_type, file_size_bytes, is_current"
      )
      .eq("file_id", fileId)
      .order("is_current", { ascending: false })

    if (versionsError) {
      return NextResponse.json(
        { error: "Failed to read file versions", details: versionsError.message },
        { status: 500 }
      )
    }

    if (!versionsData || versionsData.length === 0) {
      return NextResponse.json(
        { error: "No file_versions rows found for this file" },
        { status: 404 }
      )
    }

    const versions = versionsData as FileVersionRow[]
    const currentVersion =
      versions.find((v) => v.is_current === true) || versions[0] || null

    if (!currentVersion) {
      return NextResponse.json(
        { error: "No current file version found." },
        { status: 404 }
      )
    }

    if (!currentVersion.object_key?.trim()) {
      return NextResponse.json(
        { error: "Current version is missing object_key" },
        { status: 404 }
      )
    }

    const visibility = (fileOnly.visibility || "free").toLowerCase()

    let allowed = false

    if (isAdmin) {
      allowed = true
    } else if (visibility === "free") {
      allowed = true
    } else if (visibility === "premium") {
      allowed = isPremiumUser
    } else if (visibility === "platinum") {
      allowed = isPlatinumUser
    } else if (visibility === "private") {
      allowed = false
    }

    if (!allowed) {
      await supabase.from("download_logs").insert({
        user_id: user.id,
        file_id: fileOnly.id,
        file_version_id: currentVersion.id,
        result: "denied",
        ip_address: getClientIp(req),
        user_agent: req.headers.get("user-agent"),
      })

      return NextResponse.json(
        {
          error:
            visibility === "platinum"
              ? "Platinum membership required"
              : visibility === "premium"
                ? "Premium membership required"
                : "You do not have access to this file",
        },
        { status: 403 }
      )
    }

    const safeFilename = buildSafeFilename(fileOnly, currentVersion)

    const signedUrl = await getSignedDownloadUrl({
      key: currentVersion.object_key.trim(),
      bucket: currentVersion.bucket_name?.trim() || undefined,
      expiresInSeconds: 60,
      downloadFilename: safeFilename,
    })

    await supabase.from("download_logs").insert({
      user_id: user.id,
      file_id: fileOnly.id,
      file_version_id: currentVersion.id,
      result: "success",
      ip_address: getClientIp(req),
      user_agent: req.headers.get("user-agent"),
    })

    await supabase
      .from("files")
      .update({
        downloads_count: (fileOnly.downloads_count || 0) + 1,
      })
      .eq("id", fileOnly.id)

    try {
      const rewardResult = await awardDownloadCoins({
        userId: user.id,
        fileId: fileOnly.id,
        fileTitle: fileOnly.title || fileOnly.slug || fileOnly.id,
        membershipLevel,
      })

      console.log("Download coin reward result:", rewardResult)
    } catch (rewardError) {
      console.error("Download coin reward error:", rewardError)
    }

    return NextResponse.redirect(signedUrl, { status: 302 })
  } catch (error) {
    console.error("Download route error:", error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}