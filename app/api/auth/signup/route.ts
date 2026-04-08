import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin

  try {
    const formData = await req.formData()

    const fullName = String(formData.get("fullName") || "").trim()
    const email = String(formData.get("email") || "").trim().toLowerCase()
    const password = String(formData.get("password") || "")
    const confirmPassword = String(formData.get("confirmPassword") || "")

    const referralCodeFromForm = String(formData.get("referralCode") || "")
      .trim()
      .toUpperCase()
    const referralCodeFromUrl = String(url.searchParams.get("ref") || "")
      .trim()
      .toUpperCase()
    const referralCode = referralCodeFromForm || referralCodeFromUrl || null

    if (!fullName || !email || !password || !confirmPassword) {
      return NextResponse.redirect(`${origin}/signup?error=missing-fields`, {
        status: 303,
      })
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!emailValid) {
      return NextResponse.redirect(`${origin}/signup?error=invalid-email`, {
        status: 303,
      })
    }

    if (password.length < 6) {
      return NextResponse.redirect(`${origin}/signup?error=password-too-short`, {
        status: 303,
      })
    }

    if (password !== confirmPassword) {
      return NextResponse.redirect(`${origin}/signup?error=password-mismatch`, {
        status: 303,
      })
    }

    const cookieStore = await cookies()

    const response = NextResponse.redirect(`${origin}/signup?success=true`, {
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
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: Record<string, any>) {
            response.cookies.set({ name, value: "", ...options, maxAge: 0 })
          },
        },
      }
    )

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/api/auth/callback`,
        data: {
          full_name: fullName,
          name: fullName,
        },
      },
    })

    if (signUpError) {
      const message = signUpError.message.toLowerCase()

      if (
        message.includes("already registered") ||
        message.includes("user already registered")
      ) {
        return NextResponse.redirect(`${origin}/signup?error=email-exists`, {
          status: 303,
        })
      }

      console.error("Signup auth error:", signUpError)
      return NextResponse.redirect(`${origin}/signup?error=failed`, {
        status: 303,
      })
    }

    const newUser = signUpData.user

    if (newUser?.id) {
      const username =
        email.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "") || null

      let referredByUserId: string | null = null

      if (referralCode) {
        const { data: refUser, error: refUserError } = await supabase
          .from("profiles")
          .select("id")
          .eq("referral_code", referralCode)
          .maybeSingle()

        if (refUserError) {
          console.error("Referral lookup error:", refUserError)
        }

        if (refUser?.id && refUser.id !== newUser.id) {
          referredByUserId = refUser.id
        }
      }

      const signupReward = 35

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: newUser.id,
            email: newUser.email ?? email,
            full_name: fullName,
            name: fullName,
            username,
            membership: "standard",
            account_status: "Active",
            status: "Active",
            is_premium: false,
            role: "user",
            referred_by: referredByUserId,
            coins: 0,
          },
          { onConflict: "id" }
        )

      if (profileError) {
        console.error("Profile creation error:", profileError)
        return NextResponse.redirect(`${origin}/signup?error=profile-failed`, {
          status: 303,
        })
      }

      const { error: signupRewardError } = await supabase.rpc(
        "handle_coin_change",
        {
          p_user_id: newUser.id,
          p_amount: signupReward,
          p_type: "signup_bonus",
          p_description: `Signup reward: +${signupReward} JB Coins`,
        }
      )

      if (signupRewardError) {
        console.error("Signup reward RPC error:", signupRewardError)
      }

      if (referredByUserId) {
        const referralReward = 35

        const { error: referralRewardError } = await supabase.rpc(
          "handle_coin_change",
          {
            p_user_id: referredByUserId,
            p_amount: referralReward,
            p_type: "referral_bonus",
            p_description: `Referral reward: +${referralReward} JB Coins`,
          }
        )

        if (referralRewardError) {
          console.error("Referral reward RPC error:", referralRewardError)
        }
      }
    }

    return response
  } catch (error) {
    console.error("Signup route error:", error)

    return NextResponse.redirect(`${new URL(req.url).origin}/signup?error=failed`, {
      status: 303,
    })
  }
}