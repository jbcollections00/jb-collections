import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

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
      return NextResponse.redirect(`${origin}/signup?error=missing-fields`, 303)
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!emailValid) {
      return NextResponse.redirect(`${origin}/signup?error=invalid-email`, 303)
    }

    if (password.length < 6) {
      return NextResponse.redirect(`${origin}/signup?error=password-too-short`, 303)
    }

    if (password !== confirmPassword) {
      return NextResponse.redirect(`${origin}/signup?error=password-mismatch`, 303)
    }

    const cookieStore = await cookies()

    const response = NextResponse.redirect(`${origin}/signup?success=true`, {
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
        emailRedirectTo: `${origin}/auth/callback`,
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
        return NextResponse.redirect(`${origin}/signup?error=email-exists`, 303)
      }

      return NextResponse.redirect(`${origin}/signup?error=failed`, 303)
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

      // Create profile with starting 35 coins
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
            coins: 35,
          },
          { onConflict: "id" }
        )

      if (profileError) {
        console.error("Profile creation error:", profileError)
        return NextResponse.redirect(`${origin}/signup?error=profile-failed`, 303)
      }

      // Add signup bonus history
      const { error: signupHistoryError } = await supabase
        .from("coin_history")
        .insert({
          user_id: newUser.id,
          amount: 35,
          type: "signup_bonus",
          description: "Signup reward: +35 JB Coins",
        })

      if (signupHistoryError) {
        console.error("Signup history insert error:", signupHistoryError)
      }

      // Referral reward for referrer only
      if (referredByUserId) {
        // Give reward to referrer
        const { data: referrerProfile, error: referrerReadError } = await supabase
          .from("profiles")
          .select("coins")
          .eq("id", referredByUserId)
          .single()

        if (referrerReadError) {
          console.error("Referrer read error:", referrerReadError)
        } else {
          const currentCoins = Number(referrerProfile?.coins || 0)
          const referralReward = 35

          const { error: referrerUpdateError } = await supabase
            .from("profiles")
            .update({
              coins: currentCoins + referralReward,
            })
            .eq("id", referredByUserId)

          if (referrerUpdateError) {
            console.error("Referrer coin update error:", referrerUpdateError)
          } else {
            const { error: referrerHistoryError } = await supabase
              .from("coin_history")
              .insert({
                user_id: referredByUserId,
                amount: referralReward,
                type: "referral_bonus",
                description: `Referral reward: +${referralReward} JB Coins`,
              })

            if (referrerHistoryError) {
              console.error("Referrer history insert error:", referrerHistoryError)
            }
          }
        }
      }
    }

    return response
  } catch (error) {
    console.error("Signup route error:", error)

    return NextResponse.redirect(
      `${new URL(req.url).origin}/signup?error=failed`,
      303
    )
  }
}