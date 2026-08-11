import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // 1. Kunin ang Top 3 mula sa kasalukuyang weekly leaderboard
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/leaderboard/weekly`, {
      cache: "no-store",
    })
    const data = await res.json()

    if (!data.success || !data.leaderboard || data.leaderboard.length === 0) {
      return NextResponse.json({ message: "No active participants found" })
    }

    const top3 = data.leaderboard.slice(0, 3)
    const rewards = [500, 300, 200]

    // 2. I-distribute ang pabuya sa Top 3
    for (let i = 0; i < top3.length; i++) {
      const winner = top3[i]
      const prizeAmount = rewards[i]

      // A. I-record sa coin_transactions bilang 'weekly_reward'
      await supabase.from("coin_transactions").insert({
        user_id: winner.user_id,
        amount: prizeAmount,
        type: "weekly_reward", // 👈 Eto ang dahilan kung bakit hindi ito mabilang sa susunod na race
        description: `Weekly Leaderboard Rank #${winner.rank} Reward`,
      })

      // B. Idagdag sa totoong wallet balance ng user
      const { data: profile } = await supabase
        .from("profiles")
        .select("coins")
        .eq("id", winner.user_id)
        .single()

      if (profile) {
        const currentCoins = Number(profile.coins || 0)
        await supabase
          .from("profiles")
          .update({ coins: currentCoins + prizeAmount })
          .eq("id", winner.user_id)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Weekly rewards successfully distributed!",
      winners: top3,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}