import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  try {
    const { upgradeId, userId } = await req.json()

    if (!upgradeId || !userId) {
      return NextResponse.json(
        { error: "Missing upgradeId or userId" },
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

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (adminProfile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error: upgradeError } = await supabase
      .from("upgrades")
      .update({ status: "approved" })
      .eq("id", upgradeId)

    if (upgradeError) {
      return NextResponse.json(
        { error: upgradeError.message },
        { status: 500 }
      )
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        membership: "premium",
        is_premium: true,
      })
      .eq("id", userId)

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Approve upgrade error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}