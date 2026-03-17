"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import AdSlot from "@/app/components/AdSlot"
import { IN_CONTENT_AD } from "@/app/lib/adCodes"

type Category = {
  id: string
  name: string
  description: string | null
}

type CategoryLinkItem = {
  id: string
  name: string
}

type FileItem = {
  id: string
  name?: string | null
  title?: string | null
  slug?: string | null
  description: string | null
  file_url?: string | null
  category_id: string
  thumbnail_url?: string | null
  cover_url?: string | null
  image_url?: string | null
  file_size?: number | null
  size?: number | null
  downloads_count?: number | null
  download_count?: number | null
  file_type?: string | null
  mime_type?: string | null
  visibility?: "free" | "premium" | "private" | null
  status?: "draft" | "review" | "published" | "flagged" | "removed" | null
  created_at?: string | null
}

const PAGE_SIZE = 36

function isImageFile(url?: string | null) {
  if (!url) return false
  return /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(url)
}

function getPreviewImage(file: FileItem) {
  if (file.cover_url) return file.cover_url
  if (file.thumbnail_url) return file.thumbnail_url
  if (file.image_url) return file.image_url
  if (isImageFile(file.file_url)) return file.file_url || null
  return null
}

function getFileExtension(url?: string | null) {
  if (!url) return "FILE"
  const clean = url.split("?")[0]
  const ext = clean.split(".").pop()?.toUpperCase()
  return ext || "FILE"
}

function getDisplayFileType(file: FileItem) {
  if (file.file_type) return file.file_type.toUpperCase()
  if (file.mime_type?.includes("pdf")) return "PDF"
  if (file.mime_type?.includes("image")) return "IMAGE"
  if (file.mime_type?.includes("video")) return "VIDEO"
  if (file.mime_type?.includes("audio")) return "AUDIO"
  if (file.mime_type?.includes("zip")) return "ZIP"
  if (file.mime_type?.includes("rar")) return "RAR"
  if (file.mime_type?.includes("7z")) return "7Z"
  return getFileExtension(file.file_url)
}

function getFileIcon(type: string) {
  const normalized = type.toUpperCase()

  if (["PDF"].includes(normalized)) return "📕"
  if (["DOC", "DOCX"].includes(normalized)) return "📘"
  if (["XLS", "XLSX", "CSV"].includes(normalized)) return "📗"
  if (["PPT", "PPTX"].includes(normalized)) return "📙"
  if (["ZIP", "RAR", "7Z"].includes(normalized)) return "🗜️"
  if (["JPG", "JPEG", "PNG", "WEBP", "GIF", "SVG", "IMAGE"].includes(normalized)) return "🖼️"
  if (["MP4", "MOV", "AVI", "MKV", "VIDEO"].includes(normalized)) return "🎬"
  if (["MP3", "WAV", "AAC", "AUDIO"].includes(normalized)) return "🎵"
  if (["EXE", "MSI", "APK"].includes(normalized)) return "⚙️"
  return "📄"
}

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat().format(value || 0)
}

function getDisplayName(file: FileItem) {
  return file.title || file.name || "Untitled File"
}

