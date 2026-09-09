import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    // 1. Security Check
    const authHeader = req.headers.get("authorization")
    const url = new URL(req.url)
    const querySecret = url.searchParams.get("secret")
    const cronSecret = process.env.CRON_SECRET

    const isHeaderValid = authHeader === `Bearer ${cronSecret}`
    const isQueryValid = querySecret === cronSecret

    if (cronSecret && !isHeaderValid && !isQueryValid) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const now = new Date().toISOString()

    // 2. Fetch Due Promos
    const { data: duePromos, error: dueError } = await supabase
      .from("yearly_promo_monthly_credits")
      .select("*")
      .eq("active", true)
      .lte("next_credit_at", now)
      .lt("months_credited", 12)
      .limit(50)

    if (dueError) {
      return NextResponse.json({ error: dueError.message || "Failed to read due promos." }, { status: 500 })
    }

    let processed = 0
    let failed = 0

    // 3. Process Credits
    for (const promo of duePromos || []) {
      try {
        const packageCoins = Number(promo.package_coins || 0)
        const nextMonthNumber = Number(promo.months_credited || 0) + 1

        if (!packageCoins || packageCoins <= 0) {
          failed++
          continue
        }

        const description = `First Purchase Yearly Promo Month ${nextMonthNumber}/12`
        const reference = `yearly_promo_${promo.id}_month_${nextMonthNumber}`

        // A. Secure Coin Transfer via RPC
        const { error: rpcError } = await supabase.rpc("handle_coin_change", {
          p_user_id: promo.user_id,
          p_amount: packageCoins,
          p_type: "yearly_promo_monthly_credit",
          p_description: description,
          p_reference: reference,
        })

        // Fallback kung wala ang RPC
        if (rpcError) {
          await supabase.from("coin_history").insert({
            user_id: promo.user_id,
            amount: packageCoins,
            type: "yearly_promo_monthly_credit",
            description: description,
            reference: reference
          })

          const { data: profile } = await supabase.from("profiles").select("coins").eq("id", promo.user_id).single()
          if (profile) {
            await supabase
              .from("profiles")
              .update({ coins: Number(profile.coins || 0) + packageCoins })
              .eq("id", promo.user_id)
          }
        }

        // B. Update Promo Schedule
        const nextCreditDate = new Date(promo.next_credit_at)
        nextCreditDate.setMonth(nextCreditDate.getMonth() + 1)
        const isCompleted = nextMonthNumber >= 12

        const { error: promoUpdateError } = await supabase
          .from("yearly_promo_monthly_credits")
          .update({
            months_credited: nextMonthNumber,
            next_credit_at: nextCreditDate.toISOString(),
            active: !isCompleted,
            updated_at: new Date().toISOString(),
          })
          .eq("id", promo.id)

        if (promoUpdateError) {
          failed++
          continue
        }

        processed++
      } catch (error) {
        console.error("Yearly promo credit item error:", error)
        failed++
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      failed,
      checkedAt: now,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Something went wrong." }, { status: 500 })
  }
}