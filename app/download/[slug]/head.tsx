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

export default async function Head({ params }: Props) {
  const supabase = await createClient()

  const baseQuery = supabase
    .from("files")
    .select("title, description, thumbnail_url")
    .eq("status", "published")

  const { data: file } = isUuid(params.slug)
    ? await baseQuery.eq("id", params.slug).maybeSingle()
    : await baseQuery.eq("slug", params.slug).maybeSingle()

  const title = file?.title ? `${file.title} | JB Collections` : "Download | JB Collections"
  const description =
    file?.description || "Download premium content for free on JB Collections."
  const image = file?.thumbnail_url || "/default-preview.jpg"

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </>
  )
}