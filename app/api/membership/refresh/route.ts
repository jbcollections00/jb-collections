import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function normalizeMembership(value?: string | null) {
  const membership = String(value || "").trim().toLowerCase()
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  return "standard"
}

export async function POST() {
  try {
    const cookieStore = await cookies()

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      )
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select(
        "id, role, membership, is_premium, membership_payment_type, membership_started_at, membership_expires_at"
      )
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    if (String(profile.role || "").toLowerCase() === "admin") {
      return NextResponse.json({
        success: true,
        expired: false,
        membership: "platinum",
        is_premium: true,
        is_platinum: true,
        membership_payment_type: "none",
        membership_started_at: null,
        membership_expires_at: null,
      })
    }

    const membership = normalizeMembership(profile.membership)
    const expiresAt = profile.membership_expires_at
    const expired =
      membership !== "standard" &&
      !!expiresAt &&
      new Date(expiresAt).getTime() <= Date.now()

    if (expired) {
      const { error: updateError } = await adminSupabase
        .from("profiles")
        .update({
          membership: "standard",
          is_premium: false,
          membership_payment_type: "none",
          membership_started_at: null,
          membership_expires_at: null,
        })
        .eq("id", user.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        expired: true,
        membership: "standard",
        is_premium: false,
        is_platinum: false,
        membership_payment_type: "none",
        membership_started_at: null,
        membership_expires_at: null,
      })
    }

    return NextResponse.json({
      success: true,
      expired: false,
      membership,
      is_premium: membership === "premium" || membership === "platinum",
      is_platinum: membership === "platinum",
      membership_payment_type: profile.membership_payment_type || "none",
      membership_started_at: profile.membership_started_at ?? null,
      membership_expires_at: expiresAt ?? null,
    })
  } catch (error) {
    console.error("Membership refresh error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}