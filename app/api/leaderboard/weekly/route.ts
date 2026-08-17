import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

// Helper: Siguraduhing makuha ang Lunes 12:00 AM ng kasalukuyang linggo (Manila Time)
function getManilaMondayStart(): string {
  const now = new Date()
  const manilaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }))
  
  const day = manilaNow.getDay() // 0 = Sunday, 1 = Monday, ...
  const diff = day === 0 ? 6 : day - 1 // Kunin ang diperensya pabalik sa Lunes
  
  const monday = new Date(manilaNow)
  monday.setDate(manilaNow.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  
  // I-format nang tama gamit ang +08:00 (Philippine Time)
  const y = monday.getFullYear()
  const m = String(monday.getMonth() + 1).padStart(2, "0")
  const date = String(monday.getDate()).padStart(2, "0")
  return `${y}-${m}-${date}T00:00:00+08:00`
}

export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Kunin ang Lunes 12:00 AM date string
    let weekStart = getManilaMondayStart()

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
      .gte("week_start", weekStart) // Siguraduhing tugma sa Manila Time format
      .order("total_coins", { ascending: false })
      .limit(50)

    if (!viewError && viewData && viewData.length > 0) {
      leaderboardData = viewData
    } else {
      // Fallback: Direktang pagbasa mula sa 'coin_transactions' table (Pinakaligtas)
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
        .neq("type", "weekly_reward") // 👈 HINDI ISINASAMA ANG NAPANALUNANG PREMYO DITO!

      if (txError) throw txError

      // Group and sum weekly coins per user
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

      leaderboardData = Object.values(userMap).sort(
        (a: any, b: any) => b.total_coins - a.total_coins
      ).slice(0, 50) // Kunin lang ang top 50
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