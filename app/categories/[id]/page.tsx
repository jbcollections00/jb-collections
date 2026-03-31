"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import AdSlot from "@/app/components/AdSlot"
import SiteHeader from "@/app/components/SiteHeader"
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
  visibility?: "free" | "premium" | "platinum" | "private" | null
  status?: "draft" | "review" | "published" | "flagged" | "removed" | null
  created_at?: string | null
}

type ProfileRow = {
  role?: string | null
  membership?: string | null
  is_premium?: boolean | null
}

const PAGE_SIZE = 20

function isImageFile(url?: string | null) {
  if (!url) return false
  return /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|$)/i.test(url)
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

function normalizeMembership(value?: string | null) {
  const membership = String(value || "").trim().toLowerCase()
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  return "standard"
}

function getVisibilityLabel(file: FileItem) {
  const visibility = (file.visibility || "free").toLowerCase()

  if (visibility === "platinum") return "Platinum"
  if (visibility === "premium") return "Premium"
  if (visibility === "private") return "Private"
  return "Free"
}

function getVisibilityBadgeClasses(file: FileItem) {
  const visibility = (file.visibility || "free").toLowerCase()

  if (visibility === "platinum") return "border-fuchsia-400/30 bg-fuchsia-600 text-white"
  if (visibility === "premium") return "border-amber-400/30 bg-amber-500 text-white"
  if (visibility === "private") return "border-red-400/30 bg-red-600 text-white"
  return "border-emerald-400/30 bg-emerald-600 text-white"
}

function getCardBorderClasses(file: FileItem) {
  const visibility = (file.visibility || "free").toLowerCase()

  if (visibility === "platinum") return "border-fuchsia-400/20"
  if (visibility === "premium") return "border-amber-400/20"
  if (visibility === "private") return "border-red-400/20"
  return "border-white/10"
}

