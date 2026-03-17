import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getSignedDownloadUrl } from "@/lib/r2"

export const runtime = "nodejs"

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
    const allowedHost = String(process.env.NEXT_PUBLIC_SITE_URL || "")
      .trim()
      .replace(/\/$/, "")

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, membership, is_premium")
      .eq("id", user.id)
      .maybeSingle()

    const isAdmin = profile?.role === "admin"
    const isPremiumUser =
      profile?.is_premium === true || profile?.membership === "premium"

    const { data: fileOnly, error: fileOnlyError } = await supabase
      .from("files")
      .select("id, title, slug, visibility, status, downloads_count")
      .eq("id", fileId)
      .maybeSingle()

    if (fileOnlyError) {
      return NextResponse.json(
        { error: "Failed to read file record", details: fileOnlyError.message },
        { status: 500 }
      )
    }

    if (!fileOnly) {
      return NextResponse.json({ error: "File row not found" }, { status: 404 })
    }

    if (fileOnly.status !== "published") {
      return NextResponse.json(
        { error: `File is not published. Current status: ${fileOnly.status}` },
        { status: 404 }
      )
    }

    const { data: versions, error: versionsError } = await supabase
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

    if (!versions || versions.length === 0) {
      return NextResponse.json(
        { error: "No file_versions rows found for this file" },
        { status: 404 }
      )
    }

    const currentVersion = versions.find((v) => v.is_current === true)

    if (!currentVersion) {
      return NextResponse.json(
        { error: "No current file version found. Set is_current=true on one version." },
        { status: 404 }
      )
    }

    if (!currentVersion.object_key) {
      return NextResponse.json(
        { error: "Current version is missing object_key" },
        { status: 404 }
      )
    }

    let allowed = false
    const visibility = (fileOnly.visibility || "free").toLowerCase()

    if (isAdmin) {
      allowed = true
    } else if (visibility === "free") {
      allowed = true
    } else if (visibility === "premium") {
      allowed = true
    } else if (visibility === "private") {
      allowed = false
    }

    if (!allowed) {
      await supabase.from("download_logs").insert({
        user_id: user.id,
        file_id: fileOnly.id,
        file_version_id: currentVersion.id,
        result: "denied",
        ip_address: req.headers.get("x-forwarded-for"),
        user_agent: req.headers.get("user-agent"),
      })

      return NextResponse.json(
        { error: "You do not have access to this file" },
        { status: 403 }
      )
    }

    const extension =
      currentVersion.archive_type?.trim()?.toLowerCase() || "zip"

    const baseName = (fileOnly.slug || fileOnly.title || fileOnly.id)
      .toString()
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")

    const safeFilename = `${baseName || "download"}.${extension}`

    const signedUrl = await getSignedDownloadUrl({
      key: currentVersion.object_key,
      bucket: currentVersion.bucket_name || undefined,
      expiresInSeconds: 60,
      downloadFilename: safeFilename,
    })

    await supabase.from("download_logs").insert({
      user_id: user.id,
      file_id: fileOnly.id,
      file_version_id: currentVersion.id,
      result: "success",
      ip_address: req.headers.get("x-forwarded-for"),
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