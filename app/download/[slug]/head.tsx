import { createClient } from "@/lib/supabase-server"

type Props = {
  params: {
    slug: string
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function toAbsoluteUrl(url: string | null | undefined, baseUrl: string) {
  if (!url) return `${baseUrl}/default-preview.jpg`
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  if (url.startsWith("/")) return `${baseUrl}${url}`
  return `${baseUrl}/${url}`
}

export default async function Head({ params }: Props) {
  const supabase = await createClient()

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://jb-collections.com"

  const baseQuery = supabase
    .from("files")
    .select("title, description, thumbnail_url, cover_url")
    .eq("status", "published")

  const { data: file } = isUuid(params.slug)
    ? await baseQuery.eq("id", params.slug).maybeSingle()
    : await baseQuery.eq("slug", params.slug).maybeSingle()

  const title = file?.title ? `${file.title} | JB Collections` : "Download | JB Collections"
  const description =
    file?.description || "Download premium content for free on JB Collections."

  const image = toAbsoluteUrl(file?.cover_url || file?.thumbnail_url, baseUrl)
  const url = `${baseUrl}/download/${params.slug}`

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="JB Collections" />
      <meta property="og:image" content={image} />
      <meta property="og:image:secure_url" content={image} />
      <meta property="og:image:alt" content={title} />
      <meta property="og:type" content="website" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </>
  )
}