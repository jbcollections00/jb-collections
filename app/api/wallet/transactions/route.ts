import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export const runtime = "nodejs"

type PaymentMethod = "gcash" | "maya"
type TransactionStatus = "pending" | "approved" | "credited" | "rejected"

type UpgradeRecord = Record<string, unknown>

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

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toStringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function pickFirst<T = unknown>(record: UpgradeRecord, keys: string[]) {
  for (const key of keys) {
    if (key in record && record[key] != null) {
      return record[key] as T
    }
  }
  return undefined
}

function normalizeMethod(value: unknown): PaymentMethod {
  const method = String(value || "").trim().toLowerCase()
  return method === "gcash" ? "gcash" : "maya"
}

function normalizeStatus(record: UpgradeRecord): TransactionStatus {
  const rawStatus = String(record.status || "").trim().toLowerCase()
  const credited = Boolean(record.coins_credited)

  if (credited || rawStatus === "credited") return "credited"
  if (rawStatus === "approved") return "approved"
  if (rawStatus === "rejected" || rawStatus === "declined") return "rejected"
  return "pending"
}

function buildTransaction(record: UpgradeRecord, index: number) {
  const coins = toNumber(pickFirst(record, ["coins", "coin_amount"]), 0)
  const bonus = toNumber(pickFirst(record, ["bonus", "bonus_coins"]), 0)
  const base = toNumber(pickFirst(record, ["base", "base_coins"]), Math.max(coins - bonus, 0))
  const amount = toNumber(pickFirst(record, ["amount", "payment_amount"]), 0)

  const id =
    toStringValue(record.id) ||
    toStringValue(record.reference_number) ||
    toStringValue(record.referenceNumber) ||
    `UPGRADE-${index + 1}`

  const label =
    toStringValue(record.label) ||
    toStringValue(record.plan) ||
    toStringValue(record.subject) ||
    "JB Coin Package"

  const createdAt =
    toStringValue(record.created_at) ||
    toStringValue(record.createdAt) ||
    new Date().toISOString()

  const receiptName =
    toStringValue(record.receipt_name) ||
    toStringValue(record.receiptName) ||
    (() => {
      const path = toStringValue(record.receipt_path) || toStringValue(record.receipt_url)
      if (!path) return "receipt-image"
      const parts = path.split("/").filter(Boolean)
      return parts[parts.length - 1] || "receipt-image"
    })()

  return {
    id,
    label,
    amount,
    coins,
    bonus,
    base,
    method: normalizeMethod(
      pickFirst(record, ["method", "payment_method"])
    ),
    payerName: toStringValue(
      pickFirst(record, ["payer_name", "payerName", "sender_name"])
    ),
    referenceNumber: toStringValue(
      pickFirst(record, ["reference_number", "referenceNumber"])
    ),
    notes: toStringValue(record.notes),
    status: normalizeStatus(record),
    createdAt,
    receiptName,
  }
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

    const { data, error } = await adminDb
      .from("upgrades")
      .select("*")
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Wallet transactions error:", error)
      return NextResponse.json(
        { ok: false, error: "Failed to load transaction history." },
        { status: 500 }
      )
    }

    const rows = Array.isArray(data) ? (data as UpgradeRecord[]) : []

    const transactions = rows.map((row, index) => buildTransaction(row, index))

    return NextResponse.json({
      ok: true,
      transactions,
    })
  } catch (error) {
    console.error("Wallet transactions GET route error:", error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load transaction history.",
      },
      { status: 500 }
    )
  }
}
