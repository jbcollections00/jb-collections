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

const PAGE_SIZE = 20

function slugify(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
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

function formatFileSize(bytes?: number | null) {
  const value = bytes || 0
  if (!value) return "Unknown"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let size = value
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`
}

function getDisplayName(file: FileItem) {
  return file.title || file.name || "Untitled File"
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

function getVisibilityLabel(file: FileItem) {
  const visibility = (file.visibility || "free").toLowerCase()
  if (visibility === "platinum") return "Platinum"
  if (visibility === "premium") return "Premium"
  if (visibility === "private") return "Private"
  return "Free"
}

function getVisibilityBadgeClasses(file: FileItem) {
  const visibility = (file.visibility || "free").toLowerCase()

  if (visibility === "platinum") {
    return "border-fuchsia-400/30 bg-fuchsia-500/90 text-white shadow-[0_0_24px_rgba(217,70,239,0.28)]"
  }
  if (visibility === "premium") {
    return "border-amber-400/30 bg-amber-500/90 text-white shadow-[0_0_24px_rgba(245,158,11,0.24)]"
  }
  if (visibility === "private") {
    return "border-red-400/30 bg-red-500/90 text-white shadow-[0_0_24px_rgba(239,68,68,0.24)]"
  }
  return "border-emerald-400/30 bg-emerald-500/90 text-white shadow-[0_0_24px_rgba(16,185,129,0.22)]"
}

function getCardBorderClasses(file: FileItem) {
  const visibility = (file.visibility || "free").toLowerCase()

  if (visibility === "platinum") return "border-fuchsia-400/20 hover:border-fuchsia-400/40"
  if (visibility === "premium") return "border-amber-400/20 hover:border-amber-400/40"
  if (visibility === "private") return "border-red-400/20 hover:border-red-400/40"
  return "border-white/10 hover:border-sky-400/30"
}

function isNewFile(file: FileItem) {
  if (!file.created_at) return false
  const createdAt = new Date(file.created_at).getTime()
  if (Number.isNaN(createdAt)) return false
  return createdAt > Date.now() - 10 * 24 * 60 * 60 * 1000
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const membership = normalizeMembership(profile?.membership)
  const isAdmin = profile?.role === "admin"
  const isPremiumUser =
    isAdmin ||
    profile?.is_premium === true ||
    membership === "premium" ||
    membership === "platinum"
  const isPlatinumUser = isAdmin || membership === "platinum"

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
    const start = (currentPage - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    return filteredFiles.slice(start, end)
  }, [filteredFiles, currentPage])

  const totalDownloads = useMemo(() => {
    return files.reduce((sum, file) => sum + (file.downloads_count || file.download_count || 0), 0)
  }, [files])

  const freeCount = useMemo(() => {
    return files.filter((file) => (file.visibility || "free").toLowerCase() === "free").length
  }, [files])

  const premiumCount = useMemo(() => {
    return files.filter((file) => (file.visibility || "free").toLowerCase() === "premium").length
  }, [files])

  const platinumCount = useMemo(() => {
    return files.filter((file) => (file.visibility || "free").toLowerCase() === "platinum").length
  }, [files])

  const newestCount = useMemo(() => {
    return files.filter((file) => isNewFile(file)).length
  }, [files])

  const imageCount = useMemo(() => {
    return files.filter((file) => getDisplayFileType(file) === "IMAGE" || isImageFile(file.file_url)).length
  }, [files])

  const videoCount = useMemo(() => {
    return files.filter((file) => getDisplayFileType(file) === "VIDEO" || isVideoFile(file.file_url)).length
  }, [files])

  const topDownloads = useMemo(() => {
    return [...files]
      .sort((a, b) => (b.downloads_count || b.download_count || 0) - (a.downloads_count || a.download_count || 0))
      .slice(0, 4)
  }, [files])

  const relatedFiles = useMemo(() => {
    return [...files]
      .sort((a, b) => {
        const aDownloads = a.downloads_count || a.download_count || 0
        const bDownloads = b.downloads_count || b.download_count || 0
        if (bDownloads !== aDownloads) return bDownloads - aDownloads
        const aTime = new Date(a.created_at || "").getTime() || 0
        const bTime = new Date(b.created_at || "").getTime() || 0
        return bTime - aTime
      })
      .filter((file) => file.id !== featuredFile?.id)
      .slice(0, 5)
  }, [files, featuredFile])

  const previewableFiles = useMemo(() => {
    return filteredFiles.filter((file) => canPreviewInline(file))
  }, [filteredFiles])

  const currentPreviewIndex = useMemo(() => {
    if (!previewFile) return -1
    return previewableFiles.findIndex((file) => file.id === previewFile.id)
  }, [previewFile, previewableFiles])

  function openPreview(file: FileItem) {
    setPreviewZoom(1)
    setPreviewFile(file)
  }

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

  function handlePreviewTouchStart(clientX: number) {
    setTouchStartX(clientX)
  }

  function handlePreviewTouchEnd(clientX: number) {
    if (touchStartX === null) return
    const deltaX = clientX - touchStartX

    if (Math.abs(deltaX) >= 60) {
      if (deltaX < 0) {
        openNextPreview()
      } else {
        openPrevPreview()
      }
    }

    setTouchStartX(null)
  }

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

  function clearFilters() {
    setSearch("")
    setFilter("all")
    setSortBy("newest")
  }

  function toggleFavorite(fileId: string) {
    const fileName = getDisplayName(files.find((file) => file.id === fileId) || { title: "File" } as FileItem)
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
        <div className="mx-auto w-full max-w-[1900px] px-4 pb-8 pt-24 sm:px-6 sm:pt-28 lg:px-8">
          <div className="mb-6 h-64 animate-pulse rounded-[34px] border border-white/10 bg-slate-900/80 ring-1 ring-white/5" />
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-[24px] border border-white/10 bg-slate-900/80" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/80 shadow-sm ring-1 ring-white/5">
                <div className="aspect-[3/4] animate-pulse bg-slate-800" />
                <div className="space-y-3 p-3">
                  <div className="mx-auto h-4 w-3/4 animate-pulse rounded bg-slate-700" />
                  <div className="h-4 w-full animate-pulse rounded bg-slate-700" />
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="rounded-3xl border border-white/10 bg-slate-900 px-8 py-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-white">Redirecting to categories...</p>
          <p className="mt-2 text-sm text-slate-400">Please wait.</p>
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
    <div className="min-h-screen bg-slate-950 text-white">
      <SiteHeader />

      <div className="mx-auto w-full max-w-[1900px] px-4 pb-10 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        <div className="mb-8 overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.22),transparent_28%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.18),transparent_25%),linear-gradient(135deg,#020617_0%,#0f172a_50%,#111827_100%)] shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
          <div className="relative">
            {heroImage ? (
              <>
                <img src={heroImage} alt={category.name} className="absolute inset-0 h-full w-full object-cover opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-900/40" />
              </>
            ) : null}

            <div className="relative z-10 px-5 py-6 sm:px-6 lg:px-8 lg:py-8">
              <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-300">
                <Link href="/categories" className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition hover:bg-white/10">
                  All Categories
                </Link>
                <span className="text-slate-500">/</span>
                <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-sky-300">
                  {category.name}
                </span>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
                <div>
                  <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-sky-200 backdrop-blur-sm">
                    10/10 Category Experience
                  </div>

                  <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                    {category.name}
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                    {category.description || "Explore a polished collection page with fast browsing, strong visuals, better filtering, and high-conversion file cards."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                      {formatNumber(files.length)} files
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                      {formatNumber(totalDownloads)} downloads
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                      {formatNumber(newestCount)} new arrivals
                    </div>
                  </div>

                  {featuredFile && (
                    <div className="mt-6 rounded-[26px] border border-white/10 bg-white/10 p-4 backdrop-blur-md">
                      <div className="mb-2 inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-200">
                        Featured Pick
                      </div>
                      <h2 className="text-lg font-black sm:text-xl">{getDisplayName(featuredFile)}</h2>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-300">
                        {featuredFile.description || "Top performing file in this category."}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <div className={`rounded-full border px-3 py-1.5 text-xs font-bold ${getVisibilityBadgeClasses(featuredFile)}`}>
                          {getVisibilityLabel(featuredFile)}
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
                          {getDisplayFileType(featuredFile)}
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
                          {formatNumber(featuredFile.downloads_count || featuredFile.download_count || 0)} downloads
                        </div>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => handleDownload(featuredFile)}
                          className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-200"
                        >
                          Download Featured
                        </button>
                        <button
                          type="button"
                          onClick={() => openPreview(featuredFile)}
                          className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/15"
                        >
                          Quick Preview
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-[26px] border border-white/10 bg-white/10 p-3 backdrop-blur-md">
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                      Search inside category
                    </label>
                    <input
                      type="text"
                      placeholder={`Search in ${category.name}...`}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="w-full rounded-[18px] border border-white/10 bg-white px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="sticky top-24 z-30 rounded-[26px] border border-white/10 bg-white/10 p-4 backdrop-blur-md shadow-[0_14px_35px_rgba(0,0,0,0.28)]">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">Browse Categories</span>
                      <Link href="/categories" className="text-xs font-semibold text-sky-300 hover:text-sky-200">
                        View all
                      </Link>
                    </div>
                    <div className="flex max-h-[160px] flex-wrap gap-2 overflow-auto pr-1">
                      {allCategories.map((item) => {
                        const active = item.id === category.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => router.push(getCategoryHref(item))}
                            className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                              active
                                ? "border-white bg-white text-slate-900"
                                : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                            }`}
                          >
                            {item.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="rounded-[26px] border border-white/10 bg-white/10 p-4 backdrop-blur-md">
                    <div className="mb-3 flex flex-wrap gap-2">
                      {[
                        { key: "all", label: "ALL" },
                        { key: "free", label: "FREE" },
                        { key: "premium", label: "PREMIUM" },
                        { key: "platinum", label: "PLATINUM" },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setFilter(item.key as FilterKey)}
                          className={`rounded-full border px-4 py-2 text-xs font-bold tracking-[0.14em] transition ${
                            filter === item.key
                              ? "border-white bg-white text-slate-900"
                              : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Sort</span>
                      <select
                        value={sortBy}
                        onChange={(event) => setSortBy(event.target.value as SortKey)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white outline-none"
                      >
                        <option value="newest" className="text-slate-900">Newest</option>
                        <option value="downloads" className="text-slate-900">Most Downloaded</option>
                        <option value="name" className="text-slate-900">Name A-Z</option>
                      </select>

                      {(search || filter !== "all" || sortBy !== "newest") && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Total Files", value: formatNumber(files.length) },
            { label: "Downloads", value: formatNumber(totalDownloads) },
            { label: "Free", value: formatNumber(freeCount) },
            { label: "Premium", value: formatNumber(premiumCount) },
            { label: "Platinum", value: formatNumber(platinumCount) },
            { label: "New This Week", value: formatNumber(newestCount) },
          ].map((item) => (
            <div key={item.label} className="rounded-[24px] border border-white/10 bg-slate-900/80 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
              <p className="mt-2 text-2xl font-black text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-8 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-white/10 bg-slate-900/80 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black tracking-tight text-white">🔥 Popular Now</h3>
                <p className="mt-1 text-sm text-slate-400">Quick access to the hottest files in this category</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {topDownloads.length > 0 ? (
                topDownloads.map((file, index) => {
                  const previewImage = getPreviewImage(file)
                  return (
                    <div key={file.id} className={`group w-full overflow-hidden rounded-[24px] border bg-slate-950/60 shadow-[0_12px_30px_rgba(0,0,0,0.28)] transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-[0_20px_45px_rgba(0,0,0,0.34)] ${index === 0 ? "border-amber-400/50 ring-1 ring-amber-300/30 shadow-[0_0_0_1px_rgba(251,191,36,0.18),0_20px_45px_rgba(0,0,0,0.34)]" : "border-white/10 hover:border-sky-400/40"}`}>
                      <div className="relative aspect-[3/4] overflow-hidden bg-slate-800">
                        {previewImage ? (
                          <>
                            <img src={previewImage} alt={getDisplayName(file)} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
                          </>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-4xl">{getFileIcon(getDisplayFileType(file))}</div>
                        )}
                        <div className={`absolute left-3 top-3 rounded-full border px-3 py-1.5 text-sm font-black text-white backdrop-blur-sm shadow-[0_10px_30px_rgba(0,0,0,0.28)] ${index === 0 ? "border-amber-300/40 bg-amber-500/90" : "border-white/10 bg-black/55"}`}>#{index + 1}</div>
                      </div>
                        {index === 0 && (
                          <div className="absolute right-3 bottom-3 rounded-full border border-amber-300/35 bg-amber-500/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-[0_10px_25px_rgba(245,158,11,0.35)]">
                            Top Pick
                          </div>
                        )}
                      <div className="p-4">
                        <h4 className="line-clamp-1 text-sm font-black text-white">{getDisplayName(file)}</h4>
                        <p className="mt-1 text-xs text-slate-400">{formatNumber(file.downloads_count || file.download_count || 0)} downloads</p>
                        <p className="mt-1 text-xs text-slate-400">Size: {formatFileSize(file.file_size || file.size)}</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => openPreview(file)}
                            className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(file)}
                            className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:from-sky-600 hover:via-blue-700 hover:to-indigo-700"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="col-span-full rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
                  No popular files yet in this category.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-slate-900/80 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.24)]">
              <h3 className="text-lg font-black text-white">Category Insights</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Images</p>
                  <p className="mt-2 text-2xl font-black">{formatNumber(imageCount)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Videos</p>
                  <p className="mt-2 text-2xl font-black">{formatNumber(videoCount)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 col-span-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Access Level</p>
                  <p className="mt-2 text-sm font-semibold text-slate-200">
                    {isPlatinumUser ? "You can access free, premium, and platinum files." : isPremiumUser ? "You can access free and premium files." : "You currently have access to free files only."}
                  </p>
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
            <div className="rounded-[28px] border border-dashed border-white/15 bg-slate-900/70 px-6 py-20 text-center shadow-sm">
              <div className="mx-auto max-w-md">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 text-3xl">🔎</div>
                <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">No files found</h2>
                <p className="mt-3 text-slate-400">No file matched your search or selected filter in {category.name}.</p>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-200"
                  >
                    Clear Search & Filters
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white">Browse Files</h2>
                <p className="mt-1 text-sm text-slate-400">Showing {startItem} to {endItem} of {formatNumber(filteredFiles.length)} files</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300">Page {currentPage} of {totalPages}</div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
              {paginatedFiles.map((file) => {
                const previewImage = getPreviewImage(file)
                const type = getDisplayFileType(file)
                const icon = getFileIcon(type)
                const visibility = (file.visibility || "free").toLowerCase()
                const isPremiumLocked = visibility === "premium"
                const isPlatinumLocked = visibility === "platinum"
                const isLocked = (isPremiumLocked && !isPremiumUser) || (isPlatinumLocked && !isPlatinumUser)
                const canPreview = canPreviewInline(file)

                return (
                  <div
                    key={file.id}
                    className={`group overflow-hidden rounded-[26px] border bg-slate-900/90 shadow-[0_12px_35px_rgba(0,0,0,0.28)] ring-1 ring-white/5 transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_24px_60px_rgba(0,0,0,0.42)] ${getCardBorderClasses(file)}`}
                    style={{ animation: `fadeUp 0.45s ease ${Math.min((currentPage - 1) * 0, 0) + (paginatedFiles.findIndex((entry) => entry.id === file.id) * 0.035)}s both` }}
                  >
                    <div className="relative overflow-hidden bg-slate-800">
                      <div className="aspect-[3/4] overflow-hidden">
                        {previewImage ? (
                          <>
                            <img
                              src={previewImage}
                              alt={getDisplayName(file)}
                              loading="lazy"
                              decoding="async"
                              className={`h-full w-full object-cover transition duration-500 group-hover:scale-110 ${isLocked ? "brightness-90" : ""}`}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
                            <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.08)_45%,transparent_70%)] opacity-0 transition duration-500 group-hover:opacity-100" />
                          </>
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                            <div className="mb-3 text-5xl">{icon}</div>
                            <p className="px-4 text-center text-sm font-semibold text-slate-400">No preview available</p>
                          </div>
                        )}

                        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                          <div className={`rounded-full border px-3 py-1.5 text-[11px] font-bold backdrop-blur-md ${getVisibilityBadgeClasses(file)}`}>
                            {getVisibilityLabel(file)}
                          </div>
                          <div className="rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-md">{type}</div>
                        </div>

                        <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(file.id)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/45 text-lg text-white backdrop-blur-md transition hover:scale-110 hover:bg-black/60"
                            aria-label={favorites.includes(file.id) ? "Remove from favorites" : "Add to favorites"}
                          >
                            {favorites.includes(file.id) ? "❤️" : "🤍"}
                          </button>
                          {(file.downloads_count || file.download_count || 0) >= 500 && (
                            <div className="rounded-full border border-red-400/30 bg-red-500/95 px-2.5 py-1 text-[10px] font-bold text-white shadow-[0_0_20px_rgba(239,68,68,0.30)]">🔥 TRENDING</div>
                          )}
                          {isNewFile(file) && (
                            <div className="rounded-full border border-sky-400/30 bg-sky-500/95 px-2.5 py-1 text-[10px] font-bold text-white shadow-[0_0_20px_rgba(14,165,233,0.25)]">NEW</div>
                          )}
                        </div>

                        {isPremiumLocked && !isPremiumUser && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-amber-900/85 via-amber-800/30 to-transparent px-3 pb-3 pt-10">
                            <div className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100">Premium Access</div>
                          </div>
                        )}

                        {isPlatinumLocked && !isPlatinumUser && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-fuchsia-900/85 via-violet-800/30 to-transparent px-3 pb-3 pt-10">
                            <div className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-fuchsia-100">Platinum Exclusive</div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 px-3 pb-3 pt-3">
                      <h3 className="line-clamp-2 min-h-[40px] text-sm font-extrabold leading-tight text-white" title={getDisplayName(file)}>
                        {getDisplayName(file)}
                      </h3>

                      <p className="line-clamp-2 min-h-[38px] text-xs leading-5 text-slate-400">
                        {file.description || "No description available."}
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Downloads</p>
                          <p className="mt-1 text-sm font-black text-white">{formatNumber(file.downloads_count || file.download_count || 0)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Size</p>
                          <p className="mt-1 text-sm font-black text-white">{formatFileSize(file.file_size || file.size)}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {canPreview ? (
                          <button
                            type="button"
                            onClick={() => openPreview(file)}
                            className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
                          >
                            Preview
                          </button>
                        ) : (
                          <div className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-slate-500">
                            No Preview
                          </div>
                        )}

                        {isPlatinumLocked && !isPlatinumUser ? (
                          <Link href="/upgrade" className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-2.5 text-sm font-bold text-white transition hover:opacity-90">
                            Unlock
                          </Link>
                        ) : isPremiumLocked && !isPremiumUser ? (
                          <Link href="/upgrade" className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2.5 text-sm font-bold text-white transition hover:opacity-90">
                            Unlock
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDownload(file)}
                            className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-3 py-2.5 text-sm font-bold text-white transition hover:from-sky-600 hover:via-blue-700 hover:to-indigo-700"
                          >
                            Download
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>


            {relatedFiles.length > 0 && (
              <div className="mt-12">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black tracking-tight text-white">✨ Users Also Downloaded</h3>
                    <p className="mt-1 text-sm text-slate-400">More files people open after viewing this category</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                  {relatedFiles.map((file) => {
                    const previewImage = getPreviewImage(file)
                    return (
                      <div
                        key={file.id}
                        className="group overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/80 shadow-[0_12px_30px_rgba(0,0,0,0.26)] transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:border-sky-400/35" style={{ animation: `fadeUp 0.45s ease ${relatedFiles.findIndex((entry) => entry.id === file.id) * 0.04}s both` }}
                      >
                        <div className="relative aspect-[3/4] overflow-hidden bg-slate-800">
                          {previewImage ? (
                            <>
                              <img
                                src={previewImage}
                                alt={getDisplayName(file)}
                                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                            </>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-4xl">
                              {getFileIcon(getDisplayFileType(file))}
                            </div>
                          )}

                          <div className={`absolute left-3 top-3 rounded-full border px-3 py-1.5 text-[11px] font-bold backdrop-blur-md ${getVisibilityBadgeClasses(file)}`}>
                            {getVisibilityLabel(file)}
                          </div>
                        </div>

                        <div className="space-y-2 p-4">
                          <h4 className="line-clamp-2 text-sm font-black text-white">{getDisplayName(file)}</h4>
                          <p className="text-xs text-slate-400">
                            {formatNumber(file.downloads_count || file.download_count || 0)} downloads
                          </p>
                          <p className="text-xs text-slate-400">Size: {formatFileSize(file.file_size || file.size)}</p>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => openPreview(file)}
                              className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownload(file)}
                              className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:from-sky-600 hover:via-blue-700 hover:to-indigo-700"
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

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

      {favoriteToast && (
        <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-3 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(0,0,0,0.38)] backdrop-blur-md">
          {favoriteToast}
        </div>
      )}

      {showQuickBar && (
        <div className="fixed bottom-6 right-6 z-[110] flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackToTop}
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm font-bold text-white shadow-[0_14px_35px_rgba(0,0,0,0.32)] backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            ↑ Top
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/90 px-4 py-3 text-sm font-bold text-white shadow-[0_14px_35px_rgba(14,165,233,0.32)] transition hover:-translate-y-0.5 hover:bg-sky-500"
          >
            Reset Filters
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {previewFile && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 px-3 py-4 backdrop-blur-md sm:px-4 sm:py-6"
          onClick={() => {
            setPreviewFile(null)
            setPreviewZoom(1)
          }}
        >
          <div
            className="relative flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 shadow-[0_25px_90px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <div className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${getVisibilityBadgeClasses(previewFile)}`}>
                    {getVisibilityLabel(previewFile)}
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white">
                    {getDisplayFileType(previewFile)}
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white">
                    {formatFileSize(previewFile.file_size || previewFile.size)}
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white">
                    {formatNumber(previewFile.downloads_count || previewFile.download_count || 0)} downloads
                  </div>
                </div>
                <h3 className="truncate text-lg font-black text-white sm:text-2xl">{getDisplayName(previewFile)}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Swipe to browse on mobile. Use arrow keys on desktop.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openPrevPreview}
                  disabled={previewableFiles.length <= 1}
                  className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  onClick={openNextPreview}
                  disabled={previewableFiles.length <= 1}
                  className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next →
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-bold text-white transition hover:bg-white/10"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(1)}
                  className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  {Math.round(previewZoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom((prev) => Math.min(3, Number((prev + 0.25).toFixed(2))))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-bold text-white transition hover:bg-white/10"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewFile(null)
                    setPreviewZoom(1)
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-bold text-white transition hover:bg-white/10"
                >
                  ×
                </button>
              </div>
            </div>

            <div
              className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_25%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]"
              onTouchStart={(event) => handlePreviewTouchStart(event.changedTouches[0]?.clientX ?? 0)}
              onTouchEnd={(event) => handlePreviewTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
            >
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-24 bg-gradient-to-r from-black/35 to-transparent lg:block" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-24 bg-gradient-to-l from-black/35 to-transparent lg:block" />

              {previewableFiles.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={openPrevPreview}
                    className="absolute left-3 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-xl font-black text-white backdrop-blur-md transition hover:scale-105 hover:bg-black/60 lg:inline-flex"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={openNextPreview}
                    className="absolute right-3 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/45 text-xl font-black text-white backdrop-blur-md transition hover:scale-105 hover:bg-black/60 lg:inline-flex"
                  >
                    ›
                  </button>
                </>
              )}

              <div className="flex h-full max-h-[68vh] min-h-[360px] items-center justify-center overflow-auto px-3 py-3 sm:px-6 sm:py-6">
                {getPreviewImage(previewFile) ? (
                  <img
                    src={getPreviewImage(previewFile) || ""}
                    alt={getDisplayName(previewFile)}
                    className="max-h-[64vh] w-auto max-w-full rounded-2xl object-contain transition-transform duration-300"
                    style={{ transform: `scale(${previewZoom})`, transformOrigin: "center center" }}
                  />
                ) : isVideoFile(previewFile.file_url) ? (
                  <video
                    src={previewFile.file_url ?? undefined}
                    controls
                    autoPlay
                    muted
                    playsInline
                    className="max-h-[64vh] w-full max-w-5xl rounded-2xl bg-black object-contain"
                  />
                ) : isPdfFile(previewFile.file_url, previewFile.mime_type) ? (
                  <iframe
                    src={previewFile.file_url ?? undefined}
                    title={getDisplayName(previewFile)}
                    className="h-[64vh] w-full rounded-2xl bg-white"
                  />
                ) : (
                  <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
                    <div className="mb-4 text-6xl">{getFileIcon(getDisplayFileType(previewFile))}</div>
                    <h4 className="text-xl font-black text-white">Preview not available</h4>
                    <p className="mt-2 max-w-md text-sm text-slate-400">This file type does not support inline preview. You can still download it below.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 bg-slate-950/95 px-4 py-4 sm:px-6">
              {previewableFiles.length > 0 && (
                <div className="mb-4 overflow-x-auto pb-1">
                  <div className="flex gap-3">
                    {previewableFiles.slice(0, 12).map((file) => {
                      const thumb = getPreviewImage(file)
                      const isActive = file.id === previewFile.id

                      return (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => openPreview(file)}
                          className={`group relative h-24 w-20 shrink-0 overflow-hidden rounded-2xl border transition ${
                            isActive
                              ? "border-sky-400 ring-2 ring-sky-400/40"
                              : "border-white/10 hover:border-sky-300/40"
                          }`}
                        >
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={getDisplayName(file)}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-900 text-2xl">
                              {getFileIcon(getDisplayFileType(file))}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                          <div className="absolute inset-x-1 bottom-1 line-clamp-2 text-left text-[10px] font-bold leading-tight text-white">
                            {getDisplayName(file)}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-400">
                  {currentPreviewIndex >= 0 ? `Preview ${currentPreviewIndex + 1} of ${previewableFiles.length}` : "Preview"}
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => toggleFavorite(previewFile.id)}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    {favorites.includes(previewFile.id) ? "❤️ Saved" : "🤍 Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewFile(null)
                      setPreviewZoom(1)
                    }}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(previewFile)}
                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:from-sky-600 hover:via-blue-700 hover:to-indigo-700"
                  >
                    Download File
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
