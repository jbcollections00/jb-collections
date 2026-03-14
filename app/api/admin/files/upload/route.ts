import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getSignedDownloadUrl } from "@/lib/r2"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const fileId = searchParams.get("id")

    if (!fileId) {
      return NextResponse.json({ error: "Missing file id." }, { status: 400 })
    }

    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set() {},
          remove() {},
        },
      }
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    const { data: file, error: fileError } = await supabase
      .from("files")
      .select(`
        id,
        title,
        visibility,
        status,
        downloads_count,
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

    if (fileError || !file) {
      return NextResponse.json({ error: "File not found." }, { status: 404 })
    }

    const currentVersion = Array.isArray(file.file_versions)
      ? file.file_versions[0]
      : file.file_versions

    if (!currentVersion?.object_key) {
      return NextResponse.json(
        { error: "No active file version found for download." },
        { status: 404 }
      )
    }

    const isPremiumFile = file.visibility === "premium"

    if (isPremiumFile) {
      if (!user) {
        return NextResponse.redirect(new URL("/login", req.url))
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_premium, role")
        .eq("id", user.id)
        .single()

      const isAllowed = Boolean(profile?.is_premium) || profile?.role === "admin"

      if (profileError || !isAllowed) {
        return NextResponse.redirect(new URL("/profile", req.url))
      }
    }

    let signedUrl: string

    try {
      signedUrl = await getSignedDownloadUrl({
        key: currentVersion.object_key,
        bucket: currentVersion.bucket_name || undefined,
        expiresInSeconds: 60 * 5,
        downloadFilename: file.title || "download",
      })
    } catch (signError) {
      console.error("SIGNED URL ERROR:", signError)

      return NextResponse.json(
        { error: "Could not generate download URL." },
        { status: 500 }
      )
    }

    const currentCount = file.downloads_count ?? 0

    await supabase
      .from("files")
      .update({ downloads_count: currentCount + 1 })
      .eq("id", file.id)

    return NextResponse.redirect(signedUrl)
  } catch (error) {
    console.error("DOWNLOAD ROUTE ERROR:", error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Download failed.",
      },
      { status: 500 }
    )
  }
}