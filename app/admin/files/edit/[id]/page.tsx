"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft, Edit3, ShieldCheck } from "lucide-react"

type Category = {
  id: string
  name: string
}

type PresignResponse = {
  success?: boolean
  uploadUrl?: string
  key?: string
  error?: string
}

type FinalizeResponse = {
  success?: boolean
  message?: string
  error?: string
  fileId?: string
}

type Visibility = "free" | "premium" | "platinum" | "private"
type FileStatus = "draft" | "review" | "published" | "flagged" | "removed"

export default function EditFilePage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const fileId = params?.id as string

  const lastProgressRef = useRef(0)

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [loadingFile, setLoadingFile] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [visibility, setVisibility] = useState<Visibility>("free")
  const [status, setStatus] = useState<FileStatus>("published")

  // Existing file metadata
  const [existingStorageKey, setExistingStorageKey] = useState<string | null>(null)
  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState<string | null>(null)
  const [existingFileSize, setExistingFileSize] = useState<number | null>(null)
  const [existingFileType, setExistingFileType] = useState<string | null>(null)

  // Replacement upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedThumbnail, setSelectedThumbnail] = useState<File | null>(null)

  const [saving, setSaving] = useState(false)
  const [statusText, setStatusText] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [uploadProgress, setUploadProgress] = useState<number>(0)

  useEffect(() => {
    if (fileId) {
      void checkAdminAndLoad()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId])

  async function checkAdminAndLoad() {
    try {
      setCheckingAdmin(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

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

      // Load Categories
      const { data: categoriesData } = await supabase
        .from("categories")
        .select("id,name")
        .order("name", { ascending: true })

      setCategories((categoriesData as Category[]) || [])

      // Load File Details
      setLoadingFile(true)
      const { data: fileData, error: fileError } = await supabase
        .from("files")
        .select(`
          id, title, description, category_id, visibility, status,
          storage_key, thumbnail_url, file_size, file_type
        `)
        .eq("id", fileId)
        .single()

      if (fileError || !fileData) {
        setErrorMessage("File not found.")
        return
      }

      setTitle(fileData.title || "")
      setDescription(fileData.description || "")
      setCategoryId(fileData.category_id || "")
      setVisibility(fileData.visibility || "free")
      setStatus(fileData.status || "published")
      setExistingStorageKey(fileData.storage_key || null)
      setExistingThumbnailUrl(fileData.thumbnail_url || null)
      setExistingFileSize(fileData.file_size || null)
      setExistingFileType(fileData.file_type || null)
    } catch (error) {
      console.error("Initialization failed:", error)
      router.replace("/secure-admin-portal-7X9")
    } finally {
      setCheckingAdmin(false)
      setLoadingFile(false)
    }
  }

  function clearMessages() {
    setErrorMessage("")
    setSuccessMessage("")
    setStatusText("")
    setUploadProgress(0)
    lastProgressRef.current = 0
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return "Unknown"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  function getFileType(name: string) {
    return name.includes(".") ? name.split(".").pop()?.toUpperCase() || null : null
  }

  function handleFileChange(file: File | null) {
    clearMessages()
    if (!file) {
      setSelectedFile(null)
      return
    }

    const maxSizeInBytes = 5 * 1024 * 1024 * 1024
    if (file.size > maxSizeInBytes) {
      setSelectedFile(null)
      setErrorMessage("File is too large. Maximum allowed size is 5GB.")
      return
    }

    setSelectedFile(file)
  }

  function handleThumbnailChange(file: File | null) {
    clearMessages()
    if (!file) {
      setSelectedThumbnail(null)
      return
    }

    if (!file.type.startsWith("image/")) {
      setSelectedThumbnail(null)
      setErrorMessage("Thumbnail must be an image file.")
      return
    }

    const maxSizeInBytes = 10 * 1024 * 1024
    if (file.size > maxSizeInBytes) {
      setSelectedThumbnail(null)
      setErrorMessage("Thumbnail is too large. Maximum allowed size is 10MB.")
      return
    }

    setSelectedThumbnail(file)
  }

  async function requestPresignedUpload(params: {
    fileName: string
    contentType: string
    title?: string
    categoryId?: string
    folder?: string
  }) {
    const response = await fetch("/api/admin/files/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "presign", ...params }),
    })

    const text = await response.text()
    let result: PresignResponse = {}

    try {
      result = text ? (JSON.parse(text) as PresignResponse) : {}
    } catch {
      result = { error: text || "Invalid server response." }
    }

    if (!response.ok || !result.uploadUrl || !result.key) {
      throw new Error(result.error || `Failed to get upload URL. (${response.status})`)
    }

    return { uploadUrl: result.uploadUrl, key: result.key }
  }

  function uploadFileDirect(file: File, uploadUrl: string, onProgress?: (percent: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("PUT", uploadUrl)
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress(percent)
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}.`))
        }
      }

      xhr.onerror = () => reject(new Error("Network error during upload."))
      xhr.send(file)
    })
  }

  function updateProgress(percent: number, label: string) {
    const previous = lastProgressRef.current
    if (percent === 100 || percent === 0 || percent >= previous + 2 || percent < previous) {
      lastProgressRef.current = percent
      setUploadProgress(percent)
      setStatusText(`${label} ${percent}%`)
    }
  }

  async function updateFile() {
    clearMessages()

    if (!title.trim()) {
      setErrorMessage("File title is required.")
      return
    }
    if (!categoryId) {
      setErrorMessage("Please select a category.")
      return
    }

    setSaving(true)
    try {
      let finalStorageKey = existingStorageKey
      let finalThumbnailUrl = existingThumbnailUrl
      let finalFileSize = existingFileSize
      let finalFileType = existingFileType

      // If replacing main file
      if (selectedFile) {
        setStatusText("Uploading replacement file...")
        const presignedMain = await requestPresignedUpload({
          fileName: selectedFile.name,
          contentType: selectedFile.type || "application/octet-stream",
          title: title.trim(),
          categoryId,
        })
        setUploadProgress(0)
        lastProgressRef.current = 0

        await uploadFileDirect(selectedFile, presignedMain.uploadUrl, (percent) => {
          updateProgress(percent, "Uploading replacement file...")
        })
        finalStorageKey = presignedMain.key
        finalFileSize = selectedFile.size
        finalFileType = getFileType(selectedFile.name)
      }

      // If replacing thumbnail
      if (selectedThumbnail) {
        setStatusText("Uploading replacement thumbnail...")
        const presignedThumb = await requestPresignedUpload({
          fileName: selectedThumbnail.name,
          contentType: selectedThumbnail.type || "application/octet-stream",
          folder: "thumbnails",
        })
        setUploadProgress(0)
        lastProgressRef.current = 0

        await uploadFileDirect(selectedThumbnail, presignedThumb.uploadUrl, (percent) => {
          updateProgress(percent, "Uploading replacement thumbnail...")
        })
        finalThumbnailUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.replace(/\/$/, "") || ""}/${presignedThumb.key}`
      }

      setUploadProgress(0)
      setStatusText("Updating file record...")

      const response = await fetch("/api/admin/files/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finalize",
          mode: "edit",
          fileId,
          title: title.trim(),
          description,
          categoryId,
          visibility,
          status,
          shrinkmeUrl: null,
          linkvertiseUrl: null,
          monetizationEnabled: false,
          storageKey: finalStorageKey,
          thumbnailUrl: finalThumbnailUrl,
          fileSize: finalFileSize,
          fileType: finalFileType,
        }),
      })

      const text = await response.text()
      let result: FinalizeResponse = {}

      try {
        result = text ? (JSON.parse(text) as FinalizeResponse) : {}
      } catch {
        result = { error: text || "Invalid server response." }
      }

      if (!response.ok) {
        throw new Error(result.error || `Failed to update record. (${response.status})`)
      }

      setSuccessMessage("File updated successfully! Redirecting...")
      setTimeout(() => {
        router.push("/admin/files")
      }, 1200)
    } catch (error) {
      setStatusText("")
      setUploadProgress(0)
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  if (checkingAdmin || loadingFile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
        <div className="rounded-[24px] border border-slate-800 bg-slate-900 px-8 py-6 text-center shadow-2xl">
          <p className="text-lg font-bold text-white">Loading file details...</p>
          <p className="mt-2 text-sm text-slate-400">Please wait.</p>
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
                <button
                  onClick={() => router.push("/admin/files")}
                  className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white"
                >
                  <ArrowLeft size={14} /> Back to File Manager
                </button>
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-sky-200">
                    <Edit3 size={14} />
                    Edit File
                  </div>
                </div>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {title || "Edit File Record"}
                </h1>
              </div>
            </div>
          </div>
        </section>

        {/* Status Alerts */}
        {(errorMessage || successMessage || statusText) && (
          <div
            className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-bold ${
              errorMessage
                ? "border-red-400/20 bg-red-500/10 text-red-300"
                : successMessage
                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                  : "border-sky-400/20 bg-sky-500/10 text-sky-300"
            }`}
          >
            <div>{errorMessage || successMessage || statusText}</div>
            {!errorMessage && !successMessage && uploadProgress > 0 && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-sky-950">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Edit Form */}
        <section className="mt-5 rounded-[28px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.26)] backdrop-blur sm:p-5">
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-400">Title</label>
                <input
                  placeholder="File Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-400">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id} className="text-black">
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-bold text-slate-400">Description</label>
                <textarea
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={saving}
                  className="min-h-[96px] w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40"
                />
              </div>
              <div className="grid gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-400">Visibility</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as Visibility)}
                    disabled={saving}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
                  >
                    <option value="free" className="text-black">Free</option>
                    <option value="premium" className="text-black">Premium</option>
                    <option value="platinum" className="text-black">Platinum</option>
                    <option value="private" className="text-black">Private</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-400">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as FileStatus)}
                    disabled={saving}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
                  >
                    <option value="draft" className="text-black">Draft</option>
                    <option value="review" className="text-black">Review</option>
                    <option value="published" className="text-black">Published</option>
                    <option value="flagged" className="text-black">Flagged</option>
                    <option value="removed" className="text-black">Removed</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <label className="mb-2 block text-sm font-bold text-slate-200">
                  Replace Main File (Optional)
                </label>
                <input
                  type="file"
                  disabled={saving}
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:font-semibold file:text-white"
                />
                <div className="mt-3 text-xs text-slate-400">
                  Current size: {formatFileSize(existingFileSize)} | Type: {existingFileType || "Unknown"}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <label className="mb-2 block text-sm font-bold text-slate-200">
                  Replace Thumbnail (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  disabled={saving}
                  onChange={(e) => handleThumbnailChange(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:font-semibold file:text-white"
                />
                <div className="mt-3 flex items-center gap-3">
                  {selectedThumbnail ? (
                    <img
                      src={URL.createObjectURL(selectedThumbnail)}
                      alt="New Thumbnail Preview"
                      className="h-16 w-16 rounded-xl border border-white/10 object-cover"
                    />
                  ) : existingThumbnailUrl ? (
                    <img
                      src={existingThumbnailUrl}
                      alt="Current Thumbnail"
                      className="h-16 w-16 rounded-xl border border-white/10 object-cover"
                    />
                  ) : (
                    <span className="text-xs text-slate-500">No thumbnail set</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={updateFile}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? "Updating..." : "Update File Record"}
              </button>
              <button
                onClick={() => router.push("/admin/files")}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}