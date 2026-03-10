"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

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
  const supabase = createClient()
  const router = useRouter()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  async function fetchCategories() {
    setLoading(true)

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

    setLoading(false)
  }

  async function handleLogout() {
    try {
      setLoggingOut(true)
      await supabase.auth.signOut()
      router.push("/login")
      router.refresh()
    } catch (error) {
      console.error("Logout failed:", error)
      alert("Failed to log out.")
    } finally {
      setLoggingOut(false)
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 px-6 py-8 text-white sm:px-8 sm:py-10">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-white blur-3xl" />
              <div className="absolute right-0 top-6 h-48 w-48 rounded-full bg-white blur-3xl" />
            </div>

            <div className="relative flex flex-col gap-6">
              <div className="flex flex-wrap justify-end gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  🏠 Dashboard
                </Link>

                <Link
                  href="/profile"
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  👤 Profile
                </Link>

                <Link
                  href="/dashboard/inbox"
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  📥 Inbox
                </Link>

                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  💬 Message Admin
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="inline-flex items-center gap-2 rounded-2xl bg-red-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  🚪 {loggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1fr_minmax(360px,700px)] lg:items-end">
                <div>
                  <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-white/80">
                    JB Collections
                  </p>
                  <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                    Categories
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm text-white/90 sm:text-base">
                    Browse all download categories and open a dedicated page for each one.
                  </p>
                </div>

                <div className="w-full">
                  <div className="rounded-[24px] bg-white/15 p-2 backdrop-blur-md">
                    <input
                      type="text"
                      placeholder="Search categories..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-[18px] border border-white/20 bg-white px-5 py-4 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
              >
                <div className="aspect-[4/3] animate-pulse bg-slate-200" />
                <div className="space-y-3 p-5">
                  <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
                  <div className="h-10 w-full animate-pulse rounded-2xl bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-24 text-center shadow-sm">
            <div className="mx-auto max-w-md">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-3xl">
                📁
              </div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">
                No categories found
              </h2>
              <p className="mt-3 text-slate-500">
                No category matched your search.
              </p>
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
                  className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt={category.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200">
                        <div className="text-6xl">{icon}</div>
                      </div>
                    )}

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-4 pt-10">
                      <h2 className="line-clamp-2 text-lg font-bold text-white">
                        {category.name}
                      </h2>
                    </div>
                  </div>

                  <div className="p-5">
                    <p className="line-clamp-2 min-h-[44px] text-sm text-slate-500">
                      {category.description || "Open this category to browse downloadable files."}
                    </p>

                    <Link
                      href={`/categories/${category.id}`}
                      className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-600"
                    >
                      Open Category
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
