import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function GET() {
  try {
    const supabase = createClient()

    // get current week
    const { data: weekData } = await supabase.rpc("get_week_start")
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
      leaderboard: data || [],
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
    })
  }
}