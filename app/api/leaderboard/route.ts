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

async function createSupabaseUserClient() {
  const cookieStore = await cookies()

  return createServerClient(
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
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.")
  }

  return createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
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
    const supabase = await createSupabaseUserClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const adminDb = createSupabaseAdminClient()

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

    const leaderboardRows = (Array.isArray(topProfiles) ? topProfiles : []) as LeaderboardProfileRow[]

    const currentUserCoinsResult = await adminDb
      .from("profiles")
      .select("coins, full_name, name, username, avatar_url, membership, role")
      .eq("id", user.id)
      .maybeSingle()

    if (currentUserCoinsResult.error) {
      console.error("Current user leaderboard error:", currentUserCoinsResult.error)
      return NextResponse.json(
        { ok: false, error: "Failed to load your leaderboard rank" },
        { status: 500 }
      )
    }

    const currentUserCoins = Number(currentUserCoinsResult.data?.coins || 0)

    const { count: higherCount, error: rankError } = await adminDb
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gt("coins", currentUserCoins)

    if (rankError) {
      console.error("Leaderboard rank count error:", rankError)
      return NextResponse.json(
        { ok: false, error: "Failed to load leaderboard rank" },
        { status: 500 }
      )
    }

    const yourRank = Number(higherCount || 0) + 1

    const top = leaderboardRows.map((profile, index) => {
      const displayName = getDisplayName(profile)

      return {
        rank: index + 1,
        id: profile.id,
        display_name: displayName,
        username: profile.username || null,
        avatar_url: profile.avatar_url || null,
        initials: getInitials(displayName),
        coins: Number(profile.coins || 0),
        membership: getMembership(profile),
        membership_label: getMembershipLabel(getMembership(profile)),
        is_current_user: profile.id === user.id,
      }
    })

    const currentUserProfile = currentUserCoinsResult.data as LeaderboardProfileRow | null
    const currentUserDisplayName = getDisplayName(
      currentUserProfile || {
        id: user.id,
        full_name: "",
        name: "",
        username: "",
      }
    )

    return NextResponse.json({
      ok: true,
      top,
      me: {
        id: user.id,
        rank: yourRank,
        display_name: currentUserDisplayName,
        username: currentUserProfile?.username || null,
        avatar_url: currentUserProfile?.avatar_url || null,
        initials: getInitials(currentUserDisplayName),
        coins: currentUserCoins,
        membership: getMembership(currentUserProfile || { id: user.id }),
        membership_label: getMembershipLabel(
          getMembership(currentUserProfile || { id: user.id })
        ),
      },
    })
  } catch (error) {
    console.error("Leaderboard route error:", error)

    return NextResponse.json(
      { ok: false, error: "Failed to load leaderboard" },
      { status: 500 }
    )
  }
}