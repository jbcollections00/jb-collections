import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Prevent Next.js static caching
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    // Prefer Service Role Key to bypass RLS, fallback to Anon Key
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ""

    console.log("🔥 ROUTE IS READING SUPABASE URL:", supabaseUrl)

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase URL or Key in environment variables." },
        { status: 500 }
      )
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Identify current user if Authorization header is provided
    let currentUserId: string | null = null
    const authHeader = req.headers.get("authorization")

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "")
      const { data: userData } = await supabase.auth.getUser(token)
      if (userData?.user) {
        currentUserId = userData.user.id
      }
    }

    // 🟢 2. CALL THE SQL RPC FUNCTION (weekly coins calculation from coin_history)
    const { data: earners, error: dbError } = await supabase
      .rpc("get_weekly_top_coin_earners")

    if (dbError || !earners) {
      console.error("Leaderboard DB error:", dbError)
      return NextResponse.json(
        { ok: false, error: dbError?.message || "Failed to fetch leaderboard data." },
        { status: 500 }
      )
    }

    // 🟢 3. Format weekly RPC results into clean leaderboard entries
    const top = earners.map((user: any, index: number) => {
      const displayName = user.username || "Anonymous User"
      const coinEarnedWeekly = Number(user.total_coins_earned || 0)

      return {
        rank: index + 1,
        id: user.user_id,
        display_name: displayName,
        username: user.username || null,
        avatar_url: user.avatar_url || null,
        coins: coinEarnedWeekly,
        membership: null,
        membership_label: "Member",
        is_current_user: currentUserId ? user.user_id === currentUserId : false,
      }
    })

    // 4. Determine current user's rank object
    let me = currentUserId
      ? top.find((entry) => entry.id === currentUserId) || null
      : null

    if (currentUserId && !me) {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUserId)
        .maybeSingle()

      if (myProfile) {
        me = {
          rank: 999,
          id: myProfile.id,
          display_name:
            myProfile.full_name || myProfile.name || myProfile.username || "You",
          username: myProfile.username || null,
          avatar_url: myProfile.avatar_url || null,
          coins: 0,
          membership: myProfile.membership || null,
          membership_label: myProfile.membership || "Member",
          is_current_user: true,
        }
      }
    }

    // 5. Return JSON response with strict anti-cache headers
    return NextResponse.json(
      { ok: true, top, me },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    )
  } catch (err: any) {
    console.error("Leaderboard GET route exception:", err)
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal Server Error" },
      { status: 500 }
    )
  }
}