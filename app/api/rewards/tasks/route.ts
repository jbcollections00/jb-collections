import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

const MAX_ADS_PER_DAY = 5
const AD_COOLDOWN_SECONDS = 30
const FIVE_ADS_BONUS_COINS = 20

type EarnTask = {
  id: string
  title: string
  description: string
  reward: number
  type: "ad" | "visit"
  required_time: number
  link: string | null
  max_claims_per_day?: number
  cooldown_seconds?: number
  bonus_at_claim_count?: number
  bonus_reward?: number
}

type EarnTaskClaimRow = {
  id: number
  user_id: string
  task_id: string
  reward_date: string
  claim_count: number
  started_at: string | null
  ready_at: string | null
  completed_at: string | null
  created_at: string | null
  updated_at: string | null
}

function requireEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function createAdminDb() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")

  return createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function getEarnTasks(): EarnTask[] {
  return [
    {
      id: "watch_ad",
      title: "Watch Sponsor Bonus",
      description: "Open sponsor page and return here to claim your reward. You can do this up to 5 times per day.",
      reward: 10,
      type: "ad",
      required_time: 10,
      link: "https://www.profitablecpmratenetwork.com/ek44eeb04?key=99f05c43be188cef9d877a7519d8166a",
      max_claims_per_day: MAX_ADS_PER_DAY,
      cooldown_seconds: AD_COOLDOWN_SECONDS,
      bonus_at_claim_count: MAX_ADS_PER_DAY,
      bonus_reward: FIVE_ADS_BONUS_COINS,
    },
    {
      id: "visit_store",
      title: "Visit JB Store",
      description: "Open the store page and stay for a few seconds.",
      reward: 10,
      type: "visit",
      required_time: 15,
      link: "/upgrade",
      max_claims_per_day: 1,
    },
    {
      id: "leaderboard",
      title: "View Leaderboard",
      description: "Visit leaderboard and stay briefly.",
      reward: 5,
      type: "visit",
      required_time: 10,
      link: "/leaderboard",
      max_claims_per_day: 1,
    },
    {
      id: "browse",
      title: "Browse Library",
      description: "Browse files and stay on page.",
      reward: 10,
      type: "visit",
      required_time: 20,
      link: "/dashboard",
      max_claims_per_day: 1,
    },
  ]
}

function getTaskById(taskId: string) {
  return getEarnTasks().find((task) => task.id === taskId) || null
}

function getMaxClaims(task: EarnTask) {
  return Math.max(1, Number(task.max_claims_per_day || 1))
}

function isAdTask(task: EarnTask) {
  return task.type === "ad" || task.id === "watch_ad"
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

function addSeconds(date: Date, seconds: number) {
  const next = new Date(date)
  next.setSeconds(next.getSeconds() + Math.max(0, seconds))
  return next
}

function getSecondsRemaining(readyAt?: string | null) {
  if (!readyAt) return 0

  const readyDate = new Date(readyAt)
  if (Number.isNaN(readyDate.getTime())) return 0

  return Math.max(0, Math.ceil((readyDate.getTime() - Date.now()) / 1000))
}

function getCooldownRemaining(claim: EarnTaskClaimRow | null, task: EarnTask) {
  if (!claim?.completed_at) return 0

  const cooldownSeconds = Math.max(0, Number(task.cooldown_seconds || 0))
  if (cooldownSeconds <= 0) return 0

  const completedDate = new Date(claim.completed_at)
  if (Number.isNaN(completedDate.getTime())) return 0

  const secondsSinceCompleted = Math.floor((Date.now() - completedDate.getTime()) / 1000)

  return Math.max(0, cooldownSeconds - secondsSinceCompleted)
}

function decorateTask(task: EarnTask, claim?: EarnTaskClaimRow | null) {
  const claimCount = Number(claim?.claim_count || 0)
  const maxClaims = getMaxClaims(task)
  const completed = claimCount >= maxClaims
  const currentlyStarted = Boolean(claim?.started_at && claim?.ready_at && !completed)
  const secondsRemaining = completed ? 0 : getSecondsRemaining(claim?.ready_at)
  const cooldownRemaining = completed ? 0 : getCooldownRemaining(claim || null, task)
  const canClaim = currentlyStarted && !completed && secondsRemaining <= 0
  const canStart = !completed && !currentlyStarted && cooldownRemaining <= 0

  return {
    ...task,
    started: currentlyStarted,
    completed,
    completed_today: completed,
    can_claim: canClaim,
    can_start: canStart,
    claim_count: claimCount,
    max_claims_per_day: maxClaims,
    remaining_claims: Math.max(0, maxClaims - claimCount),
    cooldown_seconds: Number(task.cooldown_seconds || 0),
    cooldown_remaining: cooldownRemaining,
    bonus_at_claim_count: task.bonus_at_claim_count || null,
    bonus_reward: task.bonus_reward || null,
    started_at: claim?.started_at ?? null,
    ready_at: claim?.ready_at ?? null,
    completed_at: claim?.completed_at ?? null,
    seconds_remaining: secondsRemaining,
  }
}

async function getAuthenticatedUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  return {
    ok: true as const,
    user,
  }
}

