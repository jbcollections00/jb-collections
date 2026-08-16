import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    // 1. Security check gamit ang Authorization Header O URL Query Parameter (?secret=...)
    const authHeader = req.headers.get("authorization")
    const url = new URL(req.url)
    const querySecret = url.searchParams.get("secret")
    const cronSecret = process.env.CRON_SECRET

    const isHeaderValid = authHeader === `Bearer ${cronSecret}`
    const isQueryValid = querySecret === cronSecret

    if (cronSecret && !isHeaderValid && !isQueryValid) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // 2. Kunin ang Top 3 mula sa weekly leaderboard
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const res = await fetch(`${siteUrl}/api/leaderboard/weekly`, {
      cache: "no-store",
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch leaderboard endpoint" }, { status: 500 })
    }

    const data = await res.json()

    if (!data.success || !data.leaderboard || data.leaderboard.length === 0) {
      return NextResponse.json({ message: "No active participants found" })
    }

    const top3 = data.leaderboard.slice(0, 3)
    const rewards = [500, 300, 200]
    const distributedWinners = []

    // 3. I-distribute ang pabuya
    for (let i = 0; i < top3.length; i++) {
      const winner = top3[i]
      const userId = winner.user_id || winner.id
      const prizeAmount = rewards[i]
      const rank = i + 1

      if (!userId) continue

      // A. Gamitin ang RPC function kung mayroon para sa atomic coin update
      const { error: rpcError } = await supabase.rpc("handle_coin_change", {
        p_user_id: userId,
        p_amount: prizeAmount,
        p_type: "weekly_reward",
        p_description: `Weekly Leaderboard Rank #${rank} Reward`,
        p_reference: `weekly_reward:${userId}:${new Date().toISOString().slice(0, 10)}`,
      })

      // B. Fallback kapag walang RPC function sa Supabase
      if (rpcError) {
        const { error: txError } = await supabase.from("coin_transactions").insert({
          user_id: userId,
          amount: prizeAmount,
          type: "weekly_reward",
          description: `Weekly Leaderboard Rank #${rank} Reward`,
        })

        if (txError) {
          console.error(`Transaction insert error for user ${userId}:`, txError.message)
          continue
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("coins")
          .eq("id", userId)
          .single()

        if (profile) {
          const currentCoins = Number(profile.coins || 0)
          await supabase
            .from("profiles")
            .update({ coins: currentCoins + prizeAmount })
            .eq("id", userId)
        }
      }

      distributedWinners.push({ userId, rank, prizeAmount })
    }

    return NextResponse.json({
      success: true,
      message: "Weekly rewards successfully distributed!",
      winners: distributedWinners,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}