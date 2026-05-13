import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export const runtime = "nodejs"

export async function GET() {
  try {
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

    const { data: myProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError || myProfile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      )
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await adminSupabase
      .from("profiles")
      .select(
        "id, email, full_name, name, username, membership, membership_payment_type, membership_started_at, membership_expires_at, account_status, status, is_premium, role, coins, last_seen, created_at"
      )
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const users = data || []
    const userIds = users.map((userRow) => userRow.id).filter(Boolean)

    let historiesByUser: Record<string, any[]> = {}
    let signupBonusByUser: Record<string, any> = {}

    if (userIds.length > 0) {
      const { data: histories, error: historyError } = await adminSupabase
        .from("coin_history")
        .select("id, user_id, amount, type, description, reference, created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(Math.max(userIds.length * 20, 20))

      if (historyError) {
        console.error("Admin users coin history error:", historyError.message)
      } else {
        historiesByUser = (histories || []).reduce<Record<string, any[]>>((acc, item) => {
          if (!item.user_id) return acc
          if (!acc[item.user_id]) acc[item.user_id] = []
          if (acc[item.user_id].length < 20) {
            acc[item.user_id].push({
              id: item.id,
              amount: item.amount,
              type: item.type,
              description: item.description,
              reference: item.reference,
              created_at: item.created_at,
            })
          }
          return acc
        }, {})
      }


      const { data: signupBonuses, error: signupBonusError } = await adminSupabase
        .from("coin_history")
        .select("id, user_id, amount, type, description, reference, created_at")
        .in("user_id", userIds)
        .eq("type", "signup_bonus")
        .order("created_at", { ascending: false })
        .limit(Math.max(userIds.length * 3, 20))

      if (signupBonusError) {
        console.error("Admin users signup bonus history error:", signupBonusError.message)
      } else {
        signupBonusByUser = (signupBonuses || []).reduce<Record<string, any>>((acc, item) => {
          if (!item.user_id || acc[item.user_id]) return acc
          acc[item.user_id] = item
          return acc
        }, {})
      }
    }

    const usersWithActivities = users.map((userRow) => {
      const recentActivities = historiesByUser[userRow.id] || []
      const signupBonus = signupBonusByUser[userRow.id] || recentActivities.find((activity) => activity.type === "signup_bonus")

      return {
        ...userRow,
        signup_bonus_amount: signupBonus?.amount ?? null,
        signup_bonus_created_at: signupBonus?.created_at ?? null,
        recent_activities: recentActivities,
      }
    })

    return NextResponse.json({ users: usersWithActivities })
  } catch (error) {
    console.error("Admin users API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}