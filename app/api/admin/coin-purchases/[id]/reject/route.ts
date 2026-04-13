import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function createAdminDb() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")

  return createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function requireAdminUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Profile not found." }, { status: 404 }),
    }
  }

  const role = String(profile.role || "").trim().toLowerCase()

  if (role !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return {
    ok: true as const,
    user,
  }
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdminUser()
    if (!adminCheck.ok) return adminCheck.response

    const { id } = await context.params
    const orderId = String(id || "").trim()

    if (!orderId) {
      return NextResponse.json({ error: "Missing order id." }, { status: 400 })
    }

    const adminDb = createAdminDb()

    const { data: order, error: orderError } = await adminDb
      .from("coin_purchase_orders")
      .select("id, status")
      .eq("id", orderId)
      .maybeSingle()

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 })
    }

    const currentStatus = String(order.status || "").trim().toLowerCase()

    if (currentStatus === "approved") {
      return NextResponse.json(
        { error: "Approved orders cannot be rejected." },
        { status: 400 }
      )
    }

    if (currentStatus === "rejected") {
      return NextResponse.json({
        success: true,
        message: "Order is already rejected.",
      })
    }

    const { error: rejectError } = await adminDb
      .from("coin_purchase_orders")
      .update({
        status: "rejected",
      })
      .eq("id", orderId)

    if (rejectError) {
      console.error("Reject coin purchase order error:", rejectError)
      return NextResponse.json(
        { error: "Failed to reject order." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Order rejected successfully.",
    })
  } catch (error) {
    console.error("Reject coin purchase route error:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reject order.",
      },
      { status: 500 }
    )
  }
}
