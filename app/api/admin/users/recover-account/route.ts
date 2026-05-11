import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase()
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const userId = String(body?.userId || "").trim()
    const email = normalizeEmail(body?.email)
    const password = String(body?.password || "").trim()
    const reason = String(body?.reason || "").trim()

    if (!userId) {
      return NextResponse.json({ error: "Missing user id." }, { status: 400 })
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid recovery email." }, { status: 400 })
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Temporary password must be at least 6 characters." },
        { status: 400 }
      )
    }

    if (!reason) {
      return NextResponse.json(
        { error: "Please enter the account verification note." },
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
      data: { user: adminUser },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !adminUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: adminProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", adminUser.id)
      .maybeSingle()

    if (profileError || adminProfile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Missing Supabase admin environment variables." },
        { status: 500 }
      )
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data: targetProfile, error: targetProfileError } = await adminSupabase
      .from("profiles")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle()

    if (targetProfileError) {
      return NextResponse.json({ error: targetProfileError.message }, { status: 500 })
    }

    if (!targetProfile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 })
    }

    const { error: authUpdateError } = await adminSupabase.auth.admin.updateUserById(userId, {
      email,
      password,
      email_confirm: true,
    })

    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message }, { status: 500 })
    }

    const { error: profileUpdateError } = await adminSupabase
      .from("profiles")
      .update({ email })
      .eq("id", userId)

    if (profileUpdateError) {
      return NextResponse.json({ error: profileUpdateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      email,
      message: "Account recovered successfully. Give the temporary password only to the verified account owner.",
    })
  } catch (error) {
    console.error("Admin recover account API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
