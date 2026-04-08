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
}

type FileRow = {
  id: string
  title?: string | null
  slug?: string | null
  visibility?: "free" | "premium" | "platinum" | "private" | null
  status?: string | null
  downloads_count?: number | null
}

type FileVersionRow = {
  id: string
  file_id: string
  object_key?: string | null
  bucket_name?: string | null
  archive_type?: string | null
  is_current?: boolean | null
}

function normalizeSiteUrl(url: string) {
  return url.trim().replace(/\/$/, "")
}

function normalizeMembership(profile?: ProfileRow | null): MembershipLevel {
  const role = String(profile?.role || "").toLowerCase()
  const membership = String(profile?.membership || "").toLowerCase()

  if (role === "admin") return "admin"
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  if (profile?.is_premium) return "premium"
  return "standard"
}

function buildSafeFilename(file: FileRow, version: FileVersionRow) {
  const extension = version.archive_type?.toLowerCase() || "zip"
  const base = (file.slug || file.title || file.id || "download")
    .replace(/[^a-zA-Z0-9-_]/g, "_")

  return `${base}.${extension}`
}

function getClientIp(req: NextRequest) {
  const f = req.headers.get("x-forwarded-for")
  return f?.split(",")[0] || null
}

// 🔥 NEW CENTRALIZED COIN SYSTEM
async function awardDownloadCoins({
  userId,
  fileId,
  fileTitle,
  membershipLevel,
}: {
  userId: string
  fileId: string
  fileTitle: string
  membershipLevel: MembershipLevel
}) {
  if (membershipLevel === "admin") {
    return { awarded: 0 }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return { awarded: 0 }
  }

  const admin = createSupabaseAdmin(supabaseUrl, serviceRoleKey)

  const reward = 5

  // ✅ LIMIT: 20 per day
  const { data: allowed } = await admin.rpc("check_coin_limit", {
    p_user_id: userId,
    p_action: "download_reward",
    p_limit: 20,
  })

  if (!allowed) {
    return { awarded: 0 }
  }

  // ✅ PREVENT SAME FILE SPAM
  const today = new Date().toISOString().slice(0, 10)

  const { data: existing } = await admin
    .from("download_rewards")
    .select("id")
    .eq("user_id", userId)
    .eq("file_id", fileId)
    .eq("reward_date", today)
    .maybeSingle()

  if (existing) {
    return { awarded: 0 }
  }

  await admin.from("download_rewards").insert({
    user_id: userId,
    file_id: fileId,
    reward_date: today,
  })

  // ✅ ADD COINS + HISTORY
  await admin.rpc("handle_coin_change", {
    p_user_id: userId,
    p_amount: reward,
    p_type: "download_reward",
    p_description: `Download reward for ${fileTitle}`,
  })

  return { awarded: reward }
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
    const allowedHost = normalizeSiteUrl(
      process.env.NEXT_PUBLIC_SITE_URL || ""
    )

    if (allowedHost && referer && !referer.startsWith(allowedHost)) {
      return NextResponse.json(
        { error: "Direct download not allowed" },
        { status: 403 }
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()

    const membershipLevel = normalizeMembership(profile)

    const { data: file } = await supabase
      .from("files")
      .select("*")
      .eq("id", fileId)
      .maybeSingle()

    if (!file || file.status !== "published") {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const { data: versions } = await supabase
      .from("file_versions")
      .select("*")
      .eq("file_id", fileId)
      .order("is_current", { ascending: false })

    const current = versions?.find(v => v.is_current) || versions?.[0]

    if (!current || !current.object_key) {
      return NextResponse.json({ error: "File missing" }, { status: 404 })
    }

    const visibility = file.visibility || "free"

    const allowed =
      membershipLevel === "admin" ||
      visibility === "free" ||
      (visibility === "premium" && membershipLevel !== "standard") ||
      (visibility === "platinum" &&
        (membershipLevel === "platinum" || membershipLevel === "admin"))

    if (!allowed) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const filename = buildSafeFilename(file, current)

    const url = await getSignedDownloadUrl({
      key: current.object_key,
      bucket: current.bucket_name,
      expiresInSeconds: 60,
      downloadFilename: filename,
    })

    await supabase.from("download_logs").insert({
      user_id: user.id,
      file_id: file.id,
      file_version_id: current.id,
      result: "success",
      ip_address: getClientIp(req),
      user_agent: req.headers.get("user-agent"),
    })

    await supabase
      .from("files")
      .update({ downloads_count: (file.downloads_count || 0) + 1 })
      .eq("id", file.id)

    // 🔥 COIN REWARD
    await awardDownloadCoins({
      userId: user.id,
      fileId: file.id,
      fileTitle: file.title || file.slug || file.id,
      membershipLevel,
    })

    return NextResponse.redirect(url, { status: 302 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}