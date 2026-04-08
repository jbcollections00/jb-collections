import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"

function randomVoucherCode(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let result = "JB-"
  for (let i = 0; i < length; i += 1) {
    if (i > 0 && i % 4 === 0) result += "-"
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)

    const coins = Number(body?.coins || 0)
    const amount = body?.amount == null ? null : Number(body.amount)
    const label = String(body?.label || "").trim() || "JB Voucher"
    const maxUses = Math.max(1, Number(body?.maxUses || 1))
    const expiresAt = body?.expiresAt ? String(body.expiresAt) : null

    if (!Number.isFinite(coins) || coins <= 0) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid coin amount." },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set() {},
          remove() {},
        },
      }
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 }
      )
    }

    const { data: adminProfile, error: adminError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (adminError || adminProfile?.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Admin access required." },
        { status: 403 }
      )
    }

    let code = randomVoucherCode()

    for (let i = 0; i < 5; i += 1) {
      const { data: existing } = await supabase
        .from("voucher_codes")
        .select("id")
        .eq("code", code)
        .maybeSingle()

      if (!existing) break
      code = randomVoucherCode()
    }

    const { data, error } = await supabase
      .from("voucher_codes")
      .insert({
        code,
        coins,
        amount,
        label,
        max_uses: maxUses,
        expires_at: expiresAt,
        created_by: user.id,
        status: "active",
      })
      .select("*")
      .single()

    if (error) {
      console.error("Create voucher error:", error)
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to create voucher." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      voucher: data,
      message: "Voucher created successfully.",
    })
  } catch (error) {
    console.error("Create voucher route error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to create voucher." },
      { status: 500 }
    )
  }
}