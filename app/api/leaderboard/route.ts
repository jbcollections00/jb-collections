import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export const runtime = "nodejs"

type LeaderboardProfileRow = {
  id: string
  full_name?: string | null
  name?: string | null
  username?: string | null
  avatar_url?: string | null
  coins?: number | null
  membership?: string | null
  role?: string | null
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

async function createSupabaseUserClient() {
  const cookieStore = await cookies()

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
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
}

function createSupabaseAdminClient() {
  return createSupabaseAdmin(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

function getDisplayName(profile: LeaderboardProfileRow) {
  return (
    profile.full_name?.trim() ||
    profile.name?.trim() ||
    profile.username?.trim() ||
    "User"
  )
}

function getMembership(profile: LeaderboardProfileRow) {
  const role = String(profile.role || "").trim().toLowerCase()
  const membership = String(profile.membership || "").trim().toLowerCase()

  if (role === "admin") return "admin"
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  return "standard"
}

function getMembershipLabel(value: string) {
  if (value === "admin") return "Admin"
  if (value === "platinum") return "Platinum"
  if (value === "premium") return "Premium"
  return "Standard"
}

function getInitials(name: string) {
  const cleaned = name.trim()
  if (!cleaned) return "U"

  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase()
}

export async function GET() {
  try {
    const adminDb = createSupabaseAdminClient()

    let currentUserId: string | null = null

    try {
      const supabase = await createSupabaseUserClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      currentUserId = user?.id || null
    } catch {
      currentUserId = null
    }

    const { data: topProfiles, error: leaderboardError } = await adminDb
      .from("profiles")
      .select("id, full_name, name, username, avatar_url, coins, membership, role")
      .order("coins", { ascending: false, nullsFirst: false })
      .limit(10)

    if (leaderboardError) {
      console.error("Leaderboard query error:", leaderboardError)

      return NextResponse.json(
        { ok: false, error: "Failed to load leaderboard" },
        { status: 500 }
      )
    }

    const leaderboardRows = Array.isArray(topProfiles)
      ? (topProfiles as LeaderboardProfileRow[])
      : []

    const top = leaderboardRows.map((profile, index) => {
      const displayName = getDisplayName(profile)
      const membership = getMembership(profile)

      return {
        rank: index + 1,
        id: profile.id,
        display_name: displayName,
        username: profile.username || null,
        avatar_url: profile.avatar_url || null,
        initials: getInitials(displayName),
        coins: Number(profile.coins || 0),
        membership,
        membership_label: getMembershipLabel(membership),
        is_current_user: currentUserId ? profile.id === currentUserId : false,
      }
    })

    let me = null

    if (currentUserId) {
      const { data: currentUserProfile, error: currentUserError } = await adminDb
        .from("profiles")
        .select("id, coins, full_name, name, username, avatar_url, membership, role")
        .eq("id", currentUserId)
        .maybeSingle()

      if (!currentUserError && currentUserProfile) {
        const safeCurrentUserProfile =
          currentUserProfile as LeaderboardProfileRow

        const currentUserCoins = Number(safeCurrentUserProfile.coins || 0)

        const { count: higherCount } = await adminDb
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gt("coins", currentUserCoins)

        const currentUserDisplayName = getDisplayName(safeCurrentUserProfile)
        const currentUserMembership = getMembership(safeCurrentUserProfile)

        me = {
          id: currentUserId,
          rank: Number(higherCount || 0) + 1,
          display_name: currentUserDisplayName,
          username: safeCurrentUserProfile.username || null,
          avatar_url: safeCurrentUserProfile.avatar_url || null,
          initials: getInitials(currentUserDisplayName),
          coins: currentUserCoins,
          membership: currentUserMembership,
          membership_label: getMembershipLabel(currentUserMembership),
        }
      }
    }

    return NextResponse.json({
      ok: true,
      top,
      me,
    })
  } catch (error) {
    console.error("Leaderboard route error:", error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load leaderboard",
      },
      { status: 500 }
    )
  }
}