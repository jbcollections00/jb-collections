import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin

  try {
    const formData = await req.formData()

    const fullName = String(formData.get("fullName") || "").trim()
    const email = String(formData.get("email") || "").trim().toLowerCase()
    const password = String(formData.get("password") || "")
    const confirmPassword = String(formData.get("confirmPassword") || "")

    if (!fullName || !email || !password || !confirmPassword) {
      return NextResponse.redirect(`${origin}/signup?error=missing-fields`, 303)
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!emailValid) {
      return NextResponse.redirect(`${origin}/signup?error=invalid-email`, 303)
    }

    if (password.length < 6) {
      return NextResponse.redirect(`${origin}/signup?error=password-too-short`, 303)
    }

    if (password !== confirmPassword) {
      return NextResponse.redirect(`${origin}/signup?error=password-mismatch`, 303)
    }

    const cookieStore = await cookies()

    const response = NextResponse.redirect(
      `${origin}/login?message=check-email`,
      { status: 303 }
    )

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

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
          full_name: fullName,
          name: fullName,
        },
      },
    })

    if (signUpError) {
      const message = signUpError.message.toLowerCase()

      if (
        message.includes("already registered") ||
        message.includes("already been registered") ||
        message.includes("user already registered")
      ) {
        return NextResponse.redirect(`${origin}/signup?error=email-exists`, 303)
      }

      return NextResponse.redirect(`${origin}/signup?error=failed`, 303)
    }

    const newUser = signUpData.user

    if (newUser?.id) {
      const username =
        email.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "") || null

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: newUser.id,
            email: newUser.email ?? email,
            full_name: fullName,
            name: fullName,
            username,
            membership: "free",
            account_status: "active",
            status: "active",
            is_premium: false,
            role: "user",
          },
          {
            onConflict: "id",
          }
        )

      if (profileError) {
        console.error("Profile creation error:", profileError)
      }
    }

    return response
  } catch (error) {
    console.error("Signup route error:", error)
    return NextResponse.redirect(
      `${new URL(req.url).origin}/signup?error=failed`,
      303
    )
  }
}