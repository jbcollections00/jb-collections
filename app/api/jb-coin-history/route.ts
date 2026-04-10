import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

type CoinHistoryRow = {
  id: string
  amount?: number | null
  type?: string | null
  description?: string | null
  created_at?: string | null
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const limitParam = Number(req.nextUrl.searchParams.get("limit") || 12)
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 50)
      : 12

    const { data, error } = await supabase
      .from("coin_history") // ✅ FIXED
      .select("id, amount, type, description, created_at") // ✅ FIXED
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load JB Coin history." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      items: data || [],
    })
  } catch (error) {
    console.error("JB Coin history route error:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Internal server error.",
      },
      { status: 500 }
    )
  }
}