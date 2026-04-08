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
  coins?: number | null
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

function getDailyDownloadRewardLimit(level: MembershipLevel) {
  if (level === "admin") return 0
  if (level === "platinum") return 50
  if (level === "premium") return 35
  return 20
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

function getTodayManilaDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
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

  const rewardAmount = 5
  const dailyLimit = getDailyDownloadRewardLimit(membershipLevel)

  if (dailyLimit <= 0) {
    return { awarded: 0, reason: "limit_disabled" as const }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("Download reward skipped: missing service role env vars.")
    return { awarded: 0, reason: "missing_env" as const }
  }

  const adminDb = createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const rewardDate = getTodayManilaDateString()

  const { data: allowed, error: limitError } = await adminDb.rpc("check_coin_limit", {
    p_user_id: userId,
    p_action: "download_reward",
    p_limit: dailyLimit,
  })

  if (limitError) {
    throw new Error(limitError.message || "Failed checking daily download reward limit.")
  }

  if (!allowed) {
    return { awarded: 0, reason: "daily_limit_reached" as const }
  }

  const { data: existingReward, error: existingRewardError } = await adminDb
    .from("download_rewards")
    .select("id")
    .eq("user_id", userId)
    .eq("file_id", fileId)
    .eq("reward_date", rewardDate)
    .maybeSingle()

  if (existingRewardError) {
    throw new Error(existingRewardError.message || "Failed checking existing file reward.")
  }

  if (existingReward) {
    return { awarded: 0, reason: "already_rewarded_today" as const }
  }

  const { error: insertRewardError } = await adminDb.from("download_rewards").insert({
    user_id: userId,
    file_id: fileId,
    reward_date: rewardDate,
  })

  if (insertRewardError) {
    if ((insertRewardError as { code?: string }).code === "23505") {
      return { awarded: 0, reason: "already_rewarded_today" as const }
    }

    throw new Error(insertRewardError.message || "Failed creating download reward marker.")
  }

  const { error: coinError } = await adminDb.rpc("handle_coin_change", {
    p_user_id: userId,
    p_amount: rewardAmount,
    p_type: "download_reward",
    p_description: `Download reward for ${fileTitle || fileId}`,
  })

  if (coinError) {
    await adminDb
      .from("download_rewards")
      .delete()
      .eq("user_id", userId)
      .eq("file_id", fileId)
      .eq("reward_date", rewardDate)

    throw new Error(coinError.message || "Failed rewarding download coins.")
  }

  return { awarded: rewardAmount, reason: "awarded" as const }
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
      .select("id, role, membership, is_premium, coins")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("Profile fetch error:", profileError)
    }

    const profile = profileData as ProfileRow | null
    const membershipLevel = normalizeMembership(profile)

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

    const visibility = (fileOnly.visibility || "free").toLowerCase() as
      | "free"
      | "premium"
      | "platinum"
      | "private"

    let allowed = false

    switch (visibility) {
      case "free":
        allowed = true
        break
      case "premium":
        allowed =
          membershipLevel === "premium" ||
          membershipLevel === "platinum" ||
          membershipLevel === "admin"
        break
      case "platinum":
        allowed =
          membershipLevel === "platinum" ||
          membershipLevel === "admin"
        break
      case "private":
        allowed = membershipLevel === "admin"
        break
      default:
        allowed = false
        break
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