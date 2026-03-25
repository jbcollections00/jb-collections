import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function normalizeFile(file: Record<string, any>) {
  return {
    id: file.id ?? null,
    title: file.title ?? null,
    name: file.name ?? null,
    slug: file.slug ?? null,
    description: file.description ?? null,
    thumbnail_url: file.thumbnail_url ?? null,
    cover_url: file.cover_url ?? null,
    image_url: file.image_url ?? null,
    downloads_count: Number(file.downloads_count ?? 0),
    created_at: file.created_at ?? null,
    visibility: file.visibility ?? "free",
    status: file.status ?? null,
  }
}

export async function GET() {
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

    const [trendingResult, topResult, latestResult] = await Promise.all([
      supabase
        .from("files")
        .select("*")
        .eq("status", "published")
        .order("downloads_count", { ascending: false })
        .limit(10),

      supabase
        .from("files")
        .select("*")
        .eq("status", "published")
        .order("downloads_count", { ascending: false })
        .limit(10),

      supabase
        .from("files")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(10),
    ])

    if (trendingResult.error || topResult.error || latestResult.error) {
      console.error("Home sections query error:", {
        trending: trendingResult.error,
        top: topResult.error,
        latest: latestResult.error,
      })

      return NextResponse.json(
        {
          error: "Failed to load homepage sections.",
          details: {
            trending: trendingResult.error?.message ?? null,
            top: topResult.error?.message ?? null,
            latest: latestResult.error?.message ?? null,
          },
        },
        { status: 500 }
      )
    }

    const trending = (trendingResult.data || [])
      .map(normalizeFile)
      .filter((file) => file.downloads_count > 0)

    const top = (topResult.data || []).map(normalizeFile)
    const latest = (latestResult.data || []).map(normalizeFile)

    return NextResponse.json({
      trending,
      top,
      latest,
    })
  } catch (error) {
    console.error("Home sections API error:", error)

    return NextResponse.json(
      {
        error: "Failed to load homepage sections.",
        details: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    )
  }
}