export default function CategoryPage() {
  const params = useParams()
  const router = useRouter()
  const categoryId = params?.id as string
  const supabase = createClient()

  const [category, setCategory] = useState<Category | null>(null)
  const [allCategories, setAllCategories] = useState<CategoryLinkItem[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (categoryId) {
      checkUserAndLoad()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId])

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

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

      await fetchCategoryPage()
    } catch (error) {
      console.error("Category auth check failed:", error)
      router.replace("/login")
    } finally {
      setCheckingAuth(false)
      setLoading(false)
    }
  }

  async function fetchCategoryPage() {
    const [
      { data: categoryData, error: categoryError },
      { data: filesData, error: filesError },
      { data: categoriesData, error: categoriesError },
    ] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, description")
        .eq("id", categoryId)
        .single(),
      supabase
        .from("files")
        .select("*")
        .eq("category_id", categoryId)
        .eq("status", "published")
        .order("created_at", { ascending: false }),
      supabase
        .from("categories")
        .select("id, name")
        .order("name", { ascending: true }),
    ])

    if (categoryError) {
      console.error("Category fetch error:", categoryError)
      setCategory(null)
    } else {
      setCategory(categoryData)
    }

    if (filesError) {
      console.error("Files fetch error:", filesError)
      setFiles([])
    } else {
      setFiles(filesData || [])
    }

    if (categoriesError) {
      console.error("Categories fetch error:", categoriesError)
      setAllCategories([])
    } else {
      setAllCategories(categoriesData || [])
    }
  }

  const filteredFiles = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return files

    return files.filter((file) => {
      const name = getDisplayName(file).toLowerCase()
      const description = file.description?.toLowerCase() || ""
      const type = getDisplayFileType(file).toLowerCase()

      return name.includes(keyword) || description.includes(keyword) || type.includes(keyword)
    })
  }, [files, search])

  const otherCategories = useMemo(() => {
    return allCategories.filter((item) => item.id !== categoryId)
  }, [allCategories, categoryId])

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE))

  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    return filteredFiles.slice(start, end)
  }, [filteredFiles, currentPage])

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function handleDownload(file: FileItem) {
  window.location.href = `/download/${file.id}``
  }

  async function handleLogout() {
    try {
      setLoggingOut(true)
      await supabase.auth.signOut()
      router.replace("/login")
      router.refresh()
    } catch (error) {
      console.error("Logout failed:", error)
      alert("Failed to log out.")
    } finally {
      setLoggingOut(false)
    }
  }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto w-full max-w-[1800px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <div className="mb-6 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm sm:mb-8 sm:rounded-[30px]">
            <div className="h-56 animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm"
              >
                <div className="aspect-[4/5] animate-pulse bg-slate-200" />
                <div className="space-y-3 p-3">
                  <div className="mx-auto h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                  <div className="h-9 w-full animate-pulse rounded-xl bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Category not found</h1>
          <p className="mt-3 text-slate-500">
            This category does not exist or may have been removed.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const startItem = filteredFiles.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const endItem = Math.min(currentPage * PAGE_SIZE, filteredFiles.length)

  const visiblePages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (page) => Math.abs(page - currentPage) <= 2
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm sm:mb-8 sm:rounded-[30px]">
          <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 px-4 py-5 text-white sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-white blur-3xl" />
              <div className="absolute right-0 top-6 h-48 w-48 rounded-full bg-white blur-3xl" />
            </div>

            <div className="relative">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80 sm:text-sm">
                  JB Collections
                </p>

                <div className="hidden items-center gap-3 lg:flex">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    🏠 Dashboard
                  </Link>

                  <Link
                    href="/profile"
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    👤 Profile
                  </Link>

                  <Link
                    href="/dashboard/inbox"
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    📥 Inbox
                  </Link>

                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    💬 Message Admin
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="inline-flex items-center gap-2 rounded-2xl bg-red-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
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
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    🏠 Dashboard
                  </Link>

                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    👤 Profile
                  </Link>

                  <Link
                    href="/dashboard/inbox"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    📥 Inbox
                  </Link>

                  <Link
                    href="/contact"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    💬 Message Admin
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    🚪 {loggingOut ? "Logging out..." : "Logout"}
                  </button>
                </div>
              )}

              <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_minmax(320px,680px)] lg:items-start">
                <div>
                  <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                    {category.name}
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm text-white/90 sm:text-base">
                    {category.description || `Browse downloadable resources inside ${category.name}.`}
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="rounded-[22px] bg-white/15 p-2 backdrop-blur-md">
                    <input
                      type="text"
                      placeholder={`Search in ${category.name}...`}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-[18px] border border-white/20 bg-white px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 sm:px-5 sm:py-4"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/30"
                    >
                      Dashboard
                    </Link>

                    {otherCategories.slice(0, 8).map((item) => (
                      <Link
                        key={item.id}
                        href={`/categories/${item.id}`}
                        className="inline-flex items-center rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/25"
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex justify-center">
          <AdSlot code={IN_CONTENT_AD} className="text-center" />
        </div>

        {filteredFiles.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-20 text-center shadow-sm sm:rounded-[30px] sm:py-24">
            <div className="mx-auto max-w-md">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-3xl">
                📁
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                No files found
              </h2>
              <p className="mt-3 text-slate-500">
                There are no downloadable files in {category.name} yet.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-5 text-center text-sm text-slate-600">
              Showing <span className="font-bold text-slate-900">{startItem}</span> to{" "}
              <span className="font-bold text-slate-900">{endItem}</span> of{" "}
              <span className="font-bold text-slate-900">
                {formatNumber(filteredFiles.length)}
              </span>{" "}
              files
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {paginatedFiles.map((file, index) => {
                const previewImage = getPreviewImage(file)
                const type = getDisplayFileType(file)
                const icon = getFileIcon(type)

                return (
                  <div key={file.id}>
                    {(index === 3 || index === 9) && (
                      <div className="col-span-full mb-4 flex justify-center">
                        <AdSlot code={IN_CONTENT_AD} className="text-center" />
                      </div>
                    )}

                    <div className="group overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                      <div className="relative overflow-hidden bg-slate-100">
                        <div className="aspect-[4/5] overflow-hidden">
                          {previewImage ? (
                            <img
                              src={previewImage}
                              alt={getDisplayName(file)}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200">
                              <div className="mb-3 text-5xl">{icon}</div>
                              <p className="px-4 text-center text-sm font-semibold text-slate-500">
                                No preview available
                              </p>
                            </div>
                          )}

                          {file.visibility === "premium" && (
                            <div className="absolute right-3 top-3 rounded-full bg-black/75 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-md">
                              Premium
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="px-3 pb-3 pt-2">
                        <h3
                          className="mb-2 line-clamp-2 min-h-[40px] text-center text-sm font-extrabold leading-tight text-slate-900"
                          title={getDisplayName(file)}
                        >
                          {getDisplayName(file)}
                        </h3>

                        <button
                          type="button"
                          onClick={() => handleDownload(file)}
                          className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-3 py-2 text-sm font-bold text-white transition hover:from-sky-600 hover:via-blue-700 hover:to-indigo-700"
                        >
                          Download Now
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-8 flex justify-center">
              <AdSlot code={IN_CONTENT_AD} className="text-center" />
            </div>

            <div className="mt-8 flex flex-col items-center gap-4 sm:mt-10">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prev
                </button>

                {visiblePages.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => goToPage(page)}
                    className={`min-w-[48px] rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm transition ${
                      currentPage === page
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}