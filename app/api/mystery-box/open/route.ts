import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const REWARDS = [
  { coins: 5, chance: 40 },
  { coins: 10, chance: 30 },
  { coins: 25, chance: 20 },
  { coins: 50, chance: 8 },
  { coins: 100, chance: 2 },
]

function getRandomReward() {
  const rand = Math.random() * 100
  let cumulative = 0

  for (const reward of REWARDS) {
    cumulative += reward.chance
    if (rand <= cumulative) return reward.coins
  }

  return 5
}

export async function POST() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: existing, error: existingError } = await supabase
      .from("mystery_box_claims")
      .select("id")
      .eq("user_id", user.id)
      .gte("created_at", todayStart.toISOString())
      .maybeSingle()

    if (existingError) {
      console.error("Mystery box existing check error:", existingError)
      return NextResponse.json({ error: "Failed to check mystery box cooldown" }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json({ error: "Already opened today" }, { status: 400 })
    }

    const reward = getRandomReward()

    const { error: insertError } = await supabase.from("mystery_box_claims").insert({
      user_id: user.id,
      coins: reward,
    })

    if (insertError) {
      console.error("Mystery box insert error:", insertError)
      return NextResponse.json({ error: "Failed to save mystery box claim" }, { status: 500 })
    }

    const { error: walletError } = await supabase.rpc("increment_wallet", {
      user_id: user.id,
      amount: reward,
    })

    if (walletError) {
      console.error("Mystery box wallet update error:", walletError)
      return NextResponse.json({ error: "Failed to update wallet" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      reward,
    })
  } catch (err) {
    console.error("Mystery box server error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}