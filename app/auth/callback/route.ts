import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function GET(req: Request) {
  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next") || "/dashboard"
  const origin = requestUrl.origin

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=failed", origin))
  }

  const cookieStore = await cookies()
  const response = NextResponse.redirect(new URL(next, origin))

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

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error("OAuth exchange error:", exchangeError)
    return NextResponse.redirect(new URL("/login?error=failed", origin))
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error("User fetch error after OAuth:", userError)
    return NextResponse.redirect(new URL("/login?error=failed", origin))
  }

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileLookupError) {
    console.error("Profile lookup error:", profileLookupError)
    return NextResponse.redirect(new URL("/login?error=failed", origin))
  }

  if (!existingProfile) {
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.display_name ||
      null

    const username =
      user.email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "") || null

    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email ?? null,
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
      return NextResponse.redirect(new URL("/login?error=failed", origin))
    }
  }

  return response
}