async function addCoins(
  adminDb: ReturnType<typeof createAdminDb>,
  userId: string,
  amount: number,
  type: string,
  description: string,
) {
  const { error } = await adminDb.rpc("handle_coin_change", {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_description: description,
  })

  if (error) {
    throw new Error(error.message || "Failed to add JB Coins.")
  }
}

export async function GET() {
  try {
    const auth = await getAuthenticatedUser()
    if (!auth.ok) return auth.response

    const adminDb = createAdminDb()
    const today = getManilaDateString()
    const taskIds = getEarnTasks().map((task) => task.id)

    const { data: claimRows, error: claimsError } = await adminDb
      .from("earn_task_claims")
      .select("*")
      .eq("user_id", auth.user.id)
      .eq("reward_date", today)
      .in("task_id", taskIds)

    if (claimsError) {
      return NextResponse.json(
        { error: claimsError.message || "Failed to load earn task claims." },
        { status: 500 },
      )
    }

    const claimMap = new Map<string, EarnTaskClaimRow>()

    ;((claimRows || []) as EarnTaskClaimRow[]).forEach((claim) => {
      claimMap.set(claim.task_id, claim)
    })

    const tasks = getEarnTasks().map((task) => decorateTask(task, claimMap.get(task.id)))

    return NextResponse.json({
      ok: true,
      tasks,
      openTasks: tasks.filter((task) => !task.completed).length,
      availableCoins: tasks
        .filter((task) => task.can_claim)
        .reduce((sum, task) => sum + task.reward, 0),
    })
  } catch (error) {
    console.error("Earn tasks GET error:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load earn tasks.",
      },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser()
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || "").trim().toLowerCase()
    const taskId = String(body?.taskId || body?.task_id || "").trim()
    const task = getTaskById(taskId)

    if (!task) {
      return NextResponse.json({ error: "Invalid task." }, { status: 400 })
    }

    if (action !== "start" && action !== "claim") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 })
    }

    const adminDb = createAdminDb()
    const today = getManilaDateString()
    const now = new Date()
    const maxClaims = getMaxClaims(task)

    const { data: existingClaim, error: existingError } = await adminDb
      .from("earn_task_claims")
      .select("*")
      .eq("user_id", auth.user.id)
      .eq("task_id", task.id)
      .eq("reward_date", today)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message || "Failed to verify task status." },
        { status: 500 },
      )
    }

    const claim = existingClaim as EarnTaskClaimRow | null
    const currentClaimCount = Number(claim?.claim_count || 0)

    if (action === "start") {
      if (currentClaimCount >= maxClaims) {
        return NextResponse.json(
          {
            error: isAdTask(task)
              ? `Daily ad limit reached (${maxClaims}/${maxClaims}).`
              : "Task already completed today.",
            task: decorateTask(task, claim),
          },
          { status: 400 },
        )
      }

      if (claim?.started_at && claim?.ready_at) {
        return NextResponse.json({
          ok: true,
          message: "Task already started. Visit the required page, then return to claim.",
          task: decorateTask(task, claim),
        })
      }

      const cooldownRemaining = getCooldownRemaining(claim, task)

      if (cooldownRemaining > 0) {
        return NextResponse.json(
          {
            error: `Please wait ${cooldownRemaining} more second${
              cooldownRemaining === 1 ? "" : "s"
            } before starting another sponsor task.`,
            cooldown_remaining: cooldownRemaining,
            task: decorateTask(task, claim),
          },
          { status: 400 },
        )
      }

      const readyAt = addSeconds(now, task.required_time).toISOString()

      const { data: startedClaim, error: startError } = await adminDb
        .from("earn_task_claims")
        .upsert(
          {
            user_id: auth.user.id,
            task_id: task.id,
            reward_date: today,
            claim_count: currentClaimCount,
            started_at: now.toISOString(),
            ready_at: readyAt,
            completed_at: null,
            updated_at: now.toISOString(),
          },
          {
            onConflict: "user_id,task_id,reward_date",
          },
        )
        .select("*")
        .single()

      if (startError) {
        return NextResponse.json(
          { error: startError.message || "Failed to start task." },
          { status: 500 },
        )
      }

      return NextResponse.json({
        ok: true,
        message:
          task.type === "visit"
            ? "Task started. Visit the required page, then return to claim."
            : `Sponsor task started. Ad ${currentClaimCount + 1}/${maxClaims} is ready to open.`,
        task: decorateTask(task, startedClaim as EarnTaskClaimRow),
      })
    }

    if (!claim?.started_at || !claim?.ready_at) {
      return NextResponse.json(
        { error: "Start this task first before claiming." },
        { status: 400 },
      )
    }

    if (currentClaimCount >= maxClaims) {
      return NextResponse.json(
        {
          error: isAdTask(task)
            ? `Daily ad limit reached (${maxClaims}/${maxClaims}).`
            : "Task already completed today.",
          task: decorateTask(task, claim),
        },
        { status: 400 },
      )
    }

    const readyDate = new Date(claim.ready_at)
    const secondsRemaining = getSecondsRemaining(claim.ready_at)

    if (Number.isNaN(readyDate.getTime()) || now.getTime() < readyDate.getTime()) {
      return NextResponse.json(
        {
          error: `Please wait ${secondsRemaining} more second${
            secondsRemaining === 1 ? "" : "s"
          } before claiming.`,
          seconds_remaining: secondsRemaining,
          task: decorateTask(task, claim),
        },
        { status: 400 },
      )
    }

    const newClaimCount = currentClaimCount + 1
    let totalReward = task.reward
    let bonusReward = 0

    await addCoins(
      adminDb,
      auth.user.id,
      task.reward,
      `earn_task_${task.id}`,
      `${task.title} complete. +${task.reward} JB Coins added.`,
    )

    if (
      isAdTask(task) &&
      task.bonus_at_claim_count &&
      task.bonus_reward &&
      newClaimCount === task.bonus_at_claim_count
    ) {
      bonusReward = Number(task.bonus_reward || 0)
      totalReward += bonusReward

      await addCoins(
        adminDb,
        auth.user.id,
        bonusReward,
        "earn_task_watch_ad_bonus",
        `Watched ${task.bonus_at_claim_count} sponsor ads bonus. +${bonusReward} JB Coins added.`,
      )
    }

    const { data: completedClaim, error: completeError } = await adminDb
      .from("earn_task_claims")
      .update({
        claim_count: newClaimCount,
        started_at: null,
        ready_at: null,
        completed_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", claim.id)
      .eq("user_id", auth.user.id)
      .select("*")
      .single()

    if (completeError) {
      return NextResponse.json(
        {
          error:
            completeError.message ||
            "Coins were added, but task completion could not be saved.",
        },
        { status: 500 },
      )
    }

    const decorated = decorateTask(task, completedClaim as EarnTaskClaimRow)

    return NextResponse.json({
      ok: true,
      message:
        bonusReward > 0
          ? `${task.title} complete. +${task.reward} JB Coins added, plus +${bonusReward} bonus coins!`
          : `${task.title} complete. +${task.reward} JB Coins added.`,
      task: decorated,
      coinsAdded: totalReward,
      reward: totalReward,
      baseReward: task.reward,
      bonusReward,
      claimCount: newClaimCount,
      maxClaims,
    })
  } catch (error) {
    console.error("Earn tasks POST error:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process earn task.",
      },
      { status: 500 },
    )
  }
}
