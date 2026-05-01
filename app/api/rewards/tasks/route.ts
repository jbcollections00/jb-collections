import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

const MAX_ADS_PER_DAY = 5
const AD_COOLDOWN_SECONDS = 30
const FIVE_ADS_BONUS_COINS = 20
const REFERRAL_PASSIVE_PERCENT = 10
const DOUBLE_REWARD_AD_SECONDS = 10

const AD_LINK = "https://www.profitablecpmratenetwork.com/ek44eeb04?key=99f05c43be188cef9d877a7519d8166a"

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
  boost_started_at?: string | null
  boost_ready_at?: string | null
  boost_used?: boolean | null
  created_at: string | null
  updated_at: string | null
}

type ReferralRow = {
  id: string
  user_id: string
  referrer_id: string
  created_at: string | null
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function createAdminDb() {
  return createSupabaseAdmin(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
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
      link: AD_LINK,
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

function getManilaDateString(date = new Date()) {
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
    passive_referral_percent: REFERRAL_PASSIVE_PERCENT,
    started_at: claim?.started_at ?? null,
    ready_at: claim?.ready_at ?? null,
    completed_at: claim?.completed_at ?? null,
    boost_started_at: claim?.boost_started_at ?? null,
    boost_ready_at: claim?.boost_ready_at ?? null,
    boost_used: Boolean(claim?.boost_used),
    boost_can_claim:
      !completed &&
      !isAdTask(task) &&
      Boolean(claim?.boost_started_at) &&
      Boolean(claim?.boost_ready_at) &&
      !Boolean(claim?.boost_used) &&
      getSecondsRemaining(claim?.boost_ready_at) <= 0,
    boost_seconds_remaining: getSecondsRemaining(claim?.boost_ready_at),
    double_reward_ad_seconds: DOUBLE_REWARD_AD_SECONDS,
    seconds_remaining: secondsRemaining,
  }
}

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  return { ok: true as const, user }
}

async function addCoins(adminDb: ReturnType<typeof createAdminDb>, userId: string, amount: number, type: string, description: string) {
  if (amount <= 0) return

  const { error } = await adminDb.rpc("handle_coin_change", {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_description: description,
  })

  if (error) throw new Error(error.message || "Failed to add JB Coins.")
}

async function addPassiveReferralEarnings(adminDb: ReturnType<typeof createAdminDb>, referredUserId: string, sourceTaskId: string, sourceRewardAmount: number) {
  if (sourceRewardAmount <= 0) return { passiveReward: 0, referrerId: null as string | null }

  const { data: referral, error: referralError } = await adminDb
    .from("referrals")
    .select("id, user_id, referrer_id, created_at")
    .eq("user_id", referredUserId)
    .maybeSingle()

  if (referralError) {
    console.error("Passive referral lookup failed:", referralError)
    return { passiveReward: 0, referrerId: null as string | null }
  }

  const referralRow = referral as ReferralRow | null
  if (!referralRow?.referrer_id || referralRow.referrer_id === referredUserId) {
    return { passiveReward: 0, referrerId: null as string | null }
  }

  const passiveReward = Math.max(1, Math.floor((sourceRewardAmount * REFERRAL_PASSIVE_PERCENT) / 100))

  await addCoins(
    adminDb,
    referralRow.referrer_id,
    passiveReward,
    "passive_referral_earning",
    `Passive referral earning from ${sourceTaskId}. +${passiveReward} JB Coins added.`,
  )

  const { error: logError } = await adminDb.from("referral_earnings").insert({
    referral_id: referralRow.id,
    referrer_id: referralRow.referrer_id,
    referred_user_id: referredUserId,
    source_type: `earn_task_${sourceTaskId}`,
    source_amount: sourceRewardAmount,
    earning_amount: passiveReward,
    earning_percent: REFERRAL_PASSIVE_PERCENT,
  })

  if (logError) console.error("Passive referral log failed:", logError)

  return { passiveReward, referrerId: referralRow.referrer_id }
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
      return NextResponse.json({ error: claimsError.message || "Failed to load earn task claims." }, { status: 500 })
    }

    const claimMap = new Map<string, EarnTaskClaimRow>()
    ;((claimRows || []) as EarnTaskClaimRow[]).forEach((claim) => claimMap.set(claim.task_id, claim))

    const tasks = getEarnTasks().map((task) => decorateTask(task, claimMap.get(task.id)))

    return NextResponse.json({
      ok: true,
      tasks,
      openTasks: tasks.filter((task) => !task.completed).length,
      availableCoins: tasks.filter((task) => task.can_claim).reduce((sum, task) => sum + task.reward, 0),
    })
  } catch (error) {
    console.error("Earn tasks GET error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load earn tasks." }, { status: 500 })
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

    if (!task) return NextResponse.json({ error: "Invalid task." }, { status: 400 })
    if (action !== "start" && action !== "claim" && action !== "start_boost") {
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
      return NextResponse.json({ error: existingError.message || "Failed to verify task status." }, { status: 500 })
    }

    const claim = existingClaim as EarnTaskClaimRow | null
    const currentClaimCount = Number(claim?.claim_count || 0)

    if (action === "start") {
      if (currentClaimCount >= maxClaims) {
        return NextResponse.json({
          error: isAdTask(task) ? `Daily ad limit reached (${maxClaims}/${maxClaims}).` : "Task already completed today.",
          task: decorateTask(task, claim),
        }, { status: 400 })
      }

      if (claim?.started_at && claim?.ready_at && getSecondsRemaining(claim.ready_at) > 0) {
        return NextResponse.json({ ok: true, message: "Task already started. Visit the required page, then return to claim.", task: decorateTask(task, claim) })
      }

      const cooldownRemaining = getCooldownRemaining(claim, task)
      if (cooldownRemaining > 0) {
        return NextResponse.json({
          error: `Please wait ${cooldownRemaining} more second${cooldownRemaining === 1 ? "" : "s"} before starting another sponsor task.`,
          cooldown_remaining: cooldownRemaining,
          task: decorateTask(task, claim),
        }, { status: 400 })
      }

      const readyAt = addSeconds(now, task.required_time).toISOString()

      const { data: startedClaim, error: startError } = await adminDb
        .from("earn_task_claims")
        .upsert({
          user_id: auth.user.id,
          task_id: task.id,
          reward_date: today,
          claim_count: currentClaimCount,
          started_at: now.toISOString(),
          ready_at: readyAt,
          completed_at: null,
          updated_at: now.toISOString(),
        }, { onConflict: "user_id,task_id,reward_date" })
        .select("*")
        .single()

      if (startError) return NextResponse.json({ error: startError.message || "Failed to start task." }, { status: 500 })

      return NextResponse.json({
        ok: true,
        message: task.type === "visit" ? "Task started. Visit the required page, then return to claim." : `Sponsor task started. Ad ${currentClaimCount + 1}/${maxClaims} is ready to open.`,
        task: decorateTask(task, startedClaim as EarnTaskClaimRow),
      })
    }

    if (action === "start_boost") {
      if (isAdTask(task)) {
        return NextResponse.json(
          { error: "Double reward boost is only for engagement tasks." },
          { status: 400 }
        )
      }

      if (!claim?.started_at || !claim?.ready_at) {
        return NextResponse.json(
          { error: "Complete the task first before boosting the reward." },
          { status: 400 }
        )
      }

      if (currentClaimCount >= maxClaims || claim.completed_at) {
        return NextResponse.json(
          { error: "Task already completed today.", task: decorateTask(task, claim) },
          { status: 400 }
        )
      }

      const readyDate = new Date(claim.ready_at)
      if (Number.isNaN(readyDate.getTime()) || now.getTime() < readyDate.getTime()) {
        return NextResponse.json(
          {
            error: "Task is not ready yet.",
            task: decorateTask(task, claim),
          },
          { status: 400 }
        )
      }

      if (claim.boost_used) {
        return NextResponse.json(
          { error: "Double reward boost already used.", task: decorateTask(task, claim) },
          { status: 400 }
        )
      }

      const boostReadyAt = addSeconds(now, DOUBLE_REWARD_AD_SECONDS).toISOString()

      const { data: boostedClaim, error: boostError } = await adminDb
        .from("earn_task_claims")
        .update({
          boost_started_at: now.toISOString(),
          boost_ready_at: boostReadyAt,
          updated_at: now.toISOString(),
        })
        .eq("id", claim.id)
        .eq("user_id", auth.user.id)
        .select("*")
        .single()

      if (boostError) {
        return NextResponse.json(
          { error: boostError.message || "Failed to start double reward boost." },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        message: "Double reward boost started. Open the sponsor, then return to claim 2x coins.",
        task: decorateTask(task, boostedClaim as EarnTaskClaimRow),
      })
    }

    if (!claim?.started_at || !claim?.ready_at) return NextResponse.json({ error: "Start this task first before claiming." }, { status: 400 })

    if (currentClaimCount >= maxClaims) {
      return NextResponse.json({
        error: isAdTask(task) ? `Daily ad limit reached (${maxClaims}/${maxClaims}).` : "Task already completed today.",
        task: decorateTask(task, claim),
      }, { status: 400 })
    }

    const readyDate = new Date(claim.ready_at)
    const secondsRemaining = getSecondsRemaining(claim.ready_at)

    if (Number.isNaN(readyDate.getTime()) || now.getTime() < readyDate.getTime()) {
      return NextResponse.json({
        error: `Please wait ${secondsRemaining} more second${secondsRemaining === 1 ? "" : "s"} before claiming.`,
        seconds_remaining: secondsRemaining,
        task: decorateTask(task, claim),
      }, { status: 400 })
    }

    const boosted = Boolean(body?.boosted || body?.double_reward || body?.boost)
    let boostReward = 0

    if (boosted) {
      if (isAdTask(task)) {
        return NextResponse.json(
          { error: "Double reward boost is only for engagement tasks." },
          { status: 400 }
        )
      }

      if (!claim.boost_started_at || !claim.boost_ready_at) {
        return NextResponse.json(
          { error: "Start the double reward boost first.", task: decorateTask(task, claim) },
          { status: 400 }
        )
      }

      if (claim.boost_used) {
        return NextResponse.json(
          { error: "Double reward boost already used.", task: decorateTask(task, claim) },
          { status: 400 }
        )
      }

      const boostReadyDate = new Date(claim.boost_ready_at)
      const boostSecondsRemaining = getSecondsRemaining(claim.boost_ready_at)

      if (Number.isNaN(boostReadyDate.getTime()) || now.getTime() < boostReadyDate.getTime()) {
        return NextResponse.json(
          {
            error: `Please wait ${boostSecondsRemaining} more second${
              boostSecondsRemaining === 1 ? "" : "s"
            } before claiming your double reward.`,
            boost_seconds_remaining: boostSecondsRemaining,
            task: decorateTask(task, claim),
          },
          { status: 400 }
        )
      }

      boostReward = task.reward
    }

    const newClaimCount = currentClaimCount + 1
    let totalReward = task.reward + boostReward
    let bonusReward = 0

    await addCoins(
      adminDb,
      auth.user.id,
      task.reward,
      `earn_task_${task.id}`,
      `${task.title} complete. +${task.reward} JB Coins added.`
    )

    if (boostReward > 0) {
      await addCoins(
        adminDb,
        auth.user.id,
        boostReward,
        `earn_task_${task.id}_double_reward`,
        `${task.title} double reward boost. +${boostReward} bonus JB Coins added.`
      )
    }

    if (isAdTask(task) && task.bonus_at_claim_count && task.bonus_reward && newClaimCount === task.bonus_at_claim_count) {
      bonusReward = Number(task.bonus_reward || 0)
      totalReward += bonusReward
      await addCoins(adminDb, auth.user.id, bonusReward, "earn_task_watch_ad_bonus", `Watched ${task.bonus_at_claim_count} sponsor ads bonus. +${bonusReward} JB Coins added.`)
    }

    const passive = await addPassiveReferralEarnings(adminDb, auth.user.id, task.id, totalReward)

    const { data: completedClaim, error: completeError } = await adminDb
      .from("earn_task_claims")
      .update({
        claim_count: newClaimCount,
        started_at: null,
        ready_at: null,
        completed_at: now.toISOString(),
        boost_used: boostReward > 0 ? true : Boolean(claim.boost_used),
        updated_at: now.toISOString(),
      })
      .eq("id", claim.id)
      .eq("user_id", auth.user.id)
      .select("*")
      .single()

    if (completeError) {
      return NextResponse.json({ error: completeError.message || "Coins were added, but task completion could not be saved." }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message:
        boostReward > 0
          ? `${task.title} complete. Double reward activated. +${totalReward} JB Coins added!`
          : bonusReward > 0
            ? `${task.title} complete. +${task.reward} JB Coins added, plus +${bonusReward} bonus coins!`
            : `${task.title} complete. +${task.reward} JB Coins added.`,
      task: decorateTask(task, completedClaim as EarnTaskClaimRow),
      coinsAdded: totalReward,
      reward: totalReward,
      baseReward: task.reward,
      boostReward,
      bonusReward,
      passiveReferralReward: passive.passiveReward,
      passiveReferralPercent: REFERRAL_PASSIVE_PERCENT,
      claimCount: newClaimCount,
      maxClaims,
    })
  } catch (error) {
    console.error("Earn tasks POST error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to process earn task." }, { status: 500 })
  }
}
