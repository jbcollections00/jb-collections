import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

type ProfileRow = {
  id: string
  role?: string | null
  membership?: string | null
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Missing order id." }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: adminProfile, error: adminProfileError } = await supabase
      .from("profiles")
      .select("id, role, membership")
      .eq("id", user.id)
      .maybeSingle()

    if (adminProfileError) {
      return NextResponse.json({ error: adminProfileError.message || "Failed to verify admin." }, { status: 500 })
    }

    const profile = adminProfile as ProfileRow | null
    const isAdmin = String(profile?.role || "").trim().toLowerCase() === "admin"

    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Missing Supabase service role configuration." }, { status: 500 })
    }

    const adminDb = createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: order, error: orderError } = await adminDb
      .from("coin_purchase_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (orderError) {
      return NextResponse.json({ error: orderError.message || "Failed to load order." }, { status: 500 })
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 })
    }

    if (order.status === "approved") {
      return NextResponse.json({ error: "Order is already approved." }, { status: 400 })
    }

    if (order.status === "rejected") {
      return NextResponse.json({ error: "Rejected orders cannot be approved." }, { status: 400 })
    }

    const { error: coinChangeError } = await adminDb.rpc("handle_coin_change", {
      p_user_id: order.user_id,
      p_amount: Number(order.coins || 0),
      p_type: "coin_purchase",
      p_description: `Approved coin purchase ${order.label || order.id}`,
    })

    if (coinChangeError) {
      return NextResponse.json({ error: coinChangeError.message || "Failed to credit coins." }, { status: 500 })
    }

    const { error: updateError } = await adminDb
      .from("coin_purchase_orders")
      .update({
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message || "Failed to mark order approved." }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Order approved and coins credited successfully.",
    })
  } catch (error) {
    console.error("Approve coin purchase order error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong." },
      { status: 500 }
    )
  }
}
