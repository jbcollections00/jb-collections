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

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = createSupabaseAdmin()

    const { data: order, error: findError } = await supabase
      .from("coin_purchase_orders")
      .select("id,status")
      .eq("id", id)
      .single()

    if (findError || !order) {
      return NextResponse.json(
        { error: "Coin purchase order not found." },
        { status: 404 }
      )
    }

    const { error } = await supabase
      .from("coin_purchase_orders")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json(
        { error: error.message },
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
        error: error instanceof Error ? error.message : "Failed to delete order.",
      },
      { status: 500 }
    )
  }
}
