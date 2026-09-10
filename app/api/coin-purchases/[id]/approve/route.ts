import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

// 1. Authenticated Supabase Client to check caller permissions
async function createUserClient() {
  const cookieStore = await cookies()

  return createServerClient(
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
}

// 2. Service Role Admin Client for system updates
function createAdmin() {
  return createAdminClient(
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
    const userSupabase = await createUserClient()
    const admin = createAdmin()

    // 🔐 AUTHENTICATION CHECK
    const {
      data: { user },
      error: authError,
    } = await userSupabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 })
    }

    // 🔐 ADMIN ROLE AUTHORIZATION CHECK
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin privileges required." },
        { status: 403 }
      )
    }

    // 1. Fetch order details
    const { data: order, error: fetchError } = await admin
      .from("coin_purchase_orders")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 })
    }

    // 2. Strict status check (Only pending orders can be approved)
    if (order.status !== "pending") {
      return NextResponse.json(
        { error: `Order cannot be approved because it is currently '${order.status}'.` },
        { status: 400 }
      )
    }

    // 3. Execute coin credit RPC first
    const { error: rpcError } = await admin.rpc("handle_coin_change", {
      p_user_id: order.user_id,
      p_amount: Number(order.coins),
      p_type: "credit",
      p_description: `Coin Purchase (${order.label || "Package"})`,
      p_reference: order.payment_reference,
    })

    if (rpcError) {
      console.error("Coin credit RPC error:", rpcError)
      return NextResponse.json(
        { error: rpcError.message || "Failed to credit coins." },
        { status: 500 }
      )
    }

    // 4. Update order status to credited in DB
    const { data: updatedOrder, error: updateError } = await admin
      .from("coin_purchase_orders")
      .update({ status: "credited" })
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, order: updatedOrder })
  } catch (error) {
    console.error("Order approval error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to approve order",
      },
      { status: 500 }
    )
  }
}