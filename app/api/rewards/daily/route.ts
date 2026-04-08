import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export const runtime = "nodejs"

function getManilaDateParts(date = new Date()) {
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

  return { year, month, day }
}

function getManilaDateString(date = new Date()) {
  const { year, month, day } = getManilaDateParts(date)
  return `${year}-${month}-${day}`
}

function getTomorrowManilaDateString(date = new Date()) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + 1)
  return getManilaDateString(next)
}

function getManilaDayRange(date = new Date()) {
  const { year, month, day } = getManilaDateParts(date)
  const start = `${year}-${month}-${day}T00:00:00+08:00`

  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + 1)
  const nextParts = getManilaDateParts(next)
  const end = `${nextParts.year}-${nextParts.month}-${nextParts.day}T00:00:00+08:00`

  return { start, end }
}

async function createSupabaseUserClient() {
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

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.")
  }

  return createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function GET() {
  try {
    const supabase = await createSupabaseUserClient()

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
    const { start, end } = getManilaDayRange()

    const { data: claimRow, error: claimError } = await supabase
      .from("coin_history")
      .select("id, amount, created_at")
      .eq("user_id", user.id)
      .eq("type", "daily_reward")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })
      .limit(1)
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
      claimed: !!claimRow,
      alreadyClaimed: !!claimRow,
      coins: claimRow?.amount ?? 15,
      rewardDate: today,
      nextClaimDate: tomorrow,
      claimedAt: claimRow?.created_at ?? null,
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
    const supabase = await createSupabaseUserClient()

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

    const adminDb = createSupabaseAdminClient()

    const today = getManilaDateString()
    const tomorrow = getTomorrowManilaDateString()
    const dailyCoins = 15
    const { start, end } = getManilaDayRange()

    const { data: existingClaim, error: existingClaimError } = await adminDb
      .from("coin_history")
      .select("id, amount, created_at")
      .eq("user_id", user.id)
      .eq("type", "daily_reward")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingClaimError) {
      console.error("Daily reward existing claim check error:", existingClaimError)
      return NextResponse.json(
        { ok: false, error: "Failed to verify reward status" },
        { status: 500 }
      )
    }

    if (existingClaim) {
      return NextResponse.json({
        ok: true,
        claimed: true,
        alreadyClaimed: true,
        coins: existingClaim.amount ?? dailyCoins,
        rewardDate: today,
        nextClaimDate: tomorrow,
        claimedAt: existingClaim.created_at ?? null,
        message: "You already claimed today’s daily reward.",
      })
    }

    const { data: allowed, error: limitError } = await adminDb.rpc(
      "check_coin_limit",
      {
        p_user_id: user.id,
        p_action: "daily_reward",
        p_limit: 1,
      }
    )

    if (limitError) {
      console.error("Daily reward limit error:", limitError)
      return NextResponse.json(
        { ok: false, error: "Failed to verify daily limit" },
        { status: 500 }
      )
    }

    if (!allowed) {
      const { data: latestClaim } = await adminDb
        .from("coin_history")
        .select("id, amount, created_at")
        .eq("user_id", user.id)
        .eq("type", "daily_reward")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      return NextResponse.json({
        ok: true,
        claimed: true,
        alreadyClaimed: true,
        coins: latestClaim?.amount ?? dailyCoins,
        rewardDate: today,
        nextClaimDate: tomorrow,
        claimedAt: latestClaim?.created_at ?? null,
        message: "You already claimed today’s daily reward.",
      })
    }

    const { error: rewardError } = await adminDb.rpc("handle_coin_change", {
      p_user_id: user.id,
      p_amount: dailyCoins,
      p_type: "daily_reward",
      p_description: `Daily reward +${dailyCoins} JB Coins`,
    })

    if (rewardError) {
      console.error("Daily reward coin change error:", rewardError)
      return NextResponse.json(
        { ok: false, error: "Failed to claim daily reward" },
        { status: 500 }
      )
    }

    const { data: newClaim } = await adminDb
      .from("coin_history")
      .select("id, amount, created_at")
      .eq("user_id", user.id)
      .eq("type", "daily_reward")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      ok: true,
      claimed: true,
      alreadyClaimed: false,
      coins: newClaim?.amount ?? dailyCoins,
      rewardDate: today,
      nextClaimDate: tomorrow,
      claimedAt: newClaim?.created_at ?? null,
      message: "Daily reward claimed successfully.",
    })
  } catch (error) {
    console.error("Daily reward POST route error:", error)

    return NextResponse.json(
      { ok: false, error: "Failed to claim daily reward" },
      { status: 500 }
    )
  }
}