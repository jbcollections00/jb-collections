import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle()

    if (meError) {
      return NextResponse.json({ error: "Failed to verify admin" }, { status: 500 })
    }

    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, premium, is_premium, created_at")
      .order("created_at", { ascending: false })

    if (usersError) {
      return NextResponse.json(
        { error: usersError.message || "Failed to load users" },
        { status: 500 }
      )
    }

    return NextResponse.json({ users: users || [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}