import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export const runtime = "nodejs"

type ProfileRow = {
  id: string
  username?: string | null
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
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

async function getTargetProfile(
  username: string,
  adminDb: ReturnType<typeof createSupabaseAdminClient>
) {
  const { data, error } = await adminDb
    .from("profiles")
    .select("id, username")
    .eq("username", username)
    .maybeSingle()

  if (error) throw error
  return (data as ProfileRow | null) ?? null
}

async function getCounts(
  targetUserId: string,
  adminDb: ReturnType<typeof createSupabaseAdminClient>
) {
  const [{ count: followers }, { count: following }] = await Promise.all([
    adminDb
      .from("profile_follows")
      .select("id", { count: "exact", head: true })
      .eq("following_user_id", targetUserId),
    adminDb
      .from("profile_follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_user_id", targetUserId),
  ])

  return {
    followers: Number(followers || 0),
    following: Number(following || 0),
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminDb = createSupabaseAdminClient()
    const userDb = await createSupabaseUserClient()

    const username = normalizeUsername(request.nextUrl.searchParams.get("username") || "")
    if (!username) {
      return NextResponse.json({ ok: false, error: "Missing username." }, { status: 400 })
    }

    const targetProfile = await getTargetProfile(username, adminDb)
    if (!targetProfile) {
      return NextResponse.json({ ok: false, error: "Profile not found." }, { status: 404 })
    }

    const counts = await getCounts(targetProfile.id, adminDb)

    const {
      data: { user },
    } = await userDb.auth.getUser()

    let isFollowing = false

    if (user?.id && user.id !== targetProfile.id) {
      const { data } = await adminDb
        .from("profile_follows")
        .select("id")
        .eq("follower_user_id", user.id)
        .eq("following_user_id", targetProfile.id)
        .maybeSingle()

      isFollowing = Boolean(data)
    }

    return NextResponse.json({
      ok: true,
      ...counts,
      isFollowing,
    })
  } catch (error) {
    console.error("Profile follow GET error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to load follow data." },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminDb = createSupabaseAdminClient()
    const userDb = await createSupabaseUserClient()

    const {
      data: { user },
    } = await userDb.auth.getUser()

    if (!user) {
      return NextResponse.json({ ok: false, error: "Please log in first." }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { username?: string }
    const username = normalizeUsername(String(body.username || ""))

    if (!username) {
      return NextResponse.json({ ok: false, error: "Missing username." }, { status: 400 })
    }

    const targetProfile = await getTargetProfile(username, adminDb)
    if (!targetProfile) {
      return NextResponse.json({ ok: false, error: "Profile not found." }, { status: 404 })
    }

    if (targetProfile.id === user.id) {
      return NextResponse.json({ ok: false, error: "You cannot follow yourself." }, { status: 400 })
    }

    const { data: existing } = await adminDb
      .from("profile_follows")
      .select("id")
      .eq("follower_user_id", user.id)
      .eq("following_user_id", targetProfile.id)
      .maybeSingle()

    let isFollowing = false

    if (existing?.id) {
      const { error: deleteError } = await adminDb
        .from("profile_follows")
        .delete()
        .eq("id", existing.id)

      if (deleteError) {
        throw deleteError
      }

      isFollowing = false
    } else {
      const { error: insertError } = await adminDb
        .from("profile_follows")
        .insert({
          follower_user_id: user.id,
          following_user_id: targetProfile.id,
        })

      if (insertError) {
        throw insertError
      }

      isFollowing = true
    }

    const counts = await getCounts(targetProfile.id, adminDb)

    return NextResponse.json({
      ok: true,
      isFollowing,
      ...counts,
    })
  } catch (error) {
    console.error("Profile follow POST error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to update follow status." },
      { status: 500 }
    )
  }
}