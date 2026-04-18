import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function createSupabaseAdmin() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const supabaseServiceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY")

  return createClient(supabaseUrl, supabaseServiceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function getProfileBalanceMode(supabase: ReturnType<typeof createSupabaseAdmin>, userId: string) {
  const tryCoins = await supabase
    .from("profiles")
    .select("coins")
    .eq("id", userId)
    .single()

  if (!tryCoins.error) {
    return {
      mode: "coins" as const,
      current: Number(tryCoins.data?.coins ?? 0),
    }
  }

  const tryPoints = await supabase
    .from("profiles")
    .select("jb_points")
    .eq("id", userId)
    .single()

  if (!tryPoints.error) {
    return {
      mode: "jb_points" as const,
      current: Number(tryPoints.data?.jb_points ?? 0),
    }
  }

  throw new Error("Could not detect a wallet balance column on profiles. Add either coins or jb_points.")
}

async function writeTransactionLog(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  order: Record<string, any>,
) {
  const creditDate = new Date().toISOString()

  const logAttempts = [
    () =>
      supabase.from("coin_history").insert({
        user_id: order.user_id,
        type: "credit",
        source: "coin_purchase_order",
        label: order.label || "JB Coin Purchase",
        coins: Number(order.coins ?? 0),
        amount: Number(order.amount ?? 0),
        status: "credited",
        reference_id: order.id,
        reference_number: order.reference_number,
        payment_method: order.payment_method,
        created_at: creditDate,
      }),
    () =>
      supabase.from("jb_points_log").insert({
        user_id: order.user_id,
        action_type: "coin_purchase_credit",
        points: Number(order.coins ?? 0),
        reference_id: order.id,
        created_at: creditDate,
      }),
    () =>
      supabase.from("coin_transactions").insert({
        user_id: order.user_id,
        transaction_type: "credit",
        coins: Number(order.coins ?? 0),
        label: order.label || "JB Coin Purchase",
        reference_id: order.id,
        created_at: creditDate,
      }),
  ]

  for (const attempt of logAttempts) {
    const { error } = await attempt()
    if (!error) {
      return
    }
  }
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const supabase = createSupabaseAdmin()

    const { data: order, error: orderError } = await supabase
      .from("coin_purchase_orders")
      .select("*")
      .eq("id", id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Coin purchase order not found." },
        { status: 404 },
      )
    }

    if (order.status === "credited" || order.status === "approved") {
      return NextResponse.json(
        { error: "This order was already processed." },
        { status: 400 },
      )
    }

    if (order.status === "rejected") {
      return NextResponse.json(
        { error: "Rejected orders cannot be approved." },
        { status: 400 },
      )
    }

    const balanceInfo = await getProfileBalanceMode(supabase, order.user_id)
    const creditAmount = Number(order.coins ?? 0)

    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      return NextResponse.json(
        { error: "This order has an invalid coin amount." },
        { status: 400 },
      )
    }

    const updatedBalance = balanceInfo.current + creditAmount

    const profileUpdate =
      balanceInfo.mode === "coins"
        ? await supabase
            .from("profiles")
            .update({
              coins: updatedBalance,
              last_seen: new Date().toISOString(),
            })
            .eq("id", order.user_id)
        : await supabase
            .from("profiles")
            .update({
              jb_points: updatedBalance,
              last_seen: new Date().toISOString(),
            })
            .eq("id", order.user_id)

    if (profileUpdate.error) {
      return NextResponse.json(
        { error: profileUpdate.error.message },
        { status: 500 },
      )
    }

    const { error: statusError } = await supabase
      .from("coin_purchase_orders")
      .update({
        status: "credited",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)

    if (statusError) {
      return NextResponse.json(
        { error: statusError.message },
        { status: 500 },
      )
    }

    await writeTransactionLog(supabase, order)

    return NextResponse.json({
      ok: true,
      message: `${creditAmount} coins credited successfully.`,
      credited: creditAmount,
      balance: updatedBalance,
      balanceMode: balanceInfo.mode,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to approve order.",
      },
      { status: 500 },
    )
  }
}