export default function CategoryPage() {
  const params = useParams()
  const router = useRouter()
  const categoryId = params?.id as string
  const supabase = useMemo(() => createClient(), [])

  const [category, setCategory] = useState<Category | null>(null)
  const [allCategories, setAllCategories] = useState<CategoryLinkItem[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState("")

  useEffect(() => {
    if (categoryId) {
      void checkUserAndLoad()
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

      await fetchCategoryPage(user.id)
    } catch (error) {
      console.error("Category auth check failed:", error)
      router.replace("/login")
    } finally {
      setCheckingAuth(false)
      setLoading(false)
    }
  }

  async function fetchCategoryPage(userId: string) {
    const [
      { data: categoryData, error: categoryError },
      { data: filesData, error: filesError },
      { data: categoriesData, error: categoriesError },
      { data: profileData, error: profileError },
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
      supabase.from("categories").select("id, name").order("name", { ascending: true }),
      supabase
        .from("profiles")
        .select("role, membership, is_premium")
        .eq("id", userId)
        .maybeSingle(),
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

    if (profileError) {
      console.error("Profile fetch error:", profileError)
      setProfile(null)
    } else {
      setProfile((profileData as ProfileRow | null) || null)
    }

    setSelectedCategoryId("")
  }

  const membership = normalizeMembership(profile?.membership)
  const isAdmin = profile?.role === "admin"
  const isPremiumUser =
    isAdmin ||
    profile?.is_premium === true ||
    membership === "premium" ||
    membership === "platinum"
  const isPlatinumUser = isAdmin || membership === "platinum"

  const filteredFiles = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return files

    return files.filter((file) => {
      const name = getDisplayName(file).toLowerCase()
      const description = file.description?.toLowerCase() || ""
      const type = getDisplayFileType(file).toLowerCase()
      const visibility = String(file.visibility || "free").toLowerCase()

      return (
        name.includes(keyword) ||
        description.includes(keyword) ||
        type.includes(keyword) ||
        visibility.includes(keyword)
      )
    })
  }, [files, search])

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
    window.location.href = `/download/${file.id}`
  }

  function handleBackToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function handleCategoryChange(nextValue: string) {
    setSelectedCategoryId(nextValue)
    if (!nextValue) return
    router.push(`/categories/${nextValue}`)
  }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <SiteHeader />

        <div className="mx-auto w-full max-w-[1800px] px-4 pb-6 pt-24 sm:px-6 sm:pb-8 sm:pt-28 lg:px-8">
          <div className="mb-6 h-40 animate-pulse rounded-[32px] border border-white/10 bg-slate-900/80 ring-1 ring-white/5" />
          <div className="mb-6 flex justify-center">
            <div className="h-[90px] w-full max-w-[728px] animate-pulse rounded-[20px] bg-slate-800" />
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/80 shadow-sm ring-1 ring-white/5"
              >
                <div className="aspect-[4/5] animate-pulse bg-slate-800" />
                <div className="space-y-3 p-3">
                  <div className="mx-auto h-4 w-3/4 animate-pulse rounded bg-slate-700" />
                  <div className="h-10 w-full animate-pulse rounded-xl bg-slate-700" />
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
      <div className="min-h-screen bg-slate-950">
        <SiteHeader />

        <div className="mx-auto max-w-5xl px-4 py-24 text-center">
          <h1 className="text-3xl font-bold text-white">Category not found</h1>
          <p className="mt-3 text-slate-400">
            This category does not exist or may have been removed.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
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
    <div className="min-h-screen bg-slate-950">
      <SiteHeader />

      <div className="mx-auto w-full max-w-[1800px] px-4 pb-6 pt-24 sm:px-6 sm:pb-8 sm:pt-28 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_28%),linear-gradient(135deg,#0f172a_0%,#111827_55%,#020617_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 px-5 py-7 sm:px-6 lg:grid lg:grid-cols-[1fr_minmax(380px,720px)] lg:items-end lg:px-8">
            <div>
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">
                JB Collections
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                {category.name}
              </h1>

              <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
                {category.description || "Browse files available in this collection."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
                  {formatNumber(filteredFiles.length)} files
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
                  Page {currentPage} of {totalPages}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="w-full lg:flex-1">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-2 backdrop-blur-md">
                  <input
                    type="text"
                    placeholder={`Search in ${category.name}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-[18px] border border-white/10 bg-white px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="w-full lg:w-[280px]">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-2 backdrop-blur-md">
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full rounded-[18px] border border-white/10 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Category</option>
                    {allCategories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 flex justify-center">
          <AdSlot code={IN_CONTENT_AD} className="text-center" />
        </div>

        {filteredFiles.length === 0 ? (
          <>
            <div className="rounded-[26px] border border-dashed border-white/15 bg-slate-900/70 px-6 py-20 text-center shadow-sm">
              <div className="mx-auto max-w-md">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 text-3xl">
                  📁
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  No files found
                </h2>
                <p className="mt-3 text-slate-400">
                  There are no downloadable files in {category.name} yet.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center gap-4 pb-24 sm:mt-10">
              <button
                type="button"
                onClick={handleBackToTop}
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-200"
              >
                ↑ Back to Top
              </button>

              <div className="flex justify-center pt-3">
                <AdSlot code={IN_CONTENT_AD} className="text-center" />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mb-5 text-center text-sm text-slate-400">
              Showing <span className="font-bold text-white">{startItem}</span> to{" "}
              <span className="font-bold text-white">{endItem}</span> of{" "}
              <span className="font-bold text-white">{formatNumber(filteredFiles.length)}</span>{" "}
              files
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
              {paginatedFiles.map((file) => {
                const previewImage = getPreviewImage(file)
                const type = getDisplayFileType(file)
                const icon = getFileIcon(type)
                const visibility = (file.visibility || "free").toLowerCase()
                const isPremiumLocked = visibility === "premium"
                const isPlatinumLocked = visibility === "platinum"

                return (
                  <div
                    key={file.id}
                    className={`group overflow-hidden rounded-[24px] border bg-slate-900/80 shadow-[0_10px_30px_rgba(0,0,0,0.25)] ring-1 ring-white/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(0,0,0,0.38)] ${getCardBorderClasses(
                      file
                    )}`}
                  >
                    <div className="relative overflow-hidden bg-slate-800">
                      <div className="aspect-[4/5] overflow-hidden">
                        {previewImage ? (
                          <>
                            <img
                              src={previewImage}
                              alt={getDisplayName(file)}
                              loading="lazy"
                              decoding="async"
                              className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${
                                isPlatinumLocked || isPremiumLocked ? "brightness-90" : ""
                              }`}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
                          </>
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                            <div className="mb-3 text-5xl">{icon}</div>
                            <p className="px-4 text-center text-sm font-semibold text-slate-400">
                              No preview available
                            </p>
                          </div>
                        )}

                        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                          <div
                            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold backdrop-blur-md ${getVisibilityBadgeClasses(
                              file
                            )}`}
                          >
                            {getVisibilityLabel(file)}
                          </div>
                        </div>

                        {isPremiumLocked && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-amber-900/80 via-amber-800/30 to-transparent px-3 pb-3 pt-10">
                            <div className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100">
                              Premium Access
                            </div>
                          </div>
                        )}

                        {isPlatinumLocked && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-fuchsia-900/80 via-violet-800/30 to-transparent px-3 pb-3 pt-10">
                            <div className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-fuchsia-100">
                              Platinum Exclusive
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-3 pb-3 pt-3">
                      <h3
                        className="mb-2 line-clamp-2 min-h-[40px] text-center text-sm font-extrabold leading-tight text-white"
                        title={getDisplayName(file)}
                      >
                        {getDisplayName(file)}
                      </h3>

                      {isPlatinumLocked && !isPlatinumUser ? (
                        <Link
                          href="/upgrade"
                          className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                        >
                          Unlock with Platinum
                        </Link>
                      ) : isPremiumLocked && !isPremiumUser ? (
                        <Link
                          href="/upgrade"
                          className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                        >
                          Unlock with Premium
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDownload(file)}
                          className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-3 py-2.5 text-sm font-bold text-white transition hover:from-sky-600 hover:via-blue-700 hover:to-indigo-700"
                        >
                          Download Now
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-8 flex flex-col items-center gap-4 pb-24 sm:mt-10">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
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
                        ? "border-white bg-white text-slate-900"
                        : "border-white/10 bg-slate-900 text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>

              <button
                type="button"
                onClick={handleBackToTop}
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-200"
              >
                ↑ Back to Top
              </button>

              <div className="flex justify-center pt-3">
                <AdSlot code={IN_CONTENT_AD} className="text-center" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}