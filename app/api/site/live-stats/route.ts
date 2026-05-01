import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const ONLINE_WINDOW_MINUTES = 5
const NEW_MEMBERS_LIMIT = 12

type ProfileRow = {
  id: string
  email?: string | null
  full_name?: string | null
  name?: string | null
  username?: string | null
  role?: string | null
  membership?: string | null
  account_status?: string | null
  status?: string | null
  created_at?: string | null
  last_seen?: string | null
  is_premium?: boolean | null
  avatar_url?: string | null
}

function getIsoMinutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

function getStartOfTodayIso() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.toISOString()
}

function normalizeMember(user: ProfileRow) {
  return {
    id: user.id,
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
    avatar_url: user.avatar_url ?? null,
  }
}

function fallbackResponse(message = "Live stats fallback response.") {
  return NextResponse.json(
    {
      totalUsers: 0,
      activeToday: 0,
      onlineUsers: 0,
      onlineMembers: [],
      newMembers: [],
      warning: message,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    },
  )
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase environment variables for live stats.")
      return fallbackResponse("Missing Supabase environment variables.")
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
      "id, email, full_name, name, username, role, membership, account_status, status, created_at, last_seen, is_premium, avatar_url"

    const totalUsersResult = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })

    if (totalUsersResult.error) {
      console.error("Live stats total users error:", totalUsersResult.error)
    }

    const activeTodayResult = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("last_seen", "is", null)
      .gte("last_seen", startOfToday)

    if (activeTodayResult.error) {
      console.error("Live stats active today error:", activeTodayResult.error)
    }

    const onlineMembersResult = await supabase
      .from("profiles")
      .select(memberFields)
      .not("last_seen", "is", null)
      .gte("last_seen", onlineSince)
      .order("last_seen", { ascending: false })
      .limit(50)

    if (onlineMembersResult.error) {
      console.error("Live stats online members error:", onlineMembersResult.error)
    }

    const newMembersResult = await supabase
      .from("profiles")
      .select(memberFields)
      .not("created_at", "is", null)
      .gte("created_at", startOfToday)
      .order("created_at", { ascending: false })
      .limit(NEW_MEMBERS_LIMIT)

    if (newMembersResult.error) {
      console.error("Live stats new members error:", newMembersResult.error)
    }

    const onlineMembers = Array.isArray(onlineMembersResult.data)
      ? (onlineMembersResult.data as ProfileRow[]).map(normalizeMember)
      : []

    const newMembers = Array.isArray(newMembersResult.data)
      ? (newMembersResult.data as ProfileRow[]).map(normalizeMember)
      : []

    return NextResponse.json(
      {
        totalUsers: Number(totalUsersResult.count || 0),
        activeToday: Number(activeTodayResult.count || 0),
        onlineUsers: onlineMembers.length,
        onlineMembers,
        newMembers,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    )
  } catch (error) {
    console.error("Live stats API error:", error)
    return fallbackResponse(
      error instanceof Error ? error.message : "Unknown live stats server error.",
    )
  }
}