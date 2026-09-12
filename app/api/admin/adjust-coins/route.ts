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

export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const { userId, amount, action, reason } = body

    if (!userId || typeof amount !== "number") {
      return NextResponse.json({ error: "Invalid parameters. Required: userId, amount." }, { status: 400 })
    }

    const adminSupabase = createSupabaseAdmin()

    // 2. Fetch current user balance
    const { data: targetProfile, error: profileErr } = await adminSupabase
      .from("profiles")
      .select("coins")
      .eq("id", userId)
      .single()

    if (profileErr || !targetProfile) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 })
    }

    const currentCoins = Number(targetProfile.coins || 0)
    let newCoins = currentCoins

    if (action === "add") {
      newCoins += Math.abs(amount)
    } else if (action === "subtract") {
      newCoins = Math.max(0, currentCoins - Math.abs(amount))
    } else if (action === "set") {
      newCoins = Math.max(0, amount)
    } else {
      newCoins = Math.max(0, currentCoins + amount)
    }

    const delta = newCoins - currentCoins

    // 3. Update profiles coins
    const { error: updateErr } = await adminSupabase
      .from("profiles")
      .update({ coins: newCoins })
      .eq("id", userId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // 4. Log to coin_history
    const description = reason || `Admin manual adjustment (${action || "update"})`
    const { error: historyErr } = await adminSupabase.from("coin_history").insert({
      user_id: userId,
      amount: delta,
      type: "admin_adjustment",
      description: description,
      reference: `ADMIN-${Date.now()}`,
    })

    if (historyErr) {
      console.error("Failed to log coin history:", historyErr.message)
    }

    return NextResponse.json({
      success: true,
      message: "Coins updated successfully.",
      coins: newCoins,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to adjust coins." },
      { status: 500 }
    )
  }
}