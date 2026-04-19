import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

type ProfileRow = {
  id: string
  role?: string | null
  coins?: number | null
  jb_points?: number | null
}

type PurchaseOrderRow = {
  id: string
  user_id: string
  amount_php?: number | null
  amount?: number | null
  coins?: number | null
  label?: string | null
  payment_method?: string | null
  reference_number?: string | null
  payment_reference?: string | null
  proof_url?: string | null
  status?: string | null
  created_at?: string | null
}

type AuthResult = {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: Awaited<ReturnType<typeof createClient>> extends infer _T ? any : never
  error: "Unauthorized" | null
}

type AdminCheckResult =
  | { ok: true; profile: ProfileRow }
  | { ok: false; error: string }

type OrderResult =
  | { ok: true; order: PurchaseOrderRow }
  | { ok: false; error: string }

type TargetProfileResult =
  | { ok: true; profile: ProfileRow & Record<string, unknown> }
  | { ok: false; error: string }

type StatusUpdateResult =
  | { ok: true; status: string }
  | { ok: false; error: string }

async function getAuthenticatedUser(): Promise<AuthResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { supabase, user: null, error: "Unauthorized" }
  }

  return { supabase, user, error: null }
}

async function requireAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<AdminCheckResult> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()

  if (error || !data) {
    return { ok: false, error: "Admin profile not found." }
  }

  const role = String((data as Record<string, unknown>).role || "").toLowerCase()
  if (role !== "admin") {
    return { ok: false, error: "Forbidden" }
  }

  return { ok: true, profile: data as ProfileRow }
}

async function readOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string
): Promise<OrderResult> {
  const { data, error } = await supabase
    .from("coin_purchase_orders")
    .select("*")
    .eq("id", orderId)
    .single()

  if (error || !data) {
    return { ok: false, error: "Coin purchase order not found." }
  }

  return { ok: true, order: data as PurchaseOrderRow }
}

async function readTargetProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<TargetProfileResult> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()

  if (error || !data) {
    return { ok: false, error: "User profile not found." }
  }

  return { ok: true, profile: data as ProfileRow & Record<string, unknown> }
}

// ✅ FIXED: remove strict typing issue (THIS CAUSED YOUR BUILD FAILURE)
async function bestEffortInsertHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: {
    userId: string
    orderId: string
    coins: number
    amountPhp: number
    label: string
    adminId: string
    paymentMethod: string
    paymentReference: string
    finalStatus: string
  }
) {
  try {
    const coinHistoryPayload: Record<string, unknown> = {
      user_id: payload.userId,
      coins: payload.coins,
      type: "purchase_credit",
      label: payload.label,
      source: "coin_purchase_orders",
      reference_id: payload.orderId,
      amount_php: payload.amountPhp,
      payment_method: payload.paymentMethod,
      payment_reference: payload.paymentReference,
      status: payload.finalStatus,
      created_by: payload.adminId,
    }

    const result = await (supabase.from("coin_history") as any).insert(
      coinHistoryPayload
    )

    if (!result.error) return
  } catch {}

  try {
    const fallbackPayload: Record<string, unknown> = {
      user_id: payload.userId,
      coins: payload.coins,
      type: "purchase_credit",
      label: payload.label,
      reference_id: payload.orderId,
      amount_php: payload.amountPhp,
      payment_method: payload.paymentMethod,
      payment_reference: payload.paymentReference,
      status: payload.finalStatus,
      created_by: payload.adminId,
    }

    const result = await (supabase.from("jb_coin_transactions") as any).insert(
      fallbackPayload
    )

    if (!result.error) return
  } catch {}

  try {
    const fallback2: Record<string, unknown> = {
      user_id: payload.userId,
      points: payload.coins,
      coins: payload.coins,
      action_type: "purchase_credit",
      label: payload.label,
      reference_id: payload.orderId,
      amount_php: payload.amountPhp,
      status: payload.finalStatus,
      created_by: payload.adminId,
    }

    await (supabase.from("jb_points_log") as any).insert(fallback2)
  } catch {}
}

async function bestEffortMarkCreditedMetadata(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  adminId: string,
  finalStatus: string
) {
  const timestamp = new Date().toISOString()

  const metadataVariants = [
    {
      approved_at: timestamp,
      approved_by: adminId,
      credited_at: timestamp,
      credited_by: adminId,
      status_note: `Final status: ${finalStatus}`,
    },
    {
      approved_at: timestamp,
      approved_by: adminId,
      status_note: `Final status: ${finalStatus}`,
    },
    {
      credited_at: timestamp,
      credited_by: adminId,
      status_note: `Final status: ${finalStatus}`,
    },
    {
      status_note: `Final status: ${finalStatus}`,
    },
  ]

  for (const patch of metadataVariants) {
    try {
      const { error } = await supabase
        .from("coin_purchase_orders")
        .update(patch)
        .eq("id", orderId)

      if (!error) return
    } catch {
      continue
    }
  }
}

