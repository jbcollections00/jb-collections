import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"
import { cookies } from "next/headers"

type ProfileRow = {
  id: string
  membership?: string | null
  jb_points?: number | null
  role?: string | null
  is_premium?: boolean | null
}

function normalizePlan(value?: string | null) {
  const plan = String(value || "").trim().toLowerCase()
  if (plan === "platinum") return "platinum"
  return "premium"
}

function normalizeMembership(value?: string | null) {
  const membership = String(value || "").trim().toLowerCase()
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  return "standard"
}

function getRequiredCoins(plan: "premium" | "platinum") {
  if (plan === "platinum") return 2600
  return 2000
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin

  try {
    const formData = await req.formData()

    const selectedPlan = normalizePlan(String(formData.get("plan") || "premium"))
    const requiredCoins = getRequiredCoins(selectedPlan)

    const cookieStore = await cookies()

    const responseRedirect = (params: string) =>
      NextResponse.redirect(`${origin}/upgrade?${params}&plan=${selectedPlan}`, {
        status: 303,
      })

    const supabase = createServerClient(
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return responseRedirect("error=auth-required")
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase env for redeem backend.")
      return responseRedirect("error=redeem-failed")
    }

    const admin = createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: profileData, error: profileError } = await admin
      .from("profiles")
      .select("id, membership, jb_points, role, is_premium")
      .eq("id", user.id)
      .single()

    if (profileError || !profileData) {
      console.error("Redeem profile fetch error:", profileError)
      return responseRedirect("error=redeem-failed")
    }

    const profile = profileData as ProfileRow
    const currentMembership = normalizeMembership(profile.membership)
    const currentCoins = Number(profile.jb_points || 0)

    if (selectedPlan === "premium" && currentMembership !== "standard") {
      return responseRedirect("error=already-premium")
    }

    if (selectedPlan === "platinum" && currentMembership === "platinum") {
      return responseRedirect("error=already-platinum")
    }

    if (currentCoins < requiredCoins) {
      return responseRedirect("error=insufficient-coins")
    }

    const nextMembership = selectedPlan
    const nextCoins = currentCoins - requiredCoins

    const updatePayload =
      selectedPlan === "platinum"
        ? {
            membership: "platinum",
            is_premium: true,
          }
        : {
            membership: "premium",
            is_premium: true,
          }

    const { error: updateError } = await admin
      .from("profiles")
      .update({
        ...updatePayload,
        jb_points: nextCoins,
      })
      .eq("id", user.id)
      .eq("jb_points", currentCoins)

    if (updateError) {
      console.error("Redeem profile update error:", updateError)
      return responseRedirect("error=redeem-failed")
    }

    const txInsert = await admin.from("jb_coin_transactions").insert({
      user_id: user.id,
      amount: -requiredCoins,
      action_type: selectedPlan === "platinum" ? "redeem_platinum" : "redeem_premium",
      description:
        selectedPlan === "platinum"
          ? "Redeemed Platinum membership using JB Coins"
          : "Redeemed Premium membership using JB Coins",
    })

    if (txInsert.error) {
      console.error("Redeem transaction insert error:", txInsert.error)

      const rollbackMembership =
        currentMembership === "platinum"
          ? { membership: "platinum", is_premium: true }
          : currentMembership === "premium"
            ? { membership: "premium", is_premium: true }
            : { membership: "free", is_premium: false }

      const rollbackResult = await admin
        .from("profiles")
        .update({
          ...rollbackMembership,
          jb_points: currentCoins,
        })
        .eq("id", user.id)

      if (rollbackResult.error) {
        console.error("Redeem rollback error:", rollbackResult.error)
      }

      return responseRedirect("error=redeem-failed")
    }

    return responseRedirect("success=redeemed")
  } catch (error) {
    console.error("Redeem coins route error:", error)
    return NextResponse.redirect(
      `${new URL(req.url).origin}/upgrade?error=unexpected`,
      { status: 303 }
    )
  }
}