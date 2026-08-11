"use client"

import { useEffect, useState } from "react"
import * as zip from "@zip.js/zip.js"
import { createClient } from "@/lib/supabase/client"

type ArchiveEntry = {
  filename: string
  directory: boolean
  uncompressedSize: number
  entry: zip.Entry
}

type Props = {
  isOpen: boolean
  onClose: () => void
  fileUrl: string
  fileName: string
}

export default function ArchiveExtractorModal({ isOpen, onClose, fileUrl, fileName }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<ArchiveEntry[]>([])
  const [extractingName, setExtractingName] = useState<string | null>(null)
  const [isRarFile, setIsRarFile] = useState(false)

  useEffect(() => {
    if (!isOpen || !fileUrl) return

    async function loadArchive() {
      setLoading(true)
      setError(null)
      setEntries([])

      const isRar = fileName.toLowerCase().endsWith(".rar") || fileUrl.toLowerCase().includes(".rar")
      setIsRarFile(isRar)

      // Kung .rar file, agad na magpakita ng malinis na message at direct download button
      if (isRar) {
        setLoading(false)
        setError(
          "Ang file na ito ay naka-.rar format. Ang online preview at individual file extraction ay para sa .zip files. Maaari mong i-download ang buong archive file sa ibaba."
        )
        return
      }

      try {
        // Inayos ang 403 Forbidden sa pamamagitan ng pagpasa ng Supabase Bearer Token
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        const headers: Record<string, string> = {
          Accept: "*/*",
        }

        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`
        }

        const response = await fetch(fileUrl, {
          credentials: "include",
          headers,
        })

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error("Access denied (403). Session expired or missing download permissions.")
          }
          throw new Error(`Failed to fetch archive file (Status: ${response.status}).`)
        }

        const blob = await response.blob()

        // Standard .zip processing
        const zipReader = new zip.ZipReader(new zip.BlobReader(blob))
        const zipEntries = await zipReader.getEntries()

        const formattedEntries: ArchiveEntry[] = zipEntries.map((entry) => ({
          filename: entry.filename,
          directory: entry.directory,
          uncompressedSize: entry.uncompressedSize || 0,
          entry,
        }))

        setEntries(formattedEntries)
        await zipReader.close()
      } catch (err: any) {
        console.error("Archive extraction error:", err)
        setError(err.message || "Hindi mabasa ang archive file.")
      } finally {
        setLoading(false)
      }
    }

    void loadArchive()
  }, [isOpen, fileUrl, fileName])

  async function downloadSingleFile(entry: zip.Entry) {
    if (entry.directory || !entry.getData) return

    try {
      setExtractingName(entry.filename)
      const blobWriter = new zip.BlobWriter()
      const blob = await entry.getData(blobWriter)

      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = entry.filename.split("/").pop() || "extracted-file"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      console.error("Single file extraction failed:", err)
      alert("Failed to extract file.")
    } finally {
      setExtractingName(null)
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{isRarFile ? "📦" : "📂"}</span>
            <div>
              <h3 className="text-lg font-bold text-amber-400">
                Online Archive Extractor {isRarFile ? "(RAR)" : "(ZIP)"}
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-xs">{fileName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
              <p className="text-sm font-medium">Extracting file list...</p>
            </div>
          )}

          {error && (
            <div className="space-y-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-center text-sm text-amber-200">
              <p>{error}</p>
              <a
                href={fileUrl}
                download={fileName}
                className="inline-block rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-amber-400 shadow-lg"
              >
                ⬇️ Download Full Archive File Directly
              </a>
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">Empty archive file.</p>
          )}

          {!loading && !error && entries.length > 0 && (
            <div className="space-y-2">
              {entries.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-800/40 p-3 hover:bg-slate-800/80 transition"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <span className="text-lg">{item.directory ? "📁" : "📄"}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">{item.filename}</p>
                      {!item.directory && (
                        <p className="text-xs text-slate-400">{formatBytes(item.uncompressedSize)}</p>
                      )}
                    </div>
                  </div>

                  {!item.directory && (
                    <button
                      onClick={() => downloadSingleFile(item.entry)}
                      disabled={extractingName === item.filename}
                      className="shrink-0 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 border border-amber-500/20 hover:bg-amber-500 hover:text-slate-950 transition disabled:opacity-50"
                    >
                      {extractingName === item.filename ? "Extracting..." : "⬇️ Extract"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 p-4 text-center text-xs text-slate-500">
          Extract individual files directly without downloading the whole archive.
        </div>
      </div>
    </div>
  )
}