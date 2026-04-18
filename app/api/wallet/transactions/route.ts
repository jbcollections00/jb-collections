import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

type PaymentMethod = "gcash" | "maya"
type TransactionStatus = "pending" | "approved" | "credited" | "rejected"

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

function mapMethod(value: unknown): PaymentMethod {
  return String(value || "").trim().toLowerCase() === "gcash"
    ? "gcash"
    : "maya"
}

function mapStatus(status: unknown): TransactionStatus {
  const value = String(status || "pending").trim().toLowerCase()
  if (value === "rejected") return "rejected"
  if (value === "approved") return "credited"
  return "pending"
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

    const { data: orders, error } = await adminDb
      .from("coin_purchase_orders")
      .select(
        "id, amount_php, coins, label, payment_method, payment_reference, proof_url, status, admin_note, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "Failed to load transaction history." },
        { status: 500 }
      )
    }

    const transactions = (orders || []).map((row) => ({
      id: row.id,
      label: row.label || "JB Coin Package",
      amount: Number(row.amount_php || 0),
      coins: Number(row.coins || 0),
      bonus: 0,
      base: Number(row.coins || 0),
      method: mapMethod(row.payment_method),
      payerName: "",
      referenceNumber: String(row.payment_reference || ""),
      notes: String(row.admin_note || ""),
      status: mapStatus(row.status),

      // ✅ REAL DATE FROM DB
      createdAt: String(row.created_at || ""),

      receiptName: row.proof_url
        ? String(row.proof_url)
            .split("/")
            .pop()
            ?.split("?")[0] || "receipt-image"
        : "receipt-image",
    }))

    return NextResponse.json({
      ok: true,
      transactions,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load transaction history.",
      },
      { status: 500 }
    )
  }
}