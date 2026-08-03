import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const userId = searchParams.get("userId") || searchParams.get("subId")
    const reward = Number(searchParams.get("reward") || searchParams.get("amount") || 0)
    const secret = searchParams.get("secret")
    const status = searchParams.get("status") // Monlix passes 1 for success, 2 for chargeback/revocation

    // 1. Verify Secret Key
    if (!secret || secret !== process.env.MONLIX_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized: Invalid secret" }, { status: 401 })
    }

    // 2. Validate user and reward
    if (!userId || reward <= 0) {
      return NextResponse.json({ error: "Invalid userId or reward" }, { status: 400 })
    }

    // 3. Process Reward (or chargeback if status === 2)
    const coinsToAdd = status === "2" ? -Math.round(reward) : Math.round(reward)

    const { error } = await supabaseAdmin.rpc("credit_user_coins", {
      user_id_input: userId,
      amount_input: coinsToAdd,
    })

    if (error) {
      console.error("[Monlix Webhook Error]:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`[Monlix Success]: Processed ${coinsToAdd} JB Coins for user ${userId}`)
    return NextResponse.json({ success: true, coinsCredited: coinsToAdd })
  } catch (err) {
    console.error("[Monlix Webhook Error]:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}