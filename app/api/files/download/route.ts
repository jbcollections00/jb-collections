import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { getSignedDownloadUrl } from "@/lib/r2"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const fileId = searchParams.get("id")

    if (!fileId) {
      return NextResponse.json({ error: "Missing file id." }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: fileRow, error: fileError } = await supabase
      .from("files")
      .select(`
        id,
        title,
        status,
        visibility,
        file_versions (
          object_key,
          bucket_name,
          is_current
        )
      `)
      .eq("id", fileId)
      .eq("status", "published")
      .single()

    if (fileError || !fileRow) {
      return NextResponse.json({ error: "File not found." }, { status: 404 })
    }

    const version = fileRow.file_versions?.find((v: any) => v.is_current)

    if (!version) {
      return NextResponse.json(
        { error: "Download URL not available." },
        { status: 500 }
      )
    }

    const signedUrl = await getSignedDownloadUrl({
      key: version.object_key,
      bucket: version.bucket_name,
      downloadFilename: fileRow.title,
    })

    return NextResponse.redirect(signedUrl)
  } catch (error) {
    console.error("Download error:", error)

    return NextResponse.json(
      { error: "Download URL not available." },
      { status: 500 }
    )
  }
}