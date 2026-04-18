import type { Metadata } from "next"
import DownloadPageClient from "./DownloadPageClient"
import { createClient } from "@/lib/supabase-server"

type PageProps = {
  params: Promise<{
    slug: string
  }>
}

type CategoryRelation = {
  name?: string | null
}

type FileRow = {
  id?: string
  title?: string | null
  description?: string | null
  slug?: string | null
  thumbnail_url?: string | null
  thumbnail_storage_key?: string | null
  cover_url?: string | null
  preview_url?: string | null
  visibility?: string | null
  category_name?: string | null
  updated_at?: string | null
}

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://jb-collections.com"
  ).replace(/\/+$/, "")
}

function getR2PublicBaseUrl() {
  return (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || "").replace(/\/+$/, "")
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function cleanText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || ""
}

function truncate(value: string, max = 180) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trim()}…`
}

function buildOgTitle(file: FileRow | null) {
  const title = cleanText(file?.title)
  if (!title) return "JB Collections"
  return `${truncate(title, 70)} | JB Collections`
}

function buildOgDescription(file: FileRow | null) {
  const description = cleanText(file?.description)
  const category = cleanText(file?.category_name)
  const visibility = cleanText(file?.visibility)

  if (description) {
    return truncate(description, 200)
  }

  const parts: string[] = []

  if (category) parts.push(category)
  if (visibility) {
    parts.push(visibility.charAt(0).toUpperCase() + visibility.slice(1))
  }

  if (parts.length > 0) {
    return `${parts.join(" • ")} • Premium file preview on JB Collections.`
  }

  return "Premium file preview on JB Collections."
}

function normalizeAbsoluteUrl(url?: string | null) {
  const value = cleanText(url)
  if (!value) return null

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value
  }

  const siteUrl = getSiteUrl()

  if (value.startsWith("/")) {
    return `${siteUrl}${value}`
  }

  return `${siteUrl}/${value}`
}

function buildR2Url(path?: string | null) {
  const base = getR2PublicBaseUrl()
  const value = cleanText(path)

  if (!base || !value) return null
  if (value.startsWith("http://") || value.startsWith("https://")) return value

  return `${base}/${value.replace(/^\/+/, "")}`
}

function buildPreviewImage(file: FileRow | null) {
  const thumbnailUrl = normalizeAbsoluteUrl(file?.thumbnail_url)
  if (thumbnailUrl) return thumbnailUrl

  const thumbnailFromKey = buildR2Url(file?.thumbnail_storage_key)
  if (thumbnailFromKey) return thumbnailFromKey

  const coverUrl = normalizeAbsoluteUrl(file?.cover_url)
  if (coverUrl) return coverUrl

  const previewUrl = normalizeAbsoluteUrl(file?.preview_url)
  if (previewUrl) return previewUrl

  return `${getSiteUrl()}/default-preview.jpg`
}

async function getFile(slugOrId: string): Promise<FileRow | null> {
  try {
    const supabase = await createClient()

    const baseQuery = supabase
      .from("files")
      .select(
        `
        id,
        title,
        description,
        slug,
        thumbnail_url,
        thumbnail_storage_key,
        cover_url,
        preview_url,
        visibility,
        updated_at,
        category:categories(name)
      `
      )
      .eq("status", "published")

    const { data, error } = isUuid(slugOrId)
      ? await baseQuery.eq("id", slugOrId).maybeSingle()
      : await baseQuery.eq("slug", slugOrId).maybeSingle()

    if (error) {
      console.error("Download metadata file lookup error:", error.message)
      return null
    }

    if (!data) return null

    const rawCategory = Array.isArray(
      (data as { category?: CategoryRelation[] | CategoryRelation | null }).category
    )
      ? ((data as { category?: CategoryRelation[] }).category?.[0] ?? null)
      : ((data as { category?: CategoryRelation | null }).category ?? null)

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      slug: data.slug,
      thumbnail_url: (data as { thumbnail_url?: string | null }).thumbnail_url,
      thumbnail_storage_key: (data as { thumbnail_storage_key?: string | null })
        .thumbnail_storage_key,
      cover_url: (data as { cover_url?: string | null }).cover_url,
      preview_url: (data as { preview_url?: string | null }).preview_url,
      visibility: data.visibility,
      updated_at: data.updated_at,
      category_name: rawCategory?.name ?? null,
    }
  } catch (error) {
    console.error("Download metadata unexpected error:", error)
    return null
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const file = await getFile(slug)

  const siteUrl = getSiteUrl()
  const resolvedSlug = cleanText(file?.slug) || slug
  const pageUrl = `${siteUrl}/download/${resolvedSlug}`

  const title = buildOgTitle(file)
  const description = buildOgDescription(file)
  const imageUrl = buildPreviewImage(file)

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "JB Collections",
      type: "website",
      images: [
        {
          url: imageUrl,
          secureUrl: imageUrl,
          width: 1200,
          height: 630,
          alt: cleanText(file?.title) || "JB Collections file preview",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  }
}

export default async function DownloadPage() {
  return <DownloadPageClient />
}