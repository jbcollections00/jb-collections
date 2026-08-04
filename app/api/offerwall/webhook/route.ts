import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Initialize Supabase Admin Client using the Service Role Key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  // Extract the parameters we mapped in CPAGrip
  const userId = searchParams.get("userId")
  const transactionId = searchParams.get("transactionId")
  const provider = searchParams.get("provider")

  if (!userId || !transactionId) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
  }

  try {
    // 1. Verify this transaction hasn't been processed yet to prevent double-payouts
    const { data: existingTx } = await supabaseAdmin
      .from("offerwall_transactions")
      .select("id")
      .eq("transaction_id", transactionId)
      .single()

    if (existingTx) {
      return NextResponse.json({ message: "Transaction already processed" }, { status: 200 })
    }

    // 2. Log the transaction securely
    const { error: txError } = await supabaseAdmin
      .from("offerwall_transactions")
      .insert([
        {
          transaction_id: transactionId,
          user_id: userId,
          provider: provider || "cpagrip",
          coins_awarded: 500,
        }
      ])

    if (txError) throw txError

    // 3. Increment the user's JB Coins balance
    // *Assuming you have a 'profiles' table with a 'jb_coins' column*
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("jb_coins")
      .eq("id", userId)
      .single()

    const currentCoins = profile?.jb_coins || 0

    await supabaseAdmin
      .from("profiles")
      .update({ jb_coins: currentCoins + 500 })
      .eq("id", userId)

    // 4. (Optional) Check member count and apply Platinum status logic here

    return NextResponse.json({ success: true, message: "User rewarded 500 JB Coins" })
  } catch (error) {
    console.error("Webhook processing error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}