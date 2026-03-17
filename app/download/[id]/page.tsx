"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import AdSlot from "@/app/components/AdSlot"
import { IN_CONTENT_AD } from "@/app/lib/adCodes"

type FileRow = {
  id: string
  title?: string | null
  name?: string | null
  description?: string | null
  visibility?: "free" | "premium" | "private" | null
  shrinkme_url?: string | null
  linkvertise_url?: string | null
  status?: string | null
}

type ProfileRow = {
  role?: string | null
  membership?: string | null
  is_premium?: boolean | null
}

function getDisplayName(file: FileRow | null) {
  if (!file) return "Download"
  return file.title || file.name || "Untitled File"
}

function pickMonetizedLink(file: FileRow | null) {
  if (!file) return null

  const links = [file.shrinkme_url, file.linkvertise_url].filter(
    (value): value is string => Boolean(value && value.trim())
  )

  if (links.length === 0) return null
  if (links.length === 1) return links[0]

  const index = Date.now() % links.length
  return links[index]
}

export default function DownloadGatePage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const fileId = params?.id as string

  const [checking, setChecking] = useState(true)
  const [file, setFile] = useState<FileRow | null>(null)
  const [isPremiumUser, setIsPremiumUser] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [adStepDone, setAdStepDone] = useState(false)
  const [unlockCountdown, setUnlockCountdown] = useState(5)
  const [downloadReady, setDownloadReady] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!fileId) return
    void loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId])

  useEffect(() => {
    if (checking) return
    if (isPremiumUser) return
    if (!file) return
    if (countdown <= 0) return

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [checking, isPremiumUser, file, countdown])

  useEffect(() => {
    if (!adStepDone) return
    if (unlockCountdown <= 0) {
      setDownloadReady(true)
      return
    }

    const timer = setTimeout(() => {
      setUnlockCountdown((prev) => prev - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [adStepDone, unlockCountdown])

  async function loadPage() {
    try {
      setChecking(true)
      setError("")

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace("/login")
        return
      }

      const [{ data: fileData, error: fileError }, { data: profileData }] =
        await Promise.all([
          supabase
            .from("files")
            .select(
              "id, title, name, description, visibility, shrinkme_url, linkvertise_url, status"
            )
            .eq("id", fileId)
            .eq("status", "published")
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("role, membership, is_premium")
            .eq("id", user.id)
            .maybeSingle(),
        ])

      if (fileError || !fileData) {
        setError("File not found.")
        setChecking(false)
        return
      }

      const profile = profileData as ProfileRow | null
      const premium =
        profile?.role === "admin" ||
        profile?.is_premium === true ||
        profile?.membership === "premium"

      setFile(fileData as FileRow)
      setIsPremiumUser(Boolean(premium))

      if (premium) {
        window.location.href = `/api/download/${fileId}`
        return
      }
    } catch (err) {
      console.error("Download gate error:", err)
      setError("Failed to load the download page.")
    } finally {
      setChecking(false)
    }
  }

  const selectedShortlink = useMemo(() => pickMonetizedLink(file), [file])

  function handleOpenMonetizedLink() {
    if (!selectedShortlink) {
      setDownloadReady(true)
      return
    }

    window.open(selectedShortlink, "_blank", "noopener,noreferrer")
    setAdStepDone(true)
    setUnlockCountdown(5)
  }

  function handleDirectDownload() {
    window.location.href = `/api/download/${fileId}`
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-800">Preparing your download...</p>
          <p className="mt-2 text-sm text-slate-500">Please wait.</p>
        </div>
      </div>
    )
  }

  if (error || !file) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-lg rounded-3xl border border-slate-200 bg-white px-8 py-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Download unavailable</h1>
          <p className="mt-3 text-slate-500">{error || "This file could not be loaded."}</p>

          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const visibility = (file.visibility || "free").toLowerCase()

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 px-6 py-8 text-white sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">
              JB Collections
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              {getDisplayName(file)}
            </h1>
            <p className="mt-3 text-sm text-white/90 sm:text-base">
              {file.description || "Your file is almost ready."}
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <div className="mb-6 flex justify-center">
              <AdSlot code={IN_CONTENT_AD} className="text-center" />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Access Type
              </p>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {visibility === "premium" ? "Premium File" : "Free File"}
              </p>

              {visibility === "premium" && !isPremiumUser && (
                <p className="mt-3 text-sm text-red-600">
                  This file is premium-only. Upgrade your account to download it.
                </p>
              )}

              {visibility === "premium" && !isPremiumUser ? (
                <div className="mt-6">
                  <Link
                    href="/upgrade"
                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
                  >
                    Upgrade to Premium
                  </Link>
                </div>
              ) : (
                <>
                  {!adStepDone && !downloadReady ? (
                    <div className="mt-6">
                      <p className="mb-4 text-sm text-slate-600">
                        {selectedShortlink
                          ? `Free download unlocks in ${countdown} second${countdown === 1 ? "" : "s"}.`
                          : "No monetized link found for this file. Direct download will be available."}
                      </p>

                      {countdown > 0 ? (
                        <div className="inline-flex rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-500">
                          Please wait {countdown}s...
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleOpenMonetizedLink}
                          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                        >
                          {selectedShortlink ? "Open Sponsored Link" : "Unlock Download"}
                        </button>
                      )}
                    </div>
                  ) : null}

                  {adStepDone && !downloadReady ? (
                    <div className="mt-6">
                      <p className="mb-4 text-sm text-slate-600">
                        Sponsored page opened. Your download unlocks in {unlockCountdown} second
                        {unlockCountdown === 1 ? "" : "s"}.
                      </p>
                      <div className="inline-flex rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-500">
                        Unlocking...
                      </div>
                    </div>
                  ) : null}

                  {downloadReady ? (
                    <div className="mt-6 space-y-3">
                      <button
                        type="button"
                        onClick={handleDirectDownload}
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:from-sky-600 hover:via-blue-700 hover:to-indigo-700"
                      >
                        Download Now
                      </button>

                      {selectedShortlink && (
                        <button
                          type="button"
                          onClick={handleOpenMonetizedLink}
                          className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Open Sponsored Link Again
                        </button>
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {!isPremiumUser && visibility !== "premium" && (
              <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-center">
                <p className="text-sm font-semibold text-amber-800">
                  Want instant downloads with no sponsored step?
                </p>
                <Link
                  href="/upgrade"
                  className="mt-3 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
                >
                  Go Premium
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}