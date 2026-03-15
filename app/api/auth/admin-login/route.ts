import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  const cookieStore = await cookies()

  const response = NextResponse.redirect(new URL("/admin", req.url), {
    status: 303,
  })

  try {
    const formData = await req.formData()

    const email = String(formData.get("email") || "").trim()
    const password = String(formData.get("password") || "")

    if (!email || !password) {
      return NextResponse.redirect(new URL("/admin/login?error=invalid", req.url), {
        status: 303,
      })
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: Record<string, unknown>) {
            response.cookies.set({
              name,
              value,
              ...(options as Parameters<typeof response.cookies.set>[0]),
            })
          },
          remove(name: string, options: Record<string, unknown>) {
            response.cookies.set({
              name,
              value: "",
              maxAge: 0,
              ...(options as Parameters<typeof response.cookies.set>[0]),
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
      return NextResponse.redirect(new URL("/admin/login?error=invalid", req.url), {
        status: 303,
      })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle()

    if (profileError) {
      console.error("Failed to load admin profile:", profileError)
      await supabase.auth.signOut()

      return NextResponse.redirect(new URL("/admin/login?error=failed", req.url), {
        status: 303,
      })
    }

    if (!profile || profile.role !== "admin") {
      await supabase.auth.signOut()

      return NextResponse.redirect(
        new URL("/admin/login?error=not-admin", req.url),
        { status: 303 }
      )
    }

    return response
  } catch (error) {
    console.error("Admin login route error:", error)

    return NextResponse.redirect(new URL("/admin/login?error=failed", req.url), {
      status: 303,
    })
  }
}