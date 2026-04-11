import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export const runtime = "nodejs"

type DailyRewardRow = {
  id: string
  amount: number | null
  created_at: string | null
}

type CoinSettingRow = {
  key: string
  value_integer: number | null
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

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

function getManilaDateFromTimestamp(value?: string | null) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function shiftDateString(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number)
  const utcDate = new Date(Date.UTC(year, month - 1, day))
  utcDate.setUTCDate(utcDate.getUTCDate() + days)

  const yyyy = utcDate.getUTCFullYear()
  const mm = String(utcDate.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(utcDate.getUTCDate()).padStart(2, "0")

  return `${yyyy}-${mm}-${dd}`
}

function getDefaultCoinSettings() {
  return {
    daily_reward_base: 15,
    streak_bonus_3: 10,
    streak_bonus_7: 40,
    streak_bonus_14: 75,
    streak_bonus_30: 200,
  }
}

function getStreakBonus(
  streak: number,
  settings: ReturnType<typeof getDefaultCoinSettings>
) {
  if (streak > 0 && streak % 30 === 0) return settings.streak_bonus_30
  if (streak > 0 && streak % 14 === 0) return settings.streak_bonus_14
  if (streak > 0 && streak % 7 === 0) return settings.streak_bonus_7
  if (streak > 0 && streak % 3 === 0) return settings.streak_bonus_3
  return 0
}

function getNextStreakMilestone(
  streak: number,
  settings: ReturnType<typeof getDefaultCoinSettings>
) {
  const milestones = [3, 7, 14, 30]

  for (const milestone of milestones) {
    if (streak < milestone) {
      return {
        target: milestone,
        remaining: milestone - streak,
        bonus: getStreakBonus(milestone, settings),
      }
    }
  }

  const next30 = Math.ceil((streak + 1) / 30) * 30
  return {
    target: next30,
    remaining: next30 - streak,
    bonus: getStreakBonus(next30, settings),
  }
}

function buildStreakFromDates(dateStrings: string[], today: string) {
  const uniqueDates = Array.from(new Set(dateStrings)).sort((a, b) => b.localeCompare(a))

  if (uniqueDates.length === 0) {
    return {
      streak: 0,
      lastClaimDate: null as string | null,
      claimedToday: false,
      claimedYesterday: false,
    }
  }

  const lastClaimDate = uniqueDates[0] || null
  const yesterday = shiftDateString(today, -1)
  const claimedToday = uniqueDates.includes(today)
  const claimedYesterday = uniqueDates.includes(yesterday)

  let anchor: string | null = null

  if (claimedToday) {
    anchor = today
  } else if (claimedYesterday) {
    anchor = yesterday
  } else {
    return {
      streak: 0,
      lastClaimDate,
      claimedToday,
      claimedYesterday,
    }
  }

  let streak = 0
  let cursor = anchor

  while (uniqueDates.includes(cursor)) {
    streak += 1
    cursor = shiftDateString(cursor, -1)
  }

  return {
    streak,
    lastClaimDate,
    claimedToday,
    claimedYesterday,
  }
}

async function createSupabaseUserClient() {
  const cookieStore = await cookies()

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })
}

function createSupabaseAdminClient() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")

  return createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function loadCoinSettings(
  adminDb: ReturnType<typeof createSupabaseAdminClient>
) {
  const defaults = getDefaultCoinSettings()

  const { data, error } = await adminDb
    .from("jb_coin_settings")
    .select("key, value_integer")
    .in("key", [
      "daily_reward_base",
      "streak_bonus_3",
      "streak_bonus_7",
      "streak_bonus_14",
      "streak_bonus_30",
    ])

  if (error) {
    console.error("Failed to load coin settings:", error)
    return defaults
  }

  const rows = (Array.isArray(data) ? data : []) as CoinSettingRow[]

  return {
    daily_reward_base:
      rows.find((row) => row.key === "daily_reward_base")?.value_integer ??
      defaults.daily_reward_base,
    streak_bonus_3:
      rows.find((row) => row.key === "streak_bonus_3")?.value_integer ??
      defaults.streak_bonus_3,
    streak_bonus_7:
      rows.find((row) => row.key === "streak_bonus_7")?.value_integer ??
      defaults.streak_bonus_7,
    streak_bonus_14:
      rows.find((row) => row.key === "streak_bonus_14")?.value_integer ??
      defaults.streak_bonus_14,
    streak_bonus_30:
      rows.find((row) => row.key === "streak_bonus_30")?.value_integer ??
      defaults.streak_bonus_30,
  }
}

