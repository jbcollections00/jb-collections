import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const code = String(body?.code || "").trim()

    if (!code) {
      return NextResponse.json(
        { ok: false, error: "Please enter a voucher code." },
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

    const { data, error } = await supabase.rpc("redeem_voucher", {
      p_user_id: user.id,
      p_code: code,
    })

    if (error) {
      console.error("Redeem voucher error:", error)
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to redeem voucher." },
        { status: 500 }
      )
    }

    if (!data?.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error || "Voucher redemption failed." },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      coins: data.coins,
      newCoins: data.newCoins,
      message: data.message || "Voucher redeemed successfully.",
    })
  } catch (error) {
    console.error("Voucher redeem route error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to redeem voucher." },
      { status: 500 }
    )
  }
}