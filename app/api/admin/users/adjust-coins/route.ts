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

type ProfileRow = {
  id: string
  role?: string | null
  jb_points?: number | null
  full_name?: string | null
  name?: string | null
  email?: string | null
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

    if (adminProfileError || adminProfile?.role !== "admin") {
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

    const userId = String(body.userId || "").trim()
    const amount =
      typeof body.amount === "number" && Number.isFinite(body.amount)
        ? Math.trunc(body.amount)
        : NaN
    const operation = sanitizeOperation(body.operation)
    const reason = String(body.reason || "").trim()

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    if (!Number.isFinite(amount)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    if (amount < 0) {
      return NextResponse.json(
        { error: "Amount must not be negative" },
        { status: 400 }
      )
    }

    if (!reason) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 })
    }

    const { data: targetProfile, error: targetProfileError } = await adminDb
      .from("profiles")
      .select("id, jb_points, full_name, name, email")
      .eq("id", userId)
      .single()

    if (targetProfileError || !targetProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const profile = targetProfile as ProfileRow
    const currentCoins = Number(profile.jb_points || 0)

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

    const { error: updateError } = await adminDb
      .from("profiles")
      .update({
        jb_points: nextCoins,
      })
      .eq("id", userId)
      .eq("jb_points", currentCoins)

    if (updateError) {
      return NextResponse.json(
        {
          error: updateError.message || "Failed to update user coins",
        },
        { status: 500 }
      )
    }

    if (transactionAmount !== 0) {
      const targetName =
        profile.full_name?.trim() ||
        profile.name?.trim() ||
        profile.email?.trim() ||
        profile.id

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
      })

      if (historyError) {
        await adminDb
          .from("profiles")
          .update({
            jb_points: currentCoins,
          })
          .eq("id", userId)

        return NextResponse.json(
          {
            error: historyError.message || "Failed to save coin history",
          },
          { status: 500 }
        )
      }

      // Weekly leaderboard update
      // Only count positive coin gains toward the weekly leaderboard
      if (transactionAmount > 0) {
        const { data: weekStart, error: weekError } = await adminDb.rpc("get_week_start")

        if (weekError) {
          console.error("Weekly leaderboard week error:", weekError)
        } else if (weekStart) {
          const { data: existingEntry, error: leaderboardFetchError } = await adminDb
            .from("jb_weekly_leaderboard")
            .select("id, total_coins")
            .eq("user_id", userId)
            .eq("week_start", weekStart)
            .maybeSingle()

          if (leaderboardFetchError) {
            console.error("Weekly leaderboard fetch error:", leaderboardFetchError)
          } else if (existingEntry?.id) {
            const { error: leaderboardUpdateError } = await adminDb
              .from("jb_weekly_leaderboard")
              .update({
                total_coins: Number(existingEntry.total_coins || 0) + transactionAmount,
              })
              .eq("id", existingEntry.id)

            if (leaderboardUpdateError) {
              console.error("Weekly leaderboard update error:", leaderboardUpdateError)
            }
          } else {
            const { error: leaderboardInsertError } = await adminDb
              .from("jb_weekly_leaderboard")
              .insert({
                user_id: userId,
                total_coins: transactionAmount,
                week_start: weekStart,
              })

            if (leaderboardInsertError) {
              console.error("Weekly leaderboard insert error:", leaderboardInsertError)
            }
          }
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