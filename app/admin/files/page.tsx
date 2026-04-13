"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import AdminHeader from "@/app/components/AdminHeader"
import { createClient } from "@/lib/supabase/client"
import {
  BadgeCheck,
  FolderOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
} from "lucide-react"

type FileItem = {
  id: string
  title: string
  slug?: string | null
  description: string | null
  cover_url?: string | null
  thumbnail_url?: string | null
  visibility?: "free" | "premium" | "platinum" | "private" | null
  status?: "draft" | "review" | "published" | "flagged" | "removed" | null
  category_id: string | null
  created_at: string
  shrinkme_url?: string | null
  linkvertise_url?: string | null
  monetization_enabled?: boolean | null
}

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

function normalizeExternalUrl(value?: string | null) {
  if (!value) return null

  let url = value.trim()
  url = url.replace(/^[^a-zA-Z0-9]+/, "")

  if (url.startsWith("Phttp")) {
    url = url.substring(1)
  }

  if (/^https?:\/\//i.test(url)) return url

  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(url)) {
    return `https://${url}`
  }

  return null
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_14px_34px_rgba(2,6,23,0.32)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
          {label}
        </div>
        <div className="rounded-2xl bg-white/10 p-2 text-sky-200">
          <Icon size={16} />
        </div>
      </div>

      <div className={`mt-3 text-3xl font-black tracking-tight ${color}`}>{value}</div>
    </div>
  )
}