async function tryUpdateOrderStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  nextStatus: string
): Promise<StatusUpdateResult> {
  try {
    const { error } = await supabase
      .from("coin_purchase_orders")
      .update({ status: nextStatus })
      .eq("id", orderId)

    if (error) {
      return {
        ok: false,
        error: error.message || `Failed to update order status to ${nextStatus}.`,
      }
    }

    return { ok: true, status: nextStatus }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : `Failed to update order status to ${nextStatus}.`,
    }
  }
}

async function reserveFinalStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  order: PurchaseOrderRow
): Promise<StatusUpdateResult> {
  const statusCandidates = ["credited", "approved"]

  for (const candidate of statusCandidates) {
    const result = await tryUpdateOrderStatus(supabase, order.id, candidate)
    if (result.ok) {
      return result
    }
  }

  return {
    ok: false,
    error:
      "Failed to mark this order as credited/approved. Check your coin_purchase_orders status constraint.",
  }
}

async function rollbackOrderStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  previousStatus: string
) {
  try {
    await supabase
      .from("coin_purchase_orders")
      .update({ status: previousStatus })
      .eq("id", orderId)
  } catch {}
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, user, error } = await getAuthenticatedUser()

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminCheck = await requireAdmin(supabase, user.id)
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 })
    }

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Missing order id." }, { status: 400 })
    }

    const orderResult = await readOrder(supabase, id)
    if (!orderResult.ok) {
      return NextResponse.json({ error: orderResult.error }, { status: 404 })
    }

    const order = orderResult.order
    const coinsToCredit = Number(order.coins || 0)
    const amountPhp = Number(order.amount_php ?? order.amount ?? 0)

    if (!order.user_id) {
      return NextResponse.json({ error: "Order user is missing." }, { status: 400 })
    }

    if (!coinsToCredit || coinsToCredit <= 0) {
      return NextResponse.json({ error: "Invalid coin amount on order." }, { status: 400 })
    }

    const normalizedStatus = String(order.status || "").toLowerCase()

    if (normalizedStatus === "credited") {
      return NextResponse.json(
        { error: "This order has already been credited." },
        { status: 409 }
      )
    }

    if (normalizedStatus === "approved") {
      return NextResponse.json(
        { error: "This order has already been approved." },
        { status: 409 }
      )
    }

    const targetProfileResult = await readTargetProfile(supabase, order.user_id)
    if (!targetProfileResult.ok) {
      return NextResponse.json({ error: targetProfileResult.error }, { status: 404 })
    }

    const targetProfile = targetProfileResult.profile
    const hasCoinsColumn = Object.prototype.hasOwnProperty.call(targetProfile, "coins")
    const hasJbPointsColumn = Object.prototype.hasOwnProperty.call(targetProfile, "jb_points")

    if (!hasCoinsColumn && !hasJbPointsColumn) {
      return NextResponse.json(
        { error: "Profile wallet column not found." },
        { status: 500 }
      )
    }

    const reservedStatusResult = await reserveFinalStatus(supabase, order)
    if (!reservedStatusResult.ok) {
      return NextResponse.json({ error: reservedStatusResult.error }, { status: 500 })
    }

    const finalStatus = reservedStatusResult.status
    const profileUpdate: Record<string, number> = {}

    if (hasCoinsColumn) {
      profileUpdate.coins = Number(targetProfile.coins || 0) + coinsToCredit
    }

    if (hasJbPointsColumn) {
      profileUpdate.jb_points = Number(targetProfile.jb_points || 0) + coinsToCredit
    }

    const { error: walletUpdateError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", order.user_id)

    if (walletUpdateError) {
      await rollbackOrderStatus(supabase, order.id, normalizedStatus || "pending")

      return NextResponse.json(
        { error: walletUpdateError.message || "Failed to update user wallet." },
        { status: 500 }
      )
    }

    await bestEffortMarkCreditedMetadata(supabase, order.id, user.id, finalStatus)

    await bestEffortInsertHistory(supabase, {
      userId: order.user_id,
      orderId: order.id,
      coins: coinsToCredit,
      amountPhp,
      label: order.label || `₱${amountPhp} Package`,
      adminId: user.id,
      paymentMethod: String(order.payment_method || "maya"),
      paymentReference: String(order.payment_reference || order.reference_number || ""),
      finalStatus,
    })

    return NextResponse.json({
      success: true,
      message: "Order approved and coins credited successfully.",
    })
  } catch (error) {
    console.error("Admin approve error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Something went wrong.",
      },
      { status: 500 }
    )
  }
}