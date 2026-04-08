import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin

  try {
    const formData = await req.formData()

    const email = String(formData.get("email") || "").trim().toLowerCase()
    const password = String(formData.get("password") || "")

    if (!email || !password) {
      return NextResponse.redirect(`${origin}/login?error=missing-fields`, {
        status: 303,
      })
    }

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

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.user) {
      console.error("Login failed:", error)
      return NextResponse.redirect(`${origin}/login?error=invalid-login`, {
        status: 303,
      })
    }

    return response
  } catch (error) {
    console.error("Login route error:", error)
    return NextResponse.redirect(`${origin}/login?error=server-error`, {
      status: 303,
    })
  }
}