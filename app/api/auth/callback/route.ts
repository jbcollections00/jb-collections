import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin

  try {
    // ✅ FIX: await cookies()
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: "", ...options })
          },
        },
      }
    )

    const { searchParams } = new URL(req.url)
    const code = searchParams.get("code")

    if (code) {
      await supabase.auth.exchangeCodeForSession(code)
    }

    return NextResponse.redirect(`${origin}/dashboard`)
  } catch (error) {
    console.error("Auth callback error:", error)
    return NextResponse.redirect(`${origin}/login`)
  }
}