import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { upgradeId } = await req.json()

    if (!upgradeId) {
      return NextResponse.json(
        { error: "Missing upgradeId" },
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: adminProfile, error: adminProfileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (adminProfileError || adminProfile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      )
    }

    const adminDb = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data: upgradeRow, error: lookupError } = await adminDb
      .from("upgrades")
      .select("id, status, admin_reply")
      .eq("id", upgradeId)
      .maybeSingle()

    if (lookupError || !upgradeRow) {
      return NextResponse.json(
        { error: "Upgrade request not found" },
        { status: 404 }
      )
    }

    if (upgradeRow.status === "rejected") {
      return NextResponse.json(
        { success: true, message: "Request already rejected." },
        { status: 200 }
      )
    }

    const { error: rejectError } = await adminDb
      .from("upgrades")
      .update({
        status: "rejected",
        admin_reply:
          upgradeRow.admin_reply?.trim() || "Your upgrade request has been rejected.",
      })
      .eq("id", upgradeId)

    if (rejectError) {
      return NextResponse.json(
        { error: rejectError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Reject upgrade error:", error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to reject upgrade",
      },
      { status: 500 }
    )
  }
}