async function loadRecentDailyRewardDates(
  adminDb: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
) {
  const { data, error } = await adminDb
    .from("coin_history")
    .select("id, amount, created_at")
    .eq("user_id", userId)
    .eq("type", "daily_reward")
    .order("created_at", { ascending: false })
    .limit(60)

  if (error) {
    throw error
  }

  const rows = (Array.isArray(data) ? data : []) as DailyRewardRow[]
  return rows
    .map((row) => getManilaDateFromTimestamp(row.created_at))
    .filter((value): value is string => Boolean(value))
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

    const adminDb = createSupabaseAdminClient()
    const settings = await loadCoinSettings(adminDb)

    const today = getManilaDateString()
    const tomorrow = getTomorrowManilaDateString()
    const { start, end } = getManilaDayRange()
    const baseCoins = Number(settings.daily_reward_base || 0)

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

    const rewardDates = await loadRecentDailyRewardDates(adminDb, user.id)
    const streakInfo = buildStreakFromDates(rewardDates, today)
    const nextMilestone = getNextStreakMilestone(streakInfo.streak, settings)

    return NextResponse.json({
      ok: true,
      claimed: !!claimRow,
      alreadyClaimed: !!claimRow,
      coins: claimRow?.amount ?? baseCoins,
      baseCoins,
      streak: streakInfo.streak,
      streakBonus: claimRow
        ? Math.max(Number(claimRow.amount || 0) - baseCoins, 0)
        : 0,
      rewardDate: today,
      nextClaimDate: tomorrow,
      claimedAt: claimRow?.created_at ?? null,
      lastClaimDate: streakInfo.lastClaimDate,
      nextMilestone,
      settings,
    })
  } catch (error) {
    console.error("Daily reward GET route error:", error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load reward status",
      },
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
    const settings = await loadCoinSettings(adminDb)

    const today = getManilaDateString()
    const tomorrow = getTomorrowManilaDateString()
    const baseCoins = Number(settings.daily_reward_base || 0)
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

    const rewardDatesBeforeClaim = await loadRecentDailyRewardDates(adminDb, user.id)
    const currentStreakInfo = buildStreakFromDates(rewardDatesBeforeClaim, today)

    if (existingClaim) {
      const nextMilestone = getNextStreakMilestone(currentStreakInfo.streak, settings)

      return NextResponse.json({
        ok: true,
        claimed: true,
        alreadyClaimed: true,
        coins: existingClaim.amount ?? baseCoins,
        baseCoins,
        streak: currentStreakInfo.streak,
        streakBonus: Math.max(Number(existingClaim.amount || 0) - baseCoins, 0),
        rewardDate: today,
        nextClaimDate: tomorrow,
        claimedAt: existingClaim.created_at ?? null,
        lastClaimDate: currentStreakInfo.lastClaimDate,
        nextMilestone,
        settings,
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
      const nextMilestone = getNextStreakMilestone(currentStreakInfo.streak, settings)

      return NextResponse.json({
        ok: true,
        claimed: true,
        alreadyClaimed: true,
        coins: baseCoins,
        baseCoins,
        streak: currentStreakInfo.streak,
        streakBonus: 0,
        rewardDate: today,
        nextClaimDate: tomorrow,
        claimedAt: null,
        lastClaimDate: currentStreakInfo.lastClaimDate,
        nextMilestone,
        settings,
        message: "You already claimed today’s daily reward.",
      })
    }

    const newStreak = currentStreakInfo.claimedYesterday
      ? currentStreakInfo.streak + 1
      : 1

    const streakBonus = getStreakBonus(newStreak, settings)
    const totalReward = baseCoins + streakBonus

    const { error: rewardError } = await adminDb.rpc("handle_coin_change", {
      p_user_id: user.id,
      p_amount: totalReward,
      p_type: "daily_reward",
      p_description:
        streakBonus > 0
          ? `Daily reward +${baseCoins} JB Coins | Streak day ${newStreak} bonus +${streakBonus}`
          : `Daily reward +${baseCoins} JB Coins | Streak day ${newStreak}`,
    })

    if (rewardError) {
      console.error("Daily reward coin change error:", rewardError)
      return NextResponse.json(
        { ok: false, error: "Failed to claim daily reward" },
        { status: 500 }
      )
    }

    const { data: newClaim, error: newClaimError } = await adminDb
      .from("coin_history")
      .select("id, amount, created_at")
      .eq("user_id", user.id)
      .eq("type", "daily_reward")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (newClaimError) {
      console.error("Daily reward new claim fetch error:", newClaimError)
    }

    const nextMilestone = getNextStreakMilestone(newStreak, settings)

    return NextResponse.json({
      ok: true,
      claimed: true,
      alreadyClaimed: false,
      coins: newClaim?.amount ?? totalReward,
      baseCoins,
      streak: newStreak,
      streakBonus,
      rewardDate: today,
      nextClaimDate: tomorrow,
      claimedAt: newClaim?.created_at ?? null,
      lastClaimDate: today,
      nextMilestone,
      settings,
      message:
        streakBonus > 0
          ? `Daily reward claimed. Streak day ${newStreak} bonus unlocked!`
          : `Daily reward claimed. Current streak: ${newStreak} day${newStreak > 1 ? "s" : ""}.`,
    })
  } catch (error) {
    console.error("Daily reward POST route error:", error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to claim daily reward",
      },
      { status: 500 }
    )
  }
}