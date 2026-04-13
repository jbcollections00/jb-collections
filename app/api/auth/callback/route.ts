import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"

const REFERRAL_COOKIE_KEY = "jb_referral_code"
const SIGNUP_REWARD = 35
const REFERRAL_REWARD = 35

export async function GET(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin

  try {
    const cookieStore = await cookies()

    const response = NextResponse.redirect(`${origin}/dashboard`, {
      status: 303,
    })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: Record<string, any>) {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: Record<string, any>) {
            response.cookies.set({
              name,
              value: "",
              ...options,
              maxAge: 0,
            })
          },
        },
      }
    )

    const code = url.searchParams.get("code")
    const referralCodeFromUrl = String(url.searchParams.get("ref") || "")
      .trim()
      .toUpperCase()
    const referralCodeFromCookie = String(
      cookieStore.get(REFERRAL_COOKIE_KEY)?.value || ""
    )
      .trim()
      .toUpperCase()
    const referralCode = referralCodeFromUrl || referralCodeFromCookie || null

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error("Callback exchange error:", error)
        return NextResponse.redirect(`${origin}/login?error=callback-failed`, {
          status: 303,
        })
      }
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user?.id) {
      console.error("Callback getUser error:", userError)
      return response
    }

    const email = (user.email || "").trim().toLowerCase()
    const fullName =
      String(
        user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.user_metadata?.user_name ||
          "User"
      ).trim() || "User"

    const username =
      email.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "") || null

    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id, coins, referred_by")
      .eq("id", user.id)
      .maybeSingle()

    if (profileLookupError) {
      console.error("Profile lookup error:", profileLookupError)
    }

    let referredByUserId: string | null = existingProfile?.referred_by ?? null

    if (!referredByUserId && referralCode) {
      const { data: refUser, error: refUserError } = await supabase
        .from("profiles")
        .select("id")
        .eq("referral_code", referralCode)
        .maybeSingle()

      if (refUserError) {
        console.error("Referral lookup error:", refUserError)
      }

      if (refUser?.id && refUser.id !== user.id) {
        referredByUserId = refUser.id
      }
    }

    const profilePayload = {
      id: user.id,
      email: user.email ?? email,
      full_name: fullName,
      name: fullName,
      username,
      membership: "standard",
      account_status: "Active",
      status: "Active",
      is_premium: false,
      premium: false,
      role: "user",
      referred_by: referredByUserId,
      coins: existingProfile?.coins ?? 0,
    }

    const { error: profileUpsertError } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })

    if (profileUpsertError) {
      console.error("Callback profile upsert error:", profileUpsertError)
      return NextResponse.redirect(`${origin}/signup?error=profile-save-failed`, {
        status: 303,
      })
    }

    const { data: existingSignupBonus, error: signupBonusLookupError } =
      await supabase
        .from("coin_history")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "signup_bonus")
        .maybeSingle()

    if (signupBonusLookupError) {
      console.error("Signup bonus lookup error:", signupBonusLookupError)
    }

    if (!existingSignupBonus) {
      const { error: signupRewardError } = await supabase.rpc(
        "handle_coin_change",
        {
          p_user_id: user.id,
          p_amount: SIGNUP_REWARD,
          p_type: "signup_bonus",
          p_description: `Signup reward: +${SIGNUP_REWARD} JB Coins`,
        }
      )

      if (signupRewardError) {
        console.error("OAuth signup reward RPC error:", signupRewardError)

        const { error: fallbackError } = await supabase
          .from("profiles")
          .update({ coins: (existingProfile?.coins ?? 0) + SIGNUP_REWARD })
          .eq("id", user.id)

        if (fallbackError) {
          console.error("OAuth signup reward fallback error:", fallbackError)
        }
      }
    }

    if (referredByUserId) {
      const { data: existingReferralReward, error: referralLookupError } =
        await supabase
          .from("coin_history")
          .select("id")
          .eq("user_id", referredByUserId)
          .eq("type", "referral_bonus")
          .ilike("description", `%${user.id}%`)
          .maybeSingle()

      if (referralLookupError) {
        console.error("Referral reward lookup error:", referralLookupError)
      }

      if (!existingReferralReward) {
        const { error: referralRewardError } = await supabase.rpc(
          "handle_coin_change",
          {
            p_user_id: referredByUserId,
            p_amount: REFERRAL_REWARD,
            p_type: "referral_bonus",
            p_description: `Referral reward for invited user ${user.id}: +${REFERRAL_REWARD} JB Coins`,
          }
        )

        if (referralRewardError) {
          console.error("OAuth referral reward RPC error:", referralRewardError)
        }
      }
    }

    response.cookies.set({
      name: REFERRAL_COOKIE_KEY,
      value: "",
      path: "/",
      maxAge: 0,
    })

    return response
  } catch (error) {
    console.error("Auth callback error:", error)
    return NextResponse.redirect(`${origin}/login?error=server-error`, {
      status: 303,
    })
  }
}
