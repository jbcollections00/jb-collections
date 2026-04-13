import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type UpgradeRow = {
  id: string
  sender_id: string
  amount: number | string | null
  coins: number | string | null
  label: string | null
  package_label: string | null
  payment_name: string | null
  payment_method: string | null
  reference_number: string | null
  status: string | null
  coins_credited: boolean | null
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

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
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

    const { data: adminProfile, error: adminProfileError } = await adminDb
      .from("profiles")
      .select("role, full_name, name, username")
      .eq("id", user.id)
      .maybeSingle()

    if (adminProfileError) {
      console.error("Admin profile lookup error:", adminProfileError)
      return NextResponse.json(
        { ok: false, error: "Failed to verify admin access." },
        { status: 500 }
      )
    }

    const role = String(adminProfile?.role || "").trim().toLowerCase()
    if (role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Admin access required." },
        { status: 403 }
      )
    }

    const { data: upgrade, error: upgradeError } = await adminDb
      .from("upgrades")
      .select(
        "id, sender_id, amount, coins, label, package_label, payment_name, payment_method, reference_number, status, coins_credited"
      )
      .eq("id", id)
      .maybeSingle()

    if (upgradeError) {
      console.error("Upgrade lookup error:", upgradeError)
      return NextResponse.json(
        { ok: false, error: "Failed to load payment request." },
        { status: 500 }
      )
    }

    if (!upgrade) {
      return NextResponse.json(
        { ok: false, error: "Payment request not found." },
        { status: 404 }
      )
    }

    const row = upgrade as UpgradeRow
    const alreadyCredited = Boolean(row.coins_credited)
    const coins = toNumber(row.coins)

    if (alreadyCredited) {
      return NextResponse.json(
        {
          ok: true,
          alreadyCredited: true,
          message: "Coins were already credited for this payment request.",
        },
        { status: 200 }
      )
    }

    if (!row.sender_id) {
      return NextResponse.json(
        { ok: false, error: "Payment request has no sender_id." },
        { status: 400 }
      )
    }

    if (coins <= 0) {
      return NextResponse.json(
        { ok: false, error: "Payment request has invalid coin amount." },
        { status: 400 }
      )
    }

    const adminName =
      String(adminProfile?.full_name || "").trim() ||
      String(adminProfile?.name || "").trim() ||
      String(adminProfile?.username || "").trim() ||
      user.email ||
      "Admin"

    const historyLabel =
      String(row.package_label || "").trim() ||
      String(row.label || "").trim() ||
      "JB Coin Top-up"

    const historyDescription = [
      `${historyLabel} approved`,
      row.payment_method ? `via ${row.payment_method}` : "",
      row.reference_number ? `ref ${row.reference_number}` : "",
      row.payment_name ? `payer ${row.payment_name}` : "",
    ]
      .filter(Boolean)
      .join(" • ")

    const { error: historyInsertError } = await adminDb.from("coin_history").insert({
      user_id: row.sender_id,
      amount: coins,
      source: "upgrade_approval",
      label: historyLabel,
      description: historyDescription,
      reference_id: row.id,
      created_by: user.id,
    })

    if (historyInsertError) {
      console.error("coin_history insert error:", historyInsertError)
      return NextResponse.json(
        { ok: false, error: "Failed to credit user coins." },
        { status: 500 }
      )
    }

    const { data: updatedUpgrade, error: updateError } = await adminDb
      .from("upgrades")
      .update({
        status: "credited",
        coins_credited: true,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        admin_reply: `Approved and credited by ${adminName}`,
        coins_credited_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .select(
        "id, sender_id, amount, coins, label, package_label, payment_name, payment_method, reference_number, status, coins_credited, approved_at, approved_by, coins_credited_at"
      )
      .single()

    if (updateError) {
      console.error("Upgrade update error:", updateError)
      return NextResponse.json(
        {
          ok: false,
          error:
            "Coins were inserted into coin_history, but the upgrades row failed to update. Check this request manually.",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: "Payment approved and coins credited successfully.",
      upgrade: updatedUpgrade,
    })
  } catch (error) {
    console.error("Approve upgrade route error:", error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to approve payment request.",
      },
      { status: 500 }
    )
  }
}
