import { ImageResponse } from "next/og"
import { createClient } from "@/lib/supabase-server"

export const runtime = "nodejs"
export const alt = "JB Collections preview"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

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

    if (error || !data) return null

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
  } catch {
    return null
  }
}

async function urlToDataUri(url?: string | null) {
  const absoluteUrl = toAbsoluteUrl(url)
  if (!absoluteUrl) return null

  try {
    const response = await fetch(absoluteUrl, {
      cache: "no-store",
      headers: {
        "user-agent": "JBCollections-OG/1.0",
      },
    })

    if (!response.ok) return null

    const contentType = response.headers.get("content-type") || "image/jpeg"
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trim()}…`
}

function visibilityLabel(value?: string | null) {
  const v = (value || "free").toLowerCase()
  if (v === "premium") return "PREMIUM"
  if (v === "platinum") return "PLATINUM"
  if (v === "private") return "PRIVATE"
  return "FREE"
}

function visibilityColors(value?: string | null) {
  const v = (value || "free").toLowerCase()
  if (v === "premium") {
    return {
      bg: "#f59e0b",
      border: "#fbbf24",
    }
  }

  if (v === "platinum") {
    return {
      bg: "#a855f7",
      border: "#c084fc",
    }
  }

  if (v === "private") {
    return {
      bg: "#334155",
      border: "#475569",
    }
  }

  return {
    bg: "#10b981",
    border: "#34d399",
  }
}

export default async function Image({ params }: PageProps) {
  const { slug } = await params
  const file = await getFile(slug)

  const imageData =
    (await urlToDataUri(file?.cover_url)) ||
    (await urlToDataUri(file?.thumbnail_url)) ||
    (await urlToDataUri("/default-preview.png")) ||
    (await urlToDataUri("/og-default.jpg"))

  const title = truncate(file?.title?.trim() || "JB Collections", 56)
  const description = truncate(
    file?.description?.trim() || "Premium-ready file download platform",
    120
  )
  const category = truncate(file?.category_name?.trim() || "Exclusive release", 28)
  const visibility = visibilityLabel(file?.visibility)
  const colors = visibilityColors(file?.visibility)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#020617",
          color: "white",
          fontFamily: "Arial, sans-serif",
          overflow: "hidden",
        }}
      >
        {imageData ? (
          <img
            src={imageData}
            alt="Background"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : null}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.76) 45%, rgba(2,6,23,0.38) 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 380,
            height: 380,
            borderRadius: 9999,
            background: "rgba(59,130,246,0.20)",
            filter: "blur(40px)",
          }}
        />

        <div
          style={{
            position: "absolute",
            bottom: -150,
            left: -100,
            width: 340,
            height: 340,
            borderRadius: 9999,
            background: "rgba(16,185,129,0.18)",
            filter: "blur(36px)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            width: "100%",
            height: "100%",
            padding: "48px",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "68%",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 9999,
                  padding: "10px 18px",
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                }}
              >
                JB COLLECTIONS
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 9999,
                  padding: "10px 16px",
                  background: colors.bg,
                  border: `2px solid ${colors.border}`,
                  fontSize: 22,
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                }}
              >
                {visibility}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 72,
                  fontWeight: 900,
                  lineHeight: 1.02,
                  textShadow: "0 6px 24px rgba(0,0,0,0.35)",
                }}
              >
                {title}
              </div>

              <div
                style={{
                  display: "flex",
                  fontSize: 30,
                  lineHeight: 1.35,
                  color: "rgba(255,255,255,0.88)",
                  maxWidth: 720,
                }}
              >
                {description}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 18,
                  padding: "14px 18px",
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                {category}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 18,
                  padding: "14px 18px",
                  background: "rgba(37,99,235,0.24)",
                  border: "1px solid rgba(96,165,250,0.30)",
                  fontSize: 24,
                  fontWeight: 800,
                }}
              >
                Premium-ready file download platform
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              width: "28%",
              justifyContent: "flex-end",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: 250,
                borderRadius: 28,
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.18)",
                backdropFilter: "blur(14px)",
                overflow: "hidden",
                boxShadow: "0 20px 60px rgba(0,0,0,0.30)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  height: 320,
                  background: imageData ? "transparent" : "#0f172a",
                }}
              >
                {imageData ? (
                  <img
                    src={imageData}
                    alt="Preview"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : null}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "18px 18px 20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 18,
                    fontWeight: 800,
                    color: "rgba(255,255,255,0.72)",
                    letterSpacing: "0.16em",
                  }}
                >
                  DOWNLOAD PREVIEW
                </div>

                <div
                  style={{
                    display: "flex",
                    fontSize: 24,
                    fontWeight: 900,
                  }}
                >
                  JB Collections
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
