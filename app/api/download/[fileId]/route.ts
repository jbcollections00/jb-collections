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

    const { data: fileRow, error: fileError } = await supabase
      .from("files")
      .select(`
        id,
        title,
        slug,
        visibility,
        status,
        file_versions!inner (
          id,
          object_key,
          bucket_name,
          archive_type,
          mime_type,
          file_size_bytes,
          is_current
        )
      `)
      .eq("id", fileId)
      .eq("status", "published")
      .eq("file_versions.is_current", true)
      .single()

    if (fileError || !fileRow) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const currentVersion =
      Array.isArray(fileRow.file_versions) && fileRow.file_versions.length > 0
        ? fileRow.file_versions[0]
        : null

    if (!currentVersion?.object_key) {
      return NextResponse.json(
        { error: "No active file version found" },
        { status: 404 }
      )
    }

    let allowed = false
    const visibility = (fileRow.visibility || "free").toLowerCase()

    if (isAdmin) {
      allowed = true
    } else if (visibility === "free") {
      allowed = true
    } else if (visibility === "premium") {
      allowed = isPremiumUser
    } else if (visibility === "private") {
      allowed = false
    }

    if (!allowed) {
      await supabase.from("download_logs").insert({
        user_id: user.id,
        file_id: fileRow.id,
        file_version_id: currentVersion.id,
        result: "denied",
        user_agent: req.headers.get("user-agent"),
      })

      return NextResponse.json(
        { error: "You do not have access to this file" },
        { status: 403 }
      )
    }

    const extension =
      currentVersion.archive_type?.trim()?.toLowerCase() || "zip"

    const baseName = (fileRow.slug || fileRow.title || fileRow.id)
      .toString()
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")

    const safeFilename = `${baseName || "download"}.${extension}`

    const signedUrl = await getSignedDownloadUrl({
      key: currentVersion.object_key,
      bucket: currentVersion.bucket_name || undefined,
      expiresInSeconds: 120,
      downloadFilename: safeFilename,
    })

    await supabase.from("download_logs").insert({
      user_id: user.id,
      file_id: fileRow.id,
      file_version_id: currentVersion.id,
      result: "success",
      user_agent: req.headers.get("user-agent"),
    })

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