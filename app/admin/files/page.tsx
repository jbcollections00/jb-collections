"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { FolderOpen, Search, Trash2, Edit2, Download } from "lucide-react"

type Category = {
  id: string
  name: string
}

type FileItem = {
  id: string
  title: string
  description: string | null
  file_size: number | null
  file_type: string | null
  created_at: string
  category_id: string | null
  status: "draft" | "review" | "published" | "flagged" | "removed"
  visibility: "free" | "premium" | "platinum" | "private"
  storage_key: string | null
  thumbnail_url: string | null
  downloads: number
  category?: Category | null
}

export default function FileManagerPage() {
  const supabase = createClient()
  const router = useRouter()

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    void checkAdminAndLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkAdminAndLoad() {
    try {
      setCheckingAdmin(true)
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace("/secure-admin-portal-7X9")
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()

      if (profileError || profile?.role !== "admin") {
        router.replace("/secure-admin-portal-7X9")
        return
      }

      await loadData()
    } catch (error) {
      console.error("Admin check failed:", error)
      router.replace("/secure-admin-portal-7X9")
    } finally {
      setCheckingAdmin(false)
    }
  }

  async function loadData() {
    setLoading(true)
    try {
      const { data: catData } = await supabase
        .from("categories")
        .select("id,name")
        .order("name", { ascending: true })
      
      setCategories((catData as Category[]) || [])

      const { data: fileData, error: fileError } = await supabase
        .from("files")
        .select(`
          id, title, description, file_size, file_type, created_at, category_id,
          status, visibility, storage_key, thumbnail_url, downloads:download_count,
          category:categories(id,name)
        `)
        .order("created_at", { ascending: false })

      if (fileError) throw fileError
      setFiles((fileData as any[]) || [])
    } catch (error) {
      console.error("Failed to load data:", error)
      alert("Failed to load files.")
    } finally {
      setLoading(false)
    }
  }

  async function deleteFile(id: string, storageKey: string | null) {
    if (!confirm("Are you sure you want to delete this file? This cannot be undone.")) return
    
    setDeletingId(id)
    try {
      if (storageKey) {
        await fetch("/api/admin/files/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", storageKey })
        })
      }

      const { error } = await supabase.from("files").delete().eq("id", id)
      if (error) throw error

      setFiles(files.filter((f) => f.id !== id))
    } catch (error) {
      console.error("Failed to delete file:", error)
      alert("Failed to delete file.")
    } finally {
      setDeletingId(null)
    }
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return "Unknown size"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || f.status === statusFilter
    const matchesCategory = categoryFilter === "all" || f.category_id === categoryFilter
    return matchesSearch && matchesStatus && matchesCategory
  })

  if (checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
        <div className="rounded-[24px] border border-slate-800 bg-slate-900 px-8 py-6 text-center shadow-2xl">
          <p className="text-lg font-bold text-white">Checking admin access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_24%),linear-gradient(180deg,#020617_0%,#0b1220_48%,#111827_100%)] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1800px]">
        {/* Header */}
        <section className="mt-4 overflow-hidden rounded-[30px] border border-white/10 bg-slate-900/75 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.22),transparent_30%),linear-gradient(135deg,#0f172a_0%,#0b1220_45%,#111827_100%)]" />
            <div className="relative flex flex-col gap-5 px-5 py-6 sm:px-6 sm:py-7 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-sky-200">
                  <FolderOpen size={14} />
                  File Manager
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Manage Files
                </h1>
              </div>
              <button
                onClick={() => router.push('/admin/files/upload')}
                className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-700"
              >
                Upload New File
              </button>
            </div>
          </div>
        </section>

        {/* Toolbar */}
        <section className="mt-5 rounded-[28px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.26)] backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                placeholder="Search files by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-sky-400/40"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40 md:w-48"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="text-black">{c.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40 md:w-48"
            >
              <option value="all">All Statuses</option>
              <option value="published" className="text-black">Published</option>
              <option value="draft" className="text-black">Draft</option>
              <option value="review" className="text-black">Review</option>
              <option value="flagged" className="text-black">Flagged</option>
              <option value="removed" className="text-black">Removed</option>
            </select>
          </div>
        </section>

        {/* File Grid */}
        <section className="mt-5">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              Loading files...
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-slate-900/75 p-10 text-center text-slate-400">
              No files found.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredFiles.map((file) => (
                <div key={file.id} className="flex flex-col overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/75 transition hover:border-white/20">
                  <div className="relative aspect-video w-full bg-slate-950/50">
                    {file.thumbnail_url ? (
                      <img src={file.thumbnail_url} alt={file.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-600">
                        No Thumbnail
                      </div>
                    )}
                    <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                      {file.status}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="line-clamp-1 text-lg font-bold text-white" title={file.title}>
                      {file.title}
                    </h3>
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                      <span className="rounded bg-white/5 px-2 py-1">{file.category?.name || "Uncategorized"}</span>
                      <span className="rounded bg-white/5 px-2 py-1">{file.visibility}</span>
                      <span className="rounded bg-white/5 px-2 py-1">{formatFileSize(file.file_size)}</span>
                    </div>
                    
                    <div className="mt-auto pt-5 flex items-center justify-between border-t border-white/5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Download size={14} />
                        {file.downloads ?? 0}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/admin/files/edit/${file.id}`)}
                          className="flex items-center justify-center rounded-xl bg-sky-500/10 p-2 text-sky-400 transition hover:bg-sky-500/20"
                          title="Edit File"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deleteFile(file.id, file.storage_key)}
                          disabled={deletingId === file.id}
                          className="flex items-center justify-center rounded-xl bg-red-500/10 p-2 text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                          title="Delete File"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}