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
  slug?: string | null
  description: string | null
  thumbnail_url?: string | null
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

type SortKey = "newest" | "downloads" | "name"

const PAGE_SIZE = 25

function slugify(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/^-+|-+$/g, "")
}

function getPreviewImage(file: FileItem) {
  if (file.cover_url) return file.cover_url
  if (file.thumbnail_url) return file.thumbnail_url
  if (file.image_url) return file.image_url
  if (file.file_url && /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|$)/i.test(file.file_url)) {
    return file.file_url
  }
  return null
}

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat().format(value || 0)
}

function getDisplayName(file: FileItem) {
  return file.title || file.name || "Untitled Resource"
}

export default function CategoryPage() {
  const params = useParams()
  const router = useRouter()
  const routeValue = String(params?.id || params?.slug || params?.category || "")
  const supabase = useMemo(() => createClient(), [])

  const [category, setCategory] = useState<Category | null>(null)
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortKey>("newest")
  const [favorites, setFavorites] = useState<string[]>([])
  const [favoriteToast, setFavoriteToast] = useState<string | null>(null)
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (routeValue) {
      void loadCategoryAndFiles()
    } else {
      setLoading(false)
      setErrorMessage("Walang nahanap na Category ID sa URL.")
    }
  }, [routeValue])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, sortBy, category?.id])

  useEffect(() => {
    if (!favoriteToast) return
    const timeout = window.setTimeout(() => setFavoriteToast(null), 1800)
    return () => window.clearTimeout(timeout)
  }, [favoriteToast])

  async function loadCategoryAndFiles() {
    try {
      setLoading(true)
      setErrorMessage(null)

      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("id, name, slug, description, thumbnail_url")
        .order("name", { ascending: true })

      if (categoriesError) {
        console.error("Categories fetch error:", categoriesError)
        setErrorMessage("Hindi ma-load ang mga kategorya mula sa database.")
        return
      }

      const categories = (categoriesData || []) as Category[]
      setAllCategories(categories)

      const normalizedRoute = slugify(routeValue)
      const matchedCategory = categories.find((item) => {
        const matchesId = item.id.toLowerCase() === routeValue.toLowerCase()
        const matchesSlug = slugify(item.slug) === normalizedRoute
        const matchesName = slugify(item.name) === normalizedRoute
        return matchesId || matchesSlug || matchesName
      })

      if (!matchedCategory) {
        setCategory(null)
        setErrorMessage(`Hindi nahanap ang kategoryang "${routeValue}".`)
        return
      }

      setCategory(matchedCategory)

      const { data: filesData, error: filesError } = await supabase
        .from("files")
        .select("*")
        .eq("category_id", matchedCategory.id)
        .order("created_at", { ascending: false })

      if (filesError) {
        console.error("Files fetch error:", filesError)
      } else {
        setFiles((filesData || []) as FileItem[])
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      setErrorMessage("May nangyaring hindi inaasahang error sa pag-load ng data.")
    } finally {
      setLoading(false)
    }
  }

  const filteredFiles = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    let result = [...files]

    if (keyword) {
      result = result.filter((file) => {
        const name = getDisplayName(file).toLowerCase()
        const description = file.description?.toLowerCase() || ""
        return name.includes(keyword) || description.includes(keyword)
      })
    }

    result.sort((a, b) => {
      if (sortBy === "name") return getDisplayName(a).localeCompare(getDisplayName(b))
      if (sortBy === "downloads") {
        const aDownloads = a.downloads_count || a.download_count || 0
        const bDownloads = b.downloads_count || b.download_count || 0
        return bDownloads - aDownloads
      }
      const aTime = new Date(a.created_at || "").getTime() || 0
      const bTime = new Date(b.created_at || "").getTime() || 0
      return bTime - aTime
    })

    return result
  }, [files, search, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE))

  const paginatedFiles = useMemo(() => {
    const boundedPage = Math.min(currentPage, totalPages)
    const start = (boundedPage - 1) * PAGE_SIZE
    return filteredFiles.slice(start, start + PAGE_SIZE)
  }, [filteredFiles, currentPage, totalPages])

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function handleNavigateToDownload(file: FileItem) {
    const target = file.slug || file.id
    router.push(`/download/${target}`)
  }

  function toggleFavorite(fileId: string) {
    const fileName = getDisplayName(
      files.find((f) => f.id === fileId) || ({ title: "Resource" } as FileItem)
    )
    setFavorites((prev) => {
      const exists = prev.includes(fileId)
      setFavoriteToast(
        exists ? `Tinanggal ang ${fileName} sa favorites` : `Inilagay ang ${fileName} sa favorites`
      )
      return exists ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050814] text-white">
        <SiteHeader />
        <div className="mx-auto w-full max-w-[1900px] px-4 pb-8 pt-20 sm:px-6 lg:px-8">
          <div className="mb-6 h-48 animate-pulse rounded-[34px] border border-white/10 bg-slate-900/80" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="h-64 animate-pulse rounded-[24px] border border-white/10 bg-slate-900/80"
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (errorMessage || !category) {
    return (
      <div className="min-h-screen bg-[#050814] text-white">
        <SiteHeader />
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="max-w-md rounded-3xl border border-rose-500/20 bg-slate-900/90 p-8 text-center shadow-2xl backdrop-blur-xl">
            <span className="text-5xl">⚠️</span>
            <h2 className="mt-4 text-xl font-black text-white">Hindi Maikarga ang Kategorya</h2>
            <p className="mt-2 text-sm text-slate-400">
              {errorMessage || "Maaaring nabura o mali ang URL na pinuntahan."}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700"
              >
                Subukang Muli
              </button>
              <Link
                href="/dashboard"
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"
              >
                Bumalik sa Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const startItem = filteredFiles.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const endItem = Math.min(currentPage * PAGE_SIZE, filteredFiles.length)

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <SiteHeader />

      <div className="mx-auto w-full max-w-[1900px] px-4 pb-10 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        <div className="relative mb-6 overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-r from-sky-600/90 via-blue-700/80 to-indigo-950 p-6 shadow-2xl md:p-8">
          <div className="relative z-10">
            <div className="mb-4">
              <span className="inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-sky-200">
                Category View
              </span>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
                {category.name}
              </h1>
              {category.description && (
                <p className="mt-1 max-w-2xl text-sm text-slate-200">{category.description}</p>
              )}
            </div>

            <div className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-3 shadow-2xl backdrop-blur-md md:p-4">
              <div className="flex flex-col items-center justify-between gap-4 xl:flex-row">
                <div className="flex w-full flex-col xl:w-72">
                  <span className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Maghanap sa kategoryang ito
                  </span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Search in ${category.name}...`}
                    className="w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="flex w-full flex-col xl:w-72">
                  <span className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Lumipat ng Kategorya
                  </span>
                  <select
                    value={category.id}
                    onChange={(e) => {
                      const targetItem = allCategories.find((item) => item.id === e.target.value)
                      if (targetItem) {
                        router.push(`/category/${targetItem.slug || targetItem.id}`)
                      }
                    }}
                    className="w-full cursor-pointer rounded-xl bg-white px-4 py-2 text-xs font-extrabold uppercase text-slate-900 focus:outline-none"
                  >
                    {allCategories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase text-slate-400">Sort</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    className="cursor-pointer rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="newest">Pinakabago</option>
                    <option value="downloads">Pinakamaraming Download</option>
                    <option value="name">Pangalan (A-Z)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {filteredFiles.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-white/15 bg-slate-900/70 px-6 py-20 text-center shadow-sm">
            <div className="mx-auto max-w-md">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 text-3xl">
                📁
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                Walang Files Dito
              </h2>
              <p className="mt-3 text-slate-400">
                Wala pang nai-upload na file sa kategoryang ito o walang nag-match sa hinahanap mo.
              </p>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="mt-6 inline-flex items-center justify-center rounded-2xl bg-white px-5 py-2.5 text-xs font-bold text-slate-900"
                >
                  Clear Search Filter
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white">Mga File</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Ipinapakita {startItem} hanggang {endItem} sa kabuuang{" "}
                  {formatNumber(filteredFiles.length)} files
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {paginatedFiles.map((file) => {
                const rawPreviewImage = getPreviewImage(file)
                const isImageBroken = !rawPreviewImage || failedImages[file.id]
                const fileTitle = getDisplayName(file)
                const dlCount = file.downloads_count || file.download_count || 0

                return (
                  <div
                    key={file.id}
                    onClick={() => handleNavigateToDownload(file)}
                    className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-[24px] border border-slate-800 bg-slate-900/40 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-slate-700"
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-950">
                      {!isImageBroken ? (
                        <img
                          src={rawPreviewImage}
                          alt={fileTitle}
                          loading="lazy"
                          onError={() => setFailedImages((prev) => ({ ...prev, [file.id]: true }))}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-4 text-center">
                          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-2xl text-slate-500">
                            🖼️
                          </div>
                          <span className="line-clamp-1 text-[11px] font-semibold text-slate-500">
                            No Preview Available
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        aria-label="Favorite button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleFavorite(file.id)
                        }}
                        className="absolute right-3 top-3 z-10 rounded-full border border-white/10 bg-slate-900/60 p-2 text-slate-300 backdrop-blur-md transition hover:bg-slate-800"
                      >
                        <svg
                          className={`h-3.5 w-3.5 fill-current ${
                            favorites.includes(file.id) ? "text-red-500" : "text-slate-300"
                          }`}
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex flex-col items-center gap-2 bg-slate-900/90 p-3 text-center">
                      <p className="line-clamp-1 w-full text-center text-xs font-black tracking-tight text-white">
                        {fileTitle}
                      </p>

                      <div className="flex w-full flex-col items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleNavigateToDownload(file)
                          }}
                          className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-extrabold uppercase text-white shadow transition hover:bg-blue-500"
                        >
                          Download
                        </button>

                        <span className="flex items-center justify-center gap-1 text-[10px] font-medium text-slate-400">
                          📥 {formatNumber(dlCount)} DLs
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-10 flex justify-center">
              <AdSlot code={IN_CONTENT_AD} className="text-center" />
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-2 pb-16">
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="flex items-center px-4 text-xs font-bold text-slate-300">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-xs font-semibold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {favoriteToast && (
        <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-md">
          {favoriteToast}
        </div>
      )}
    </div>
  )
}