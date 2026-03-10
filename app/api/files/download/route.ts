import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

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
      .select("id, file_url, is_premium, downloads_count")
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
        .select("is_premium")
        .eq("id", user.id)
        .single()

      if (profileError || !profile?.is_premium) {
        return NextResponse.redirect(new URL("/upgrade", req.url))
      }
    }

    const currentCount = file.downloads_count ?? 0
    await supabase
      .from("files")
      .update({ downloads_count: currentCount + 1 })
      .eq("id", file.id)

    return NextResponse.redirect(file.file_url)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Download failed.",
      },
      { status: 500 }
    )
  }
}