import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
// Caches response for 10 seconds on the server/CDN to prevent hammering the DB
export const revalidate = 10 

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
    { status: 200 }
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

    // ⚡ SPEED FIX: Fire all 4 queries simultaneously using Promise.all
    const [
      totalUsersResult,
      activeTodayResult,
      onlineMembersResult,
      newMembersResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .not("last_seen", "is", null)
        .gte("last_seen", startOfToday),

      supabase
        .from("profiles")
        .select(memberFields)
        .not("last_seen", "is", null)
        .gte("last_seen", onlineSince)
        .order("last_seen", { ascending: false })
        .limit(50),

      supabase
        .from("profiles")
        .select(memberFields)
        .not("created_at", "is", null)
        .gte("created_at", startOfToday)
        .order("created_at", { ascending: false })
        .limit(NEW_MEMBERS_LIMIT),
    ])

    // Log errors if any individual query fails
    if (totalUsersResult.error) console.error("Total users error:", totalUsersResult.error)
    if (activeTodayResult.error) console.error("Active today error:", activeTodayResult.error)
    if (onlineMembersResult.error) console.error("Online members error:", onlineMembersResult.error)
    if (newMembersResult.error) console.error("New members error:", newMembersResult.error)

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
          // Cache response on browser/CDN for 10 seconds, stale-while-revalidate for 30 seconds
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
        },
      }
    )
  } catch (error) {
    console.error("Live stats API error:", error)
    return fallbackResponse(
      error instanceof Error ? error.message : "Unknown live stats server error."
    )
  }
}