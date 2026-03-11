"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Category = {
  id: string
  name: string
  description: string | null
  image_url?: string | null
  thumbnail_url?: string | null
  cover_url?: string | null
}

type FileRow = {
  id: string
  category_id: string | null
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
  return "📁"
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()

  const [categories, setCategories] = useState<Category[]>([])
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    checkUserAndLoad()
  }, [])

  async function checkUserAndLoad() {
    try {
      setLoading(true)
      setCheckingAuth(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace("/login")
        return
      }

      await fetchDashboardData()
    } catch (error) {
      console.error("Dashboard auth check failed:", error)
      router.replace("/login")
    } finally {
      setCheckingAuth(false)
      setLoading(false)
    }
  }

  async function fetchDashboardData() {
    const [{ data: categoriesData, error: categoriesError }, { data: filesData, error: filesError }] =
      await Promise.all([
        supabase.from("categories").select("*").order("name", { ascending: true }),
        supabase.from("files").select("id, category_id"),
      ])

    if (categoriesError) {
      console.error("Error fetching categories:", categoriesError)
      setCategories([])
    } else {
      setCategories(categoriesData || [])
    }

    if (filesError) {
      console.error("Error fetching files:", filesError)
      setFileCounts({})
    } else {
      const counts: Record<string, number> = {}

      ;((filesData as FileRow[]) || []).forEach((file) => {
        if (!file.category_id) return
        counts[file.category_id] = (counts[file.category_id] || 0) + 1
      })

      setFileCounts(counts)
    }
  }

  async function handleLogout() {
    try {
      setLoggingOut(true)

      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error("Logout error:", error)
        alert("Failed to log out.")
        return
      }

      router.replace("/login")
      router.refresh()
    } catch (error) {
      console.error("Logout failed:", error)
      alert("Failed to log out.")
    } finally {
      setLoggingOut(false)
    }
  }

  const totalDownloads = Object.values(fileCounts).reduce((sum, count) => sum + count, 0)

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-800">Checking your account...</p>
          <p className="mt-2 text-sm text-slate-500">Please wait.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm sm:mb-8 sm:rounded-[30px]">
          <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 px-4 py-5 text-white sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <div className="relative">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80 sm:text-sm">
                  JB Collections
                </p>

                <div className="hidden items-center gap-3 lg:flex">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-slate-100"
                  >
                    Dashboard
                  </Link>

                  <Link
                    href="/profile"
                    className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    👤 Profile
                  </Link>

                  <Link
                    href="/dashboard/inbox"
                    className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    📥 Inbox
                  </Link>

                  <Link
                    href="/contact"
                    className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    💬 Message Admin
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="inline-flex items-center justify-center rounded-2xl bg-red-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    🚪 {loggingOut ? "Logging out..." : "Logout"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-xl text-white backdrop-blur lg:hidden"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? "✕" : "☰"}
                </button>
              </div>

              {mobileMenuOpen && (
                <div className="mt-4 grid grid-cols-1 gap-3 lg:hidden">
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-sky-700 shadow-sm"
                  >
                    Dashboard
                  </Link>

                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    👤 Profile
                  </Link>

                  <Link
                    href="/dashboard/inbox"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    📥 Inbox
                  </Link>

                  <Link
                    href="/contact"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    💬 Message Admin
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    🚪 {loggingOut ? "Logging out..." : "Logout"}
                  </button>
                </div>
              )}

              <div className="mt-6">
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Dashboard
                </h1>

                <p className="mt-3 max-w-2xl text-sm text-white/90 sm:text-base">
                  Browse categories, access downloads, and manage your account in one place.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
              Categories
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Explore premium-ready downloadable collections.
            </p>
          </div>

          <div className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm">
            Total files: {formatNumber(totalDownloads)}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm"
              >
                <div className="aspect-[4/2.6] animate-pulse bg-slate-200" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
                  <div className="h-10 w-full animate-pulse rounded-2xl bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {categories.map((category) => {
              const previewImage = getCategoryImage(category)
              const icon = getCategoryIcon(category.name)
              const fileCount = fileCounts[category.id] || 0

              return (
                <div
                  key={category.id}
                  className="group overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative aspect-[4/2.6] overflow-hidden bg-slate-100">
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt={category.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl">
                        {icon}
                      </div>
                    )}

                    <div className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow">
                      {formatNumber(fileCount)} files
                    </div>
                  </div>

                  <div className="p-3">
                    <h3 className="line-clamp-1 text-base font-bold text-slate-900">
                      {category.name}
                    </h3>

                    <p className="mt-1 min-h-[40px] text-xs leading-5 text-slate-600">
                      {category.description ||
                        "Open this category to browse downloadable files."}
                    </p>

                    <Link
                      href={`/categories/${category.id}`}
                      className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
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