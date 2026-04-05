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

async function createSupabaseResponse() {
  const cookieStore = await cookies()

  const response = NextResponse.json({ ok: true })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, any>) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: Record<string, any>) {
          response.cookies.set({ name, value: "", ...options, maxAge: 0 })
        },
      },
    }
  )

  return { supabase, response }
}

export async function GET() {
  try {
    const { supabase } = await createSupabaseResponse()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const today = getManilaDateString()
    const tomorrow = getTomorrowManilaDateString()

    const { data: claim, error: claimError } = await supabase
      .from("daily_reward_claims")
      .select("claimed_at, coins, reward_date")
      .eq("user_id", user.id)
      .eq("reward_date", today)
      .maybeSingle()

    if (claimError) {
      console.error("Daily reward status error:", claimError)
      return NextResponse.json(
        { ok: false, error: "Failed to load reward status" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      claimed: !!claim,
      coins: claim?.coins ?? 5,
      rewardDate: today,
      nextClaimDate: tomorrow,
      claimedAt: claim?.claimed_at ?? null,
    })
  } catch (error) {
    console.error("Daily reward GET route error:", error)

    return NextResponse.json(
      { ok: false, error: "Failed to load reward status" },
      { status: 500 }
    )
  }
}

export async function POST() {
  try {
    const { supabase } = await createSupabaseResponse()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const today = getManilaDateString()
    const tomorrow = getTomorrowManilaDateString()
    const dailyCoins = 5

    const { data, error } = await supabase.rpc("claim_daily_reward", {
      p_user_id: user.id,
      p_reward_date: today,
      p_coins: dailyCoins,
    })

    if (error) {
      console.error("Daily reward claim error:", error)
      return NextResponse.json(
        { ok: false, error: "Failed to claim daily reward" },
        { status: 500 }
      )
    }

    const alreadyClaimed = !!data?.already_claimed
    const ok = !!data?.ok

    return NextResponse.json({
      ok,
      claimed: ok && !alreadyClaimed,
      alreadyClaimed,
      coins: dailyCoins,
      rewardDate: today,
      nextClaimDate: tomorrow,
      message: alreadyClaimed
        ? "You already claimed today’s daily reward."
        : "Daily reward claimed successfully.",
    })
  } catch (error) {
    console.error("Daily reward POST route error:", error)

    return NextResponse.json(
      { ok: false, error: "Failed to claim daily reward" },
      { status: 500 }
    )
  }
}