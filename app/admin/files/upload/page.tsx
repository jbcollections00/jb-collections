"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ShieldCheck } from "lucide-react"

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

export default function UploadFilePage() {
  const supabase = createClient()
  const router = useRouter()
  const lastProgressRef = useRef(0)

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [visibility, setVisibility] = useState<Visibility>("free")
  const [status, setStatus] = useState<FileStatus>("published")

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [selectedThumbnail, setSelectedThumbnail] = useState<File | null>(null)

  const [saving, setSaving] = useState(false)
  const [statusText, setStatusText] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [uploadProgress, setUploadProgress] = useState<number>(0)

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

      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("id,name")
        .order("name", { ascending: true })

      if (categoriesError) {
        setErrorMessage(categoriesError.message || "Failed to load categories.")
      }

      setCategories((categoriesData as Category[]) || [])
    } catch (error) {
      console.error("Admin upload auth check failed:", error)
      router.replace("/secure-admin-portal-7X9")
    } finally {
      setCheckingAdmin(false)
    }
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
    const thumbnailInput = document.getElementById("thumbnail-upload-input") as HTMLInputElement | null

    if (fileInput) fileInput.value = ""
    if (thumbnailInput) thumbnailInput.value = ""
  }

  function clearForm() {
    setTitle("")
    setDescription("")
    setCategoryId("")
    setVisibility("free")
    setStatus("published")
    setSelectedFile(null)
    setSelectedFiles([])
    setSelectedThumbnail(null)
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
      const thumbnailInput = document.getElementById("thumbnail-upload-input") as HTMLInputElement | null
      if (thumbnailInput) thumbnailInput.value = ""
      setErrorMessage("Thumbnail must be an image file.")
      return
    }

    const maxSizeInBytes = 10 * 1024 * 1024
    if (file.size > maxSizeInBytes) {
      setSelectedThumbnail(null)
      const thumbnailInput = document.getElementById("thumbnail-upload-input") as HTMLInputElement | null
      if (thumbnailInput) thumbnailInput.value = ""
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

  async function finalizeFileRecord(payload: {
    mode: "create"
    title: string
    description: string
    categoryId: string
    visibility: Visibility
    status: FileStatus
    shrinkmeUrl: null
    linkvertiseUrl: null
    monetizationEnabled: false
    storageKey: string | null
    thumbnailUrl: string | null
    fileSize: number | null
    fileType: string | null
  }) {
    const response = await fetch("/api/admin/files/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finalize", ...payload }),
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

    if (selectedFiles.length > 0 && !categoryId) {
      setErrorMessage("Please select a category.")
      return
    }

    if (selectedFiles.length > 0) {
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

          sharedThumbnailUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.replace(/\/$/, "") || ""}/${presignedThumb.key}`
        }

        for (let index = 0; index < selectedFiles.length; index++) {
          const currentFile = selectedFiles[index]
          const derivedTitle = title.trim() || currentFile.name.replace(/\.[^/.]+$/, "")

          setStatusText(`Preparing file ${index + 1} of ${selectedFiles.length}: ${currentFile.name}`)
          setUploadProgress(0)
          lastProgressRef.current = 0

          const presignedMain = await requestPresignedUpload({
            fileName: currentFile.name,
            contentType: currentFile.type || "application/octet-stream",
            title: derivedTitle,
            categoryId,
          })

          setStatusText(`Uploading file ${index + 1} of ${selectedFiles.length}: ${currentFile.name}`)
          await uploadFileDirect(currentFile, presignedMain.uploadUrl, (percent) => {
            updateProgress(percent, `Uploading file ${index + 1} of ${selectedFiles.length}: ${currentFile.name}`)
          })

          setUploadProgress(0)
          setStatusText(`Saving record ${index + 1} of ${selectedFiles.length}: ${currentFile.name}`)

          await finalizeFileRecord({
            mode: "create",
            title: derivedTitle,
            description,
            categoryId,
            visibility,
            status,
            shrinkmeUrl: null,
            linkvertiseUrl: null,
            monetizationEnabled: false,
            storageKey: presignedMain.key,
            thumbnailUrl: sharedThumbnailUrl,
            fileSize: currentFile.size,
            fileType: getFileType(currentFile.name),
          })
        }

        clearForm()
        setSuccessMessage(`${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} uploaded successfully.`)
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
    if (!selectedFile) {
      setErrorMessage("Please choose a file to upload.")
      return
    }

    setSaving(true)
    try {
      let finalStorageKey: string | null = null
      let finalThumbnailUrl: string | null = null
      let finalFileSize: number | null = null
      let finalFileType: string | null = null

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
        finalThumbnailUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.replace(/\/$/, "") || ""}/${presignedThumb.key}`
      }

      setUploadProgress(0)
      setStatusText("Saving file record...")

      await finalizeFileRecord({
        mode: "create",
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
      })

      clearForm()
      setSuccessMessage("File uploaded successfully.")
    } catch (error) {
      setStatusText("")
      setUploadProgress(0)
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

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
        <section className="mt-4 overflow-hidden rounded-[30px] border border-white/10 bg-slate-900/75 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.22),transparent_30%),linear-gradient(135deg,#0f172a_0%,#0b1220_45%,#111827_100%)]" />
            <div className="relative flex flex-col gap-5 px-5 py-6 sm:px-6 sm:py-7 lg:flex-row lg:items-end lg:justify-between lg:px-8">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-sky-200">
                  <ShieldCheck size={14} />
                  Admin Tools
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Upload File
                </h1>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Add new file records to your platform securely.
                </p>
              </div>
            </div>
          </div>
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
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input
                placeholder={selectedFiles.length > 1 ? "Shared title base (optional for multi-upload)" : "File title"}
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
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <label htmlFor="file-upload-input" className="mb-2 block text-sm font-bold text-slate-200">
                  Choose file(s) (up to 5GB each)
                </label>
                <input
                  id="file-upload-input"
                  type="file"
                  multiple
                  disabled={saving}
                  onChange={(e) => {
                    const fileList = e.target.files
                    if (!fileList || fileList.length === 0) {
                      handleFileChange(null)
                      setSelectedFiles([])
                      return
                    }
                    if (fileList.length === 1) {
                      handleFileChange(fileList[0] || null)
                    } else {
                      handleMultipleFiles(fileList)
                    }
                  }}
                  className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:font-semibold file:text-white"
                />

                {selectedFiles.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-3">
                    <p className="text-sm font-bold text-sky-200">{selectedFiles.length} files selected</p>
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
                    <p className="mt-1 text-xs text-slate-400">Size: {formatFileSize(selectedFile.size)}</p>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <label htmlFor="thumbnail-upload-input" className="mb-2 block text-sm font-bold text-slate-200">
                  {selectedFiles.length > 1
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
      </div>
    </div>
  )
}