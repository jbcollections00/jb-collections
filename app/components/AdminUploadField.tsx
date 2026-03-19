"use client"

import Image from "next/image"
import { useRef, useState } from "react"

type AdminUploadFieldProps = {
  label: string
  helperText?: string
  accept?: string
  file: File | null
  previewUrl?: string | null
  onFileChange: (file: File | null) => void
  maxSizeMb?: number
  isImage?: boolean
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AdminUploadField({
  label,
  helperText,
  accept = "*/*",
  file,
  previewUrl,
  onFileChange,
  maxSizeMb = 10,
  isImage = false,
}: AdminUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState("")

  function validateAndSetFile(nextFile: File | null) {
    setError("")

    if (!nextFile) {
      onFileChange(null)
      return
    }

    const maxBytes = maxSizeMb * 1024 * 1024
    if (nextFile.size > maxBytes) {
      setError(`File is too large. Maximum size is ${maxSizeMb}MB.`)
      return
    }

    if (accept !== "*/*") {
      const acceptedTypes = accept.split(",").map((item) => item.trim().toLowerCase())
      const fileName = nextFile.name.toLowerCase()
      const mimeType = nextFile.type.toLowerCase()

      const matches = acceptedTypes.some((rule) => {
        if (rule.endsWith("/*")) {
          const prefix = rule.replace("/*", "")
          return mimeType.startsWith(`${prefix}/`)
        }

        if (rule.startsWith(".")) {
          return fileName.endsWith(rule)
        }

        return mimeType === rule
      })

      if (!matches) {
        setError("Selected file type is not allowed.")
        return
      }
    }

    onFileChange(nextFile)
  }

  function openPicker() {
    inputRef.current?.click()
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] || null
    validateAndSetFile(nextFile)
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)

    const nextFile = event.dataTransfer.files?.[0] || null
    validateAndSetFile(nextFile)
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(true)
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)
  }

  function removeFile() {
    setError("")
    onFileChange(null)
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  const hasPreview = Boolean(previewUrl)

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-bold text-slate-800">{label}</label>
        {helperText ? (
          <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />

      <div
        onClick={openPicker}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-4 transition ${
          dragActive
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
        }`}
      >
        {isImage && hasPreview ? (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="relative aspect-[4/5] w-full max-w-[240px]">
                <Image
                  src={previewUrl!}
                  alt="Preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  openPicker()
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Change Image
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  removeFile()
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
              {isImage ? "🖼️" : "📦"}
            </div>

            <p className="text-sm font-semibold text-slate-800">
              Drag and drop {isImage ? "an image" : "a file"} here
            </p>
            <p className="mt-1 text-xs text-slate-500">
              or click to browse
            </p>

            {file ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
    </div>
  )
}