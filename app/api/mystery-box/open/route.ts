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
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // check cooldown (1 per day)
    const { data: existing } = await supabase
      .from("mystery_box_claims")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", new Date(new Date().setHours(0,0,0,0)).toISOString())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "Already opened today" }, { status: 400 })
    }

    const reward = getRandomReward()

    // insert claim
    await supabase.from("mystery_box_claims").insert({
      user_id: user.id,
      coins: reward,
    })

    // update wallet
    await supabase.rpc("increment_wallet", {
      user_id: user.id,
      amount: reward,
    })

    return NextResponse.json({
      success: true,
      reward,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}