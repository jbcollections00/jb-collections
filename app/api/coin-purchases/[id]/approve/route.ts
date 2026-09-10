import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const admin = createAdminClient()

    // 1. Fetch order details
    const { data: order, error: fetchError } = await admin
      .from("coin_purchase_orders")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // 2. Mark order as credited/approved
    const { data: updatedOrder, error: updateError } = await admin
      .from("coin_purchase_orders")
      .update({ status: "credited" })
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 3. Call coin change RPC to credit user coins
    await admin.rpc("handle_coin_change", {
      p_user_id: order.user_id,
      p_amount: order.coins,
      p_type: "credit",
      p_description: `Coin Purchase (${order.label || "Package"})`,
      p_reference: order.payment_reference,
    })

    return NextResponse.json({ success: true, order: updatedOrder })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to approve order",
      },
      { status: 500 }
    )
  }
}