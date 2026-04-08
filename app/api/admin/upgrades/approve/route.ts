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
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 }
      )
    }

    const { data: adminProfile, error: adminError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (adminError || adminProfile?.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Admin access required." },
        { status: 403 }
      )
    }

    const { data: upgrade, error: upgradeError } = await supabase
      .from("upgrades")
      .select("*")
      .eq("id", upgradeId)
      .maybeSingle()

    if (upgradeError || !upgrade) {
      return NextResponse.json(
        { ok: false, error: "Upgrade request not found." },
        { status: 404 }
      )
    }

    if (!upgrade.sender_id) {
      return NextResponse.json(
        { ok: false, error: "This request has no user attached." },
        { status: 400 }
      )
    }

    if (upgrade.coins_credited) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("jb_points")
        .eq("id", upgrade.sender_id)
        .maybeSingle()

      return NextResponse.json({
        ok: true,
        alreadyCredited: true,
        newCoins: Number(profile?.jb_points || 0),
        message: "Coins were already credited for this payment.",
      })
    }

    const coins = Number(upgrade.coins || 0)
    if (!Number.isFinite(coins) || coins <= 0) {
      return NextResponse.json(
        { ok: false, error: "This payment request has no valid coin amount." },
        { status: 400 }
      )
    }

    const { data: currentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("jb_points, email, full_name")
      .eq("id", upgrade.sender_id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json(
        { ok: false, error: "Failed to load user profile." },
        { status: 500 }
      )
    }

    const currentCoins = Number(currentProfile?.jb_points || 0)
    const newCoins = currentCoins + coins

    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({ jb_points: newCoins })
      .eq("id", upgrade.sender_id)

    if (updateProfileError) {
      return NextResponse.json(
        { ok: false, error: "Failed to credit user coins." },
        { status: 500 }
      )
    }

    const packageLabel =
      String(upgrade.package_label || "").trim() ||
      String(upgrade.subject || "").trim() ||
      "JB Coin top-up"

    const { error: historyError } = await supabase
      .from("coin_history")
      .insert({
        user_id: upgrade.sender_id,
        amount: coins,
        type: "credit",
        source: "payment_approval",
        description: `${packageLabel} approved payment`,
        created_at: new Date().toISOString(),
      })

    if (historyError) {
      console.error("Coin history insert error:", historyError)
    }

    const { error: approveError } = await supabase
      .from("upgrades")
      .update({
        status: "approved",
        admin_reply: adminReply || "Payment approved and JB Coins credited successfully.",
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        coins_credited: true,
        coins_credited_at: new Date().toISOString(),
      })
      .eq("id", upgradeId)

    if (approveError) {
      return NextResponse.json(
        { ok: false, error: "Coins were credited but request status failed to update." },
        { status: 500 }
      )
    }

    // ✅ EMAIL SEND (ADDED ONLY — SAFE)
    try {
      const resend = new Resend(process.env.RESEND_API_KEY!)

      const recipientEmail =
        currentProfile?.email || upgrade.email || null

      if (recipientEmail) {
        await resend.emails.send({
          from: "JB Collections <noreply@jb-collections.com>",
          to: recipientEmail,
          subject: "Payment Confirmed – JB Coins Added 💰",
          html: `
            <h2>Payment Successful 🎉</h2>
            <p>Hello ${currentProfile?.full_name || "User"},</p>

            <p>Your payment has been approved.</p>

            <p><b>Package:</b> ${packageLabel}</p>
            <p><b>Coins Added:</b> ${coins} JB Coins</p>
            <p><b>Total Balance:</b> ${newCoins} JB Coins</p>

            <br/>

            <a href="https://jb-collections.com/dashboard">
              Go to Dashboard
            </a>

            <br/><br/>
            <p>JB Collections</p>
          `,
        })
      }
    } catch (err) {
      console.error("Email error:", err)
    }

    return NextResponse.json({
      ok: true,
      alreadyCredited: false,
      newCoins,
      message: "Payment approved and JB Coins credited successfully.",
    })
  } catch (error) {
    console.error("Approve upgrade route error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to approve payment." },
      { status: 500 }
    )
  }
}