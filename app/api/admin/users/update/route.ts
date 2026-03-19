import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function normalizeMembership(value?: string | null) {
  const membership = String(value || "").trim().toLowerCase()
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  return "standard"
}

function normalizeRole(value?: string | null) {
  const role = String(value || "").trim().toLowerCase()
  if (role === "admin") return "admin"
  return "user"
}

function normalizeAccountStatus(value?: string | null) {
  const status = String(value || "").trim()
  if (
    status === "Active" ||
    status === "Pending" ||
    status === "Suspended" ||
    status === "Banned"
  ) {
    return status
  }
  return "Active"
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!body?.id) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      )
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const membership = normalizeMembership(body.membership)
    const role = normalizeRole(body.role)
    const accountStatus = normalizeAccountStatus(body.account_status)
    const status = normalizeAccountStatus(body.status)
    const isPremium = membership === "premium" || membership === "platinum"

    const { error } = await adminSupabase
      .from("profiles")
      .update({
        full_name: body.full_name ?? null,
        username: body.username ?? null,
        membership,
        is_premium: isPremium,
        account_status: accountStatus,
        status,
        role,
      })
      .eq("id", body.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      membership,
      is_premium: isPremium,
      role,
    })
  } catch (error) {
    console.error("Admin update user API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}