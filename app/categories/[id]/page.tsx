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

type ProfileRow = {
  role?: string | null
  membership?: string | null
  is_premium?: boolean | null
}

type FilterKey = "all" | "free" | "premium" | "platinum"
type SortKey = "newest" | "downloads" | "name"

// Set to 25 to support a perfect 5x5 layout matrix
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

function isUuid(value?: string | null) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  )
}

function isImageFile(url?: string | null) {
  if (!url) return false
  return /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|$)/i.test(url)
}

function isVideoFile(url?: string | null) {
  if (!url) return false
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url)
}

function isPdfFile(url?: string | null, mimeType?: string | null) {
  if (mimeType?.includes("pdf")) return true
  if (!url) return false
  return /\.pdf(\?|$)/i.test(url)
}

// Fixed priority order for previews: Title metadata images -> fallback URL properties
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

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat().format(value || 0)
}

function getDisplayName(file: FileItem) {
  return file.title || file.name || "Untitled Resource"
}

function canPreviewInline(file: FileItem) {
  return !!getPreviewImage(file) || isVideoFile(file.file_url) || isPdfFile(file.file_url, file.mime_type)
}

function normalizeMembership(value?: string | null) {
  const membership = String(value || "").trim().toLowerCase()
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  return "standard"
}

function isNewFile(file: FileItem) {
  if (!file.created_at) return false
  const createdAt = new Date(file.created_at).getTime()
  if (Number.isNaN(createdAt)) return false
  return createdAt > Date.now() - 10 * 24 * 60 * 60 * 1000
}

// Fallback logic for Category main banners
function getCategoryHeroImage(category: Category | null, featuredFile: FileItem | null) {
  if (category?.thumbnail_url) return category.thumbnail_url
  if (featuredFile) return getPreviewImage(featuredFile)
  return null
}

function getCategoryHref(category: Category) {
  return `/categories/${category.slug || slugify(category.name) || category.id}`
}

