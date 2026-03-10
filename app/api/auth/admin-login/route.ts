import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const email = String(formData.get("email") || "")
    const password = String(formData.get("password") || "")

    if (!email || !password) {
      return NextResponse.redirect(new URL("/admin/login?error=invalid", req.url))
    }

    const cookieStore = await cookies()
    const response = NextResponse.redirect(new URL("/admin", req.url))

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: any) {
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
      return NextResponse.redirect(new URL("/admin/login?error=invalid", req.url))
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single()

    if (profile?.role !== "admin") {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL("/admin/login?error=not-admin", req.url))
    }

    return response
  } catch {
    return NextResponse.redirect(new URL("/admin/login?error=failed", req.url))
  }
}