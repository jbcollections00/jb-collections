import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase-server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

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

  return createAdminClient(supabaseUrl, supabaseServiceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate Requesting User
    const userSupabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await userSupabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Verify Admin Authorization
    const { data: profile } = await userSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const role = String(profile?.role || "").toLowerCase()
    if (role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required." },
        { status: 403 }
      )
    }

    // 3. Extract & Validate Order ID
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Missing order id." }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()

    // 4. Verify Order Exists
    const { data: order, error: findError } = await supabase
      .from("coin_purchase_orders")
      .select("id, status")
      .eq("id", id)
      .single()

    if (findError || !order) {
      return NextResponse.json(
        { error: "Coin purchase order not found." },
        { status: 404 }
      )
    }

    // 5. Delete Order
    const { error: deleteError } = await supabase
      .from("coin_purchase_orders")
      .delete()
      .eq("id", id)

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: "Order deleted successfully.",
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete order.",
      },
      { status: 500 }
    )
  }
}