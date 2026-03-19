import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getSignedDownloadUrl } from "@/lib/r2"

export const runtime = "nodejs"

type ProfileRow = {
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

function normalizeMembership(value?: string | null) {
  const membership = String(value || "").trim().toLowerCase()
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  return "standard"
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
      .select("role, membership, is_premium")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("Profile fetch error:", profileError)
    }

    const profile = profileData as ProfileRow | null
    const membership = normalizeMembership(profile?.membership)
    const isAdmin = profile?.role === "admin"
    const isPremiumUser =
      isAdmin ||
      profile?.is_premium === true ||
      membership === "premium" ||
      membership === "platinum"
    const isPlatinumUser = isAdmin || membership === "platinum"

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