import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const fullName = String(formData.get("fullName") || "").trim()
    const email = String(formData.get("email") || "").trim()
    const password = String(formData.get("password") || "")
    const confirmPassword = String(formData.get("confirmPassword") || "")

    if (!fullName || !email || !password || !confirmPassword) {
      return NextResponse.redirect(
        new URL("/signup?error=missing-fields", req.url),
        { status: 303 }
      )
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!emailValid) {
      return NextResponse.redirect(
        new URL("/signup?error=invalid-email", req.url),
        { status: 303 }
      )
    }

    if (password.length < 6) {
      return NextResponse.redirect(
        new URL("/signup?error=password-too-short", req.url),
        { status: 303 }
      )
    }

    if (password !== confirmPassword) {
      return NextResponse.redirect(
        new URL("/signup?error=password-mismatch", req.url),
        { status: 303 }
      )
    }

    const cookieStore = await cookies()
    const response = NextResponse.redirect(new URL("/login", req.url), {
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

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      const message = error.message.toLowerCase()

      if (
        message.includes("already registered") ||
        message.includes("already been registered") ||
        message.includes("user already registered")
      ) {
        return NextResponse.redirect(
          new URL("/signup?error=email-exists", req.url),
          { status: 303 }
        )
      }

      return NextResponse.redirect(
        new URL("/signup?error=failed", req.url),
        { status: 303 }
      )
    }

    if (!data.user) {
      return NextResponse.redirect(
        new URL("/signup?error=failed", req.url),
        { status: 303 }
      )
    }

    return response
  } catch (error) {
    console.error("SIGNUP ERROR:", error)

    return NextResponse.redirect(new URL("/signup?error=failed", req.url), {
      status: 303,
    })
  }
}