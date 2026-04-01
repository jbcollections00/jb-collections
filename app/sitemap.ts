import type { MetadataRoute } from "next"
import { createClient } from "@/lib/supabase-server"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/dashboard`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/upgrade`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ]

  const { data: files } = await supabase
    .from("files")
    .select("id, updated_at, status")
    .eq("status", "published")
    .order("updated_at", { ascending: false })

  const fileRoutes: MetadataRoute.Sitemap =
    files?.map((file) => ({
      url: `${baseUrl}/download/${file.slug || file.id}`,
      lastModified: file.updated_at ? new Date(file.updated_at) : new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    })) || []

  const { data: categories } = await supabase
    .from("categories")
    .select("id, updated_at")
    .order("updated_at", { ascending: false })

  const categoryRoutes: MetadataRoute.Sitemap =
    categories?.map((category) => ({
      url: `${baseUrl}/category/${category.id}`,
      lastModified: category.updated_at ? new Date(category.updated_at) : new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    })) || []

  return [...staticRoutes, ...fileRoutes, ...categoryRoutes]
}