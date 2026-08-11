import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Fetch Real-Time Total Counts (Para hindi na hardcoded na 85)
    const [
      { count: totalFilesCount },
      { count: totalUsersCount },
      { count: totalDownloadsCount },
    ] = await Promise.all([
      supabase.from("files").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("download_unlocks").select("*", { count: "exact", head: true }),
    ])

    // 2. Fetch Top 5 Downloaded Files
    const { data: topFiles, error: topError } = await supabase
      .from("files")
      .select("*")
      .order("downloads_count", { ascending: false })
      .limit(5)

    if (topError) console.error("Error fetching top files:", topError)

    // 3. Fetch Latest 10 Uploads
    const { data: latestFiles, error: latestError } = await supabase
      .from("files")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)

    if (latestError) console.error("Error fetching latest files:", latestError)

    // 4. Fetch Trending Files
    const { data: trendingFiles, error: trendingError } = await supabase
      .from("files")
      .select("*")
      .order("downloads_count", { ascending: false })
      .limit(5)

    if (trendingError) console.error("Error fetching trending files:", trendingError)

    // 5. Fetch Recent Downloads Activity
    let recentDownloads: any[] = []

    const { data: logsData, error: logsError } = await supabase
      .from("download_unlocks")
      .select(`
        id,
        created_at,
        files (
          id,
          title,
          name,
          slug,
          description,
          thumbnail_url,
          cover_url,
          image_url,
          downloads_count,
          visibility
        ),
        profiles (
          full_name,
          name,
          username
        )
      `)
      .order("created_at", { ascending: false })
      .limit(5)

    if (logsError) {
      console.error("Error fetching recent downloads activity:", logsError)
    } else if (logsData && logsData.length > 0) {
      recentDownloads = logsData
        .filter((log: any) => log.files)
        .map((log: any) => ({
          id: log.files.id,
          title: log.files.title || log.files.name,
          thumbnail_url: log.files.thumbnail_url,
          cover_url: log.files.cover_url,
          image_url: log.files.image_url,
          downloads_count: log.files.downloads_count,
          visibility: log.files.visibility,
          description: log.files.description,
          user_name:
            log.profiles?.full_name ||
            log.profiles?.name ||
            log.profiles?.username ||
            "Community Member",
        }))
    }

    return NextResponse.json(
      {
        stats: {
          total_files: totalFilesCount || 0,
          total_users: totalUsersCount || 0,
          total_downloads: totalDownloadsCount || 0,
        },
        total_files: totalFilesCount || 0,
        total_users: totalUsersCount || 0,
        total_downloads: totalDownloadsCount || 0,
        top: topFiles || [],
        latest: latestFiles || [],
        trending: trendingFiles || [],
        recent_downloads: recentDownloads,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    )
  } catch (error) {
    console.error("Server Error in /api/home/sections:", error)
    return NextResponse.json(
      {
        stats: { total_files: 0, total_users: 0, total_downloads: 0 },
        total_files: 0,
        total_users: 0,
        total_downloads: 0,
        top: [],
        latest: [],
        trending: [],
        recent_downloads: [],
      },
      { status: 500 }
    )
  }
}