import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRole) {
    throw new Error("Missing required Supabase environment variables.")
  }

  return createAdminClient(supabaseUrl, supabaseServiceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate Request
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createSupabaseAdmin()

    // 2. Verify Admin Role
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (String(profile?.role || "").toLowerCase() !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required." },
        { status: 403 }
      )
    }

    // 3. Resolve Order ID & Optional Reason
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Missing order id." }, { status: 400 })
    }

    let reason = ""
    try {
      const body = await request.json()
      reason = String(body?.reason || "").trim()
    } catch {
      // Body payload is optional
    }

    // 4. Fetch Order Details
    const { data: order, error: orderError } = await admin
      .from("coin_purchase_orders")
      .select("id, status, user_id, coins, amount_php, amount")
      .eq("id", id)
      .maybeSingle()

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Coin purchase order not found." },
        { status: 404 }
      )
    }

    const currentStatus = String(order.status || "").toLowerCase()

    if (currentStatus === "credited" || currentStatus === "approved") {
      return NextResponse.json(
        { error: "Processed orders cannot be rejected anymore." },
        { status: 400 }
      )
    }

    if (currentStatus === "rejected") {
      return NextResponse.json(
        { error: "This order has already been rejected." },
        { status: 409 }
      )
    }

    // 5. Reject Order & Record Metadata
    const statusNote = reason ? `Rejected by Admin: ${reason}` : "Rejected by Admin"

    const { error: updateError } = await admin
      .from("coin_purchase_orders")
      .update({
        status: "rejected",
        status_note: statusNote,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Failed to reject order." },
        { status: 500 }
      )
    }

    // 6. Notify User via Message Notification
    if (order.user_id) {
      try {
        await admin.from("messages").insert({
          user_id: order.user_id,
          title: "Payment Order Rejected ❌",
          body: reason
            ? `Your payment order (${id.slice(0, 8)}...) was rejected. Reason: ${reason}`
            : `Your payment order (${id.slice(0, 8)}...) was rejected. Please double-check your payment reference number and receipt before trying again.`,
          is_read: false,
        })
      } catch (msgError) {
        console.error("Failed to send in-app rejection message:", msgError)
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Order rejected successfully.",
    })
  } catch (error) {
    console.error("Admin reject order error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to reject order.",
      },
      { status: 500 }
    )
  }
}