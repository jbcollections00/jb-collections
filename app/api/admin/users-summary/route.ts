import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export const runtime = "nodejs"

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  name: string | null
  username: string | null
  role: string | null
  created_at: string | null
  last_seen: string | null
}

export async function GET() {
  try {
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
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: me } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (me?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const now = new Date()
    const activeTodayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const onlineNowDate = new Date(now.getTime() - 5 * 60 * 1000).toISOString()

    const [{ count: totalUsers }, { count: activeToday }, { count: onlineNow }, recentResult] =
      await Promise.all([
        admin.from("profiles").select("*", { count: "exact", head: true }),
        admin
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("last_seen", activeTodayDate),
        admin
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("last_seen", onlineNowDate),
        admin
          .from("profiles")
          .select("id, email, full_name, name, username, role, created_at, last_seen")
          .order("created_at", { ascending: false })
          .limit(8),
      ])

    if (recentResult.error) {
      throw recentResult.error
    }

    const recentUsers = (recentResult.data || []) as ProfileRow[]

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      activeToday: activeToday || 0,
      onlineNow: onlineNow || 0,
      recentUsers,
    })
  } catch (error) {
    console.error("Admin users summary error:", error)
    return NextResponse.json(
      { error: "Failed to load users summary" },
      { status: 500 }
    )
  }
}