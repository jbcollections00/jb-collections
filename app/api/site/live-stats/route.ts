import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const ONLINE_WINDOW_MINUTES = 5
const NEW_MEMBERS_LIMIT = 12

function getIsoMinutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

function getStartOfTodayIso() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.toISOString()
}

function normalizeMember(user: Record<string, any>) {
  return {
    id: user.id ?? null,
    email: user.email ?? null,
    full_name: user.full_name ?? null,
    name: user.name ?? null,
    username: user.username ?? null,
    role: user.role ?? null,
    membership: user.membership ?? null,
    account_status: user.account_status ?? null,
    status: user.status ?? null,
    created_at: user.created_at ?? null,
    last_seen: user.last_seen ?? null,
    is_premium: user.is_premium ?? null,
  }
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase environment variables." },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const onlineSince = getIsoMinutesAgo(ONLINE_WINDOW_MINUTES)
    const startOfToday = getStartOfTodayIso()

    const memberFields =
      "id, email, full_name, name, username, role, membership, account_status, status, created_at, last_seen, is_premium"

    const [totalUsersResult, activeTodayResult, onlineMembersResult, newMembersResult] =
      await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),

        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .not("last_seen", "is", null)
          .gte("last_seen", startOfToday),

        supabase
          .from("profiles")
          .select(memberFields)
          .eq("account_status", "Active")
          .eq("status", "Active")
          .not("last_seen", "is", null)
          .gte("last_seen", onlineSince)
          .order("last_seen", { ascending: false }),

        supabase
          .from("profiles")
          .select(memberFields)
          .not("created_at", "is", null)
          .gte("created_at", startOfToday)
          .order("created_at", { ascending: false })
          .limit(NEW_MEMBERS_LIMIT),
      ])

    if (totalUsersResult.error) {
      console.error("totalUsersResult error:", totalUsersResult.error)
      return NextResponse.json(
        { error: totalUsersResult.error.message },
        { status: 500 }
      )
    }

    if (activeTodayResult.error) {
      console.error("activeTodayResult error:", activeTodayResult.error)
      return NextResponse.json(
        { error: activeTodayResult.error.message },
        { status: 500 }
      )
    }

    if (onlineMembersResult.error) {
      console.error("onlineMembersResult error:", onlineMembersResult.error)
      return NextResponse.json(
        { error: onlineMembersResult.error.message },
        { status: 500 }
      )
    }

    if (newMembersResult.error) {
      console.error("newMembersResult error:", newMembersResult.error)
      return NextResponse.json(
        { error: newMembersResult.error.message },
        { status: 500 }
      )
    }

    const onlineMembers = (onlineMembersResult.data || []).map(normalizeMember)
    const newMembers = (newMembersResult.data || []).map(normalizeMember)

    return NextResponse.json({
      totalUsers: Number(totalUsersResult.count || 0),
      activeToday: Number(activeTodayResult.count || 0),
      onlineUsers: onlineMembers.length,
      onlineMembers,
      newMembers,
    })
  } catch (error) {
    console.error("Live stats API error:", error)

    return NextResponse.json(
      {
        error: "Failed to load live stats.",
        details: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    )
  }
}