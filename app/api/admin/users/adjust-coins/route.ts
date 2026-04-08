import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

type RequestBody = {
  userId?: string
  amount?: number
  operation?: "add" | "subtract" | "set"
  reason?: string
}

function sanitizeOperation(value?: string | null) {
  if (value === "subtract") return "subtract"
  if (value === "set") return "set"
  return "add"
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (adminProfile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json()) as RequestBody

    const userId = String(body.userId || "").trim()
    const amount = Number(body.amount)
    const operation = sanitizeOperation(body.operation)
    const reason = String(body.reason || "").trim()

    if (!userId || !Number.isFinite(amount) || amount < 0 || !reason) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    const adminDb = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    let finalAmount = amount

    if (operation === "subtract") {
      finalAmount = -amount
    }

    if (operation === "set") {
      // ⚠️ for "set", you should fetch current coins first (optional improvement)
      finalAmount = amount
    }

    const { error } = await adminDb.rpc("handle_coin_change", {
      p_user_id: userId,
      p_amount: finalAmount,
      p_type: "admin_adjustment",
      p_description: `Admin adjustment: ${reason}`,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Coins updated successfully",
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}