import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

type FileRow = Record<string, any>

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE

  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function normalizeFile(file: FileRow) {
  return {
    id: file.id ?? null,
    title: file.title ?? file.name ?? file.file_name ?? "Untitled",
    name: file.name ?? file.title ?? file.file_name ?? "Untitled",
    slug: file.slug ?? null,
    description: file.description ?? file.short_description ?? "",
    thumbnail_url:
      file.thumbnail_url ??
      file.thumbnail ??
      file.preview_url ??
      file.image_url ??
      file.cover_url ??
      null,
    cover_url: file.cover_url ?? file.image_url ?? file.thumbnail_url ?? null,
    image_url: file.image_url ?? file.cover_url ?? file.thumbnail_url ?? null,
    downloads_count: Number(
      file.downloads_count ??
        file.download_count ??
        file.downloads ??
        file.total_downloads ??
        0,
    ),
    created_at: file.created_at ?? null,
    visibility: file.visibility ?? file.access_type ?? "free",
    status: file.status ?? null,
  }
}

function isVisibleFile(file: FileRow) {
  const status = String(file.status ?? "published").toLowerCase()
  const visibility = String(file.visibility ?? file.access_type ?? "free").toLowerCase()

  if (file.deleted_at || file.is_deleted === true) return false
  if (visibility === "private") return false
  if (["deleted", "disabled", "inactive", "rejected", "blocked"].includes(status)) return false

  return true
}

function sortByDownloadsDesc(a: ReturnType<typeof normalizeFile>, b: ReturnType<typeof normalizeFile>) {
  return Number(b.downloads_count || 0) - Number(a.downloads_count || 0)
}

function sortByCreatedAtDesc(a: ReturnType<typeof normalizeFile>, b: ReturnType<typeof normalizeFile>) {
  const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
  const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
  return bTime - aTime
}

function uniqueById(files: ReturnType<typeof normalizeFile>[]) {
  const seen = new Set<string>()

  return files.filter((file) => {
    const id = String(file.id || "")
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function emptySections(warning?: string) {
  return NextResponse.json(
    {
      trending: [],
      top: [],
      latest: [],
      warning: warning ?? null,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    },
  )
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient()

    if (!supabase) {
      console.error("Missing Supabase environment variables for homepage sections.")
      return emptySections("Missing Supabase environment variables.")
    }

    const { data, error } = await supabase
      .from("files")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(120)

    if (error) {
      console.error("Home sections files query error:", error)
      return emptySections(error.message)
    }

    const files = ((data || []) as FileRow[])
      .filter(isVisibleFile)
      .map(normalizeFile)

    const latest = uniqueById([...files].sort(sortByCreatedAtDesc)).slice(0, 10)
    const top = uniqueById([...files].sort(sortByDownloadsDesc)).slice(0, 10)
    const trending = uniqueById([...top, ...latest])
      .sort((a, b) => {
        const downloadDiff = Number(b.downloads_count || 0) - Number(a.downloads_count || 0)

        if (downloadDiff !== 0) return downloadDiff

        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0

        return bTime - aTime
      })
      .slice(0, 10)

    return NextResponse.json(
      {
        trending,
        top,
        latest,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    )
  } catch (error) {
    console.error("Home sections API error:", error)

    return emptySections(
      error instanceof Error ? error.message : "Unknown homepage sections error.",
    )
  }
}