import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

type RedeemPlan = "premium" | "platinum"

const PLAN_COST: Record<RedeemPlan, number> = {
  premium: 1000,
  platinum: 1500,
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
      .select("id, role, membership, is_premium, jb_points")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError || !myProfile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 })
    }

    const currentMembership = normalizeMembership(myProfile)
    const currentCoins = Number(myProfile.jb_points || 0)
    const requiredCoins = PLAN_COST[plan]

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
        },
        { status: 400 }
      )
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

    const nextCoins = currentCoins - requiredCoins
    const nextMembership = plan
    const nextIsPremium = plan === "premium" || plan === "platinum"

    const { data: updatedProfile, error: updateError } = await adminDb
      .from("profiles")
      .update({
        membership: nextMembership,
        is_premium: nextIsPremium,
        jb_points: nextCoins,
      })
      .eq("id", user.id)
      .gte("jb_points", requiredCoins)
      .select("membership, is_premium, jb_points")
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