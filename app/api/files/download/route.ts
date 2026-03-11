import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { r2 } from "@/lib/r2"

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
      .select("id, title, file_url, storage_key, is_premium, downloads_count")
      .eq("id", fileId)
      .single()

    if (fileError || !file) {
      return NextResponse.json({ error: "File not found." }, { status: 404 })
    }

    if (file.is_premium) {
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

    const currentCount = file.downloads_count ?? 0

    await supabase
      .from("files")
      .update({ downloads_count: currentCount + 1 })
      .eq("id", file.id)

    if (file.storage_key) {
      const signedUrl = await getSignedUrl(
        r2,
        new GetObjectCommand({
          Bucket: process.env.R2_BUCKET!,
          Key: file.storage_key,
          ResponseContentDisposition: `attachment; filename="${(file.title || "download").replace(/"/g, "")}"`,
        }),
        { expiresIn: 60 * 5 }
      )

      return NextResponse.redirect(signedUrl)
    }

    if (file.file_url) {
      return NextResponse.redirect(file.file_url)
    }

    return NextResponse.json({ error: "Download URL not available." }, { status: 404 })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Download failed.",
      },
      { status: 500 }
    )
  }
}