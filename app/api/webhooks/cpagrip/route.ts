import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Initialize Supabase Admin Client using Service Role Key (bypasses Row Level Security)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    let password = ""
    let payout = 0
    let trackingId = ""

    const contentType = req.headers.get("content-type") || ""

    // CPAGrip sends standard x-www-form-urlencoded or multipart form data
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await req.formData()
      password = formData.get("password")?.toString() || ""
      payout = Number(formData.get("payout") || 0)
      trackingId =
        formData.get("tracking_id")?.toString() ||
        formData.get("subid")?.toString() ||
        ""
    } else {
      // Fallback for JSON payload or URL query string parameters
      try {
        const body = await req.json()
        password = body.password || ""
        payout = Number(body.payout || 0)
        trackingId = body.tracking_id || body.subid || ""
      } catch {
        const { searchParams } = new URL(req.url)
        password = searchParams.get("password") || ""
        payout = Number(searchParams.get("payout") || 0)
        trackingId =
          searchParams.get("tracking_id") || searchParams.get("subid") || ""
      }
    }

    // 1. Verify security password
    if (!password || password !== process.env.CPAGRIP_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized: Password mismatch" },
        { status: 401 }
      )
    }

    // 2. Validate tracking ID and payout amount
    if (!trackingId || payout <= 0) {
      return NextResponse.json(
        { error: "Invalid tracking_id or payout value" },
        { status: 400 }
      )
    }

    // 3. Convert payout ($ USD) to JB Coins (e.g. $1.00 USD = 1,000 JB Coins)
    const coinsToAdd = Math.round(payout * 1000)

    // 4. Update user balance in Supabase via RPC function
    const { error } = await supabaseAdmin.rpc("credit_user_coins", {
      user_id_input: trackingId,
      amount_input: coinsToAdd,
    })

    if (error) {
      console.error("[CPAGrip Postback Error]:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(
      `[CPAGrip Success]: Credited ${coinsToAdd} JB Coins ($${payout}) to User ${trackingId}`
    )
    return NextResponse.json({ success: true, coinsCredited: coinsToAdd })
  } catch (err) {
    console.error("[CPAGrip Webhook Error]:", err)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const password = searchParams.get("password")
    const payout = Number(searchParams.get("payout") || 0)
    const trackingId =
      searchParams.get("tracking_id") || searchParams.get("subid") || ""

    // 1. Verify security password
    if (!password || password !== process.env.CPAGRIP_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized: Password mismatch" },
        { status: 401 }
      )
    }

    // 2. Validate tracking ID and payout amount
    if (!trackingId || payout <= 0) {
      return NextResponse.json(
        { error: "Invalid tracking_id or payout value" },
        { status: 400 }
      )
    }

    const coinsToAdd = Math.round(payout * 1000)

    const { error } = await supabaseAdmin.rpc("credit_user_coins", {
      user_id_input: trackingId,
      amount_input: coinsToAdd,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, coinsCredited: coinsToAdd })
  } catch (err) {
    console.error("[CPAGrip GET Error]:", err)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}