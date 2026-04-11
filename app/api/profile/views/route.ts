import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"
import { cookies, headers } from "next/headers"
import { createHash } from "crypto"

export const runtime = "nodejs"

type ProfileRow = {
  id: string
  username?: string | null
}

type ProfileViewRow = {
  id: string
  profile_user_id: string
  viewer_user_id?: string | null
  visitor_key?: string | null
  viewed_at?: string | null
}

async function createSupabaseUserClient() {
  const cookieStore = await cookies()

  return createServerClient(
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
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.")
  }

  return createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

async function getTargetProfileByUsername(username: string, adminDb: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await adminDb
    .from("profiles")
    .select("id, username")
    .eq("username", username)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as ProfileRow | null) ?? null
}

async function buildVisitorKey() {
  const headerStore = await headers()

  const forwardedFor = headerStore.get("x-forwarded-for") || ""
  const realIp = headerStore.get("x-real-ip") || ""
  const userAgent = headerStore.get("user-agent") || ""
  const acceptLanguage = headerStore.get("accept-language") || ""

  const raw = `${forwardedFor}|${realIp}|${userAgent}|${acceptLanguage}`

  return createHash("sha256").update(raw).digest("hex")
}

export async function GET(request: NextRequest) {
  try {
    const adminDb = createSupabaseAdminClient()

    const usernameParam = request.nextUrl.searchParams.get("username") || ""
    const username = normalizeUsername(usernameParam)

    if (!username) {
      return NextResponse.json(
        { ok: false, error: "Missing username." },
        { status: 400 }
      )
    }

    const targetProfile = await getTargetProfileByUsername(username, adminDb)

    if (!targetProfile) {
      return NextResponse.json(
        { ok: false, error: "Profile not found." },
        { status: 404 }
      )
    }

    const { count: totalViews, error: totalViewsError } = await adminDb
      .from("profile_views")
      .select("id", { count: "exact", head: true })
      .eq("profile_user_id", targetProfile.id)

    if (totalViewsError) {
      console.error("Profile views count error:", totalViewsError)
      return NextResponse.json(
        { ok: false, error: "Failed to load profile views." },
        { status: 500 }
      )
    }

    const { data: allRows, error: uniqueVisitorsError } = await adminDb
      .from("profile_views")
      .select("viewer_user_id, visitor_key")
      .eq("profile_user_id", targetProfile.id)

    if (uniqueVisitorsError) {
      console.error("Profile visitors query error:", uniqueVisitorsError)
      return NextResponse.json(
        { ok: false, error: "Failed to load unique visitors." },
        { status: 500 }
      )
    }

    const uniqueVisitorSet = new Set<string>()

    ;((allRows as Array<{ viewer_user_id?: string | null; visitor_key?: string | null }>) || []).forEach((row) => {
      const uniqueKey = row.viewer_user_id || row.visitor_key || null
      if (uniqueKey) uniqueVisitorSet.add(uniqueKey)
    })

    return NextResponse.json({
      ok: true,
      username,
      views: Number(totalViews || 0),
      visitors: uniqueVisitorSet.size,
    })
  } catch (error) {
    console.error("Profile views GET route error:", error)

    return NextResponse.json(
      { ok: false, error: "Failed to load profile views." },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminDb = createSupabaseAdminClient()
    const supabase = await createSupabaseUserClient()

    const body = (await request.json().catch(() => ({}))) as {
      username?: string
    }

    const username = normalizeUsername(String(body.username || ""))

    if (!username) {
      return NextResponse.json(
        { ok: false, error: "Missing username." },
        { status: 400 }
      )
    }

    const targetProfile = await getTargetProfileByUsername(username, adminDb)

    if (!targetProfile) {
      return NextResponse.json(
        { ok: false, error: "Profile not found." },
        { status: 404 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.id && user.id === targetProfile.id) {
      return NextResponse.json({
        ok: true,
        counted: false,
        reason: "self_view_ignored",
      })
    }

    const visitorKey = await buildVisitorKey()

    // Avoid spam: one recorded view per visitor per profile every 6 hours.
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()

    let recentQuery = adminDb
      .from("profile_views")
      .select("id")
      .eq("profile_user_id", targetProfile.id)
      .gte("viewed_at", sixHoursAgo)
      .limit(1)

    if (user?.id) {
      recentQuery = recentQuery.eq("viewer_user_id", user.id)
    } else {
      recentQuery = recentQuery.eq("visitor_key", visitorKey)
    }

    const { data: recentRows, error: recentError } = await recentQuery

    if (recentError) {
      console.error("Recent profile view check error:", recentError)
      return NextResponse.json(
        { ok: false, error: "Failed to record view." },
        { status: 500 }
      )
    }

    if (Array.isArray(recentRows) && recentRows.length > 0) {
      return NextResponse.json({
        ok: true,
        counted: false,
        reason: "recent_view_already_counted",
      })
    }

    const insertPayload: ProfileViewRow = {
      id: crypto.randomUUID(),
      profile_user_id: targetProfile.id,
      viewer_user_id: user?.id || null,
      visitor_key: user?.id ? null : visitorKey,
      viewed_at: new Date().toISOString(),
    }

    const { error: insertError } = await adminDb
      .from("profile_views")
      .insert(insertPayload)

    if (insertError) {
      console.error("Profile view insert error:", insertError)
      return NextResponse.json(
        { ok: false, error: "Failed to record view." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      counted: true,
    })
  } catch (error) {
    console.error("Profile views POST route error:", error)

    return NextResponse.json(
      { ok: false, error: "Failed to record view." },
      { status: 500 }
    )
  }
}
