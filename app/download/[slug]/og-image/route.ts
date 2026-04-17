import { createClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    slug: string
  }>
}

type FileRow = {
  id?: string
  slug?: string | null
  thumbnail_url?: string | null
  cover_url?: string | null
}

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://jb-collections.com"
  ).replace(/\/+$/, "")
}

function getSupabaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "")
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function toAbsoluteUrl(value?: string | null) {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const siteUrl = getSiteUrl()
  const supabaseUrl = getSupabaseUrl()

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (trimmed.startsWith("/storage/v1/object/public/")) {
    return supabaseUrl ? `${supabaseUrl}${trimmed}` : null
  }

  if (trimmed.startsWith("storage/v1/object/public/")) {
    return supabaseUrl ? `${supabaseUrl}/${trimmed}` : null
  }

  if (trimmed.startsWith("/")) {
    return `${siteUrl}${trimmed}`
  }

  return `${siteUrl}/${trimmed}`
}

async function getFile(slugOrId: string): Promise<FileRow | null> {
  try {
    const supabase = await createClient()

    const baseQuery = supabase
      .from("files")
      .select("id, slug, thumbnail_url, cover_url")
      .eq("status", "published")

    const { data, error } = isUuid(slugOrId)
      ? await baseQuery.eq("id", slugOrId).maybeSingle()
      : await baseQuery.eq("slug", slugOrId).maybeSingle()

    if (error || !data) return null

    return {
      id: data.id,
      slug: data.slug,
      thumbnail_url: data.thumbnail_url,
      cover_url: data.cover_url,
    }
  } catch {
    return null
  }
}

function buildCacheKey(file: FileRow | null, fallback: string) {
  return encodeURIComponent(file?.id || file?.slug || fallback)
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params
  const file = await getFile(slug)

  const sourceUrl =
    toAbsoluteUrl(file?.thumbnail_url) ||
    toAbsoluteUrl(file?.cover_url) ||
    `${getSiteUrl()}/default-preview.png`

  try {
    const upstream = await fetch(sourceUrl, {
      cache: "no-store",
      headers: {
        "user-agent": "JBCollections-OG-Proxy/1.0",
        "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    })

    if (!upstream.ok) {
      return new Response("Preview image not found", { status: 404 })
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg"
    const arrayBuffer = await upstream.arrayBuffer()

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
        "X-OG-Proxy": "jb-collections",
        "Content-Disposition": 'inline; filename="og-image"',
        "X-OG-Source": buildCacheKey(file, slug),
      },
    })
  } catch {
    return new Response("Preview image fetch failed", { status: 500 })
  }
}
