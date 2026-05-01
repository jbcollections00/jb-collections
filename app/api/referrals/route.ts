import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

const DIRECT_REFERRAL_REWARD = 25
const REFERRAL_PASSIVE_PERCENT = 10

const MILESTONES = [
  { referrals: 10, reward: 100 },
  { referrals: 20, reward: 250 },
  { referrals: 30, reward: 500 },
  { referrals: 40, reward: 750 },
  { referrals: 50, reward: 1000 },
  { referrals: 75, reward: 1750 },
  { referrals: 100, reward: 3000 },
]

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

function normalizeCode(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
}

function makeReferralCode(userId: string) {
  return `JB${userId.replace(/-/g, "").slice(0, 8).toUpperCase()}`
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

async function ensureReferralCode(adminDb: ReturnType<typeof createAdminDb>, userId: string) {
  const { data: profile, error } = await adminDb
    .from("profiles")
    .select("id, referral_code, full_name, name, username")
    .eq("id", userId)
    .maybeSingle()

  if (error) throw new Error(error.message || "Failed to load profile.")
  if (!profile) throw new Error("Profile not found.")

  if (profile.referral_code) {
    return { profile, code: String(profile.referral_code) }
  }

  const generatedCode = makeReferralCode(userId)
  const { data: updatedProfile, error: updateError } = await adminDb
    .from("profiles")
    .update({ referral_code: generatedCode })
    .eq("id", userId)
    .select("id, referral_code, full_name, name, username")
    .single()

  if (updateError) throw new Error(updateError.message || "Failed to save referral code.")

  return { profile: updatedProfile, code: generatedCode }
}

async function getReferralStats(adminDb: ReturnType<typeof createAdminDb>, userId: string) {
  const { count: directCount, error: directCountError } = await adminDb
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", userId)

  if (directCountError) throw new Error(directCountError.message || "Failed to load referral count.")

  const { data: earningsRows, error: earningsError } = await adminDb
    .from("referral_earnings")
    .select("earning_amount")
    .eq("referrer_id", userId)

  if (earningsError) throw new Error(earningsError.message || "Failed to load referral earnings.")

  const passiveEarnings = (earningsRows || []).reduce((sum, row) => sum + Number(row.earning_amount || 0), 0)

  const { data: claimedMilestones, error: milestoneError } = await adminDb
    .from("referral_milestone_claims")
    .select("milestone_count, reward_amount")
    .eq("user_id", userId)

  if (milestoneError) throw new Error(milestoneError.message || "Failed to load referral milestones.")

  const claimedCounts = new Set((claimedMilestones || []).map((row) => Number(row.milestone_count || 0)))
  const milestoneRewardsClaimed = (claimedMilestones || []).reduce((sum, row) => sum + Number(row.reward_amount || 0), 0)

  const milestones = MILESTONES.map((milestone) => ({
    ...milestone,
    claimed: claimedCounts.has(milestone.referrals),
    unlocked: Number(directCount || 0) >= milestone.referrals,
  }))

  return {
    directReferrals: Number(directCount || 0),
    passiveEarnings,
    milestoneRewardsClaimed,
    milestones,
    nextMilestone: milestones.find((m) => !m.claimed && !m.unlocked) || milestones.find((m) => !m.claimed) || null,
  }
}

export async function GET() {
  try {
    const auth = await getAuthenticatedUser()
    if (!auth.ok) return auth.response

    const adminDb = createAdminDb()
    const { code } = await ensureReferralCode(adminDb, auth.user.id)
    const stats = await getReferralStats(adminDb, auth.user.id)

    const { data: myReferral } = await adminDb
      .from("referrals")
      .select("id, referrer_id, created_at")
      .eq("user_id", auth.user.id)
      .maybeSingle()

    return NextResponse.json({
      ok: true,
      referralCode: code,
      referralLink: `/register?ref=${code}`,
      directReward: DIRECT_REFERRAL_REWARD,
      passivePercent: REFERRAL_PASSIVE_PERCENT,
      hasReferrer: Boolean(myReferral?.referrer_id),
      stats,
    })
  } catch (error) {
    console.error("Referral GET error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load referral system." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser()
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || "apply").trim().toLowerCase()
    const adminDb = createAdminDb()

    if (action === "apply") {
      const code = normalizeCode(body?.code)
      if (!code) return NextResponse.json({ error: "Enter a referral code." }, { status: 400 })

      const { data: existingReferral, error: existingError } = await adminDb
        .from("referrals")
        .select("id, referrer_id")
        .eq("user_id", auth.user.id)
        .maybeSingle()

      if (existingError) return NextResponse.json({ error: existingError.message || "Failed to check referral." }, { status: 500 })
      if (existingReferral) return NextResponse.json({ error: "You already used a referral code." }, { status: 400 })

      const { data: referrer, error: referrerError } = await adminDb
        .from("profiles")
        .select("id, referral_code")
        .eq("referral_code", code)
        .maybeSingle()

      if (referrerError) return NextResponse.json({ error: referrerError.message || "Failed to verify referral code." }, { status: 500 })
      if (!referrer) return NextResponse.json({ error: "Invalid referral code." }, { status: 400 })
      if (referrer.id === auth.user.id) return NextResponse.json({ error: "You cannot use your own referral code." }, { status: 400 })

      const { data: insertedReferral, error: insertError } = await adminDb
        .from("referrals")
        .insert({ user_id: auth.user.id, referrer_id: referrer.id })
        .select("id")
        .single()

      if (insertError) return NextResponse.json({ error: insertError.message || "Failed to apply referral code." }, { status: 500 })

      await addCoins(adminDb, referrer.id, DIRECT_REFERRAL_REWARD, "direct_referral_bonus", `Direct referral bonus. +${DIRECT_REFERRAL_REWARD} JB Coins added.`)

      return NextResponse.json({
        ok: true,
        message: "Referral code applied successfully.",
        referralId: insertedReferral.id,
        referrerReward: DIRECT_REFERRAL_REWARD,
      })
    }

    if (action === "claim_milestone") {
      const milestoneCount = Number(body?.milestoneCount || body?.milestone_count || 0)
      const milestone = MILESTONES.find((item) => item.referrals === milestoneCount)
      if (!milestone) return NextResponse.json({ error: "Invalid milestone." }, { status: 400 })

      const stats = await getReferralStats(adminDb, auth.user.id)
      if (stats.directReferrals < milestone.referrals) {
        return NextResponse.json({ error: `You need ${milestone.referrals} referrals to claim this milestone.` }, { status: 400 })
      }

      const { data: existingClaim } = await adminDb
        .from("referral_milestone_claims")
        .select("id")
        .eq("user_id", auth.user.id)
        .eq("milestone_count", milestone.referrals)
        .maybeSingle()

      if (existingClaim?.id) return NextResponse.json({ error: "Milestone already claimed." }, { status: 400 })

      const { error: claimError } = await adminDb
        .from("referral_milestone_claims")
        .insert({ user_id: auth.user.id, milestone_count: milestone.referrals, reward_amount: milestone.reward })

      if (claimError) return NextResponse.json({ error: claimError.message || "Failed to claim milestone." }, { status: 500 })

      await addCoins(adminDb, auth.user.id, milestone.reward, "referral_milestone_bonus", `Referral milestone ${milestone.referrals} users. +${milestone.reward} JB Coins added.`)

      return NextResponse.json({ ok: true, message: `Milestone claimed. +${milestone.reward} JB Coins added.`, reward: milestone.reward, milestone })
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 })
  } catch (error) {
    console.error("Referral POST error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to process referral request." }, { status: 500 })
  }
}
