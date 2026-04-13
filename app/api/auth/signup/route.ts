import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

type CookieToSet = {
  name: string
  value: string
  options?: {
    domain?: string
    path?: string
    maxAge?: number
    expires?: Date
    httpOnly?: boolean
    secure?: boolean
    sameSite?: "lax" | "strict" | "none"
  }
}

const SIGNUP_REWARD = 35
const REFERRAL_REWARD = 25

function redirect(origin: string, error?: string) {
  const target = error
    ? `${origin}/signup?error=${encodeURIComponent(error)}`
    : `${origin}/signup?success=true`

  return NextResponse.redirect(target, { status: 303 })
}

function buildAuthClient(response: NextResponse) {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...(options ?? {}) })
          })
        },
      },
    }
  )
}

function buildAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

async function ensureProfile(admin: ReturnType<typeof buildAdminClient>, params: {
  userId: string
  email: string
  fullName: string
}) {
  const { userId, email, fullName } = params

  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName,
    },
    { onConflict: "id" }
  )

  return error
}

async function grantSignupRewardOnce(admin: ReturnType<typeof buildAdminClient>, userId: string) {
  const rewardTag = `signup_reward:${userId}`

  const { data: existing, error: lookupError } = await admin
    .from("coin_history")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "signup_bonus")
    .eq("reference", rewardTag)
    .maybeSingle()

  if (lookupError && lookupError.code !== "PGRST116") {
    return { ok: false as const, error: lookupError, alreadyApplied: false }
  }

  if (existing) {
    return { ok: true as const, alreadyApplied: true }
  }

  const { error } = await admin.rpc("handle_coin_change", {
    p_user_id: userId,
    p_amount: SIGNUP_REWARD,
    p_type: "signup_bonus",
    p_description: `Signup reward +${SIGNUP_REWARD}`,
    p_reference: rewardTag,
  })

  if (!error) {
    return { ok: true as const, alreadyApplied: false }
  }

  return { ok: false as const, error, alreadyApplied: false }
}

async function applyReferralIfValid(
  admin: ReturnType<typeof buildAdminClient>,
  params: { userId: string; referralCode: string }
) {
  const { userId, referralCode } = params

  if (!referralCode) {
    return { ok: true as const, skipped: true as const }
  }

  const { data: owner, error: ownerError } = await admin
    .from("profiles")
    .select("id, referral_code")
    .eq("referral_code", referralCode)
    .maybeSingle()

  if (ownerError && ownerError.code !== "PGRST116") {
    return { ok: false as const, error: ownerError }
  }

  if (!owner?.id) {
    return { ok: true as const, skipped: true as const, invalid: true as const }
  }

  if (owner.id === userId) {
    return { ok: true as const, skipped: true as const, selfReferralBlocked: true as const }
  }

  const referralRef = `referral_bonus:${owner.id}:${userId}`

  const { data: existingReferral, error: referralLookupError } = await admin
    .from("coin_history")
    .select("id")
    .eq("reference", referralRef)
    .maybeSingle()

  if (referralLookupError && referralLookupError.code !== "PGRST116") {
    return { ok: false as const, error: referralLookupError }
  }

  if (existingReferral) {
    return { ok: true as const, skipped: true as const, duplicateBlocked: true as const }
  }

  const { error: linkError } = await admin
    .from("profiles")
    .update({ referred_by: owner.id })
    .eq("id", userId)
    .is("referred_by", null)

  if (linkError) {
    return { ok: false as const, error: linkError }
  }

  const { data: linkedProfile, error: linkedProfileError } = await admin
    .from("profiles")
    .select("referred_by")
    .eq("id", userId)
    .maybeSingle()

  if (linkedProfileError && linkedProfileError.code !== "PGRST116") {
    return { ok: false as const, error: linkedProfileError }
  }

  if (!linkedProfile?.referred_by || linkedProfile.referred_by !== owner.id) {
    return { ok: true as const, skipped: true as const, duplicateBlocked: true as const }
  }

  const { error: referralRewardError } = await admin.rpc("handle_coin_change", {
    p_user_id: owner.id,
    p_amount: REFERRAL_REWARD,
    p_type: "referral_bonus",
    p_description: `Referral reward +${REFERRAL_REWARD}`,
    p_reference: referralRef,
  })

  if (referralRewardError) {
    return { ok: false as const, error: referralRewardError }
  }

  return { ok: true as const, skipped: false as const }
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin

  try {
    const formData = await req.formData()

    const fullName = String(formData.get("fullName") || "").trim()
    const email = String(formData.get("email") || "").trim().toLowerCase()
    const password = String(formData.get("password") || "")
    const confirmPassword = String(formData.get("confirmPassword") || "")
    const referralCode = String(formData.get("referralCode") || "")
      .trim()
      .toUpperCase()

    if (!fullName || !email || !password || !confirmPassword) {
      return redirect(origin, "missing-fields")
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return redirect(origin, "invalid-email")
    }

    if (password.length < 6) {
      return redirect(origin, "password-too-short")
    }

    if (password !== confirmPassword) {
      return redirect(origin, "password-mismatch")
    }

    const response = redirect(origin)
    const supabase = buildAuthClient(response)
    const admin = buildAdminClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/api/auth/callback`,
        data: { full_name: fullName },
      },
    })

    if (error) {
      console.error("signup failed:", error)
      return redirect(origin, "failed")
    }

    const user = data.user

    if (!user?.id) {
      return redirect(origin, "failed")
    }

    const profileError = await ensureProfile(admin, {
      userId: user.id,
      email,
      fullName,
    })

    if (profileError) {
      console.error("profile save failed:", profileError)
      return redirect(origin, "profile-save-failed")
    }

    const signupRewardResult = await grantSignupRewardOnce(admin, user.id)

    if (!signupRewardResult.ok) {
      console.error("signup reward failed:", signupRewardResult.error)
      return redirect(origin, "reward-failed")
    }

    const referralResult = await applyReferralIfValid(admin, {
      userId: user.id,
      referralCode,
    })

    if (!referralResult.ok) {
      console.error("referral reward failed:", referralResult.error)
      return redirect(origin, "referral-failed")
    }

    return response
  } catch (err) {
    console.error("signup route crashed:", err)
    return redirect(new URL(req.url).origin, "failed")
  }
}
