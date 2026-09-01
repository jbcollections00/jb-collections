import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const supabase = await createServerClient()

    // Service Role / Admin Client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ""
    const adminSupabase = createClient(supabaseUrl, serviceKey)

    // 1. Parallel Fetch for Counts & Section Files
    const [
      { count: totalFilesCount },
      { count: totalUsersCount },
      { count: logsCount },
      { count: unlocksCount },
      { data: latestFiles },
      { data: topFiles },
      { data: trendingFiles },
      { data: dlLogs },
      { data: unlockLogs },
    ] = await Promise.all([
      supabase.from("files").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("download_logs").select("*", { count: "exact", head: true }),
      supabase.from("download_unlocks").select("*", { count: "exact", head: true }),
      supabase.from("files").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("files").select("*").order("downloads_count", { ascending: false }).limit(5),
      supabase.from("files").select("*").order("downloads_count", { ascending: false }).limit(5),
      adminSupabase.from("download_logs").select("id, user_id, file_id, created_at").not("file_id", "is", null).order("created_at", { ascending: false }).limit(15),
      adminSupabase.from("download_unlocks").select("id, user_id, file_id, created_at").not("file_id", "is", null).order("created_at", { ascending: false }).limit(15),
    ])

    const totalDownloadsCount = (logsCount || 0) + (unlocksCount || 0)

    // 2. Merge and sort logs by newest timestamp
    const combinedLogs = [...(dlLogs || []), ...(unlockLogs || [])]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)

    let recentDownloads: any[] = []

    if (combinedLogs.length > 0) {
      const fileIds = Array.from(new Set(combinedLogs.map((l) => l.file_id).filter(Boolean)))
      const userIds = Array.from(new Set(combinedLogs.map((l) => l.user_id).filter(Boolean)))

      const [{ data: filesData }, { data: profilesData }] = await Promise.all([
        fileIds.length > 0 ? adminSupabase.from("files").select("*").in("id", fileIds) : { data: [] },
        userIds.length > 0 ? adminSupabase.from("profiles").select("*").in("id", userIds) : { data: [] },
      ])

      const filesMap = new Map((filesData || []).map((f) => [f.id, f]))
      const profilesMap = new Map((profilesData || []).map((p) => [p.id, p]))

      recentDownloads = combinedLogs
        .map((log, index) => {
          const file = filesMap.get(log.file_id)
          if (!file) return null
          const profile = log.user_id ? profilesMap.get(log.user_id) : null

          return {
            // FIX: Ginawang unique ang ID gamit ang Log ID o Timestamp para hindi kainin ng Frontend filter
            id: log.id ? String(log.id) : `log-${file.id}-${new Date(log.created_at).getTime()}-${index}`,
            file_id: file.id,
            title: file.title || file.name,
            thumbnail_url: file.thumbnail_url,
            cover_url: file.cover_url,
            image_url: file.image_url,
            downloads_count: file.downloads_count || 0,
            visibility: file.visibility,
            description: file.description,
            user_name:
              profile?.full_name ||
              profile?.name ||
              profile?.username ||
              "Anonymous User",
            created_at: log.created_at,
          }
        })
        .filter(Boolean)
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