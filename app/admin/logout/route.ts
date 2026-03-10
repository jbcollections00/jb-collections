import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"

export async function POST() {
  try {
    const supabase = createSupabaseServerClient()

    await supabase.auth.signOut()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin logout error:", error)

    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    )
  }
}