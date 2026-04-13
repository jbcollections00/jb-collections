import type { Metadata } from "next"
import { createClient } from "@/lib/supabase-server"
import DownloadPageClient from "./DownloadPageClient"

type Props = {
  params: Promise<{
    slug: string
  }>
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function toAbsoluteUrl(url: string | null | undefined, baseUrl: string) {
  if (!url) return `${baseUrl}/jb-logo.png`
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  if (url.startsWith("/")) return `${baseUrl}${url}`
  return `${baseUrl}/${url}`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const baseQuery = supabase
    .from("files")
    .select("title, description, thumbnail_url, cover_url, preview_url")
    .eq("status", "published")

  const { data: file } = isUuid(slug)
    ? await baseQuery.eq("id", slug).maybeSingle()
    : await baseQuery.eq("slug", slug).maybeSingle()

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://jb-collections.com"

  const title = file?.title ? `${file.title} | JB Collections` : "Download | JB Collections"
  const description =
    file?.description ||
    "Download premium content with preview, trust signals, and instant access on JB Collections."
  const image = toAbsoluteUrl(file?.cover_url || file?.preview_url || file?.thumbnail_url, baseUrl)
  const url = `${baseUrl}/download/${slug}`

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "JB Collections",
      images: [
        {
          url: image,
          alt: title,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  }
}

export default function Page() {
  return <DownloadPageClient />
}
