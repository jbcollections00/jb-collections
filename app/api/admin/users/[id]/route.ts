import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase environment variables." },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { id: userId } = await params

    if (!userId) {
      return NextResponse.json({ error: "Missing user id." }, { status: 400 })
    }

    // 🔥 IMPORTANT: only select needed fields (including jb_points)
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        email,
        full_name,
        name,
        username,
        membership,
        role,
        account_status,
        status,
        is_premium,
        jb_points,
        last_seen,
        created_at
      `)
      .eq("id", userId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }

    return NextResponse.json({
      user: data,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load user.",
        details: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    )
  }
}