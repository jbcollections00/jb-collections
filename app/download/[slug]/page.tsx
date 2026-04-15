import type { Metadata } from "next"
import DownloadPageClient from "./DownloadPageClient"
import { createClient } from "@/lib/supabase-server"

type PageProps = {
  params: {
    slug: string
  }
}

type FileRow = {
  id?: string
  title?: string | null
  description?: string | null
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

function pickOgImage(file: FileRow | null) {
  return (
    toAbsoluteUrl(file?.cover_url) ||
    toAbsoluteUrl(file?.thumbnail_url) ||
    `${getSiteUrl()}/og-default.jpg`
  )
}

async function getFileBySlug(slug: string): Promise<FileRow | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("files")
      .select("id, title, description, slug, thumbnail_url, cover_url")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle()

    if (error) {
      console.error("OG metadata file lookup error:", error.message)
      return null
    }

    return (data as FileRow | null) ?? null
  } catch (error) {
    console.error("OG metadata unexpected error:", error)
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = params.slug
  const file = await getFileBySlug(slug)

  const siteUrl = getSiteUrl()
  const pageUrl = `${siteUrl}/download/${slug}`
  const imageUrl = pickOgImage(file)
  const title = file?.title?.trim() || "JB Collections"
  const description =
    file?.description?.trim() || "Premium-ready file download platform."

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
          width: 1200,
          height: 630,
          alt: title,
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

export default function DownloadPage({ params }: PageProps) {
  return <DownloadPageClient params={params} />
}