import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Resend } from "resend"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const upgradeId = String(body?.upgradeId || "").trim()
    const adminReply = String(body?.adminReply || "").trim()

    if (!upgradeId) {
      return NextResponse.json(
        { ok: false, error: "Upgrade request ID is required." },
        { status: 400 }
      )
    }

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
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
    }

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (adminProfile?.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Admin access required." },
        { status: 403 }
      )
    }

    const { data: upgrade } = await supabase
      .from("upgrades")
      .select("*")
      .eq("id", upgradeId)
      .maybeSingle()

    if (!upgrade) {
      return NextResponse.json(
        { ok: false, error: "Upgrade request not found." },
        { status: 404 }
      )
    }

    if (upgrade.coins_credited) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("coins")
        .eq("id", upgrade.sender_id)
        .maybeSingle()

      return NextResponse.json({
        ok: true,
        alreadyCredited: true,
        newCoins: Number(profile?.coins || 0),
      })
    }

    const coins = Number(upgrade.coins || 0)

    if (!coins || coins <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid coin amount." },
        { status: 400 }
      )
    }

    // 🔥 CENTRAL SYSTEM (IMPORTANT)
    const { error: coinError } = await supabase.rpc("handle_coin_change", {
      p_user_id: upgrade.sender_id,
      p_amount: coins,
      p_type: "payment_credit",
      p_description: "Payment approved - JB Coins added",
    })

    if (coinError) {
      console.error("Coin system error:", coinError)
      return NextResponse.json(
        { ok: false, error: "Failed to credit coins." },
        { status: 500 }
      )
    }

    // Update upgrade status
    const { error: approveError } = await supabase
      .from("upgrades")
      .update({
        status: "approved",
        admin_reply:
          adminReply || "Payment approved and JB Coins credited successfully.",
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        coins_credited: true,
        coins_credited_at: new Date().toISOString(),
      })
      .eq("id", upgradeId)

    if (approveError) {
      return NextResponse.json(
        { ok: false, error: "Failed to update request." },
        { status: 500 }
      )
    }

    // EMAIL (optional)
    try {
      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY)

        await resend.emails.send({
          from: "JB Collections <noreply@jb-collections.com>",
          to: upgrade.email,
          subject: "Payment Confirmed – JB Coins Added 💰",
          html: `<p>Your payment has been approved. ${coins} JB Coins added.</p>`,
        })
      }
    } catch (err) {
      console.error("Email error:", err)
    }

    return NextResponse.json({
      ok: true,
      newCoins: coins,
      message: "Payment approved and coins credited.",
    })
  } catch (error) {
    console.error("Approve upgrade route error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to approve payment." },
      { status: 500 }
    )
  }
}