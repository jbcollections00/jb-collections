"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import SiteHeader from "@/app/components/SiteHeader"

type Category = {
  id: string
  name: string
  description: string | null
  image_url?: string | null
  thumbnail_url?: string | null
  cover_url?: string | null
  created_at?: string | null
}

function getCategoryImage(category: Category) {
  return category.thumbnail_url || category.cover_url || category.image_url || null
}

function getCategoryIcon(name: string) {
  const value = name.toLowerCase()

  if (value.includes("book")) return "📚"
  if (value.includes("media")) return "🎬"
  if (value.includes("software")) return "💻"
  if (value.includes("template")) return "🧩"
  if (value.includes("music")) return "🎵"
  if (value.includes("video")) return "📹"
  if (value.includes("image")) return "🖼️"
  return "📁"
}

export default function CategoriesPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    checkUserAndLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkUserAndLoad() {
    try {
      setCheckingAuth(true)
      setLoading(true)

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error || !user) {
        router.replace("/login")
        return
      }

      await fetchCategories()
    } catch (error) {
      console.error("Categories auth check failed:", error)
      router.replace("/login")
    } finally {
      setCheckingAuth(false)
      setLoading(false)
    }
  }

  async function fetchCategories() {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true })

    if (error) {
      console.error("Error fetching categories:", error)
      setCategories([])
    } else {
      setCategories(data || [])
    }
  }

  const filteredCategories = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return categories

    return categories.filter((category) => {
      const name = category.name?.toLowerCase() || ""
      const description = category.description?.toLowerCase() || ""

      return name.includes(keyword) || description.includes(keyword)
    })
  }, [categories, search])

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="rounded-3xl border border-white/10 bg-slate-900 px-8 py-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-white">Checking your account...</p>
          <p className="mt-2 text-sm text-slate-400">Please wait.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <SiteHeader />

      <div className="mx-auto max-w-[1800px] px-4 pb-6 pt-24 sm:px-6 sm:pb-8 sm:pt-28 lg:px-8">
        <div className="mb-8 overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_28%),linear-gradient(135deg,#0f172a_0%,#111827_55%,#020617_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 px-5 py-7 sm:px-6 lg:grid lg:grid-cols-[1fr_minmax(360px,700px)] lg:items-end lg:px-8">
            <div>
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">
                JB Collections
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                Categories
              </h1>

              <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
                Browse all download categories and open a dedicated page for each one.
              </p>

              <div className="mt-4 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
                {filteredCategories.length} categor{filteredCategories.length === 1 ? "y" : "ies"}
              </div>
            </div>

            <div className="w-full">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-2 backdrop-blur-md">
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-[18px] border border-white/10 bg-white px-5 py-4 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[26px] border border-white/10 bg-slate-900/80 shadow-sm ring-1 ring-white/5"
              >
                <div className="aspect-[4/2.7] animate-pulse bg-slate-800" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-slate-700" />
                  <div className="h-4 w-full animate-pulse rounded bg-slate-700" />
                  <div className="h-11 w-full animate-pulse rounded-2xl bg-slate-700" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="rounded-[30px] border border-dashed border-white/15 bg-slate-900/70 px-6 py-24 text-center shadow-sm">
            <div className="mx-auto max-w-md">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 text-3xl">
                📁
              </div>
              <h2 className="text-3xl font-black tracking-tight text-white">
                No categories found
              </h2>
              <p className="mt-3 text-slate-400">No category matched your search.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {filteredCategories.map((category) => {
              const previewImage = getCategoryImage(category)
              const icon = getCategoryIcon(category.name)

              return (
                <div
                  key={category.id}
                  className="group overflow-hidden rounded-[26px] border border-white/10 bg-slate-900/80 shadow-[0_10px_30px_rgba(0,0,0,0.25)] ring-1 ring-white/5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(0,0,0,0.38)]"
                >
                  <div className="relative aspect-[4/2.7] overflow-hidden bg-slate-800">
                    {previewImage ? (
                      <>
                        <img
                          src={previewImage}
                          alt={category.name}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                        <div className="text-5xl">{icon}</div>
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <div className="rounded-2xl bg-black/35 p-3 backdrop-blur-sm">
                        <h2 className="line-clamp-2 text-sm font-black leading-5 text-white sm:text-base">
                          {category.name}
                        </h2>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/70 sm:text-sm">
                          {category.description ||
                            "Open this category to browse downloadable files."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-300">
                      Collection
                    </div>

                    <Link
                      href={`/categories/${category.id}`}
                      className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-slate-200"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}