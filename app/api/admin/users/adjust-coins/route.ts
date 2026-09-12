import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

type RequestBody = {
  userId?: string
  targetUserId?: string
  amount?: number
  operation?: "add" | "subtract" | "set"
  action?: "add" | "subtract" | "set"
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

    const { data: adminProfile, error: adminProfileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle()

    if (adminProfileError || String(adminProfile?.role).toLowerCase() !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      )
    }

    const adminDb = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const body = (await req.json()) as RequestBody

    const userId = String(body.userId || body.targetUserId || "").trim()
    const rawAmount = typeof body.amount === "number" ? body.amount : Number(body.amount)
    const amount = Number.isFinite(rawAmount) ? Math.trunc(Math.abs(rawAmount)) : NaN
    const rawOp = body.operation || body.action
    const operation = sanitizeOperation(rawOp)
    const reason = String(body.reason || "").trim() || "Admin balance adjustment"

    if (!userId) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 })
    }

    if (!Number.isFinite(amount)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    // 1. Fetch target profile
    const { data: targetProfile, error: targetProfileError } = await adminDb
      .from("profiles")
      .select("id, coins, full_name, name, email")
      .eq("id", userId)
      .maybeSingle()

    if (targetProfileError) {
      return NextResponse.json({ error: targetProfileError.message }, { status: 500 })
    }

    if (!targetProfile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    const currentCoins = Number(targetProfile.coins || 0)

    let nextCoins = currentCoins
    let transactionAmount = 0

    if (operation === "add") {
      nextCoins = currentCoins + amount
      transactionAmount = amount
    } else if (operation === "subtract") {
      nextCoins = Math.max(0, currentCoins - amount)
      transactionAmount = nextCoins - currentCoins
    } else {
      nextCoins = Math.max(0, amount)
      transactionAmount = nextCoins - currentCoins
    }

    // 2. Update coins in profiles
    const { data: updatedProfile, error: updateError } = await adminDb
      .from("profiles")
      .update({ coins: nextCoins })
      .eq("id", userId)
      .select("coins")
      .single()

    if (updateError || !updatedProfile) {
      return NextResponse.json(
        {
          error: updateError?.message || "Failed to update user coins",
        },
        { status: 500 }
      )
    }

    // 3. Log transaction to coin_history
    if (transactionAmount !== 0) {
      const targetName =
        targetProfile.full_name?.trim() ||
        targetProfile.name?.trim() ||
        targetProfile.email?.trim() ||
        targetProfile.id

      const description =
        operation === "add"
          ? `Admin added JB Coins to ${targetName}. Reason: ${reason}`
          : operation === "subtract"
            ? `Admin subtracted JB Coins from ${targetName}. Reason: ${reason}`
            : `Admin set JB Coins for ${targetName}. Reason: ${reason}`

      const { error: historyError } = await adminDb.from("coin_history").insert({
        user_id: userId,
        amount: transactionAmount,
        type:
          operation === "add"
            ? "admin_add"
            : operation === "subtract"
              ? "admin_subtract"
              : "admin_set",
        description,
        reference: `ADMIN-${Date.now()}`,
      })

      if (historyError) {
        // Rollback balance update if history log fails
        await adminDb
          .from("profiles")
          .update({ coins: currentCoins })
          .eq("id", userId)

        return NextResponse.json(
          {
            error: historyError.message || "Failed to save coin history",
          },
          { status: 500 }
        )
      }

      // 4. Update weekly leaderboard if positive balance gain
      if (transactionAmount > 0) {
        try {
          const { data: weekStart, error: weekError } = await adminDb.rpc("get_week_start")

          if (!weekError && weekStart) {
            const { data: existingEntry } = await adminDb
              .from("jb_weekly_leaderboard")
              .select("id, total_coins")
              .eq("user_id", userId)
              .eq("week_start", weekStart)
              .maybeSingle()

            if (existingEntry?.id) {
              await adminDb
                .from("jb_weekly_leaderboard")
                .update({
                  total_coins: Number(existingEntry.total_coins || 0) + transactionAmount,
                })
                .eq("id", existingEntry.id)
            } else {
              await adminDb
                .from("jb_weekly_leaderboard")
                .insert({
                  user_id: userId,
                  total_coins: transactionAmount,
                  week_start: weekStart,
                })
            }
          }
        } catch (lbErr) {
          console.error("Weekly leaderboard update non-fatal error:", lbErr)
        }
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      previousCoins: currentCoins,
      newCoins: nextCoins,
      changeAmount: transactionAmount,
      message:
        transactionAmount > 0
          ? `Added ${transactionAmount} JB Coins successfully.`
          : transactionAmount < 0
            ? `Subtracted ${Math.abs(transactionAmount)} JB Coins successfully.`
            : "No coin change was needed.",
    })
  } catch (error) {
    console.error("Admin adjust coins route error:", error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}