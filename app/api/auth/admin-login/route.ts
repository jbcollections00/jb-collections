import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

type AdminProfile = {
  role: string | null
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const email = String(formData.get("email") || "").trim().toLowerCase()
    const password = String(formData.get("password") || "")

    if (!email || !password) {
      return NextResponse.redirect(new URL("/secure-admin-portal-7X9?error=invalid", req.url), {
        status: 303,
      })
    }

    const cookieStore = await cookies()

    const response = NextResponse.redirect(new URL("/admin", req.url), {
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

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    if (authError || !authData.user) {
      return NextResponse.redirect(new URL("/secure-admin-portal-7X9?error=invalid", req.url), {
        status: 303,
      })
    }

    const user = authData.user

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("Failed to load admin profile:", profileError)
      await supabase.auth.signOut()

      return NextResponse.redirect(new URL("/secure-admin-portal-7X9?error=failed", req.url), {
        status: 303,
      })
    }

    const adminProfile = profile as AdminProfile | null

    if (!adminProfile || adminProfile.role !== "admin") {
      await supabase.auth.signOut()

      return NextResponse.redirect(
        new URL("/secure-admin-portal-7X9?error=not-admin", req.url),
        { status: 303 }
      )
    }

    return response
  } catch (error) {
    console.error("Admin login route error:", error)

    return NextResponse.redirect(new URL("/secure-admin-portal-7X9?error=failed", req.url), {
      status: 303,
    })
  }
}