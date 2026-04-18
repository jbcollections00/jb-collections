import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

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

export async function GET() {
  try {
    const supabase = await createSupabaseUserClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminDb = createSupabaseAdminClient()

    const [{ data: profile, error: profileError }, { data: orders, error: ordersError }] =
      await Promise.all([
        adminDb.from("profiles").select("coins").eq("id", user.id).maybeSingle(),
        adminDb
          .from("coin_purchase_orders")
          .select("coins, status")
          .eq("user_id", user.id),
      ])

    if (profileError) {
      return NextResponse.json({ error: "Failed to load wallet profile." }, { status: 500 })
    }

    if (ordersError) {
      return NextResponse.json({ error: "Failed to load wallet orders." }, { status: 500 })
    }

    const rows = Array.isArray(orders) ? orders : []

    const pendingCoins = rows.reduce((sum, row) => {
      return String(row.status || "").trim().toLowerCase() === "pending"
        ? sum + Number(row.coins || 0)
        : sum
    }, 0)

    const lifetimePurchased = rows.reduce((sum, row) => {
      const status = String(row.status || "").trim().toLowerCase()
      return status !== "rejected" ? sum + Number(row.coins || 0) : sum
    }, 0)

    return NextResponse.json({
      ok: true,
      summary: {
        balance: Number(profile?.coins || 0),
        pendingCoins,
        lifetimePurchased,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load wallet summary.",
      },
      { status: 500 }
    )
  }
}
