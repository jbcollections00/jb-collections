import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase-server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function createSupabaseAdmin() {
  return createAdminClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // 1. Auth & Admin Verification
    const userClient = await createServerClient()
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: adminProfile } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (String(adminProfile?.role).toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: orderId } = await context.params
    if (!orderId) return NextResponse.json({ error: "Missing order ID." }, { status: 400 })

    const adminSupabase = createSupabaseAdmin()

    // 2. Fetch Order
    const { data: order, error: orderErr } = await adminSupabase
      .from("coin_purchase_orders")
      .select("*")
      .eq("id", orderId)
      .single()

    if (orderErr || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 })

    const status = String(order.status || "").toLowerCase()
    if (["credited", "approved"].includes(status)) {
      return NextResponse.json({ error: "Order already processed." }, { status: 409 })
    }

    const baseCoins = Number(order.coins || 0)
    if (baseCoins <= 0) {
      return NextResponse.json({ error: "Invalid coin amount on order." }, { status: 400 })
    }

    // 3. First Purchase Promo Calculation
    const { count: prevOrders, error: prevOrdersErr } = await adminSupabase
      .from("coin_purchase_orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", order.user_id)
      .in("status", ["credited", "approved"])

    if (prevOrdersErr) return NextResponse.json({ error: prevOrdersErr.message }, { status: 500 })

    const isFirstPurchase = Number(prevOrders || 0) === 0
    const multiplier = isFirstPurchase ? 12 : 1
    const coinsToCredit = baseCoins * multiplier

    // 4. Fetch Target User Profile
    const { data: targetProfile, error: profileErr } = await adminSupabase
      .from("profiles")
      .select("coins")
      .eq("id", order.user_id)
      .single()

    if (profileErr || !targetProfile) return NextResponse.json({ error: "Target profile not found." }, { status: 404 })

    const currentCoins = Number(targetProfile.coins || 0)

    // 5. Update Wallet Balance
    const { error: walletErr } = await adminSupabase
      .from("profiles")
      .update({ coins: currentCoins + coinsToCredit })
      .eq("id", order.user_id)

    if (walletErr) return NextResponse.json({ error: walletErr.message }, { status: 500 })

    // 6. Update Order Status & Add History Log
    const { error: orderUpdateErr } = await adminSupabase
      .from("coin_purchase_orders")
      .update({ status: "credited", approved_at: new Date().toISOString(), approved_by: user.id })
      .eq("id", orderId)
      
    if (orderUpdateErr) console.error("Order update failed:", orderUpdateErr)

    const { error: historyErr } = await adminSupabase.from("coin_history").insert({
      user_id: order.user_id,
      amount: coinsToCredit, 
      type: "purchase_credit",
      description: isFirstPurchase ? `${order.label || "Coins"} - First Purchase Promo x12` : order.label, 
      reference: orderId,
    })

    if (historyErr) {
      console.error("Coin history log failed:", historyErr.message)
    }

    return NextResponse.json({
      success: true,
      message: isFirstPurchase
        ? "Coins credited successfully with First Purchase Promo (x12)."
        : "Coins credited successfully.",
      credited: coinsToCredit,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to credit order." },
      { status: 500 }
    )
  }
}