import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin

  try {
    const cookieStore = await cookies()

    const response = NextResponse.redirect(`${origin}/dashboard`, {
      status: 303,
    })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: Record<string, any>) {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: Record<string, any>) {
            response.cookies.set({
              name,
              value: "",
              ...options,
              maxAge: 0,
            })
          },
        },
      }
    )

    const code = url.searchParams.get("code")

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error("Callback exchange error:", error)
        return NextResponse.redirect(`${origin}/login?error=callback-failed`, {
          status: 303,
        })
      }
    }

    return response
  } catch (error) {
    console.error("Auth callback error:", error)
    return NextResponse.redirect(`${origin}/login?error=server-error`, {
      status: 303,
    })
  }
}