import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

type CoinPurchaseStatsRow = {
  amount_php: number | string | null
  coins: number | string | null
  status: string | null
  created_at: string | null
  approved_at: string | null
  rejected_at: string | null
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

function normalizeStatus(value: unknown) {
  const status = String(value || "pending").trim().toLowerCase()
  if (status === "approved") return "approved"
  if (status === "rejected") return "rejected"
  return "pending"
}

function isSameMonth(dateString: string | null, now: Date) {
  if (!dateString) return false
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return false
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

function isToday(dateString: string | null, now: Date) {
  if (!dateString) return false
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return false
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

export async function GET() {
  try {
    const supabase = await createSupabaseUserClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const adminDb = createSupabaseAdminClient()

    const { data: adminProfile, error: adminProfileError } = await adminDb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (adminProfileError) {
      return NextResponse.json(
        { ok: false, error: "Failed to verify admin access." },
        { status: 500 }
      )
    }

    if (String(adminProfile?.role || "").trim().toLowerCase() !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Admin access required." },
        { status: 403 }
      )
    }

    const { data, error } = await adminDb
      .from("coin_purchase_orders")
      .select("amount_php, coins, status, created_at, approved_at, rejected_at")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Failed to load payment analytics." },
        { status: 500 }
      )
    }

    const rows = (data || []) as CoinPurchaseStatsRow[]
    const now = new Date()

    let totalRequests = 0
    let pendingRequests = 0
    let approvedRequests = 0
    let creditedRequests = 0
    let rejectedRequests = 0

    let totalRevenue = 0
    let creditedRevenue = 0
    let pendingRevenue = 0
    let totalCoinsRequested = 0
    let totalCoinsCredited = 0

    let todayRevenue = 0
    let monthRevenue = 0

    for (const row of rows) {
      totalRequests += 1

      const amount = toNumber(row.amount_php)
      const coins = toNumber(row.coins)
      const status = normalizeStatus(row.status)
      const credited = status === "approved"

      totalRevenue += amount
      totalCoinsRequested += coins

      if (status === "pending") {
        pendingRequests += 1
        pendingRevenue += amount
      } else if (status === "approved") {
        approvedRequests += 1
        creditedRequests += 1
      } else if (status === "rejected") {
        rejectedRequests += 1
      }

      if (credited) {
        creditedRevenue += amount
        totalCoinsCredited += coins
      }

      if (credited && isToday(row.created_at, now)) {
        todayRevenue += amount
      }

      if (credited && isSameMonth(row.created_at, now)) {
        monthRevenue += amount
      }
    }

    const approvalRate =
      totalRequests > 0 ? Math.round((approvedRequests / totalRequests) * 100) : 0

    const creditRate =
      totalRequests > 0 ? Math.round((creditedRequests / totalRequests) * 100) : 0

    return NextResponse.json({
      ok: true,
      stats: {
        totalRequests,
        pendingRequests,
        approvedRequests,
        creditedRequests,
        rejectedRequests,
        totalRevenue,
        creditedRevenue,
        pendingRevenue,
        totalCoinsRequested,
        totalCoinsCredited,
        todayRevenue,
        monthRevenue,
        approvalRate,
        creditRate,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to load payment analytics.",
      },
      { status: 500 }
    )
  }
}
