import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  const { count } = await supabase
    .from("promo_claims")
    .select("id", { count: "exact", head: true })
    .eq("promo_name", "first_100_survey_platinum")

  const claimed = count || 0
  const remaining = Math.max(0, 100 - claimed)

  return NextResponse.json({
    total: 100,
    claimed,
    remaining,
    is_active: remaining > 0,
  })
}