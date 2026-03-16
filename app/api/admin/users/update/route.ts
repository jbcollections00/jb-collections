import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set() {},
          remove() {},
        },
      }
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!body?.id) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 })
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await adminSupabase
      .from("profiles")
      .update({
        full_name: body.full_name ?? null,
        username: body.username ?? null,
        membership: body.membership ?? "standard",
        is_premium: Boolean(body.is_premium),
        account_status: body.account_status ?? "Active",
        status: body.status ?? "Active",
        role: body.role ?? "user",
      })
      .eq("id", body.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin update user API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}