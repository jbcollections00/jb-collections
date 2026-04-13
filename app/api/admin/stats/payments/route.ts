import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

type RecentUser = {
  id: string
  email: string | null
  full_name: string | null
  name: string | null
  username: string | null
  membership: string | null
  role: string | null
  created_at: string | null
  last_seen: string | null
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase server environment variables." },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const now = Date.now()
    const activeTodayDate = new Date(now - 24 * 60 * 60 * 1000).toISOString()
    const onlineUsersDate = new Date(now - 5 * 60 * 1000).toISOString()

    const [
      categoriesResult,
      filesResult,
      messagesResult,
      upgradesResult,
      usersResult,
      activeTodayResult,
      onlineUsersResult,
      recentUsersResult,
    ] = await Promise.all([
      supabase.from("categories").select("*", { count: "exact", head: true }),
      supabase.from("files").select("*", { count: "exact", head: true }),
      supabase.from("messages").select("*", { count: "exact", head: true }),
      supabase.from("upgrades").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_seen", activeTodayDate),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_seen", onlineUsersDate),
      supabase
        .from("profiles")
        .select(
          "id, email, full_name, name, username, membership, role, created_at, last_seen"
        )
        .order("created_at", { ascending: false })
        .limit(8),
    ])

    if (
      categoriesResult.error ||
      filesResult.error ||
      messagesResult.error ||
      upgradesResult.error ||
      usersResult.error ||
      activeTodayResult.error ||
      onlineUsersResult.error ||
      recentUsersResult.error
    ) {
      console.error("Admin stats query error:", {
        categories: categoriesResult.error,
        files: filesResult.error,
        messages: messagesResult.error,
        upgrades: upgradesResult.error,
        users: usersResult.error,
        activeToday: activeTodayResult.error,
        onlineUsers: onlineUsersResult.error,
        recentUsers: recentUsersResult.error,
      })

      return NextResponse.json(
        { error: "Failed to load admin stats." },
        { status: 500 }
      )
    }

    const recentUsers = (recentUsersResult.data || []) as RecentUser[]

    return NextResponse.json({
      categories: categoriesResult.count ?? 0,
      files: filesResult.count ?? 0,
      messages: messagesResult.count ?? 0,
      upgrades: upgradesResult.count ?? 0,
      users: usersResult.count ?? 0,
      activeToday: activeTodayResult.count ?? 0,
      onlineUsers: onlineUsersResult.count ?? 0,
      recentUsers,
    })
  } catch (error) {
    console.error("Admin stats API error:", error)

    return NextResponse.json(
      { error: "Failed to load admin stats." },
      { status: 500 }
    )
  }
}