import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export const runtime = "nodejs"

type ProfileRow = {
  coins?: number | string | null
}

type UpgradeRow = {
  coins?: number | string | null
  status?: string | null
  coins_credited?: boolean | null
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

async function createSupabaseUserClient() {
  const cookieStore = await cookies()

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })
}

function createSupabaseAdminClient() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")

  return createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET() {
  try {
    const supabase = await createSupabaseUserClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const adminDb = createSupabaseAdminClient()

    const [{ data: profile, error: profileError }, { data: upgrades, error: upgradesError }] =
      await Promise.all([
        adminDb
          .from("profiles")
          .select("coins")
          .eq("id", user.id)
          .maybeSingle(),
        adminDb
          .from("upgrades")
          .select("coins, status, coins_credited")
          .eq("sender_id", user.id),
      ])

    if (profileError) {
      console.error("Wallet summary profile error:", profileError)
      return NextResponse.json(
        { ok: false, error: "Failed to load wallet balance." },
        { status: 500 }
      )
    }

    if (upgradesError) {
      console.error("Wallet summary upgrades error:", upgradesError)
      return NextResponse.json(
        { ok: false, error: "Failed to load wallet purchase summary." },
        { status: 500 }
      )
    }

    const profileRow = (profile || {}) as ProfileRow
    const upgradeRows = (Array.isArray(upgrades) ? upgrades : []) as UpgradeRow[]

    const balance = toNumber(profileRow.coins)

    const pendingCoins = upgradeRows.reduce((total, row) => {
      const status = String(row.status || "").trim().toLowerCase()
      const credited = Boolean(row.coins_credited)
      const coins = toNumber(row.coins)

      if (!credited && status === "pending") {
        return total + coins
      }

      return total
    }, 0)

    const lifetimePurchased = upgradeRows.reduce((total, row) => {
      const status = String(row.status || "").trim().toLowerCase()
      const credited = Boolean(row.coins_credited)
      const coins = toNumber(row.coins)

      if (credited || status === "credited" || status === "approved") {
        return total + coins
      }

      return total
    }, 0)

    return NextResponse.json({
      ok: true,
      summary: {
        balance,
        pendingCoins,
        lifetimePurchased,
      },
    })
  } catch (error) {
    console.error("Wallet summary GET route error:", error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load wallet summary.",
      },
      { status: 500 }
    )
  }
}
