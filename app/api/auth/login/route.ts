import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const email = String(formData.get("email") || "").trim()
    const password = String(formData.get("password") || "")

    if (!email || !password) {
      return NextResponse.redirect(new URL("/login?error=invalid", req.url), {
        status: 303,
      })
    }

    const cookieStore = await cookies()

    const response = NextResponse.redirect(new URL("/dashboard", req.url), {
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
      return NextResponse.redirect(new URL("/login?error=invalid", req.url), {
        status: 303,
      })
    }

    const user = data.user

    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle()

    if (profileLookupError) {
      console.error("Profile lookup error:", profileLookupError)

      return NextResponse.redirect(new URL("/login?error=failed", req.url), {
        status: 303,
      })
    }

    if (!existingProfile) {
      const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        null

      const username =
        user.email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "") || null

      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        email: user.email ?? email,
        full_name: fullName,
        name: fullName,
        username,
        membership: "free",
        account_status: "active",
        status: "active",
        is_premium: false,
        role: "user",
      })

      if (insertError) {
        console.error("Profile insert error:", insertError)

        return NextResponse.redirect(new URL("/login?error=failed", req.url), {
          status: 303,
        })
      }
    }

    return response
  } catch (error) {
    console.error("Login route error:", error)

    return NextResponse.redirect(new URL("/login?error=failed", req.url), {
      status: 303,
    })
  }
}