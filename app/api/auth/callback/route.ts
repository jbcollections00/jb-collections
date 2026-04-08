import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const next = url.searchParams.get("next") || "/dashboard"

  const cookieStore = cookies()

  const response = NextResponse.redirect(new URL(next, req.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: "", ...options, maxAge: 0 })
        },
      },
    }
  )

  // 🔥 THIS LINE FIXES EVERYTHING
  await supabase.auth.getUser()

  return response
}