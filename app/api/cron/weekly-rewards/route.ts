import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    // 1. Security check
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

    // 2. Date Range computation para sa Asia/Manila Timezone (Last Week Mon-Sun)
    const now = new Date()
    const manilaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }))

    const dayOfWeek = manilaNow.getDay()
    const diffToCurrentMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

    const startOfCurrentWeekLocal = new Date(manilaNow)
    startOfCurrentWeekLocal.setDate(manilaNow.getDate() - diffToCurrentMonday)
    startOfCurrentWeekLocal.setHours(0, 0, 0, 0)

    const startOfLastWeekLocal = new Date(startOfCurrentWeekLocal)
    startOfLastWeekLocal.setDate(startOfLastWeekLocal.getDate() - 7)

    const endOfLastWeekLocal = new Date(startOfCurrentWeekLocal)

    const formatLocalISO = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      const hours = String(d.getHours()).padStart(2, "0")
      const minutes = String(d.getMinutes()).padStart(2, "0")
      const seconds = String(d.getSeconds()).padStart(2, "0")
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`
    }

    const startIso = new Date(formatLocalISO(startOfLastWeekLocal)).toISOString()
    const endIso = new Date(formatLocalISO(endOfLastWeekLocal)).toISOString()

    const displayStart = `${startOfLastWeekLocal.getFullYear()}-${String(startOfLastWeekLocal.getMonth() + 1).padStart(2, "0")}-${String(startOfLastWeekLocal.getDate()).padStart(2, "0")}`
    const lastWeekSunday = new Date(endOfLastWeekLocal)
    lastWeekSunday.setDate(lastWeekSunday.getDate() - 1)
    const displayEnd = `${lastWeekSunday.getFullYear()}-${String(lastWeekSunday.getMonth() + 1).padStart(2, "0")}-${String(lastWeekSunday.getDate()).padStart(2, "0")}`

    const rewards = [500, 300, 200]
    const tierExpiresAt = new Date()
    tierExpiresAt.setDate(tierExpiresAt.getDate() + 7)

    // Helper function para sa pag-award ng user
    async function grantReward(userId: string, rank: number, prizeAmount: number, category: string) {
      const tierGranted = rank === 1 ? "platinum" : "premium"
      const description = `Weekly Leaderboard (${category}) Rank #${rank} Reward (${tierGranted.toUpperCase()} + ${prizeAmount} Coins)`
      const reference = `weekly_${category.toLowerCase().replace(/\s+/g, "_")}:${userId}:${displayStart}`

      const { error: rpcError } = await supabase.rpc("handle_coin_change", {
        p_user_id: userId,
        p_amount: prizeAmount,
        p_type: "weekly_reward",
        p_description: description,
        p_reference: reference,
      })

      if (rpcError) {
        await supabase.from("coin_transactions").insert({
          user_id: userId,
          amount: prizeAmount,
          type: "weekly_reward",
          description: description,
        })

        const { data: profile } = await supabase.from("profiles").select("coins").eq("id", userId).single()
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
        await supabase
          .from("profiles")
          .update({
            membership_tier: tierGranted,
            tier_expires_at: tierExpiresAt.toISOString(),
          })
          .eq("id", userId)
      }

      return { userId, rank, prizeAmount, tierGranted, expiresAt: tierExpiresAt.toISOString() }
    }

    // --- A. TOP COIN EARNERS ---
    const { data: coinTx } = await supabase
      .from("coin_transactions")
      .select("user_id, amount")
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .gt("amount", 0)
      .neq("type", "weekly_reward")

    const coinEarnersWinners = []
    if (coinTx && coinTx.length > 0) {
      const coinTotals: Record<string, number> = {}
      coinTx.forEach((tx) => {
        coinTotals[tx.user_id] = (coinTotals[tx.user_id] || 0) + Number(tx.amount || 0)
      })

      const top3Earners = Object.entries(coinTotals)
        .map(([user_id, total]) => ({ user_id, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 3)

      for (let i = 0; i < top3Earners.length; i++) {
        const w = await grantReward(top3Earners[i].user_id, i + 1, rewards[i], "Top Coin Earner")
        coinEarnersWinners.push(w)
      }
    }

    // --- B. TOP DOWNLOADERS ---
    // Subukang i-query ang 'downloads' table (fallback sa 'file_downloads' kung sakali)
    let downloadLogs = null
    const { data: dlData, error: dlError } = await supabase
      .from("downloads")
      .select("user_id")
      .gte("created_at", startIso)
      .lt("created_at", endIso)

    if (!dlError) {
      downloadLogs = dlData
    } else {
      const { data: fDlData } = await supabase
        .from("file_downloads")
        .select("user_id")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
      downloadLogs = fDlData
    }

    const downloadersWinners = []
    if (downloadLogs && downloadLogs.length > 0) {
      const downloadCounts: Record<string, number> = {}
      downloadLogs.forEach((dl) => {
        if (dl.user_id) {
          downloadCounts[dl.user_id] = (downloadCounts[dl.user_id] || 0) + 1
        }
      })

      const top3Downloaders = Object.entries(downloadCounts)
        .map(([user_id, total]) => ({ user_id, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 3)

      for (let i = 0; i < top3Downloaders.length; i++) {
        const w = await grantReward(top3Downloaders[i].user_id, i + 1, rewards[i], "Top Downloader")
        downloadersWinners.push(w)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Weekly rewards for both competitions successfully distributed!",
      period: `${displayStart} to ${displayEnd}`,
      results: {
        topCoinEarners: coinEarnersWinners,
        topDownloaders: downloadersWinners,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}