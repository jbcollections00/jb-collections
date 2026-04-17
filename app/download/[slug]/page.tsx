import type { Metadata } from "next"
import DownloadPageClient from "./DownloadPageClient"
import { createClient } from "@/lib/supabase-server"

type PageProps = {
  params: Promise<{
    slug: string
  }>
}

type FileRow = {
  id?: string
  title?: string | null
  description?: string | null
  slug?: string | null
  thumbnail_url?: string | null
  cover_url?: string | null
  visibility?: string | null
  category_name?: string | null
}

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://jb-collections.com"
  ).replace(/\/+$/, "")
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function buildOgTitle(file: FileRow | null) {
  const title = file?.title?.trim()
  if (!title) return "JB Collections"
  return `${title} | JB Collections`
}

function buildOgDescription(file: FileRow | null) {
  const description = file?.description?.trim()
  if (description) return description

  const category = file?.category_name?.trim()
  const visibility = file?.visibility?.trim()

  if (category && visibility) {
    return `${category} • ${visibility} file download on JB Collections.`
  }

  if (category) {
    return `${category} file download on JB Collections.`
  }

  if (visibility) {
    return `${visibility} file download on JB Collections.`
  }

  return "Premium-ready file download platform."
}

async function getFile(slugOrId: string): Promise<FileRow | null> {
  try {
    const supabase = await createClient()

    const baseQuery = supabase
      .from("files")
      .select(`
        id,
        title,
        description,
        slug,
        thumbnail_url,
        cover_url,
        visibility,
        category:categories(name)
      `)
      .eq("status", "published")

    const { data, error } = isUuid(slugOrId)
      ? await baseQuery.eq("id", slugOrId).maybeSingle()
      : await baseQuery.eq("slug", slugOrId).maybeSingle()

    if (error) {
      console.error("OG metadata file lookup error:", error.message)
      return null
    }

    if (!data) return null

    const rawCategory = Array.isArray((data as any).category)
      ? (data as any).category[0]
      : (data as any).category

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      slug: data.slug,
      thumbnail_url: data.thumbnail_url,
      cover_url: data.cover_url,
      visibility: data.visibility,
      category_name: rawCategory?.name ?? null,
    }
  } catch (error) {
    console.error("OG metadata unexpected error:", error)
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const file = await getFile(slug)

  const siteUrl = getSiteUrl()
  const pageUrl = `${siteUrl}/download/${slug}`
  const ogImageUrl = `${siteUrl}/download/${slug}/opengraph-image`

  const title = buildOgTitle(file)
  const description = buildOgDescription(file)

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
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: file?.title?.trim() || "JB Collections preview",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

export default async function DownloadPage() {
  return <DownloadPageClient />
}
