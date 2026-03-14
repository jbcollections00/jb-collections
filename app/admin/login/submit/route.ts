import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const ADMIN_LOGIN_PATH = "/admin/secure-admin-portal-7X9"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const email = String(formData.get("email") || "").trim()
    const password = String(formData.get("password") || "")

    if (!email || !password) {
      return NextResponse.redirect(
        new URL(`${ADMIN_LOGIN_PATH}?error=invalid`, req.url),
        { status: 303 }
      )
    }

    const cookieStore = await cookies()
    const successRedirect = new URL("/admin", req.url)
    const response = NextResponse.redirect(successRedirect, { status: 303 })

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
      return NextResponse.redirect(
        new URL(`${ADMIN_LOGIN_PATH}?error=invalid`, req.url),
        { status: 303 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single()

    if (profileError || profile?.role !== "admin") {
      await supabase.auth.signOut()

      return NextResponse.redirect(
        new URL(`${ADMIN_LOGIN_PATH}?error=not-admin`, req.url),
        { status: 303 }
      )
    }

    return response
  } catch {
    return NextResponse.redirect(
      new URL(`${ADMIN_LOGIN_PATH}?error=failed`, req.url),
      { status: 303 }
    )
  }
}