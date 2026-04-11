import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

type CoinSettingRow = {
  key: string
  value_integer: number | null
  label: string | null
  description: string | null
  updated_at: string | null
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

async function requireAdminUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Profile not found." }, { status: 404 }),
    }
  }

  const role = String(profile.role || "").trim().toLowerCase()

  if (role !== "admin") {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return {
    ok: true as const,
    user,
  }
}

export async function GET() {
  try {
    const adminCheck = await requireAdminUser()
    if (!adminCheck.ok) return adminCheck.response

    const adminDb = createAdminDb()

    const { data, error } = await adminDb
      .from("jb_coin_settings")
      .select("key, value_integer, label, description, updated_at")
      .order("key", { ascending: true })

    if (error) {
      console.error("Admin coin settings GET error:", error)
      return NextResponse.json(
        { error: "Failed to load coin settings." },
        { status: 500 }
      )
    }

    const rows = (Array.isArray(data) ? data : []) as CoinSettingRow[]

    const settingsMap = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.key] = Number(row.value_integer || 0)
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      settings: rows,
      values: settingsMap,
    })
  } catch (error) {
    console.error("Admin coin settings GET route error:", error)

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

export async function POST(req: Request) {
  try {
    const adminCheck = await requireAdminUser()
    if (!adminCheck.ok) return adminCheck.response

    const body = (await req.json()) as {
      settings?: Array<{
        key?: string
        value_integer?: number
      }>
    }

    const settings = Array.isArray(body?.settings) ? body.settings : []

    if (settings.length === 0) {
      return NextResponse.json(
        { error: "No settings provided." },
        { status: 400 }
      )
    }

    const allowedKeys = new Set([
      "daily_reward_base",
      "streak_bonus_3",
      "streak_bonus_7",
      "streak_bonus_14",
      "streak_bonus_30",
      "redeem_premium_cost",
      "redeem_platinum_cost",
    ])

    const updates = settings.map((item) => {
      const key = String(item?.key || "").trim()
      const value = Number(item?.value_integer)

      if (!allowedKeys.has(key)) {
        throw new Error(`Invalid setting key: ${key}`)
      }

      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid value for ${key}`)
      }

      return {
        key,
        value_integer: Math.floor(value),
        updated_at: new Date().toISOString(),
      }
    })

    const adminDb = createAdminDb()

    const { error } = await adminDb
      .from("jb_coin_settings")
      .upsert(updates, { onConflict: "key" })

    if (error) {
      console.error("Admin coin settings POST error:", error)
      return NextResponse.json(
        { error: "Failed to update coin settings." },
        { status: 500 }
      )
    }

    const { data: refreshed, error: refreshError } = await adminDb
      .from("jb_coin_settings")
      .select("key, value_integer, label, description, updated_at")
      .order("key", { ascending: true })

    if (refreshError) {
      console.error("Admin coin settings refresh error:", refreshError)
      return NextResponse.json(
        {
          success: true,
          message: "Coin settings updated successfully.",
          settings: [],
        },
        { status: 200 }
      )
    }

    const rows = (Array.isArray(refreshed) ? refreshed : []) as CoinSettingRow[]

    return NextResponse.json({
      success: true,
      message: "Coin settings updated successfully.",
      settings: rows,
    })
  } catch (error) {
    console.error("Admin coin settings POST route error:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update coin settings.",
      },
      { status: 500 }
    )
  }
}