export default function CategoryPage() {
  const params = useParams()
  const router = useRouter()
  const routeValue = String(params?.id || "")
  const supabase = useMemo(() => createClient(), [])

  const [category, setCategory] = useState<Category | null>(null)
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [sortBy, setSortBy] = useState<SortKey>("newest")
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)
  const [previewZoom, setPreviewZoom] = useState(1)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [favorites, setFavorites] = useState<string[]>([])
  const [favoriteToast, setFavoriteToast] = useState<string | null>(null)
  const [showQuickBar, setShowQuickBar] = useState(false)

  useEffect(() => {
    if (routeValue) {
      void checkUserAndLoad()
    }
  }, [routeValue])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, filter, sortBy, category?.id])

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewFile(null)
        setPreviewZoom(1)
        return
      }

      if (!previewFile) return

      if (event.key === "ArrowRight") {
        event.preventDefault()
        openNextPreview()
        return
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        openPrevPreview()
        return
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault()
        setPreviewZoom((prev) => Math.min(3, Number((prev + 0.25).toFixed(2))))
        return
      }

      if (event.key === "-") {
        event.preventDefault()
        setPreviewZoom((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))))
      }
    }

    window.addEventListener("keydown", handleKeydown)
    return () => window.removeEventListener("keydown", handleKeydown)
  }, [previewFile])

  useEffect(() => {
    function handleScroll() {
      setShowQuickBar(window.scrollY > 520)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    if (!favoriteToast) return
    const timeout = window.setTimeout(() => setFavoriteToast(null), 1800)
    return () => window.clearTimeout(timeout)
  }, [favoriteToast])

  useEffect(() => {
    if (!previewFile) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [previewFile])

  useEffect(() => {
    if (!checkingAuth && !loading && !category) {
      router.replace("/categories")
    }
  }, [checkingAuth, loading, category, router])

  async function checkUserAndLoad() {
    try {
      setCheckingAuth(true)
      setLoading(true)

      const response = await supabase.auth.getUser()

      if (!response || response.error || !response.data?.user) {
        router.replace("/login")
        return
      }

      await fetchCategoryPage(response.data.user.id)
    } catch (error) {
      console.error("Category authentication check failure:", error)
      router.replace("/login")
    } finally {
      setCheckingAuth(false)
      setLoading(false)
    }
  }

  async function fetchCategoryPage(userId: string) {
    const [
      { data: categoriesData, error: categoriesError },
      { data: profileData, error: profileError },
    ] = await Promise.all([
      supabase.from("categories").select("id, name, slug, description, thumbnail_url").order("name", { ascending: true }),
      supabase.from("profiles").select("role, membership, is_premium").eq("id", userId).maybeSingle(),
    ])

    if (categoriesError) {
      console.error("Categories fetch error:", categoriesError)
      setAllCategories([])
      setCategory(null)
      setFiles([])
      return
    }

    const categories = (categoriesData || []) as Category[]
    setAllCategories(categories)

    const normalizedRouteValue = slugify(routeValue)
    const matchedCategory = categories.find((item) => {
      const matchesId = isUuid(routeValue) && item.id === routeValue
      const matchesSlug = slugify(item.slug) === normalizedRouteValue
      const matchesName = slugify(item.name) === normalizedRouteValue
      return matchesId || matchesSlug || matchesName
    })

    if (!matchedCategory) {
      setCategory(null)
      setFiles([])
    } else {
      setCategory(matchedCategory)

      const { data: filesData, error: filesError } = await supabase
        .from("files")
        .select("*")
        .eq("category_id", matchedCategory.id)
        .eq("status", "published")
        .order("created_at", { ascending: false })

      if (filesError) {
        console.error("Files fetch error:", filesError)
        setFiles([])
      } else {
        setFiles((filesData || []) as FileItem[])
      }
    }

    if (profileError) {
      console.error("Profile fetch error:", profileError)
      setProfile(null)
    } else {
      setProfile((profileData as ProfileRow | null) || null)
    }
  }

  const featuredFile = useMemo(() => {
    if (files.length === 0) return null
    return [...files].sort((a, b) => {
      const aDownloads = a.downloads_count || a.download_count || 0
      const bDownloads = b.downloads_count || b.download_count || 0
      if (bDownloads !== aDownloads) return bDownloads - aDownloads
      const aTime = new Date(a.created_at || "").getTime() || 0
      const bTime = new Date(b.created_at || "").getTime() || 0
      return bTime - aTime
    })[0]
  }, [files])

  const filteredFiles = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    let result = [...files]

    if (keyword) {
      result = result.filter((file) => {
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
    }

    if (filter !== "all") {
      result = result.filter((file) => (file.visibility || "free").toLowerCase() === filter)
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
  }, [files, search, filter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE))

  const paginatedFiles = useMemo(() => {
    const boundedPage = Math.min(currentPage, totalPages)
    const start = (boundedPage - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    return filteredFiles.slice(start, end)
  }, [filteredFiles, currentPage, totalPages])

  const totalDownloads = useMemo(() => {
    return files.reduce((sum, file) => sum + (file.downloads_count || file.download_count || 0), 0)
  }, [files])

  const newestCount = useMemo(() => {
    return files.filter((file) => isNewFile(file)).length
  }, [files])

  const previewableFiles = useMemo(() => {
    return filteredFiles.filter((file) => canPreviewInline(file))
  }, [filteredFiles])

  const currentPreviewIndex = useMemo(() => {
    if (!previewFile) return -1
    return previewableFiles.findIndex((file) => file.id === previewFile.id)
  }, [previewFile, previewableFiles])

  function openNextPreview() {
    if (!previewableFiles.length || currentPreviewIndex === -1) return
    const nextIndex = (currentPreviewIndex + 1) % previewableFiles.length
    setPreviewZoom(1)
    setPreviewFile(previewableFiles[nextIndex])
  }

  function openPrevPreview() {
    if (!previewableFiles.length || currentPreviewIndex === -1) return
    const prevIndex = (currentPreviewIndex - 1 + previewableFiles.length) % previewableFiles.length
    setPreviewZoom(1)
    setPreviewFile(previewableFiles[prevIndex])
  }

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function handleBackToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Links directly to your unique server routes
  function handleDownload(fileId: string) {
    window.location.href = `/download/${fileId}`
  }

  function clearFilters() {
    setSearch("")
    setFilter("all")
    setSortBy("newest")
  }

  function toggleFavorite(fileId: string) {
    const fileName = getDisplayName(files.find((file) => file.id === fileId) || ({ title: "File" } as FileItem))
    setFavorites((prev) => {
      const exists = prev.includes(fileId)
      setFavoriteToast(exists ? `Removed ${fileName} from favorites` : `Saved ${fileName} to favorites`)
      return exists ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    })
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="rounded-3xl border border-white/10 bg-slate-900 px-8 py-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-white">Verifying account access...</p>
          <p className="mt-2 text-sm text-slate-400">Please wait a moment.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <SiteHeader />
        <div className="mx-auto w-full max-w-[1900px] px-4 pb-8 pt-24 sm:px-6 sm:pt-28 lg:px-8">
          <div className="mb-6 h-64 animate-pulse rounded-[34px] border border-white/10 bg-slate-900/80 ring-1 ring-white/5" />
          {/* Skeleton loading matching our 5-column parameters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/80 shadow-sm ring-1 ring-white/5">
                <div className="aspect-[3/4] animate-pulse bg-slate-800" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="rounded-3xl border border-white/10 bg-slate-900 px-8 py-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-white">Navigating back to categories...</p>
        </div>
      </div>
    )
  }

  const startItem = filteredFiles.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const endItem = Math.min(currentPage * PAGE_SIZE, filteredFiles.length)
  const visiblePages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (page) => Math.abs(page - currentPage) <= 2
  )
  const heroImage = getCategoryHeroImage(category, featuredFile)

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <SiteHeader />

      <div className="mx-auto w-full max-w-[1900px] px-4 pb-10 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        
        {/* HERO HEADER REGION */}
        <div className="mb-8 overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-r from-sky-600/90 via-blue-700/80 to-indigo-950 p-6 md:p-8 shadow-2xl relative">
          {heroImage ? (
            <>
              <img src={heroImage} alt={category.name} className="absolute inset-0 h-full w-full object-cover opacity-15" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050814] via-[#050814]/70 to-transparent" />
            </>
          ) : null}

          <div className="relative z-10">
            {/* Breadcrumbs */}
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Link href="/categories" className="rounded-full border border-white/10 bg-black/30 px-3 py-1">
                All Categories
              </Link>
              <span className="text-slate-400">/</span>
              <span className="rounded-full border border-sky-400/30 bg-blue-500/30 px-3 py-1 font-bold text-sky-200">
                {category.name}
              </span>
            </div>

            {/* Title Block & Statistics */}
            <div className="mb-6 space-y-2">
              <span className="inline-block rounded-full border border-sky-400/20 bg-slate-950/50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-sky-300">
                Premium Vault Explorer
              </span>
              <h1 className="text-4xl font-black text-white tracking-tight md:text-5xl">
                {category.name}
              </h1>
              <p className="max-w-2xl text-sm text-slate-200 md:text-base">
                {category.description || "Browse custom, high-definition assets available below."}
              </p>

              <div className="flex flex-wrap gap-2 pt-2">
                <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs font-bold text-slate-200">
                  {formatNumber(files.length)} files
                </span>
                <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs font-bold text-slate-200">
                  {formatNumber(totalDownloads)} downloads
                </span>
                <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs font-bold text-slate-200">
                  {formatNumber(newestCount)} new arrivals
                </span>
              </div>
            </div>

            {/* HORIZONTAL CONTROLS COMPONENT BAR */}
            <div className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-3 md:p-4 shadow-2xl backdrop-blur-md">
              <div className="flex flex-col xl:flex-row items-center justify-between gap-4">
                
                {/* Search Parameter */}
                <div className="flex flex-col w-full xl:w-72">
                  <span className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Search inside category
                  </span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Search in ${category.name}...`}
                    className="w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Category Navigation Dropdown */}
                <div className="flex flex-col w-full xl:w-72">
                  <div className="mb-1 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Browse Categories
                    </span>
                    <Link href="/categories" className="text-[10px] font-bold text-sky-400 hover:underline">
                      View all
                    </Link>
                  </div>
                  <select
                    value={category.id}
                    onChange={(e) => {
                      const targetItem = allCategories.find((item) => item.id === e.target.value)
                      if (targetItem) router.push(getCategoryHref(targetItem))
                    }}
                    className="w-full rounded-xl bg-white px-4 py-2 text-xs font-extrabold uppercase text-slate-900 focus:outline-none cursor-pointer"
                  >
                    {allCategories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter and Sorting Group */}
                <div className="flex flex-wrap items-end justify-between xl:justify-end gap-3 w-full xl:w-auto">
                  
                  {/* Access Level Controls */}
                  <div className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-slate-900/80 p-1">
                    {(["all", "free", "premium", "platinum"] as const).map((itemKey) => (
                      <button
                        key={itemKey}
                        type="button"
                        onClick={() => setFilter(itemKey)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase transition-all ${
                          filter === itemKey
                            ? "bg-white text-slate-950 shadow-md"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {itemKey}
                      </button>
                    ))}
                  </div>

                  {/* Ordering Sequence */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase text-slate-400">Sort</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortKey)}
                      className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                    >
                      <option value="newest">Newest</option>
                      <option value="downloads">Most Downloaded</option>
                      <option value="name">Name A-Z</option>
                    </select>
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
          <div className="rounded-[28px] border border-dashed border-white/15 bg-slate-900/70 px-6 py-20 text-center shadow-sm">
            <div className="mx-auto max-w-md">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 text-3xl">🔎</div>
              <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">No files found</h2>
              <p className="mt-3 text-slate-400">No resources matched your current filter combinations.</p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-200"
                >
                  Reset Parameters
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white">Browse Files</h2>
                <p className="mt-1 text-sm text-slate-400">Showing {startItem} to {endItem} of {formatNumber(filteredFiles.length)} files</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300">
                Page {currentPage} of {totalPages}
              </div>
            </div>

            {/* FIXED 5-COLUMN GRID SPECIFYING PICTURE DETAILS & DIRECT DOWNLOAD TRIGGER */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {paginatedFiles.map((file, fileIdx) => {
                const previewImage = getPreviewImage(file)
                const type = getDisplayFileType(file)
                const fileTitle = getDisplayName(file)
                const dlCount = file.downloads_count || file.download_count || 0

                return (
                  <div
                    key={file.id}
                    className="group relative overflow-hidden rounded-[24px] border border-slate-800 bg-slate-900/40 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-slate-700"
                    style={{ animation: `fadeUp 0.45s ease ${fileIdx * 0.025}s both` }}
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-950">
                      {previewImage ? (
                        <img
                          src={previewImage}
                          alt={fileTitle}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-102"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 text-xs text-slate-600">
                          Placeholder Graphic
                        </div>
                      )}

                      {/* Pill Tier Tags */}
                      <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
                        <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-950 shadow">
                          {file.visibility || "Free"}
                        </span>
                        <span className="rounded-full border border-white/10 bg-slate-900/80 px-2.5 py-0.5 text-[9px] font-bold uppercase text-white backdrop-blur-md">
                          {type}
                        </span>
                      </div>

                      {/* Favorite Button Overlay Trigger */}
                      <button
                        type="button"
                        onClick={() => toggleFavorite(file.id)}
                        className="absolute right-3 top-3 z-10 rounded-full border border-white/10 bg-slate-900/60 p-2 text-slate-300 backdrop-blur-md transition hover:bg-slate-800"
                      >
                        <svg className={`h-3.5 w-3.5 fill-current ${favorites.includes(file.id) ? "text-red-500" : "text-slate-300"}`} viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </button>

                      {/* New Upload Arrival Badge */}
                      {isNewFile(file) && (
                        <div className="absolute bottom-3 right-3 z-10">
                          <span className="rounded-full bg-sky-500 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white shadow-md">
                            NEW
                          </span>
                        </div>
                      )}

                      {/* METADATA OVERLAY (Name, Downloads, and Direct Link Callout) */}
                      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent p-3 pt-8 transform transition-transform duration-300">
                        <p className="line-clamp-1 text-xs font-black tracking-tight text-white drop-shadow">
                          {fileTitle}
                        </p>
                        
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                            📥 {formatNumber(dlCount)} DLs
                          </span>
                          
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file.id);
                            }}
                            className="rounded-lg bg-blue-600 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-white transition hover:bg-blue-500 shadow"
                          >
                            Download
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination Segment */}
            <div className="mt-8 flex flex-col items-center gap-4 pb-24 sm:mt-10">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prev
                </button>
                {visiblePages.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => goToPage(page)}
                    className={`min-w-[48px] rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
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
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>

              <button
                type="button"
                onClick={handleBackToTop}
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
              >
                ↑ Back to Top
              </button>
            </div>
          </>
        )}
      </div>

      {favoriteToast && (
        <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-md">
          {favoriteToast}
        </div>
      )}

      {showQuickBar && (
        <div className="fixed bottom-6 right-6 z-[110] flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackToTop}
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm font-bold text-white backdrop-blur-md transition hover:bg-slate-800"
          >
            ↑ Top
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/90 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-500"
          >
            Reset Filters
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}