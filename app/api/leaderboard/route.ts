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

    // Truth Test Log: Ipapakita sa terminal kung aling Supabase project ang binabasa nito
    console.log("🔥 ROUTE IS READING SUPABASE URL:", supabaseUrl)

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase URL or Key in environment variables." },
        { status: 500 }
      )
    }

    // Initialize Supabase inside the handler so env variables are freshly read on request
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

    // 2. Query top profiles ordered strictly by 'coins'
    const { data: profiles, error: dbError } = await supabase
      .from("profiles")
      .select("*")
      .order("coins", { ascending: false })
      .limit(100)

    if (dbError || !profiles) {
      console.error("Leaderboard DB error:", dbError)
      return NextResponse.json(
        { ok: false, error: dbError?.message || "Failed to fetch leaderboard data." },
        { status: 500 }
      )
    }

    // 3. Format profile objects into clean leaderboard entries
    const top = profiles.map((user: any, index: number) => {
      const displayName =
        user.full_name || user.name || user.username || "Anonymous User"

      const coinBalance = Number(user.coins || 0)

      return {
        rank: index + 1,
        id: user.id,
        display_name: displayName,
        username: user.username || null,
        avatar_url: user.avatar_url || null,
        coins: coinBalance,
        membership: user.membership || null,
        membership_label: user.membership || "Member",
        is_current_user: currentUserId ? user.id === currentUserId : false,
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
        const myCoins = Number(myProfile.coins || 0)
        const myRank =
          profiles.filter((p: any) => Number(p.coins || 0) > myCoins).length + 1

        me = {
          rank: myRank,
          id: myProfile.id,
          display_name:
            myProfile.full_name || myProfile.name || myProfile.username || "You",
          username: myProfile.username || null,
          avatar_url: myProfile.avatar_url || null,
          coins: myCoins,
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