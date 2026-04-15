"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import AdSlot from "@/app/components/AdSlot"
import { DOWNLOAD_TOP_AD, DOWNLOAD_WAIT_AD, STICKY_BOTTOM_AD } from "@/app/lib/adCodes"

type FileVisibility = "free" | "premium" | "platinum" | "private"

type FileRow = {
  id: string
  title?: string | null
  description?: string | null
  visibility?: FileVisibility | null
  shrinkme_url?: string | null
  linkvertise_url?: string | null
  monetization_enabled?: boolean | null
  status?: string | null
  category_id?: string | null
  thumbnail_url?: string | null
  cover_url?: string | null
  file_url?: string | null
  slug?: string | null
  downloads_count?: number | null
  created_at?: string | null
  updated_at?: string | null
  file_type?: string | null
  file_size?: number | null
  size_bytes?: number | null
}

type RelatedFileRow = {
  id: string
  title?: string | null
  thumbnail_url?: string | null
  slug?: string | null
  downloads_count?: number | null
  visibility?: FileVisibility | null
}

type EventType = "gate_view" | "premium_auto_download" | "download_click"
type RewardNoticeType = "success" | "info" | "error"

function getDisplayName(file: FileRow | null) {
  if (!file) return "Download"
  return file.title?.trim() || "Untitled File"
}

function getPreviewAsset(file: FileRow | null) {
  if (!file) return null
  return file.cover_url || file.thumbnail_url || file.thumbnail_url || null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function formatCount(value?: number | null) {
  const count = Number(value || 0)
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  return `${count}`
}

function formatDate(value?: string | null) {
  if (!value) return "Recently added"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently added"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function formatFileSize(bytes?: number | null) {
  const size = Number(bytes || 0)
  if (!Number.isFinite(size) || size <= 0) return "Instant access"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = size
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const rounded =
    value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)

  return `${rounded.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")} ${units[unitIndex]}`
}

