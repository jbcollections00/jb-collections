"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import AdSlot from "@/app/components/AdSlot"
import { DOWNLOAD_TOP_AD, DOWNLOAD_WAIT_AD, STICKY_BOTTOM_AD } from "@/app/lib/adCodes"

type FileRow = {
  id: string
  title?: string | null
  description?: string | null
  visibility?: "free" | "premium" | "platinum" | "private" | null
  shrinkme_url?: string | null
  linkvertise_url?: string | null
  monetization_enabled?: boolean | null
  status?: string | null
  category_id?: string | null
  thumbnail_url?: string | null
  slug?: string | null
  downloads_count?: number | null
}

type RelatedFileRow = {
  id: string
  title?: string | null
  thumbnail_url?: string | null
  slug?: string | null
}

type ProfileRow = {
  role?: string | null
  membership?: string | null
  is_premium?: boolean | null
}

type EventType = "gate_view" | "premium_auto_download" | "download_click"

function getDisplayName(file: FileRow | null) {
  if (!file) return "Download"
  return file.title || "Untitled File"
}

function getPreviewImage(file: FileRow | null) {
  if (!file) return null
  return file.thumbnail_url || null
}

function normalizeMembership(value?: string | null) {
  const membership = String(value || "").trim().toLowerCase()
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  return "standard"
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

export default function DownloadPageClient() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const idOrSlug = (params?.slug as string) || ""
  const unlockedFromQuery = searchParams?.get("unlocked") === "1"

  const [checking, setChecking] = useState(true)
  const [file, setFile] = useState<FileRow | null>(null)
  const [related, setRelated] = useState<RelatedFileRow[]>([])
  const [isPremiumUser, setIsPremiumUser] = useState(false)
  const [isPlatinumUser, setIsPlatinumUser] = useState(false)
  const [error, setError] = useState("")
  const [shareUrl, setShareUrl] = useState("")
  const [copied, setCopied] = useState(false)

  const [step, setStep] = useState<"waiting" | "ready" | "premium-only" | "platinum-only">(
    "waiting"
  )
  const [countdown, setCountdown] = useState(3)
  const [downloadReady, setDownloadReady] = useState(false)
  const [startingDownload, setStartingDownload] = useState(false)
  const [showStickyAd, setShowStickyAd] = useState(true)

  const hasLoggedGateViewRef = useRef(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href)
    }
  }, [])

  useEffect(() => {
    if (!idOrSlug) return
    void loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idOrSlug, unlockedFromQuery])

  useEffect(() => {
    if (checking) return
    if (!file) return
    if (isPremiumUser) return
    if (step !== "waiting") return
    if (downloadReady) return
    if (countdown <= 0) return

    const timer = window.setTimeout(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [checking, file, isPremiumUser, step, downloadReady, countdown])

  async function logEvent(
    eventType: EventType,
    meta?: Record<string, unknown>,
    targetFileId?: string
  ) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !targetFileId) return

      const { error } = await supabase.from("download_events").insert({
        user_id: user.id,
        file_id: targetFileId,
        event_type: eventType,
        meta: meta ?? {},
      })

      if (error) {
        console.warn(`Failed to log ${eventType}:`, error.message)
      }
    } catch (err) {
      console.warn(`Failed to log ${eventType}:`, err)
    }
  }

  async function incrementViews(targetFileId: string) {
    try {
      const { error } = await supabase.rpc("increment_file_views", {
        file_id_input: targetFileId,
      })

      if (error) {
        console.warn("Failed to increment file views:", error.message)
      }
    } catch (err) {
      console.warn("Failed to increment file views:", err)
    }
  }

  async function loadPage() {
    try {
      setChecking(true)
      setError("")
      setFile(null)
      setRelated([])
      setIsPremiumUser(false)
      setIsPlatinumUser(false)

      setStep("waiting")
      setCountdown(3)
      setDownloadReady(false)
      setStartingDownload(false)
      hasLoggedGateViewRef.current = false

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace("/login")
        return
      }

      const baseQuery = supabase
        .from("files")
        .select(
          "id, title, description, visibility, shrinkme_url, linkvertise_url, monetization_enabled, status, category_id, thumbnail_url, slug, downloads_count"
        )
        .eq("status", "published")

      const { data: fileData, error: fileError } = isUuid(idOrSlug)
        ? await baseQuery.eq("id", idOrSlug).maybeSingle()
        : await baseQuery.eq("slug", idOrSlug).maybeSingle()

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role, membership, is_premium")
        .eq("id", user.id)
        .maybeSingle()

      if (fileError) {
        setError(`Failed to load file: ${fileError.message}`)
        return
      }

      if (!fileData) {
        setError(`No file row found for: ${idOrSlug}`)
        return
      }

      if (profileError) {
        console.error("Profile fetch error:", profileError)
      }

      const profile = profileData as ProfileRow | null
      const membership = normalizeMembership(profile?.membership)

      const premium =
        profile?.role === "admin" ||
        profile?.is_premium === true ||
        membership === "premium" ||
        membership === "platinum"

      const platinum = profile?.role === "admin" || membership === "platinum"

      const foundFile = fileData as FileRow
      const realFileId = foundFile.id
      const visibility = (foundFile.visibility || "free").toLowerCase()

      setFile(foundFile)
      setIsPremiumUser(Boolean(premium))
      setIsPlatinumUser(Boolean(platinum))

      void incrementViews(realFileId)

      if (foundFile.category_id) {
        const { data: relatedFiles, error: relatedError } = await supabase
          .from("files")
          .select("id, title, thumbnail_url, slug")
          .eq("category_id", foundFile.category_id)
          .neq("id", realFileId)
          .eq("status", "published")
          .order("downloads_count", { ascending: false })
          .limit(6)

        if (relatedError) {
          console.warn("Failed to load related files:", relatedError.message)
        } else {
          setRelated((relatedFiles as RelatedFileRow[]) || [])
        }
      }

      if (!hasLoggedGateViewRef.current) {
        hasLoggedGateViewRef.current = true
        void logEvent(
          "gate_view",
          {
            visibility,
            monetization_enabled: foundFile.monetization_enabled !== false,
            unlocked_from_query: unlockedFromQuery,
          },
          realFileId
        )
      }

      if (premium && (visibility === "free" || visibility === "premium")) {
        void logEvent(
          "premium_auto_download",
          {
            visibility,
            monetization_enabled: foundFile.monetization_enabled !== false,
          },
          realFileId
        )
        window.location.href = `/api/download/${realFileId}`
        return
      }

      if (platinum && visibility === "platinum") {
        void logEvent(
          "premium_auto_download",
          {
            visibility,
            monetization_enabled: foundFile.monetization_enabled !== false,
          },
          realFileId
        )
        window.location.href = `/api/download/${realFileId}`
        return
      }

      if (visibility === "platinum") {
        setStep("platinum-only")
        return
      }

      if (visibility === "premium" || visibility === "private") {
        setStep("premium-only")
        return
      }

      if (unlockedFromQuery && visibility === "free") {
        setDownloadReady(true)
        setStep("ready")
        return
      }

      setStep("waiting")
    } catch (err) {
      console.error("Download gate error:", err)
      setError("Failed to load the download page.")
    } finally {
      setChecking(false)
    }
  }

  function handleDirectDownload() {
    if (startingDownload || !file?.id) return

    setStartingDownload(true)

    void logEvent(
      "download_click",
      {
        source: unlockedFromQuery ? "gate_after_unlock" : "direct_button",
      },
      file.id
    )

    window.location.href = `/api/download/${file.id}`
  }

  async function handleCopyLink() {
    try {
      if (!shareUrl) return
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch (err) {
      console.warn("Failed to copy link:", err)
    }
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
  const monetizationEnabled = file.monetization_enabled !== false
  const previewImage = getPreviewImage(file)

  const shouldShowTopAd =
    !isPremiumUser && visibility === "free" && monetizationEnabled && Boolean(DOWNLOAD_TOP_AD)

  const shouldShowWaitAd =
    !isPremiumUser &&
    visibility === "free" &&
    monetizationEnabled &&
    step === "waiting" &&
    !downloadReady &&
    Boolean(DOWNLOAD_WAIT_AD)

  const shouldShowStickyAd =
    !isPremiumUser &&
    visibility === "free" &&
    monetizationEnabled &&
    showStickyAd &&
    Boolean(STICKY_BOTTOM_AD)

  function getAccessLabel() {
    if (visibility === "platinum") return "Platinum File"
    if (visibility === "premium") return "Premium File"
    if (visibility === "private") return "Private File"
    return "Free File"
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 pb-28">
      <div className="mx-auto max-w-3xl">
        {shouldShowTopAd ? (
          <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Sponsored
            </div>
            <AdSlot code={DOWNLOAD_TOP_AD} className="flex justify-center" />
          </div>
        ) : null}

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
            {previewImage ? (
              <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden bg-slate-100">
                  <img
                    src={previewImage}
                    alt={getDisplayName(file)}
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/35 via-slate-900/5 to-transparent" />
                </div>
              </div>
            ) : null}

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Access Type
              </p>

              <p className="mt-2 text-lg font-bold text-slate-900">{getAccessLabel()}</p>

              {step === "platinum-only" ? (
                <>
                  <p className="mt-3 text-sm text-fuchsia-700">
                    This file is for platinum members only.
                  </p>

                  <div className="mt-6">
                    <Link
                      href="/upgrade"
                      className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
                    >
                      Upgrade to Platinum
                    </Link>
                  </div>
                </>
              ) : step === "premium-only" ? (
                <>
                  <p className="mt-3 text-sm text-red-600">
                    This file is for premium members only.
                  </p>

                  <div className="mt-6">
                    <Link
                      href="/upgrade"
                      className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
                    >
                      Upgrade to Premium
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  {!downloadReady ? (
                    <div className="mt-6">
                      <p className="mb-4 text-sm text-slate-600">
                        Your download unlocks in {countdown} second{countdown === 1 ? "" : "s"}.
                      </p>

                      {countdown > 0 ? (
                        <div className="inline-flex rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-500">
                          Please wait {countdown}s...
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleDirectDownload}
                          disabled={startingDownload}
                          className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:from-sky-600 hover:via-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {startingDownload ? "Starting download..." : "Download Now"}
                        </button>
                      )}

                      {shouldShowWaitAd ? (
                        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Sponsored
                          </div>
                          <AdSlot code={DOWNLOAD_WAIT_AD} className="flex justify-center" />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-6 space-y-3">
                      <button
                        type="button"
                        onClick={handleDirectDownload}
                        disabled={startingDownload}
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:from-sky-600 hover:via-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {startingDownload ? "Starting download..." : "Download Now"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-center text-sm font-semibold text-slate-700">Share this file</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-300"
                >
                  {copied ? "Copied!" : "Copy Link"}
                </button>

                <a
                  href={
                    shareUrl
                      ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
                      : "#"
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Facebook
                </a>

                <a
                  href={
                    shareUrl
                      ? `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`
                      : "#"
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600"
                >
                  Telegram
                </a>
              </div>
            </div>

            {!isPremiumUser && visibility === "free" ? (
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
            ) : null}

            {!isPlatinumUser && visibility === "premium" ? (
              <div className="mt-6 rounded-3xl border border-fuchsia-200 bg-fuchsia-50 p-5 text-center">
                <p className="text-sm font-semibold text-fuchsia-800">
                  Want access to exclusive platinum-only releases too?
                </p>
                <Link
                  href="/upgrade"
                  className="mt-3 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
                >
                  Go Platinum
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        {related.length > 0 ? (
          <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Keep Browsing
                </p>
                <h2 className="text-xl font-bold text-slate-900">Related Downloads</h2>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {related.map((item) => (
                <Link
                  key={item.id}
                  href={`/download/${item.slug || item.id}`}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-slate-200">
                    {item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt={item.title || "Related file"}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400">
                        No Preview
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-slate-800 transition group-hover:text-blue-600">
                      {item.title || "Untitled File"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {shouldShowStickyAd ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
          <div className="mx-auto max-w-3xl">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Sponsored
              </span>
              <button
                type="button"
                onClick={() => setShowStickyAd(false)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <AdSlot code={STICKY_BOTTOM_AD} className="flex justify-center overflow-hidden" />
          </div>
        </div>
      ) : null}
    </div>
  )
}