import type { Metadata } from "next"
import DownloadPageClient from "./DownloadPageClient"
import { createClient } from "@/lib/supabase/server"

type PageProps = {
  params: Promise<{
    slug: string
  }>
}

type FileRow = {
  id: string
  title?: string | null
  description?: string | null
  slug?: string | null
  thumbnail_url?: string | null
  cover_url?: string | null
  preview_url?: string | null
  mime_type?: string | null
  file_type?: string | null
  visibility?: string | null
  downloads_count?: number | null
  created_at?: string | null
  updated_at?: string | null
}

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://jb-collections.com"
  ).replace(/\/+$/, "")
}

function absoluteUrl(url?: string | null) {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url

  const siteUrl = getSiteUrl()
  return `${siteUrl}${url.startsWith("/") ? url : `/${url}`}`
}

function getPreviewImage(file: FileRow | null) {
  if (!file) return `${getSiteUrl()}/og-default.jpg`

  return (
    absoluteUrl(file.cover_url) ||
    absoluteUrl(file.preview_url) ||
    absoluteUrl(file.thumbnail_url) ||
    `${getSiteUrl()}/og-default.jpg`
  )
}

function getTitle(file: FileRow | null) {
  const raw = file?.title?.trim()
  return raw ? `${raw} | JB Collections` : "JB Collections"
}

function getDescription(file: FileRow | null) {
  const raw = file?.description?.trim()
  if (raw) return raw

  const visibility = (file?.visibility || "free").toLowerCase()
  if (visibility === "platinum") return "Platinum-ready file download from JB Collections."
  if (visibility === "premium") return "Premium-ready file download from JB Collections."
  return "Premium-ready file download platform."
}

async function getFileBySlug(slug: string): Promise<FileRow | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("files")
      .select(
        "id, title, description, slug, thumbnail_url, cover_url, preview_url, mime_type, file_type, visibility, downloads_count, created_at, updated_at, status"
      )
      .eq("status", "published")
      .eq("slug", slug)
      .maybeSingle()

    if (error) {
      console.error("generateMetadata file lookup error:", error.message)
      return null
    }

    return (data as FileRow | null) ?? null
  } catch (error) {
    console.error("generateMetadata unexpected error:", error)
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const file = await getFileBySlug(slug)

  const siteUrl = getSiteUrl()
  const pageUrl = `${siteUrl}/download/${slug}`
  const imageUrl = getPreviewImage(file)
  const title = getTitle(file)
  const description = getDescription(file)

  return {
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
          width: 1200,
          height: 630,
          alt: file?.title || "JB Collections preview",
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

export default async function DownloadPage({ params }: PageProps) {
  await params
  return <DownloadPageClient />
}