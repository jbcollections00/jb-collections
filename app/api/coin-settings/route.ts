import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

type CoinSettingRow = {
  key: string
  value_integer: number | null
  label: string | null
  description: string | null
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function createAdminDb() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")

  return createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminDb = createAdminDb()

    const allowedKeys = [
      "daily_reward_base",
      "streak_bonus_3",
      "streak_bonus_7",
      "streak_bonus_14",
      "streak_bonus_30",
      "redeem_premium_cost",
      "redeem_platinum_cost",
    ]

    const { data, error } = await adminDb
      .from("jb_coin_settings")
      .select("key, value_integer, label, description")
      .in("key", allowedKeys)
      .order("key", { ascending: true })

    if (error) {
      console.error("Public coin settings GET error:", error)
      return NextResponse.json(
        { error: "Failed to load coin settings." },
        { status: 500 }
      )
    }

    const rows = (Array.isArray(data) ? data : []) as CoinSettingRow[]

    const defaults = {
      daily_reward_base: 15,
      streak_bonus_3: 10,
      streak_bonus_7: 40,
      streak_bonus_14: 75,
      streak_bonus_30: 200,
      redeem_premium_cost: 1000,
      redeem_platinum_cost: 1500,
    }

    const values = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.key] = Number(row.value_integer || 0)
      return acc
    }, { ...defaults })

    return NextResponse.json({
      success: true,
      settings: rows,
      values,
    })
  } catch (error) {
    console.error("Public coin settings route error:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load coin settings.",
      },
      { status: 500 }
    )
  }
}
