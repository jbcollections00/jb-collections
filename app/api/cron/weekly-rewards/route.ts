import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    // 1. Security check (Header or ?secret= Query Param)
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

    // 2. Compute ng Date Range para sa NAKARAANG LINGGO (Last Week)
    const now = new Date()
    const dayOfWeek = now.getUTCDay()
    const diffToCurrentMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

    const startOfCurrentWeek = new Date(now)
    startOfCurrentWeek.setUTCDate(now.getUTCDate() - diffToCurrentMonday)
    startOfCurrentWeek.setUTCHours(0, 0, 0, 0)

    const startOfLastWeek = new Date(startOfCurrentWeek)
    startOfLastWeek.setUTCDate(startOfLastWeek.getUTCDate() - 7)

    const endOfLastWeek = new Date(startOfCurrentWeek)

    // 3. Query Top Earners para sa Last Week
    const { data: transactions, error: txError } = await supabase
      .from("coin_transactions")
      .select("user_id, amount, type, created_at")
      .gte("created_at", startOfLastWeek.toISOString())
      .lt("created_at", endOfLastWeek.toISOString())
      .gt("amount", 0)
      .neq("type", "weekly_reward")

    if (txError) {
      return NextResponse.json({ error: "Database error", details: txError.message }, { status: 500 })
    }

    let top3: { user_id: string }[] = []

    if (!transactions || transactions.length === 0) {
      const { data: topProfiles } = await supabase
        .from("profiles")
        .select("id, coins, role")
        .neq("role", "admin")
        .order("coins", { ascending: false })
        .limit(3)

      if (!topProfiles || topProfiles.length === 0) {
        return NextResponse.json({ message: "No active participants found for last week" })
      }

      top3 = topProfiles.map((p) => ({ user_id: p.id }))
    } else {
      const userTotals: Record<string, number> = {}
      transactions.forEach((tx) => {
        userTotals[tx.user_id] = (userTotals[tx.user_id] || 0) + Number(tx.amount || 0)
      })

      top3 = Object.entries(userTotals)
        .map(([user_id, total]) => ({ user_id, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 3)
    }

    const rewards = [500, 300, 200]
    const distributedWinners = []

    // Mag-add ng 7 araw para sa expiration ng membership tier
    const tierExpiresAt = new Date()
    tierExpiresAt.setDate(tierExpiresAt.getDate() + 7)

    // 4. I-distribute ang Coin Rewards at Membership Tier Upgrades
    for (let i = 0; i < top3.length; i++) {
      const winner = top3[i]
      const userId = winner.user_id
      const prizeAmount = rewards[i]
      const rank = i + 1

      if (!userId) continue

      // Rank 1 = Platinum, Rank 2 & 3 = Premium
      const tierGranted = rank === 1 ? "platinum" : "premium"

      const { error: rpcError } = await supabase.rpc("handle_coin_change", {
        p_user_id: userId,
        p_amount: prizeAmount,
        p_type: "weekly_reward",
        p_description: `Weekly Leaderboard Rank #${rank} Reward (${tierGranted.toUpperCase()} + ${prizeAmount} Coins)`,
        p_reference: `weekly_reward:${userId}:${startOfLastWeek.toISOString().slice(0, 10)}`,
      })

      if (rpcError) {
        await supabase.from("coin_transactions").insert({
          user_id: userId,
          amount: prizeAmount,
          type: "weekly_reward",
          description: `Weekly Leaderboard Rank #${rank} Reward (${tierGranted.toUpperCase()} + ${prizeAmount} Coins)`,
        })

        const { data: profile } = await supabase
          .from("profiles")
          .select("coins")
          .eq("id", userId)
          .single()

        const currentCoins = Number(profile?.coins || 0)

        await supabase
          .from("profiles")
          .update({
            coins: currentCoins + prizeAmount,
            membership_tier: tierGranted,
            tier_expires_at: tierExpiresAt.toISOString(),
          })
          .eq("id", userId)
      } else {
        // I-update ang membership tier status pagkatapos maiproseso ang coins via RPC
        await supabase
          .from("profiles")
          .update({
            membership_tier: tierGranted,
            tier_expires_at: tierExpiresAt.toISOString(),
          })
          .eq("id", userId)
      }

      distributedWinners.push({
        userId,
        rank,
        prizeAmount,
        tierGranted,
        expiresAt: tierExpiresAt.toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      message: "Last week's rewards & 7-day tier upgrades successfully distributed!",
      period: `${startOfLastWeek.toISOString().slice(0, 10)} to ${endOfLastWeek.toISOString().slice(0, 10)}`,
      winners: distributedWinners,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}