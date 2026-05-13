import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function createAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization")

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createAdmin()
    const now = new Date().toISOString()

    const { data: duePromos, error: dueError } = await supabase
      .from("yearly_promo_monthly_credits")
      .select("*")
      .eq("active", true)
      .lte("next_credit_at", now)
      .lt("months_credited", 12)
      .limit(50)

    if (dueError) {
      return NextResponse.json(
        { error: dueError.message || "Failed to read due promos." },
        { status: 500 }
      )
    }

    let processed = 0
    let failed = 0

    for (const promo of duePromos || []) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", promo.user_id)
          .single()

        if (profileError || !profile) {
          failed++
          continue
        }

        const packageCoins = Number(promo.package_coins || 0)
        const nextMonthNumber = Number(promo.months_credited || 0) + 1

        if (!packageCoins || packageCoins <= 0) {
          failed++
          continue
        }

        const hasCoinsColumn = Object.prototype.hasOwnProperty.call(profile, "coins")
        const hasJbPointsColumn = Object.prototype.hasOwnProperty.call(profile, "jb_points")

        if (!hasCoinsColumn && !hasJbPointsColumn) {
          failed++
          continue
        }

        const profileUpdate: Record<string, number> = {}

        if (hasCoinsColumn) {
          profileUpdate.coins = Number(profile.coins || 0) + packageCoins
        }

        if (hasJbPointsColumn) {
          profileUpdate.jb_points = Number(profile.jb_points || 0) + packageCoins
        }

        const { error: walletError } = await supabase
          .from("profiles")
          .update(profileUpdate)
          .eq("id", promo.user_id)

        if (walletError) {
          failed++
          continue
        }

        const label = `First Purchase Yearly Promo Month ${nextMonthNumber}/12`

        await (supabase.from("coin_history") as any).insert({
          user_id: promo.user_id,
          coins: packageCoins,
          type: "yearly_promo_monthly_credit",
          label,
          source: "yearly_promo_monthly_credits",
          reference_id: promo.source_order_id,
          amount_php: promo.amount_php,
          status: "credited",
        })

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
  } catch (error) {
    console.error("Yearly promo cron error:", error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Something went wrong.",
      },
      { status: 500 }
    )
  }
}