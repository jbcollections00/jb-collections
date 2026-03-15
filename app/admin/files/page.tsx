"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import AdminHeader from "@/app/components/AdminHeader"
import { createClient } from "@/lib/supabase/client"

type FileItem = {
  id: string
  title: string
  slug?: string | null
  description: string | null
  cover_url?: string | null
  thumbnail_url?: string | null
  visibility?: "free" | "premium" | "private" | null
  status?: "draft" | "review" | "published" | "flagged" | "removed" | null
  category_id: string | null
  created_at: string
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
  const [isPremium, setIsPremium] = useState(false)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedThumbnail, setSelectedThumbnail] = useState<File | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)

  const [existingThumbnailUrl, setExistingThumbnailUrl] = useState<string | null>(null)
  const [existingStorageKey, setExistingStorageKey] = useState<string | null>(null)
  const [existingFileSize, setExistingFileSize] = useState<number | null>(null)
  const [existingFileType, setExistingFileType] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [statusText, setStatusText] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [uploadProgress, setUploadProgress] = useState<number>(0)

  useEffect(() => {
    checkAdminAndLoad()
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

      await loadData()
    } catch (error) {
      console.error("Admin files auth check failed:", error)
      router.replace("/secure-admin-portal-7X9")
    } finally {
      setCheckingAdmin(false)
    }
  }

  async function loadData() {
    setLoading(true)
    setErrorMessage("")

    const [
      { data: filesData, error: filesError },
      { data: categoriesData, error: categoriesError },
    ] = await Promise.all([
      supabase
        .from("files")
        .select(
          "id, title, slug, description, cover_url, thumbnail_url, visibility, status, category_id, created_at"
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
    setIsPremium(false)
    setSelectedFile(null)
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

  function handleFileChange(file: File | null) {
    clearMessages()

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
    setIsPremium(file.visibility === "premium")
    setSelectedFile(null)
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
    isPremium: boolean
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

    if (
      percent === 100 ||
      percent === 0 ||
      percent >= previous + 2 ||
      percent < previous
    ) {
      lastProgressRef.current = percent
      setUploadProgress(percent)
      setStatusText(`${label} ${percent}%`)
    }
  }

  async function saveFile() {
    clearMessages()

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
        isPremium,
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
      const { error } = await supabase.from("files").delete().eq("id", id)

      if (error) throw new Error(error.message || "Failed to delete file.")

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

  if (checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="rounded-[20px] border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-lg font-bold text-slate-800">Checking admin access...</p>
          <p className="mt-2 text-sm text-slate-500">Please wait.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <AdminHeader />

        <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
              Files
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Upload, edit, and organize your file records.
            </p>
          </div>

          <div className="inline-flex w-fit rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs font-bold text-blue-600 sm:text-sm">
            Total Files: {files.length}
          </div>
        </div>

        {(errorMessage || successMessage || statusText) && (
          <div
            className={`mb-4 rounded-xl px-4 py-3 text-sm font-bold ${
              errorMessage
                ? "border border-red-200 bg-red-50 text-red-700"
                : successMessage
                  ? "border border-green-200 bg-green-50 text-green-700"
                  : "border border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            <div>{errorMessage || successMessage || statusText}</div>

            {!errorMessage && !successMessage && uploadProgress > 0 && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        <div className="mb-5 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-4 text-xl font-extrabold text-slate-900 sm:text-2xl">
            {editingId ? "Edit File" : "Upload File"}
          </h2>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input
                placeholder="File title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              />

              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
                className="min-h-[86px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              />

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 md:min-h-[86px]">
                <input
                  type="checkbox"
                  checked={isPremium}
                  onChange={(e) => setIsPremium(e.target.checked)}
                  disabled={saving}
                />
                Premium file
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label
                  htmlFor="file-upload-input"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  {editingId ? "Replace file (optional, up to 5GB)" : "Choose file (up to 5GB)"}
                </label>

                <input
                  id="file-upload-input"
                  type="file"
                  disabled={saving}
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white"
                />

                {selectedFile && (
                  <div className="mt-3">
                    <p className="text-sm font-bold text-blue-600">{selectedFile.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Size: {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                )}

                {!selectedFile && editingId && (
                  <div className="mt-3">
                    <p className="text-xs font-bold text-slate-500">Current file attached</p>
                    {existingFileSize ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Size: {formatFileSize(existingFileSize)}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label
                  htmlFor="thumbnail-upload-input"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  {editingId ? "Replace thumbnail (optional)" : "Choose thumbnail image"}
                </label>

                <input
                  id="thumbnail-upload-input"
                  type="file"
                  accept="image/*"
                  disabled={saving}
                  onChange={(e) => handleThumbnailChange(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white"
                />

                {selectedThumbnail && (
                  <img
                    src={URL.createObjectURL(selectedThumbnail)}
                    alt="Thumbnail preview"
                    className="mt-3 h-24 w-24 rounded-xl border border-slate-300 object-cover"
                  />
                )}

                {!selectedThumbnail && existingThumbnailUrl && (
                  <img
                    src={existingThumbnailUrl}
                    alt="Current thumbnail"
                    className="mt-3 h-24 w-24 rounded-xl border border-slate-300 object-cover"
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
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? "Uploading..." : editingId ? "Update File" : "Upload & Create"}
              </button>

              <button
                onClick={clearForm}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-4 text-xl font-extrabold text-slate-900 sm:text-2xl">
            Uploaded Files
          </h2>

          {loading ? (
            <p className="text-sm text-slate-500">Loading files...</p>
          ) : files.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-500">
              No files found yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {files.map((file) => {
                const displayThumbnail = getDisplayThumbnail(file)

                return (
                  <div
                    key={file.id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex aspect-square items-center justify-center bg-slate-100">
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
                              fallback.className = "text-xs font-bold text-slate-400"
                              fallback.textContent = "No Thumbnail"
                              parent.appendChild(fallback)
                            }
                          }}
                        />
                      ) : (
                        <span className="text-xs font-bold text-slate-400">
                          No Thumbnail
                        </span>
                      )}
                    </div>

                    <div className="p-3">
                      <div
                        className="mb-2 line-clamp-2 min-h-[38px] text-sm font-extrabold leading-5 text-slate-900"
                        title={file.title}
                      >
                        {file.title}
                      </div>

                      <div className="mb-3 flex flex-wrap gap-2">
                        {file.visibility === "premium" && (
                          <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-bold text-white">
                            Premium
                          </span>
                        )}

                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">
                          {file.status || "draft"}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => editFile(file)}
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteFile(file.id)}
                          disabled={deletingId === file.id}
                          className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
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
        </div>
      </div>
    </div>
  )
}