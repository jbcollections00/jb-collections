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

    // ✅ REFERRAL CODE
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

    // 🔥 SIGNUP USER
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

      // 🔥 FIND REFERRER
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

      // 🔥 CREATE PROFILE
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
          },
          { onConflict: "id" }
        )

      if (profileError) {
        console.error("Profile creation error:", profileError)
      }

      // 🔥 +35 SIGNUP BONUS FOR ALL NEW USERS
      try {
        await supabase.rpc("add_jb_points", {
          p_user_id: newUser.id,
          p_action_type: "signup_bonus",
          p_points: 35,
          p_reference_id: `signup-${newUser.id}`,
          p_note: "Signup reward: 35 JB Coins",
        })
      } catch (err) {
        console.error("Signup bonus error:", err)
      }

      // 🔥 REFERRAL BONUS ONLY IF A VALID REFERRER EXISTS
      if (referredByUserId) {
        try {
          await supabase.rpc("award_invite_points_for_signup", {
            p_new_user_id: newUser.id,
          })
        } catch (err) {
          console.error("Referral bonus error:", err)
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