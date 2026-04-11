import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createClient as createSupabaseAdmin, SupabaseClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

type RedeemPlan = "premium" | "platinum"

type CoinSettingRow = {
  key: string
  value_integer: number | null
}

function normalizeMembership(profile: {
  role?: string | null
  membership?: string | null
  is_premium?: boolean | null
}) {
  const role = String(profile?.role || "").trim().toLowerCase()
  const membership = String(profile?.membership || "").trim().toLowerCase()

  if (role === "admin") return "admin"
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  if (profile?.is_premium) return "premium"
  return "standard"
}

function getDefaultPlanCosts() {
  return {
    redeem_premium_cost: 1000,
    redeem_platinum_cost: 1500,
  }
}

/**
 * 🔥 FIXED TYPE HERE
 * Use generic SupabaseClient instead of ReturnType<typeof createSupabaseAdmin>
 */
async function loadPlanCosts(adminDb: SupabaseClient) {
  const defaults = getDefaultPlanCosts()

  const { data, error } = await adminDb
    .from("jb_coin_settings")
    .select("key, value_integer")
    .in("key", ["redeem_premium_cost", "redeem_platinum_cost"])

  if (error) {
    console.error("Failed to load redeem costs:", error)
    return defaults
  }

  const rows = (Array.isArray(data) ? data : []) as CoinSettingRow[]

  return {
    redeem_premium_cost:
      rows.find((row) => row.key === "redeem_premium_cost")?.value_integer ??
      defaults.redeem_premium_cost,
    redeem_platinum_cost:
      rows.find((row) => row.key === "redeem_platinum_cost")?.value_integer ??
      defaults.redeem_platinum_cost,
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json()) as { plan?: RedeemPlan }
    const plan = body?.plan

    if (plan !== "premium" && plan !== "platinum") {
      return NextResponse.json({ error: "Invalid redeem plan." }, { status: 400 })
    }

    const { data: myProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, membership, is_premium, coins")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError || !myProfile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: "Missing Supabase server environment variables." },
        { status: 500 }
      )
    }

    const adminDb = createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const planCosts = await loadPlanCosts(adminDb)

    const requiredCoins =
      plan === "premium"
        ? Number(planCosts.redeem_premium_cost || 0)
        : Number(planCosts.redeem_platinum_cost || 0)

    const currentMembership = normalizeMembership(myProfile)
    const currentCoins = Number(myProfile.coins || 0)

    if (currentMembership === "admin") {
      return NextResponse.json(
        { error: "Administrator accounts cannot redeem memberships." },
        { status: 400 }
      )
    }

    if (currentMembership === "platinum") {
      return NextResponse.json(
        { error: "Your account is already Platinum." },
        { status: 400 }
      )
    }

    if (plan === "premium" && currentMembership === "premium") {
      return NextResponse.json(
        { error: "Your account is already Premium." },
        { status: 400 }
      )
    }

    if (currentCoins < requiredCoins) {
      return NextResponse.json(
        {
          error: `You need ${requiredCoins} JB Coins to redeem ${plan}.`,
          requiredCoins,
          currentCoins,
        },
        { status: 400 }
      )
    }

    const { error: deductError } = await adminDb.rpc("handle_coin_change", {
      p_user_id: user.id,
      p_amount: -requiredCoins,
      p_type: "redeem_membership",
      p_description: `Redeemed ${plan} membership (-${requiredCoins} JB Coins)`,
    })

    if (deductError) {
      console.error("Coin deduction error:", deductError)
      return NextResponse.json(
        { error: "Failed to deduct coins." },
        { status: 500 }
      )
    }

    const nextMembership = plan
    const nextIsPremium = plan === "premium" || plan === "platinum"

    const { data: updatedProfile, error: updateError } = await adminDb
      .from("profiles")
      .update({
        membership: nextMembership,
        is_premium: nextIsPremium,
      })
      .eq("id", user.id)
      .select("membership, is_premium, coins")
      .single()

    if (updateError || !updatedProfile) {
      return NextResponse.json(
        {
          error:
            updateError?.message ||
            "Redeem failed. Please refresh and try again.",
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message:
        plan === "premium"
          ? "Premium redeemed successfully."
          : "Platinum redeemed successfully.",
      requiredCoins,
      profile: updatedProfile,
    })
  } catch (error) {
    console.error("Redeem membership route error:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error.",
      },
      { status: 500 }
    )
  }
}