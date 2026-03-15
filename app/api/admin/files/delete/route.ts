import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const fileId = String(body?.fileId || "").trim()

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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: fileRow, error: fileError } = await supabase
      .from("files")
      .select(
        `
        id,
        file_versions (
          id,
          object_key,
          bucket_name,
          is_current
        )
      `
      )
      .eq("id", fileId)
      .single()

    if (fileError || !fileRow) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const versions = Array.isArray(fileRow.file_versions)
      ? fileRow.file_versions
      : []

    for (const version of versions) {
      if (!version?.object_key) continue

      try {
        // If you also have an R2 delete helper later, replace this section with that.
        // For now we safely continue even if physical object deletion is not implemented yet.
        console.log(
          "TODO: delete R2 object:",
          version.object_key,
          "bucket:",
          version.bucket_name || "(default)"
        )
      } catch (storageError) {
        console.error("Failed to delete storage object:", storageError)
      }
    }

    const { error: versionsDeleteError } = await supabase
      .from("file_versions")
      .delete()
      .eq("file_id", fileId)

    if (versionsDeleteError) {
      return NextResponse.json(
        { error: versionsDeleteError.message || "Failed to delete file versions" },
        { status: 500 }
      )
    }

    const { error: logsDeleteError } = await supabase
      .from("download_logs")
      .delete()
      .eq("file_id", fileId)

    if (logsDeleteError) {
      console.error("Failed to delete download logs:", logsDeleteError)
    }

    const { error: fileDeleteError } = await supabase
      .from("files")
      .delete()
      .eq("id", fileId)

    if (fileDeleteError) {
      return NextResponse.json(
        { error: fileDeleteError.message || "Failed to delete file" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin file delete route error:", error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}