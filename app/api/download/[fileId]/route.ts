import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getSignedDownloadUrl } from "@/lib/r2"

type RouteContext = {
  params: {
    fileId: string
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { fileId } = context.params
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    const currentVersion = Array.isArray(fileRow.file_versions)
      ? fileRow.file_versions[0]
      : null

    if (!currentVersion) {
      return NextResponse.json(
        { error: "No active file version found" },
        { status: 404 }
      )
    }

    let allowed = false

    if (fileRow.visibility === "free") {
      allowed = true
    } else {
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("id, status, current_period_end")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("current_period_end", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!subError && subscription) {
        if (
          !subscription.current_period_end ||
          new Date(subscription.current_period_end).getTime() > Date.now()
        ) {
          allowed = true
        }
      }
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
        { error: "Subscription required" },
        { status: 403 }
      )
    }

    const extension =
      currentVersion.archive_type?.trim()?.toLowerCase() || "zip"

    const baseName = (fileRow.slug || fileRow.id)
      .toString()
      .replace(/[^a-zA-Z0-9-_]/g, "_")

    const safeFilename = `${baseName}.${extension}`

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
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}