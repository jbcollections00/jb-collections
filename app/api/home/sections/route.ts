import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Fetch Top 5 Downloaded Files
    const { data: topFiles, error: topError } = await supabase
      .from("files")
      .select("*")
      .order("downloads_count", { ascending: false })
      .limit(5)

    if (topError) console.error("Error fetching top files:", topError)

    // 2. Fetch Latest 5 Uploads
    const { data: latestFiles, error: latestError } = await supabase
      .from("files")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5)

    if (latestError) console.error("Error fetching latest files:", latestError)

    // 3. Fetch Trending Files
    const { data: trendingFiles, error: trendingError } = await supabase
      .from("files")
      .select("*")
      .order("downloads_count", { ascending: false })
      .limit(5)

    if (trendingError) console.error("Error fetching trending files:", trendingError)

    // 4. Fetch Recent Downloads Activity (using 'download_unlocks')
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
        .filter((log: any) => log.files) // Ensure attached file record exists
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
      { top: [], latest: [], trending: [], recent_downloads: [] },
      { status: 500 }
    )
  }
}