function inferExtension(file: FileRow | null) {
  if (!file) return "FILE"

  const possibleValues = [
    file.file_type,
    file.title,
    file.file_url,
    file.thumbnail_url,
    file.thumbnail_url,
  ]
    .filter(Boolean)
    .join(" ")

  const match = possibleValues.match(/\.([a-z0-9]{2,5})(?:[\s?/#]|$)/i)
  if (match?.[1]) return match[1].toUpperCase()


  return "FILE"
}

function inferPreviewKind(file: FileRow | null) {
  const preview = getPreviewAsset(file)

  if (preview) {
    const normalized = preview.toLowerCase()
    if (/\.(mp4|webm|ogg|mov)(\?|#|$)/.test(normalized)) return "video"
  }

  const fileType = (file?.file_type || "").toLowerCase()
  if (fileType.includes("video")) return "video"

  return "image"
}

function getShortDescription(file: FileRow | null) {
  const raw = file?.description?.trim()
  if (!raw) return "Exclusive JB Collections download ready for instant access."
  return raw
}

function getVisibilityLabel(visibility?: string | null) {
  const value = (visibility || "free").toLowerCase()
  if (value === "platinum") return "Platinum File"
  if (value === "premium") return "Premium File"
  if (value === "private") return "Private File"
  return "Free File"
}

function getVisibilityPillClasses(visibility?: string | null) {
  const value = (visibility || "free").toLowerCase()
  if (value === "platinum") return "bg-fuchsia-500 text-white"
  if (value === "premium") return "bg-amber-500 text-white"
  if (value === "private") return "bg-slate-700 text-white"
  return "bg-emerald-500 text-white"
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
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  const [step, setStep] = useState<"waiting" | "ready" | "premium-only" | "platinum-only">(
    "waiting"
  )
  const [countdown, setCountdown] = useState(3)
  const [downloadReady, setDownloadReady] = useState(false)
  const [startingDownload, setStartingDownload] = useState(false)
  const [showStickyAd, setShowStickyAd] = useState(true)

  const [rewardNotice, setRewardNotice] = useState("")
  const [rewardNoticeType, setRewardNoticeType] = useState<RewardNoticeType>("success")

  const hasLoggedGateViewRef = useRef(false)
  const rewardNoticeTimerRef = useRef<number | null>(null)

  const previewAsset = useMemo(() => getPreviewAsset(file), [file])
  const previewKind = useMemo(() => inferPreviewKind(file), [file])
  const fileTypeLabel = useMemo(() => inferExtension(file), [file])
  const fileSizeLabel = useMemo(
    () => formatFileSize(file?.file_size ?? file?.size_bytes ?? null),
    [file]
  )
  const downloadsLabel = useMemo(() => formatCount(file?.downloads_count), [file])
  const addedDateLabel = useMemo(
    () => formatDate(file?.updated_at || file?.created_at || null),
    [file]
  )
  const visibility = (file?.visibility || "free").toLowerCase()
  const monetizationEnabled = file?.monetization_enabled !== false

  const clearRewardNoticeTimer = useCallback(() => {
    if (rewardNoticeTimerRef.current) {
      window.clearTimeout(rewardNoticeTimerRef.current)
      rewardNoticeTimerRef.current = null
    }
  }, [])

  const showRewardNotice = useCallback(
    (text: string, type: RewardNoticeType = "success") => {
      clearRewardNoticeTimer()
      setRewardNotice(text)
      setRewardNoticeType(type)

      rewardNoticeTimerRef.current = window.setTimeout(() => {
        setRewardNotice("")
        rewardNoticeTimerRef.current = null
      }, 2800)
    },
    [clearRewardNoticeTimer]
  )

  function dispatchCoinPopup(amount: number, label: string) {
    if (typeof window === "undefined") return

    window.dispatchEvent(
      new CustomEvent("jb-coins-popup", {
        detail: { amount, label },
      })
    )

    window.dispatchEvent(new Event("jb-coins-updated"))
  }

  useEffect(() => {
    return () => {
      clearRewardNoticeTimer()
    }
  }, [clearRewardNoticeTimer])

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href)
    }
  }, [])

  useEffect(() => {
    const rewarded =
      searchParams?.get("rewarded") === "1" || searchParams?.get("reward") === "earned"

    const alreadyRewardedToday =
      searchParams?.get("alreadyRewardedToday") === "1" ||
      searchParams?.get("already_rewarded_today") === "1" ||
      searchParams?.get("reward") === "today"

    const rewardAmountRaw =
      searchParams?.get("rewardAmount") || searchParams?.get("reward_amount") || "5"

    const parsedRewardAmount = Number(rewardAmountRaw)
    const rewardAmount =
      Number.isFinite(parsedRewardAmount) && parsedRewardAmount > 0 ? parsedRewardAmount : 5

    if (rewarded) {
      showRewardNotice(`+${rewardAmount} JB Coins earned`, "success")
      dispatchCoinPopup(rewardAmount, "Download reward")
      return
    }

    if (alreadyRewardedToday) {
      showRewardNotice("Already rewarded today", "info")
      dispatchCoinPopup(0, "Already rewarded today")
    }
  }, [searchParams, showRewardNotice])

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

  useEffect(() => {
    if (!showPreviewModal) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setShowPreviewModal(false)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [showPreviewModal])

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
      setShowPreviewModal(false)

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
          "id, title, description, visibility, shrinkme_url, linkvertise_url, monetization_enabled, status, category_id, thumbnail_url, cover_url, thumbnail_url, file_url, slug, downloads_count, created_at, updated_at, file_type, file_size, size_bytes"
        )
        .eq("status", "published")

      const { data: fileData, error: fileError } = isUuid(idOrSlug)
        ? await baseQuery.eq("id", idOrSlug).maybeSingle()
        : await baseQuery.eq("slug", idOrSlug).maybeSingle()

      const refreshRes = await fetch("/api/membership/refresh", {
        method: "POST",
        cache: "no-store",
      })

      const refreshData = await refreshRes.json()

      if (!refreshRes.ok) {
        setError(refreshData?.error || "Failed to refresh membership.")
        return
      }

      if (fileError) {
        setError(`Failed to load file: ${fileError.message}`)
        return
      }

      if (!fileData) {
        setError(`No file row found for: ${idOrSlug}`)
        return
      }

      const premium = Boolean(refreshData?.is_premium)
      const platinum = Boolean(refreshData?.is_platinum)

      const foundFile = fileData as FileRow
      const realFileId = foundFile.id
      const visibilityValue = (foundFile.visibility || "free").toLowerCase()

      setFile(foundFile)
      setIsPremiumUser(premium)
      setIsPlatinumUser(platinum)

      void incrementViews(realFileId)

      if (foundFile.category_id) {
        const { data: relatedFiles, error: relatedError } = await supabase
          .from("files")
          .select("id, title, thumbnail_url, slug, downloads_count, visibility")
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
            visibility: visibilityValue,
            monetization_enabled: foundFile.monetization_enabled !== false,
            unlocked_from_query: unlockedFromQuery,
          },
          realFileId
        )
      }

      if (premium && (visibilityValue === "free" || visibilityValue === "premium")) {
        void logEvent(
          "premium_auto_download",
          {
            visibility: visibilityValue,
            monetization_enabled: foundFile.monetization_enabled !== false,
          },
          realFileId
        )
        window.location.href = `/api/download/${realFileId}`
        return
      }

      if (platinum && visibilityValue === "platinum") {
        void logEvent(
          "premium_auto_download",
          {
            visibility: visibilityValue,
            monetization_enabled: foundFile.monetization_enabled !== false,
          },
          realFileId
        )
        window.location.href = `/api/download/${realFileId}`
        return
      }

      if (visibilityValue === "platinum") {
        setStep("platinum-only")
        return
      }

      if (visibilityValue === "premium" || visibilityValue === "private") {
        setStep("premium-only")
        return
      }

      if (unlockedFromQuery && visibilityValue === "free") {
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

  async function handleDirectDownload() {
    if (startingDownload || !file?.id) return

    setStartingDownload(true)

    try {
      void logEvent(
        "download_click",
        {
          source: unlockedFromQuery ? "gate_after_unlock" : "direct_button",
        },
        file.id
      )

      const res = await fetch(`/api/download/${file.id}?mode=json`, {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to start download")
      }

      if (data?.rewarded) {
        const rewardAmount = Number(data.rewardAmount ?? 5)
        showRewardNotice(`+${rewardAmount} JB Coins earned`, "success")
        dispatchCoinPopup(rewardAmount, "Download reward")
      } else if (data?.alreadyRewardedToday) {
        showRewardNotice("Already rewarded today", "info")
        dispatchCoinPopup(0, "Already rewarded today")
      }

      window.setTimeout(() => {
        window.location.href = data.downloadUrl
      }, 850)
    } catch (err) {
      console.error("Download start error:", err)
      showRewardNotice(err instanceof Error ? err.message : "Failed to start download.", "error")
      setError(err instanceof Error ? err.message : "Failed to start download.")
      setStartingDownload(false)
    }
  }

  async function handleCopyLink() {
    try {
      if (!shareUrl) return
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      showRewardNotice("Link copied", "success")
      window.setTimeout(() => setCopied(false), 1800)
    } catch (err) {
      console.warn("Failed to copy link:", err)
      showRewardNotice("Failed to copy link", "error")
    }
  }

  function handleNativeShare() {
    if (typeof window === "undefined" || !shareUrl) return

    if (navigator.share) {
      void navigator
        .share({
          title: getDisplayName(file),
          text: getShortDescription(file),
          url: shareUrl,
        })
        .catch(() => {})
      return
    }

    void handleCopyLink()
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

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Back to Dashboard
            </Link>

            <Link
              href="/categories"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Browse Categories
            </Link>
          </div>
        </div>
      </div>
    )
  }

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

  const isRestricted = step === "premium-only" || step === "platinum-only"

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eff6ff_0%,#f8fafc_36%,#f8fafc_100%)] px-4 py-8 pb-28">
        <div className="mx-auto max-w-6xl">
          {shouldShowTopAd ? (
            <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Sponsored
              </div>
              <AdSlot code={DOWNLOAD_TOP_AD} className="flex justify-center" />
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              <div className="relative overflow-hidden bg-gradient-to-br from-cyan-600 via-sky-500 to-indigo-600 px-6 py-8 text-white sm:px-8 sm:py-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_28%)]" />
                <div className="absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
                <div className="relative">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white/90">
                      JB Collections
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                      {getVisibilityLabel(file.visibility)}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                      {downloadsLabel}+ downloads
                    </span>
                  </div>

                  <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                    {getDisplayName(file)}
                  </h1>

                  <p className="mt-3 max-w-3xl text-sm text-white/90 sm:text-base">
                    {getShortDescription(file)}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
                        File type
                      </p>
                      <p className="mt-2 text-base font-black">{fileTypeLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
                        File size
                      </p>
                      <p className="mt-2 text-base font-black">{fileSizeLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
                        Updated
                      </p>
                      <p className="mt-2 text-base font-black">{addedDateLabel}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                    {previewAsset ? (
                      previewKind === "video" ? (
                        <video
                          src={previewAsset}
                          controls
                          preload="metadata"
                          playsInline
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <img
                          src={previewAsset}
                          alt={getDisplayName(file)}
                          className="h-full w-full object-cover"
                        />
                      )
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-center">
                        <div>
                          <p className="text-lg font-bold text-slate-700">{fileTypeLabel}</p>
                          <p className="mt-1 text-sm text-slate-500">Preview unavailable</p>
                        </div>
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent" />

                    <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="rounded-2xl bg-black/45 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md">
                        {previewKind === "video" ? "Video preview" : "Image preview"}
                      </div>

                      {previewAsset ? (
                        <button
                          type="button"
                          onClick={() => setShowPreviewModal(true)}
                          className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-slate-100"
                        >
                          Open Preview
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Why this page converts
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-emerald-600">✔</span>
                        <span className="text-sm text-slate-700">Preview first before download</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-emerald-600">✔</span>
                        <span className="text-sm text-slate-700">Clear trust and access signals</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-emerald-600">✔</span>
                        <span className="text-sm text-slate-700">Real share and working CTA flow</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Share this file
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
                      >
                        {copied ? "Copied!" : "Copy Link"}
                      </button>

                      <button
                        type="button"
                        onClick={handleNativeShare}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
                      >
                        Share
                      </button>

                      <a
                        href={
                          shareUrl
                            ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
                            : "#"
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                      >
                        Facebook
                      </a>

                      <a
                        href={
                          shareUrl
                            ? `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(getDisplayName(file))}`
                            : "#"
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-600"
                      >
                        Telegram
                      </a>
                    </div>
                  </div>
                </div>

                {related.length > 0 ? (
                  <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">
                          🔥 Trending Picks
                        </p>
                        <h2 className="mt-1 text-2xl font-black text-slate-900">
                          Users Also Downloaded
                        </h2>
                      </div>

                      <Link
                        href="/categories"
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        Browse More
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {related.map((item) => (
                        <Link
                          key={item.id}
                          href={`/download/${item.slug || item.id}`}
                          className="group overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="relative aspect-[16/10] overflow-hidden bg-slate-200">
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
                            <div className="absolute left-3 top-3">
                              <span
                                className={`rounded-xl px-3 py-1.5 text-[11px] font-black ${getVisibilityPillClasses(
                                  item.visibility
                                )}`}
                              >
                                {getVisibilityLabel(item.visibility).replace(" File", "").toUpperCase()}
                              </span>
                            </div>
                          </div>

                          <div className="p-4">
                            <div className="mb-2 inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                              {formatCount(item.downloads_count)}+ downloads
                            </div>
                            <p className="line-clamp-2 text-base font-bold text-slate-800 transition group-hover:text-blue-600">
                              {item.title || "Untitled File"}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Ready to get it?
                    </p>
                    <h2 className="mt-1 text-3xl font-black text-slate-900">
                      Download now
                    </h2>
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    Trusted
                  </div>
                </div>

                <div className="mt-5 rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Access Type
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-900">
                        {getVisibilityLabel(file.visibility)}
                      </p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                      {downloadsLabel}+ users
                    </div>
                  </div>

                  {step === "platinum-only" ? (
                    <div className="mt-5">
                      <p className="text-sm font-semibold text-fuchsia-700">
                        This file is reserved for platinum members.
                      </p>

                      <Link
                        href="/upgrade"
                        className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-4 text-base font-black text-white transition hover:opacity-90"
                      >
                        Upgrade to Platinum
                      </Link>
                    </div>
                  ) : step === "premium-only" ? (
                    <div className="mt-5">
                      <p className="text-sm font-semibold text-amber-700">
                        Premium access required for this file.
                      </p>

                      <Link
                        href="/upgrade"
                        className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-base font-black text-white transition hover:opacity-90"
                      >
                        Upgrade to Premium
                      </Link>
                    </div>
                  ) : !downloadReady ? (
                    <div className="mt-5">
                      <div className="rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-100">
                        <p className="text-sm font-semibold text-slate-500">
                          Your download unlocks in
                        </p>
                        <p className="mt-2 text-5xl font-black tracking-tight text-slate-900">
                          {countdown}s
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          Stay on this page while access is being prepared.
                        </p>
                      </div>

                      {countdown > 0 ? (
                        <div className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-4 text-base font-bold text-slate-500">
                          Please wait {countdown}s...
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleDirectDownload}
                          disabled={startingDownload}
                          className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-6 py-4 text-base font-black text-white shadow-lg shadow-blue-500/20 transition hover:from-sky-600 hover:via-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {startingDownload
                            ? "Starting download..."
                            : "⬇ DOWNLOAD NOW — INSTANT ACCESS"}
                        </button>
                      )}

                      {shouldShowWaitAd ? (
                        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
                          <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Sponsored
                          </div>
                          <AdSlot code={DOWNLOAD_WAIT_AD} className="flex justify-center" />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={handleDirectDownload}
                        disabled={startingDownload}
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-6 py-4 text-base font-black text-white shadow-lg shadow-blue-500/20 transition hover:from-sky-600 hover:via-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {startingDownload
                          ? "Starting download..."
                          : "⬇ DOWNLOAD NOW — INSTANT ACCESS"}
                      </button>
                    </div>
                  )}

                  {!isRestricted ? (
                    <div className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="text-emerald-600">✔</span>
                        <span>Preview before download</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="text-emerald-600">✔</span>
                        <span>Real working CTA</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="text-emerald-600">✔</span>
                        <span>Reward flow still intact</span>
                      </div>
                    </div>
                  ) : null}
                </div>

                {!isPremiumUser && visibility === "free" ? (
                  <div className="mt-5 rounded-[28px] border border-amber-200 bg-amber-50 p-5">
                    <p className="text-sm font-semibold text-amber-800">
                      Want instant downloads with no sponsored step?
                    </p>
                    <Link
                      href="/upgrade"
                      className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
                    >
                      Go Premium
                    </Link>
                  </div>
                ) : null}

                {!isPlatinumUser && visibility === "premium" ? (
                  <div className="mt-5 rounded-[28px] border border-fuchsia-200 bg-fuchsia-50 p-5">
                    <p className="text-sm font-semibold text-fuchsia-800">
                      Want access to platinum-only drops too?
                    </p>
                    <Link
                      href="/upgrade"
                      className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
                    >
                      Go Platinum
                    </Link>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Trust signals
                </p>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-bold text-slate-900">High-value presentation</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Preview, file info, and strong access signals make this page feel premium.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-bold text-slate-900">Conversion-focused CTA</p>
                    <p className="mt-1 text-sm text-slate-600">
                      The action area is now bigger, clearer, and visually stronger.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-bold text-slate-900">Social proof</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Downloads count is visible in both the hero and recommendation section.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {rewardNotice ? (
          <div className="pointer-events-none fixed bottom-24 right-4 z-[9999] sm:bottom-6 sm:right-6">
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-md ${
                rewardNoticeType === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : rewardNoticeType === "info"
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-red-300 bg-red-50 text-red-700"
              }`}
            >
              {rewardNotice}
            </div>
          </div>
        ) : null}

        {shouldShowStickyAd ? (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
            <div className="mx-auto max-w-6xl">
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

      {showPreviewModal && previewAsset ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                  Preview
                </p>
                <h3 className="mt-1 text-lg font-bold">{getDisplayName(file)}</h3>
              </div>

              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="flex max-h-[calc(90vh-82px)] items-center justify-center bg-slate-950 p-4">
              {previewKind === "video" ? (
                <video
                  src={previewAsset}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[75vh] w-full rounded-2xl"
                />
              ) : (
                <img
                  src={previewAsset}
                  alt={getDisplayName(file)}
                  className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
