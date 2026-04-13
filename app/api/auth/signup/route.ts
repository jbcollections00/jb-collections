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

    const referralCode = String(formData.get("referralCode") || "")
      .trim()
      .toUpperCase()

    if (!fullName || !email || !password || !confirmPassword) {
      return NextResponse.redirect(`${origin}/signup?error=missing-fields`, { status: 303 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.redirect(`${origin}/signup?error=invalid-email`, { status: 303 })
    }

    if (password.length < 6) {
      return NextResponse.redirect(`${origin}/signup?error=password-too-short`, { status: 303 })
    }

    if (password !== confirmPassword) {
      return NextResponse.redirect(`${origin}/signup?error=password-mismatch`, { status: 303 })
    }

    const cookieStore = await cookies()

    const response = NextResponse.redirect(`${origin}/signup?success=true`, { status: 303 })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
          set: (name: string, value: string, options: any) =>
            response.cookies.set({ name, value, ...options }),
          remove: (name: string, options: any) =>
            response.cookies.set({ name, value: "", ...options, maxAge: 0 }),
        },
      }
    )

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/api/auth/callback`,
        data: { full_name: fullName },
      },
    })

    if (error) {
      return NextResponse.redirect(`${origin}/signup?error=failed`, { status: 303 })
    }

    const user = data.user

    if (user?.id) {
      // create profile
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        email,
        full_name: fullName,
        coins: 0,
      })

      if (profileError) {
        return NextResponse.redirect(`${origin}/signup?error=profile-save-failed`, { status: 303 })
      }

      // 🔥 signup reward
      const signupReward = 35

      const { error: rewardError } = await supabase.rpc("handle_coin_change", {
        p_user_id: user.id,
        p_amount: signupReward,
        p_type: "signup_bonus",
        p_description: `Signup reward +${signupReward}`,
      })

      // 💥 FALLBACK if RPC fails
      if (rewardError) {
        console.error("RPC failed, applying fallback:", rewardError)

        await supabase
          .from("profiles")
          .update({ coins: signupReward })
          .eq("id", user.id)

        return NextResponse.redirect(`${origin}/signup?error=reward-failed`, { status: 303 })
      }
    }

    return response
  } catch (err) {
    console.error(err)
    return NextResponse.redirect(`${new URL(req.url).origin}/signup?error=failed`, {
      status: 303,
    })
  }
}