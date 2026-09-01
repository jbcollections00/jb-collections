import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

function getManilaMondayStart(): string {
  const now = new Date()
  const manilaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  
  const day = manilaTime.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  
  manilaTime.setUTCDate(manilaTime.getUTCDate() - diff)
  manilaTime.setUTCHours(0, 0, 0, 0)
  
  const y = manilaTime.getUTCFullYear()
  const m = String(manilaTime.getUTCMonth() + 1).padStart(2, "0")
  const date = String(manilaTime.getUTCDate()).padStart(2, "0")
  
  return `${y}-${m}-${date}T00:00:00+08:00`
}

export async function GET() {
  try {
    const supabase = await createClient()
    let weekStart = getManilaMondayStart()

    try {
      const { data: weekData, error: weekError } = await supabase.rpc("get_week_start")
      if (!weekError && weekData) {
        weekStart = weekData
      }
    } catch {
      // Fallback to JS weekStart
    }

    let leaderboardData: any[] = []

    // 1. Fetch from view and apply THRESHOLD (>= 500 coins)
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
      .gte("week_start", weekStart)
      .gte("total_coins", 500) // 👈 TULUYANG TANGGAL ANG BELOW 500 COINS
      .order("total_coins", { ascending: false })
      .limit(50)

    if (!viewError && viewData) {
      leaderboardData = viewData
    } else {
      // 2. Fallback calculation if view fails
      const { data: txData, error: txError } = await supabase
        .from("coin_history")
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
        .neq("type", "weekly_reward")

      if (txError) throw txError

      const userMap: Record<string, any> = {}

      txData?.forEach((tx: any) => {
        const uid = tx.user_id
        if (!uid) return

        if (!userMap[uid]) {
          userMap[uid] = {
            user_id: uid,
            total_coins: 0,
            profiles: tx.profiles,
          }
        }
        userMap[uid].total_coins += Number(tx.amount || 0)
      })

      // Filter >= 500 coins bago i-sort at slice
      leaderboardData = Object.values(userMap)
        .filter((user: any) => user.total_coins >= 500) // 👈 TULUYANG TANGGAL ANG BELOW 500 COINS
        .sort((a: any, b: any) => b.total_coins - a.total_coins)
        .slice(0, 50)
    }

    const formattedLeaderboard = leaderboardData.map((item: any, index: number) => {
      const rank = index + 1
      let reward = 0

      if (rank === 1) reward = 500
      if (rank === 2) reward = 300
      if (rank === 3) reward = 200

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