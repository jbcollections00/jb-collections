import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

function getManilaDateString(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value ?? "0000"
  const month = parts.find((part) => part.type === "month")?.value ?? "00"
  const day = parts.find((part) => part.type === "day")?.value ?? "00"

  return `${year}-${month}-${day}`
}

function getTomorrowManilaDateString(date = new Date()): string {
  const now = new Date(date)
  now.setUTCDate(now.getUTCDate() + 1)
  return getManilaDateString(now)
}

async function createSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )
}

export async function GET() {
  try {
    const supabase = await createSupabase()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const today = getManilaDateString()
    const tomorrow = getTomorrowManilaDateString()

    // check if already claimed via limit system
    const { data } = await supabase
      .from("user_coin_limits")
      .select("claim_count")
      .eq("user_id", user.id)
      .eq("action", "daily_reward")
      .eq("limit_date", today)
      .maybeSingle()

    const claimed = (data?.claim_count || 0) >= 1

    return NextResponse.json({
      ok: true,
      claimed,
      coins: 15,
      rewardDate: today,
      nextClaimDate: tomorrow,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = await createSupabase()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const today = getManilaDateString()
    const tomorrow = getTomorrowManilaDateString()
    const dailyCoins = 15

    // ✅ ANTI-ABUSE CHECK
    const { data: allowed } = await supabase.rpc("check_coin_limit", {
      p_user_id: user.id,
      p_action: "daily_reward",
      p_limit: 1,
    })

    if (!allowed) {
      return NextResponse.json({
        ok: false,
        alreadyClaimed: true,
        message: "You already claimed today’s reward.",
      })
    }

    // ✅ GIVE COINS (CENTRAL SYSTEM)
    const { error: coinError } = await supabase.rpc("handle_coin_change", {
      p_user_id: user.id,
      p_amount: dailyCoins,
      p_type: "daily_reward",
      p_description: `Daily reward +${dailyCoins} JB Coins`,
    })

    if (coinError) {
      console.error(coinError)
      return NextResponse.json(
        { ok: false, error: "Failed to add coins" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      claimed: true,
      coins: dailyCoins,
      rewardDate: today,
      nextClaimDate: tomorrow,
      message: "Daily reward claimed!",
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}