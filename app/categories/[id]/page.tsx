"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

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
    if (categoryId) checkUserAndLoad()
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
    } catch {
      router.replace("/login")
    } finally {
      setCheckingAuth(false)
      setLoading(false)
    }
  }

  async function fetchCategoryPage() {
    const [
      { data: categoryData },
      { data: filesData },
      { data: categoriesData },
    ] = await Promise.all([
      supabase.from("categories").select("id,name,description").eq("id", categoryId).single(),
      supabase.from("files").select("*").eq("category_id", categoryId).eq("status","published").order("created_at",{ascending:false}),
      supabase.from("categories").select("id,name").order("name",{ascending:true}),
    ])

    setCategory(categoryData || null)
    setFiles(filesData || [])
    setAllCategories(categoriesData || [])
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
    window.location.href = `/api/download/${file.id}`
  }

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.replace("/login")
  }

  if (checkingAuth) return <div className="flex min-h-screen items-center justify-center">Checking account...</div>

  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>

  if (!category) return <div className="text-center p-20">Category not found</div>

  return (
    <div className="min-h-screen bg-slate-50">

      <div className="mx-auto max-w-[1800px] px-4 py-6">

        <div className="mb-8 rounded-[30px] bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 p-8 text-white">

          <h1 className="text-4xl font-black mb-3">{category.name}</h1>

          <p className="text-white/80 mb-6">
            {category.description || `Browse downloadable resources inside ${category.name}.`}
          </p>

          <input
            type="text"
            placeholder={`Search in ${category.name}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-black"
          />

        </div>

        {/* 6 COLUMN GRID */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">

          {paginatedFiles.map((file) => {

            const previewImage = getPreviewImage(file)
            const type = getDisplayFileType(file)
            const icon = getFileIcon(type)

            return (
              <div
                key={file.id}
                className="group overflow-hidden rounded-xl border bg-white shadow-sm hover:shadow-xl transition"
              >

                <div className="aspect-[4/5] bg-slate-100 overflow-hidden relative">

                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt={getDisplayName(file)}
                      className="h-full w-full object-cover group-hover:scale-105 transition"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-4xl">
                      {icon}
                    </div>
                  )}

                  {file.visibility === "premium" && (
                    <div className="absolute right-2 top-2 bg-black text-white text-xs px-2 py-1 rounded">
                      Premium
                    </div>
                  )}

                </div>

                <div className="p-3">

                  <h3 className="text-sm font-bold text-center mb-3 line-clamp-2">
                    {getDisplayName(file)}
                  </h3>

                  <button
                    onClick={() => handleDownload(file)}
                    className="w-full rounded-lg bg-blue-600 text-white py-2 text-sm font-semibold hover:bg-blue-700"
                  >
                    Download
                  </button>

                </div>

              </div>
            )
          })}

        </div>

      </div>
    </div>
  )
}