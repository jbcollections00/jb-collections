import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

// Helper: Siguraduhing makuha ang Lunes 12:00 AM ng kasalukuyang linggo
function getMondayStart(): string {
  const now = new Date()
  const day = now.getDay() // 0 = Sunday, 1 = Monday, ...
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Set to Monday
  
  const monday = new Date(now)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  
  return monday.toISOString()
}

export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Kunin ang Lunes 12:00 AM date string (mula sa RPC o fallback JS function)
    let weekStart = getMondayStart()

    try {
      const { data: weekData, error: weekError } = await supabase.rpc("get_week_start")
      if (!weekError && weekData) {
        weekStart = weekData
      }
    } catch {
      // Magfo-fallback sa JS calculated weekStart kung wala ang RPC
    }

    // 2. Subukang kunin ang datos sa 'jb_weekly_leaderboard'
    let leaderboardData: any[] = []

    const { data: viewData, error: viewError } = await supabase
      .from("jb_weekly_leaderboard")
      .select(`
        total_coins,
        user_id,
        profiles (
          id,
          username,
          full_name,
          name,
          avatar_url
        )
      `)
      .eq("week_start", weekStart)
      .order("total_coins", { ascending: false })
      .limit(50)

    if (!viewError && viewData && viewData.length > 0) {
      leaderboardData = viewData
    } else {
      // Fallback: Direktang pagbasa mula sa 'coin_transactions' table
      const { data: txData, error: txError } = await supabase
        .from("coin_transactions")
        .select(`
          user_id,
          amount,
          type,
          profiles (
            id,
            username,
            full_name,
            name,
            avatar_url
          )
        `)
        .gte("created_at", weekStart)
        .gt("amount", 0)
        .neq("type", "weekly_reward") // 👈 HINDI ISINASAMA ANG NAPANALUNANG PREMYO DITO!

      if (txError) throw txError

      // Group and sum weekly coins per user
      const userMap: Record<string, any> = {}

      txData?.forEach((tx: any) => {
        const uid = tx.user_id
        if (!userMap[uid]) {
          userMap[uid] = {
            user_id: uid,
            total_coins: 0,
            profiles: tx.profiles,
          }
        }
        userMap[uid].total_coins += Number(tx.amount || 0)
      })

      leaderboardData = Object.values(userMap).sort(
        (a: any, b: any) => b.total_coins - a.total_coins
      )
    }

    // 3. Format response at lagyan ng Rank at Prize Metadata
    const formattedLeaderboard = leaderboardData.map((item: any, index: number) => {
      const rank = index + 1
      let reward = 0

      if (rank === 1) reward = 500
      else if (rank === 2) reward = 300
      else if (rank === 3) reward = 200

      // Handle profile structure safely (kahit array o single object ang galing sa Supabase)
      const rawProfile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
      const profile = rawProfile || {}
      
      const displayName =
        profile.full_name || profile.name || profile.username || "Anonymous User"

      return {
        rank,
        user_id: item.user_id,
        display_name: displayName,
        username: profile.username || null,
        avatar_url: profile.avatar_url || null,
        weekly_coins: Number(item.total_coins || 0),
        reward_coins: reward,
      }
    })

    return NextResponse.json(
      {
        success: true,
        weekStart,
        leaderboard: formattedLeaderboard,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    )
  } catch (err: any) {
    console.error("Weekly Leaderboard error:", err)

    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Internal Server Error",
      },
      { status: 500 }
    )
  }
}