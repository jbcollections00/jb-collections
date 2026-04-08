import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

export async function GET() {
  try {
    // ✅ FIX HERE (await!)
    const supabase = await createClient()

    // get current week
    const { data: weekData, error: weekError } = await supabase.rpc("get_week_start")

    if (weekError) throw weekError

    const weekStart = weekData

    // fetch leaderboard
    const { data, error } = await supabase
      .from("jb_weekly_leaderboard")
      .select(`
        total_coins,
        user_id,
        profiles (
          username,
          full_name
        )
      `)
      .eq("week_start", weekStart)
      .order("total_coins", { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({
      success: true,
      weekStart,
      leaderboard: data || [],
    })
  } catch (err: any) {
    console.error("Leaderboard error:", err)

    return NextResponse.json({
      success: false,
      error: err.message,
    })
  }
}