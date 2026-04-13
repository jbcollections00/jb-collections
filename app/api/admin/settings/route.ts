import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

type SettingsMap = Record<string, string>

const DEFAULT_SETTINGS: SettingsMap = {
  premium_unlock_cost: "2000",
  platinum_unlock_cost: "2600",
  daily_reward: "25",
  signup_reward: "35",
  referral_reward: "25",
  message_cost: "10",
  profile_boost_cost: "50",
  featured_upload_cost: "100",
  minimum_cashout_coins: "5000",
  coin_packages_json: JSON.stringify(
    [
      {
        id: "starter",
        label: "Starter Pack",
        amount: 99,
        base: 200,
        bonus: 25,
        featured: false,
      },
      {
        id: "popular",
        label: "Popular Pack",
        amount: 299,
        base: 700,
        bonus: 100,
        featured: true,
      },
      {
        id: "power",
        label: "Power Pack",
        amount: 499,
        base: 1100,
        bonus: 200,
        featured: false,
      },
    ],
    null,
    2
  ),
}

function buildAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

async function buildAuthClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )
}

async function requireAdmin() {
  const auth = await buildAuthClient()
  const admin = buildAdminClient()

  const {
    data: { user },
    error: authError,
  } = await auth.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { admin }
}

async function ensureDefaultSettings(admin: ReturnType<typeof buildAdminClient>) {
  const rows = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value }))

  await admin.from("app_settings").upsert(rows, { onConflict: "key" })
}

export async function GET() {
  const authResult = await requireAdmin()
  if ("error" in authResult) return authResult.error

  const { admin } = authResult

  await ensureDefaultSettings(admin)

  const { data, error } = await admin
    .from("app_settings")
    .select("key, value")
    .order("key", { ascending: true })

  if (error) {
    return NextResponse.json({ error: "Failed to load settings." }, { status: 500 })
  }

  const settings = (data || []).reduce<SettingsMap>((acc, row) => {
    acc[row.key] = row.value
    return acc
  }, { ...DEFAULT_SETTINGS })

  return NextResponse.json({ settings })
}

export async function POST(req: Request) {
  const authResult = await requireAdmin()
  if ("error" in authResult) return authResult.error

  const { admin } = authResult

  const body = await req.json().catch(() => null)
  const incoming = body?.settings

  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 })
  }

  const settingsEntries = Object.entries(incoming as Record<string, unknown>).map(
    ([key, rawValue]) => ({
      key,
      value: typeof rawValue === "string" ? rawValue : JSON.stringify(rawValue ?? ""),
    })
  )

  const { error } = await admin
    .from("app_settings")
    .upsert(settingsEntries, { onConflict: "key" })

  if (error) {
    return NextResponse.json({ error: "Failed to save settings." }, { status: 500 })
  }

  const { data } = await admin
    .from("app_settings")
    .select("key, value")
    .order("key", { ascending: true })

  const settings = (data || []).reduce<SettingsMap>((acc, row) => {
    acc[row.key] = row.value
    return acc
  }, { ...DEFAULT_SETTINGS })

  return NextResponse.json({ ok: true, settings })
}
