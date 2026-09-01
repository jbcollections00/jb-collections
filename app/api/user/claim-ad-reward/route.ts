import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

// Set reward amount (10 JB Coins per ad view)
const AD_REWARD_COINS = 10

export async function POST() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
        },
      }
    )

    // 1. Verify User Authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      )
    }

    // 2. Fetch current user balance
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      )
    }

    const newCoinBalance = (profile.coins || 0) + AD_REWARD_COINS

    // 3. Update profile coins
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ coins: newCoinBalance })
      .eq("id", user.id)

    if (updateError) {
      console.error("Database Update Error:", updateError)
      return NextResponse.json(
        { error: "Failed to update balance" },
        { status: 500 }
      )
    }

    // 4. Record transaction in history
    try {
      await supabase.from("jb_coin_history").insert({
        user_id: user.id,
        amount: AD_REWARD_COINS,
        type: "rewarded_ad",
        description: "Watched Rewarded Ad",
      })
    } catch (historyErr) {
      console.warn("History logging skipped or failed:", historyErr)
    }

    return NextResponse.json({
      success: true,
      rewarded: AD_REWARD_COINS,
      newBalance: newCoinBalance,
    })
  } catch (err) {
    console.error("Error rewarding ad coins:", err)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}