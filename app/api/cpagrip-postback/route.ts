import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Gagamit ng Supabase Service Role Key para direktang ma-update ang profile ng user
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CPAGRIP_PASSWORD = "jb_cpagrip_secret_123"

export async function POST(request: Request) {
  try {
    // Kinukuha ang formdata mula sa POST request ng CPAGrip
    const formData = await request.formData()
    
    const password = formData.get("password")?.toString()
    const trackingId = formData.get("tracking_id")?.toString() || formData.get("subid")?.toString()
    const payoutStr = formData.get("payout")?.toString() || "0"
    const offerId = formData.get("offer_id")?.toString() || ""

    // 1. I-verify ang Password para siguradong mula sa CPAGrip ang request
    if (password !== CPAGRIP_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized request" }, { status: 401 })
    }

    if (!trackingId) {
      return NextResponse.json({ error: "Missing tracking_id / userId" }, { status: 400 })
    }

    // 2. Compute Coins: Halimbawa $1.00 Payout = 1000 JB Coins (1 USD = 1000 Coins)
    const payoutAmount = parseFloat(payoutStr)
    const coinsToAdd = Math.max(1, Math.round(payoutAmount * 1000))

    // 3. Kunin ang kasalukuyang profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("coins")
      .eq("id", trackingId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    const updatedCoins = (profile.coins || 0) + coinsToAdd

    // 4. Update Profile Coins
    await supabaseAdmin
      .from("profiles")
      .update({ coins: updatedCoins })
      .eq("id", trackingId)

    // 5. I-record sa Coin History
    await supabaseAdmin.from("coin_history").insert({
      user_id: trackingId,
      amount: coinsToAdd,
      type: "offerwall_reward",
      description: `Completed CPAGrip Offer #${offerId} ($${payoutAmount.toFixed(2)})`,
    })

    return NextResponse.json({ success: true, reward: coinsToAdd })
  } catch (error) {
    console.error("CPAGrip Postback Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}