export default function FilesPage() {
  const supabase = createClient()
  const router = useRouter()
  const lastProgressRef = useRef(0)

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [files, setFiles] = useState<FileItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [visibility, setVisibility] = useState<Visibility>("free")
  const [status, setStatus] = useState<FileStatus>("published")
  const [shrinkmeUrl, setShrinkmeUrl] = useState("")
  const [linkvertiseUrl, setLinkvertiseUrl] = useState("")
  const [monetizationEnabled, setMonetizationEnabled] = useState(true)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [selectedThumbnail, setSelectedThumbnail] = useState<File | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)

  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState<string | null>(null)
  const [existingStorageKey, setExistingStorageKey] = useState<string | null>(null)
  const [existingFileSize, setExistingFileSize] = useState<number | null>(null)
  const [existingFileType, setExistingFileType] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [statusText, setStatusText] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [uploadProgress, setUploadProgress] = useState<number>(0)

  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterVisibility, setFilterVisibility] = useState<Visibility | "all">("all")
  const [filterStatus, setFilterStatus] = useState<FileStatus | "all">("all")

  useEffect(() => {
    void checkAdminAndLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

      await loadData(true)
    } catch (error) {
      console.error("Admin files auth check failed:", error)
      router.replace("/secure-admin-portal-7X9")
    } finally {
      setCheckingAdmin(false)
    }
  }

  async function loadData(showLoader = false) {
    if (showLoader) setLoading(true)
    else setRefreshing(true)

    setErrorMessage("")

    const [
      { data: filesData, error: filesError },
      { data: categoriesData, error: categoriesError },
    ] = await Promise.all([
      supabase
        .from("files")
        .select(
          "id, title, slug, description, cover_url, thumbnail_url, visibility, status, category_id, created_at, shrinkme_url, linkvertise_url, monetization_enabled"
        )
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("id,name").order("name", { ascending: true }),
    ])

    if (filesError || categoriesError) {
      setErrorMessage(
        filesError?.message || categoriesError?.message || "Failed to load data."
      )
    }

    setFiles((filesData as FileItem[]) || [])
    setCategories((categoriesData as Category[]) || [])
    setLoading(false)
    setRefreshing(false)
  }

  function clearMessages() {
    setErrorMessage("")
    setSuccessMessage("")
    setStatusText("")
    setUploadProgress(0)
    lastProgressRef.current = 0
  }

  function resetFileInputs() {
    const fileInput = document.getElementById("file-upload-input") as HTMLInputElement | null
    const thumbnailInput = document.getElementById(
      "thumbnail-upload-input"
    ) as HTMLInputElement | null

    if (fileInput) fileInput.value = ""
    if (thumbnailInput) thumbnailInput.value = ""
  }

  function clearForm() {
    setTitle("")
    setDescription("")
    setCategoryId("")
    setVisibility("free")
    setStatus("published")
    setShrinkmeUrl("")
    setLinkvertiseUrl("")
    setMonetizationEnabled(true)
    setSelectedFile(null)
    setSelectedFiles([])
    setSelectedThumbnail(null)
    setEditingId(null)
    setExistingThumbnailUrl(null)
    setExistingStorageKey(null)
    setExistingFileSize(null)
    setExistingFileType(null)
    clearMessages()
    resetFileInputs()
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  function getFileType(name: string) {
    return name.includes(".") ? name.split(".").pop()?.toUpperCase() || null : null
  }

  function getDisplayThumbnail(file: FileItem) {
    if (file.thumbnail_url && /^https?:\/\//i.test(file.thumbnail_url)) {
      return file.thumbnail_url
    }

    if (file.cover_url && /^https?:\/\//i.test(file.cover_url)) {
      return file.cover_url
    }

    return null
  }

  function getCategoryName(categoryId: string | null) {
    if (!categoryId) return "Uncategorized"
    return categories.find((cat) => cat.id === categoryId)?.name || "Uncategorized"
  }

  function handleFileChange(file: File | null) {
    clearMessages()
    setSelectedFiles([])

    if (!file) {
      setSelectedFile(null)
      return
    }

    const maxSizeInBytes = 5 * 1024 * 1024 * 1024
    if (file.size > maxSizeInBytes) {
      setSelectedFile(null)
      resetFileInputs()
      setErrorMessage("File is too large. Maximum allowed size is 5GB.")
      return
    }

    setSelectedFile(file)
  }

  function handleMultipleFiles(fileList: FileList | null) {
    clearMessages()
    setSelectedFile(null)

    if (!fileList) {
      setSelectedFiles([])
      return
    }

    const maxSizeInBytes = 5 * 1024 * 1024 * 1024
    const nextFiles: File[] = []
    let skippedLarge = 0

    Array.from(fileList).forEach((file) => {
      if (file.size > maxSizeInBytes) {
        skippedLarge += 1
        return
      }
      nextFiles.push(file)
    })

    setSelectedFiles(nextFiles)

    if (skippedLarge > 0) {
      setErrorMessage(`${skippedLarge} file(s) exceeded 5GB and were skipped.`)
    }
  }

  function handleThumbnailChange(file: File | null) {
    clearMessages()

    if (!file) {
      setSelectedThumbnail(null)
      return
    }

    if (!file.type.startsWith("image/")) {
      setSelectedThumbnail(null)
      const thumbnailInput = document.getElementById(
        "thumbnail-upload-input"
      ) as HTMLInputElement | null
      if (thumbnailInput) thumbnailInput.value = ""
      setErrorMessage("Thumbnail must be an image file.")
      return
    }

    const maxSizeInBytes = 10 * 1024 * 1024
    if (file.size > maxSizeInBytes) {
      setSelectedThumbnail(null)
      const thumbnailInput = document.getElementById(
        "thumbnail-upload-input"
      ) as HTMLInputElement | null
      if (thumbnailInput) thumbnailInput.value = ""
      setErrorMessage("Thumbnail is too large. Maximum allowed size is 10MB.")
      return
    }

    setSelectedThumbnail(file)
  }

  function editFile(file: FileItem) {
    clearMessages()
    setTitle(file.title || "")
    setDescription(file.description || "")
    setCategoryId(file.category_id || "")
    setVisibility((file.visibility || "free") as Visibility)
    setStatus((file.status || "published") as FileStatus)
    setShrinkmeUrl(file.shrinkme_url || "")
    setLinkvertiseUrl(file.linkvertise_url || "")
    setMonetizationEnabled(file.monetization_enabled !== false)
    setSelectedFile(null)
    setSelectedFiles([])
    setSelectedThumbnail(null)
    setEditingId(file.id)
    setExistingThumbnailUrl(getDisplayThumbnail(file))
    setExistingStorageKey(null)
    setExistingFileSize(null)
    setExistingFileType(null)
    resetFileInputs()
    window.scrollTo({ top: 0, behavior: "smooth" })
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "presign",
        ...params,
      }),
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

    return {
      uploadUrl: result.uploadUrl,
      key: result.key,
    }
  }

  function uploadFileDirect(
    file: File,
    uploadUrl: string,
    onProgress?: (percent: number) => void
  ) {
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

      xhr.onerror = () => {
        reject(new Error("Network error during upload."))
      }

      xhr.send(file)
    })
  }

  async function finalizeFileRecord(payload: {
    mode: "create" | "update"
    id?: string
    title: string
    description: string
    categoryId: string
    visibility: Visibility
    status: FileStatus
    shrinkmeUrl: string | null
    linkvertiseUrl: string | null
    monetizationEnabled: boolean
    storageKey: string | null
    thumbnailUrl: string | null
    fileSize: number | null
    fileType: string | null
  }) {
    const response = await fetch("/api/admin/files/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "finalize",
        ...payload,
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
      throw new Error(result.error || `Failed to save file record. (${response.status})`)
    }

    return result
  }

  function updateProgress(percent: number, label: string) {
    const previous = lastProgressRef.current

    if (percent === 100 || percent === 0 || percent >= previous + 2 || percent < previous) {
      lastProgressRef.current = percent
      setUploadProgress(percent)
      setStatusText(`${label} ${percent}%`)
    }
  }

  async function saveFile() {
    clearMessages()

    if ((!editingId || selectedFiles.length > 0) && !categoryId) {
      setErrorMessage("Please select a category.")
      return
    }

    const cleanedShrinkmeUrl = shrinkmeUrl.trim()
      ? normalizeExternalUrl(shrinkmeUrl)
      : null
    const cleanedLinkvertiseUrl = linkvertiseUrl.trim()
      ? normalizeExternalUrl(linkvertiseUrl)
      : null

    if (shrinkmeUrl.trim() && !cleanedShrinkmeUrl) {
      setErrorMessage("ShrinkMe link is invalid. Please enter a full valid URL.")
      return
    }

    if (linkvertiseUrl.trim() && !cleanedLinkvertiseUrl) {
      setErrorMessage("Linkvertise link is invalid. Please enter a full valid URL.")
      return
    }

    if (!editingId && selectedFiles.length > 0) {
      setSaving(true)

      try {
        let sharedThumbnailUrl: string | null = null

        if (selectedThumbnail) {
          setStatusText("Preparing shared thumbnail upload...")

          const presignedThumb = await requestPresignedUpload({
            fileName: selectedThumbnail.name,
            contentType: selectedThumbnail.type || "application/octet-stream",
            folder: "thumbnails",
          })

          setUploadProgress(0)
          setStatusText("Uploading shared thumbnail...")
          lastProgressRef.current = 0

          await uploadFileDirect(selectedThumbnail, presignedThumb.uploadUrl, (percent) => {
            updateProgress(percent, "Uploading shared thumbnail...")
          })

          sharedThumbnailUrl = `${
            process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.replace(/\/$/, "") || ""
          }/${presignedThumb.key}`
        }

        for (let index = 0; index < selectedFiles.length; index++) {
          const currentFile = selectedFiles[index]
          const derivedTitle = title.trim() || currentFile.name.replace(/\.[^/.]+$/, "")

          setStatusText(
            `Preparing file ${index + 1} of ${selectedFiles.length}: ${currentFile.name}`
          )
          setUploadProgress(0)
          lastProgressRef.current = 0

          const presignedMain = await requestPresignedUpload({
            fileName: currentFile.name,
            contentType: currentFile.type || "application/octet-stream",
            title: derivedTitle,
            categoryId,
          })

          setStatusText(
            `Uploading file ${index + 1} of ${selectedFiles.length}: ${currentFile.name}`
          )

          await uploadFileDirect(currentFile, presignedMain.uploadUrl, (percent) => {
            updateProgress(
              percent,
              `Uploading file ${index + 1} of ${selectedFiles.length}: ${currentFile.name}`
            )
          })

          setUploadProgress(0)
          setStatusText(
            `Saving record ${index + 1} of ${selectedFiles.length}: ${currentFile.name}`
          )

          await finalizeFileRecord({
            mode: "create",
            title: derivedTitle,
            description,
            categoryId,
            visibility,
            status,
            shrinkmeUrl: cleanedShrinkmeUrl,
            linkvertiseUrl: cleanedLinkvertiseUrl,
            monetizationEnabled,
            storageKey: presignedMain.key,
            thumbnailUrl: sharedThumbnailUrl,
            fileSize: currentFile.size,
            fileType: getFileType(currentFile.name),
          })
        }

        clearForm()
        setSuccessMessage(
          `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} uploaded successfully.`
        )
        await loadData()
      } catch (error) {
        setStatusText("")
        setUploadProgress(0)
        setErrorMessage(error instanceof Error ? error.message : "Something went wrong.")
      } finally {
        setSaving(false)
      }

      return
    }

    if (!title.trim()) {
      setErrorMessage("File title is required.")
      return
    }

    if (!categoryId) {
      setErrorMessage("Please select a category.")
      return
    }

    if (!editingId && !selectedFile) {
      setErrorMessage("Please choose a file to upload.")
      return
    }

    setSaving(true)

    try {
      let finalStorageKey: string | null = existingStorageKey || null
      let finalThumbnailUrl: string | null = existingThumbnailUrl || null
      let finalFileSize: number | null = existingFileSize || null
      let finalFileType: string | null = existingFileType || null

      if (selectedFile) {
        setStatusText("Preparing main file upload...")

        const presignedMain = await requestPresignedUpload({
          fileName: selectedFile.name,
          contentType: selectedFile.type || "application/octet-stream",
          title: title.trim(),
          categoryId,
        })

        setStatusText("Uploading main file...")
        setUploadProgress(0)
        lastProgressRef.current = 0

        await uploadFileDirect(selectedFile, presignedMain.uploadUrl, (percent) => {
          updateProgress(percent, "Uploading main file...")
        })

        finalStorageKey = presignedMain.key
        finalFileSize = selectedFile.size
        finalFileType = getFileType(selectedFile.name)
      }

      if (selectedThumbnail) {
        setStatusText("Preparing thumbnail upload...")

        const presignedThumb = await requestPresignedUpload({
          fileName: selectedThumbnail.name,
          contentType: selectedThumbnail.type || "application/octet-stream",
          folder: "thumbnails",
        })

        setUploadProgress(0)
        setStatusText("Uploading thumbnail...")
        lastProgressRef.current = 0

        await uploadFileDirect(selectedThumbnail, presignedThumb.uploadUrl, (percent) => {
          updateProgress(percent, "Uploading thumbnail...")
        })

        finalThumbnailUrl = `${
          process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.replace(/\/$/, "") || ""
        }/${presignedThumb.key}`
      }

      setUploadProgress(0)
      setStatusText("Saving file record...")

      await finalizeFileRecord({
        mode: editingId ? "update" : "create",
        id: editingId || undefined,
        title: title.trim(),
        description,
        categoryId,
        visibility,
        status,
        shrinkmeUrl: cleanedShrinkmeUrl,
        linkvertiseUrl: cleanedLinkvertiseUrl,
        monetizationEnabled,
        storageKey: finalStorageKey,
        thumbnailUrl: finalThumbnailUrl,
        fileSize: finalFileSize,
        fileType: finalFileType,
      })

      const wasEditing = Boolean(editingId)
      clearForm()
      setSuccessMessage(wasEditing ? "File updated successfully." : "File uploaded successfully.")
      await loadData()
    } catch (error) {
      setStatusText("")
      setUploadProgress(0)
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteFile(id: string) {
    clearMessages()

    const confirmed = window.confirm("Are you sure you want to delete this file?")
    if (!confirmed) return

    setDeletingId(id)

    try {
      const response = await fetch("/api/admin/files/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileId: id }),
      })

      const text = await response.text()
      let result: { success?: boolean; error?: string } = {}

      try {
        result = text ? JSON.parse(text) : {}
      } catch {
        result = { error: text || "Invalid server response." }
      }

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete file.")
      }

      if (editingId === id) {
        clearForm()
      }

      setSuccessMessage("File deleted successfully.")
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete file.")
    } finally {
      setDeletingId(null)
    }
  }

  function getVisibilityBadgeClasses(currentVisibility?: string | null) {
    if (currentVisibility === "platinum") {
      return "border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-300"
    }

    if (currentVisibility === "premium") {
      return "border-blue-400/20 bg-blue-500/10 text-blue-300"
    }

    if (currentVisibility === "private") {
      return "border-red-400/20 bg-red-500/10 text-red-300"
    }

    return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
  }

  function getStatusBadgeClasses(currentStatus?: string | null) {
    if (currentStatus === "published") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
    if (currentStatus === "review") return "border-amber-400/20 bg-amber-500/10 text-amber-300"
    if (currentStatus === "flagged") return "border-red-400/20 bg-red-500/10 text-red-300"
    if (currentStatus === "removed") return "border-slate-500/20 bg-slate-500/10 text-slate-300"
    return "border-sky-400/20 bg-sky-500/10 text-sky-300"
  }

  const filteredFiles = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return files.filter((file) => {
      const categoryName = getCategoryName(file.category_id).toLowerCase()
      const matchesSearch =
        !keyword ||
        file.title.toLowerCase().includes(keyword) ||
        (file.description || "").toLowerCase().includes(keyword) ||
        categoryName.includes(keyword)

      const matchesCategory =
        filterCategory === "all" || file.category_id === filterCategory

      const matchesVisibility =
        filterVisibility === "all" || (file.visibility || "free") === filterVisibility

      const matchesStatus =
        filterStatus === "all" || (file.status || "draft") === filterStatus

      return matchesSearch && matchesCategory && matchesVisibility && matchesStatus
    })
  }, [files, searchTerm, filterCategory, filterVisibility, filterStatus, categories])

  const stats = useMemo(() => {
    return {
      total: files.length,
      published: files.filter((file) => (file.status || "draft") === "published").length,
      premium: files.filter((file) => (file.visibility || "free") === "premium" || (file.visibility || "free") === "platinum").length,
      categories: categories.length,
    }
  }, [files, categories])

  if (checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
        <div className="rounded-[24px] border border-slate-800 bg-slate-900 px-8 py-6 text-center shadow-2xl">
          <p className="text-lg font-bold text-white">Checking admin access...</p>
          <p className="mt-2 text-sm text-slate-400">Please wait.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_24%),linear-gradient(180deg,#020617_0%,#0b1220_48%,#111827_100%)] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1800px]">
        <AdminHeader />

        <section className="mt-4 overflow-hidden rounded-[30px] border border-white/10 bg-slate-900/75 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.22),transparent_30%),linear-gradient(135deg,#0f172a_0%,#0b1220_45%,#111827_100%)]" />
            <div className="relative flex flex-col gap-5 px-5 py-6 sm:px-6 sm:py-7 lg:flex-row lg:items-end lg:justify-between lg:px-8">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-sky-200">
                  <ShieldCheck size={14} />
                  Admin Files
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  File Upload & Library
                </h1>

                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Upload, edit, monetize, and organize your file records in a cleaner premium admin layout.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadData(false)}
                disabled={refreshing}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing..." : "Refresh Files"}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Total Files" value={stats.total} icon={BadgeCheck} color="text-white" />
          <StatCard label="Published" value={stats.published} icon={UploadCloud} color="text-emerald-300" />
          <StatCard label="Premium Files" value={stats.premium} icon={ShieldCheck} color="text-blue-300" />
          <StatCard label="Categories" value={stats.categories} icon={FolderOpen} color="text-amber-300" />
        </section>

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

        <section className="mt-5 rounded-[28px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.26)] backdrop-blur sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-black text-white">
              {editingId ? "Edit File" : "Upload File"}
            </h2>
            {editingId ? (
              <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
                Editing Mode
              </span>
            ) : null}
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input
                placeholder={
                  selectedFiles.length > 1 && !editingId
                    ? "Shared title base (optional for multi-upload)"
                    : "File title"
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={saving}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40"
              />

              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={saving}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id} className="text-black">
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
                className="min-h-[96px] w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40 md:col-span-2"
              />

              <div className="grid gap-4">
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

            <div className="grid gap-4 md:grid-cols-2">
              <input
                placeholder="ShrinkMe link (optional)"
                value={shrinkmeUrl}
                onChange={(e) => setShrinkmeUrl(e.target.value)}
                disabled={saving}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40"
              />

              <input
                placeholder="Linkvertise link (optional)"
                value={linkvertiseUrl}
                onChange={(e) => setLinkvertiseUrl(e.target.value)}
                disabled={saving}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40"
              />
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-medium text-slate-200">
              <input
                type="checkbox"
                checked={monetizationEnabled}
                onChange={(e) => setMonetizationEnabled(e.target.checked)}
                disabled={saving}
                className="h-4 w-4"
              />
              Enable Linkvertise monetization for this file
            </label>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              Save one monetized link per file. Example:
              <span className="ml-1 font-semibold">https://direct-link.net/...</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <label
                  htmlFor="file-upload-input"
                  className="mb-2 block text-sm font-bold text-slate-200"
                >
                  {editingId
                    ? "Replace file (optional, up to 5GB)"
                    : "Choose file(s) (up to 5GB each)"}
                </label>

                <input
                  id="file-upload-input"
                  type="file"
                  multiple={!editingId}
                  disabled={saving}
                  onChange={(e) => {
                    const fileList = e.target.files

                    if (!fileList || fileList.length === 0) {
                      handleFileChange(null)
                      setSelectedFiles([])
                      return
                    }

                    if (editingId || fileList.length === 1) {
                      handleFileChange(fileList[0] || null)
                    } else {
                      handleMultipleFiles(fileList)
                    }
                  }}
                  className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:font-semibold file:text-white"
                />

                {selectedFiles.length > 0 && !editingId && (
                  <div className="mt-3 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-3">
                    <p className="text-sm font-bold text-sky-200">
                      {selectedFiles.length} files selected
                    </p>
                    <div className="mt-2 max-h-36 space-y-1 overflow-auto pr-1">
                      {selectedFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="text-xs text-sky-200">
                          {index + 1}. {file.name} — {formatFileSize(file.size)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedFile && (
                  <div className="mt-3">
                    <p className="text-sm font-bold text-sky-300">{selectedFile.name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Size: {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                )}

                {!selectedFile && selectedFiles.length === 0 && editingId && (
                  <div className="mt-3">
                    <p className="text-xs font-bold text-slate-400">Current file attached</p>
                    {existingFileSize ? (
                      <p className="mt-1 text-xs text-slate-400">
                        Size: {formatFileSize(existingFileSize)}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <label
                  htmlFor="thumbnail-upload-input"
                  className="mb-2 block text-sm font-bold text-slate-200"
                >
                  {editingId
                    ? "Replace thumbnail (optional)"
                    : selectedFiles.length > 1
                      ? "Choose shared thumbnail image for all selected files"
                      : "Choose thumbnail image"}
                </label>

                <input
                  id="thumbnail-upload-input"
                  type="file"
                  accept="image/*"
                  disabled={saving}
                  onChange={(e) => handleThumbnailChange(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:font-semibold file:text-white"
                />

                {selectedThumbnail && (
                  <img
                    src={URL.createObjectURL(selectedThumbnail)}
                    alt="Thumbnail preview"
                    className="mt-3 h-24 w-24 rounded-2xl border border-white/10 object-cover"
                  />
                )}

                {!selectedThumbnail && existingThumbnailUrl && (
                  <img
                    src={existingThumbnailUrl}
                    alt="Current thumbnail"
                    className="mt-3 h-24 w-24 rounded-2xl border border-white/10 object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={saveFile}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving
                  ? "Uploading..."
                  : editingId
                    ? "Update File"
                    : selectedFiles.length > 1
                      ? `Upload ${selectedFiles.length} Files`
                      : "Upload & Create"}
              </button>

              <button
                onClick={clearForm}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Clear
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.26)] backdrop-blur sm:p-5">
          <div className="mb-4 flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-black text-white">Uploaded Files</h2>

              <div className="inline-flex w-fit rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 sm:text-sm">
                Showing {filteredFiles.length} of {files.length}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
              <div className="relative lg:col-span-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40"
                />
              </div>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
              >
                <option value="all" className="text-black">All categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id} className="text-black">
                    {cat.name}
                  </option>
                ))}
              </select>

              <select
                value={filterVisibility}
                onChange={(e) =>
                  setFilterVisibility(e.target.value as Visibility | "all")
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
              >
                <option value="all" className="text-black">All visibility</option>
                <option value="free" className="text-black">Free</option>
                <option value="premium" className="text-black">Premium</option>
                <option value="platinum" className="text-black">Platinum</option>
                <option value="private" className="text-black">Private</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FileStatus | "all")}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
              >
                <option value="all" className="text-black">All status</option>
                <option value="draft" className="text-black">Draft</option>
                <option value="review" className="text-black">Review</option>
                <option value="published" className="text-black">Published</option>
                <option value="flagged" className="text-black">Flagged</option>
                <option value="removed" className="text-black">Removed</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-12 text-center text-sm text-slate-400">
              Loading files...
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/70 px-4 py-12 text-center text-sm font-bold text-slate-400">
              No files matched your search or filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
              {filteredFiles.map((file) => {
                const displayThumbnail = getDisplayThumbnail(file)
                const monetizationIsOn = file.monetization_enabled !== false

                return (
                  <div
                    key={file.id}
                    className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/80 shadow-[0_14px_34px_rgba(2,6,23,0.32)] transition hover:-translate-y-0.5 hover:border-sky-400/20"
                  >
                    <div className="flex aspect-[4/5] items-center justify-center bg-slate-900">
                      {displayThumbnail ? (
                        <img
                          src={displayThumbnail}
                          alt={file.title}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none"
                            const parent = e.currentTarget.parentElement
                            if (parent && !parent.querySelector("[data-no-thumb]")) {
                              const fallback = document.createElement("span")
                              fallback.setAttribute("data-no-thumb", "true")
                              fallback.className = "text-xs font-bold text-slate-500"
                              fallback.textContent = "No Thumbnail"
                              parent.appendChild(fallback)
                            }
                          }}
                        />
                      ) : (
                        <span className="text-xs font-bold text-slate-500">No Thumbnail</span>
                      )}
                    </div>

                    <div className="p-4">
                      <div
                        className="mb-2 line-clamp-2 min-h-[48px] text-base font-extrabold leading-6 text-white"
                        title={file.title}
                      >
                        {file.title}
                      </div>

                      <p className="mb-3 line-clamp-2 min-h-[40px] text-sm text-slate-400">
                        {file.description || "No description"}
                      </p>

                      <div className="mb-3 text-xs font-semibold text-slate-400">
                        {getCategoryName(file.category_id)} • {formatDate(file.created_at)}
                      </div>

                      <div className="mb-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${getVisibilityBadgeClasses(
                            file.visibility
                          )}`}
                        >
                          {file.visibility || "free"}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${getStatusBadgeClasses(
                            file.status
                          )}`}
                        >
                          {file.status || "draft"}
                        </span>
                      </div>

                      <div className="mb-4 space-y-1 text-[11px] font-bold text-slate-400">
                        <p>{file.shrinkme_url ? "ShrinkMe: Added" : "ShrinkMe: None"}</p>
                        <p>{file.linkvertise_url ? "Linkvertise: Added" : "Linkvertise: None"}</p>
                        <p>
                          Monetization:{" "}
                          <span
                            className={monetizationIsOn ? "text-emerald-300" : "text-red-300"}
                          >
                            {monetizationIsOn ? "Enabled" : "Disabled"}
                          </span>
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => editFile(file)}
                          className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/10"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteFile(file.id)}
                          disabled={deletingId === file.id}
                          className="rounded-2xl bg-red-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {deletingId === file.id ? "..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
