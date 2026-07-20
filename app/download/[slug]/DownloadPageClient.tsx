"use client"

import Link from "next/link"
import Script from "next/script"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type FileVisibility = "free" | "premium" | "platinum" | "private"
type MembershipLevel = "standard" | "premium" | "platinum" | "admin"

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

function AdsterraBanner() {
  const bannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!bannerRef.current) return
    bannerRef.current.innerHTML = ""

    const container = document.createElement("div")

    const scriptOptions = document.createElement("script")
    scriptOptions.type = "text/javascript"
    scriptOptions.text = `
      atOptions = {
        'key' : 'b34ceb41f59688ea67157fc3adaa80c5',
        'format' : 'iframe',
        'height' : 250,
        'width' : 300,
        'params' : {}
      };
    `

    const scriptInvoke = document.createElement("script")
    scriptInvoke.type = "text/javascript"
    scriptInvoke.src =
      "https://www.highperformanceformat.com/b34ceb41f59688ea67157fc3adaa80c5/invoke.js"

    container.appendChild(scriptOptions)
    container.appendChild(scriptInvoke)
    bannerRef.current.appendChild(container)
  }, [])

  return (
    <div className="mt-6 flex flex-col items-center justify-center">
      <span className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Advertisement
      </span>
      <div
        ref={bannerRef}
        className="flex min-h-[250px] min-w-[300px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
      />
    </div>
  )
}

function getDisplayName(file: FileRow | null) {
  if (!file) return "Download"
  return file.title?.trim() || "Untitled File"
}

function getPreviewAsset(file: FileRow | null) {
  if (!file) return null
  return file.cover_url || file.thumbnail_url || null
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
  if (!value) return "Jul 15, 2026"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Jul 15, 2026"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function inferExtension(file: FileRow | null) {
  if (!file) return "DEV"

  const possibleValues = [file.file_type, file.title, file.file_url, file.thumbnail_url]
    .filter(Boolean)
    .join(" ")

  const match = possibleValues.match(/\.([a-z0-9]{2,5})(?:[\s?/#]|$)/i)
  if (match?.[1]) return match[1].toUpperCase()

  return file?.file_type?.toUpperCase() || "DEV"
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

function getDownloadCoinCost(level: MembershipLevel) {
  if (level === "admin") return 0
  if (level === "platinum") return 8
  if (level === "premium") return 10
  return 12
}

function getRewardAmount(level: MembershipLevel) {
  if (level === "admin") return 0
  if (level === "platinum") return 3
  if (level === "premium") return 2
  return 2
}

export default function DownloadPageClient() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const idOrSlug =
    (params?.slug as string) || (params?.id as string) || (params?.fileId as string) || ""

  const unlockedFromQuery = searchParams?.get("unlocked") === "1"

  const [checking, setChecking] = useState(true)
  const [file, setFile] = useState<FileRow | null>(null)
  const [related, setRelated] = useState<RelatedFileRow[]>([])
  const [membershipLevel, setMembershipLevel] = useState<MembershipLevel>("standard")
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
  const [downloadError, setDownloadError] = useState("")

  const [showCoinConfirm, setShowCoinConfirm] = useState(false)
  const [showInsufficientCoins, setShowInsufficientCoins] = useState(false)
  const [requiredCoins, setRequiredCoins] = useState<number | null>(null)
  const [currentCoins, setCurrentCoins] = useState<number | null>(null)

  const [rewardNotice, setRewardNotice] = useState("")
  const [rewardNoticeType, setRewardNoticeType] = useState<RewardNoticeType>("success")

  const hasLoggedGateViewRef = useRef(false)
  const rewardNoticeTimerRef = useRef<number | null>(null)

  const previewAsset = useMemo(() => getPreviewAsset(file), [file])
  const previewKind = useMemo(() => inferPreviewKind(file), [file])
  const fileTypeLabel = useMemo(() => inferExtension(file), [file])
  const addedDateLabel = useMemo(
    () => formatDate(file?.updated_at || file?.created_at || null),
    [file]
  )
  const estimatedCoinCost = useMemo(() => getDownloadCoinCost(membershipLevel), [membershipLevel])
  const estimatedReward = useMemo(() => getRewardAmount(membershipLevel), [membershipLevel])

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
      searchParams?.get("rewardAmount") || searchParams?.get("reward_amount") || "2"

    const parsedRewardAmount = Number(rewardAmountRaw)
    const rewardAmount =
      Number.isFinite(parsedRewardAmount) && parsedRewardAmount > 0 ? parsedRewardAmount : 2

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

  function resolveMembership(refreshData: any): MembershipLevel {
    const role = String(refreshData?.role || "").toLowerCase()
    const membership = String(refreshData?.membership || "").toLowerCase()

    if (role === "admin") return "admin"
    if (refreshData?.is_platinum || membership === "platinum") return "platinum"
    if (refreshData?.is_premium || membership === "premium") return "premium"

    return "standard"
  }

  async function loadPage() {
    try {
      setChecking(true)
      setError("")
      setFile(null)
      setRelated([])
      setMembershipLevel("standard")
      setIsPremiumUser(false)
      setIsPlatinumUser(false)
      setShowPreviewModal(false)
      setShowCoinConfirm(false)
      setShowInsufficientCoins(false)
      setRequiredCoins(null)
      setCurrentCoins(null)
      setStep("waiting")
      setCountdown(3)
      setDownloadReady(false)
      setStartingDownload(false)
      setDownloadError("")
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
          "id, title, description, visibility, shrinkme_url, linkvertise_url, monetization_enabled, status, category_id, thumbnail_url, cover_url, file_url, slug, downloads_count, created_at, updated_at, file_type"
        )
        .eq("status", "published")

      const { data: fileData, error: fileError } = isUuid(idOrSlug)
        ? await baseQuery.eq("id", idOrSlug).maybeSingle()
        : await baseQuery.eq("slug", idOrSlug).maybeSingle()

      const refreshRes = await fetch("/api/membership/refresh", {
        method: "POST",
        cache: "no-store",
      })

      const refreshData = await refreshRes.json().catch(() => null)

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

      const level = resolveMembership(refreshData)
      const premium = level === "premium" || level === "platinum" || level === "admin"
      const platinum = level === "platinum" || level === "admin"

      const foundFile = fileData as FileRow
      const realFileId = foundFile.id
      const visibilityValue = (foundFile.visibility || "free").toLowerCase()

      setFile(foundFile)
      setMembershipLevel(level)
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
          .limit(10)

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
            membership_level: level,
            estimated_coin_cost: getDownloadCoinCost(level),
          },
          realFileId
        )
      }

      if (visibilityValue === "platinum" && !platinum) {
        setStep("platinum-only")
        return
      }

      if ((visibilityValue === "premium" || visibilityValue === "private") && !premium) {
        setStep("premium-only")
        return
      }

      if (premium || unlockedFromQuery || visibilityValue !== "free") {
        setDownloadReady(true)
        setStep("ready")
        return
      }

      setStep("ready")
      setDownloadReady(true)
    } catch (err) {
      console.error("Download gate error:", err)
      setError("Failed to load the download page.")
    } finally {
      setChecking(false)
    }
  }

  function handleDownloadButtonClick() {
    if (startingDownload || !file?.id) return
    setDownloadError("")
    setShowCoinConfirm(true)
  }

  async function handleDirectDownload() {
    if (startingDownload || !file?.id) return

    setShowCoinConfirm(false)
    setShowInsufficientCoins(false)
    setDownloadError("")
    setStartingDownload(true)

    try {
      void logEvent(
        "download_click",
        {
          source: unlockedFromQuery ? "gate_after_unlock" : "confirmed_button",
          membership_level: membershipLevel,
          estimated_coin_cost: estimatedCoinCost,
        },
        file.id
      )

      const downloadApiUrl = `/api/download/${file.id}?mode=json&unlocked=1`

      let res = await fetch(downloadApiUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-jb-download-intent": "button_confirm",
        },
        body: JSON.stringify({
          confirmed: true,
          source: "download_button",
        }),
      })

      if (res.status === 404 || res.status === 405) {
        res = await fetch(downloadApiUrl, {
          method: "GET",
          headers: {
            accept: "application/json",
            "x-jb-download-intent": "button_confirm",
          },
        })
      }

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        if (
          res.status === 402 ||
          data?.error?.toLowerCase?.().includes("coin") ||
          data?.requiredCoins
        ) {
          setRequiredCoins(Number(data?.requiredCoins ?? data?.required ?? estimatedCoinCost))
          setCurrentCoins(Number(data?.currentCoins ?? data?.balance ?? 0))
          setShowInsufficientCoins(true)
        }

        const message = data?.error || "Failed to start download"
        showRewardNotice(message, "error")
        setDownloadError(message)
        setStartingDownload(false)
        return
      }

      if (data?.redirectUrl) {
        window.location.href = data.redirectUrl
        return
      }

      if (!data?.downloadUrl) {
        const message = "Missing download URL from API"
        showRewardNotice(message, "error")
        setDownloadError(message)
        setStartingDownload(false)
        return
      }

      if (typeof data?.coinsUsed === "number" && data.coinsUsed > 0) {
        dispatchCoinPopup(-data.coinsUsed, "Download spend")
        showRewardNotice(`-${data.coinsUsed} JB Coins used`, "info")
      }

      if (data?.rewarded) {
        const rewardAmount = Number(data.rewardAmount ?? estimatedReward)
        window.setTimeout(() => {
          showRewardNotice(`+${rewardAmount} JB Coins earned`, "success")
          dispatchCoinPopup(rewardAmount, "Download reward")
        }, 900)
      } else if (data?.alreadyRewardedToday) {
        window.setTimeout(() => {
          showRewardNotice("Already rewarded today", "info")
          dispatchCoinPopup(0, "Already rewarded today")
        }, 900)
      }

      window.setTimeout(() => {
        window.location.href = data.downloadUrl
      }, 850)
    } catch (err) {
      console.error("Download start error:", err)
      const message = err instanceof Error ? err.message : "Failed to start download."
      showRewardNotice(message, "error")
      setDownloadError(message)
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
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Adsterra Popunder Script */}
      <Script
        id="adsterra-popunder"
        strategy="afterInteractive"
        src="https://pl28932734.effectivecpmnetwork.com/c2/ff/ba/c2ffba00507c2aa8f81f4682763f669e.js"
      />

      <div className="min-h-screen bg-slate-50 px-4 py-8 pb-16">
        <div className="mx-auto max-w-5xl">
          {/* Main Clean Layout Card */}
          <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
            {/* Clean Header Layout */}
            <div className="relative overflow-hidden bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-700 px-6 py-8 text-white sm:px-8 sm:py-10">
              <div className="relative flex w-full flex-col gap-6 md:flex-row md:items-center md:justify-between">
                {/* Primary Title and Description */}
                <div className="flex-1 space-y-3">
                  <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                    {getDisplayName(file)}
                  </h1>

                  <p className="max-w-2xl text-sm text-white/90">
                    {getShortDescription(file)}
                  </p>
                </div>
              </div>
            </div>

            {/* Core Interaction Layer */}
            <div className="grid grid-cols-1 items-start gap-8 p-6 sm:p-8 md:grid-cols-2">
              {/* Left Column: Visual Asset Display */}
              <div className="flex flex-col items-center">
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
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
                    <div className="flex h-full w-full items-center justify-center text-center">
                      <div>
                        <p className="text-lg font-bold text-slate-400">{fileTypeLabel}</p>
                        <p className="text-xs text-slate-400">Preview unavailable</p>
                      </div>
                    </div>
                  )}

                  {previewAsset && (
                    <div className="absolute bottom-3 right-3">
                      <button
                        type="button"
                        onClick={() => setShowPreviewModal(true)}
                        className="inline-flex items-center justify-center rounded-xl bg-black/50 px-3 py-1.5 text-xs font-bold text-white shadow-sm backdrop-blur-md transition hover:bg-black/70"
                      >
                        Open Preview
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Download & Metadata Action Panel */}
              <div className="flex flex-col justify-between space-y-6">
                <div>
                  <h3 className="mb-2 text-base font-bold text-slate-800">Get File Access</h3>

                  {step === "platinum-only" ? (
                    <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50 p-4">
                      <p className="text-xs font-semibold text-fuchsia-800">
                        This drop is exclusive to Platinum tier members.
                      </p>
                      <Link
                        href="/upgrade"
                        className="mt-3 inline-flex w-full justify-center rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-95"
                      >
                        Upgrade to Platinum
                      </Link>
                    </div>
                  ) : step === "premium-only" ? (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                      <p className="text-xs font-semibold text-amber-800">
                        Premium account authentication required for this asset.
                      </p>
                      <Link
                        href="/upgrade"
                        className="mt-3 inline-flex w-full justify-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-95"
                      >
                        Upgrade to Premium
                      </Link>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDownloadButtonClick}
                      disabled={startingDownload}
                      className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 px-6 py-4 text-sm font-black text-white shadow-md shadow-blue-500/10 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {startingDownload
                        ? "Initializing Secure Link..."
                        : `⬇ DOWNLOAD — ${estimatedCoinCost} JB COINS`}
                    </button>
                  )}

                  {downloadError && (
                    <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-600">
                      {downloadError}
                    </div>
                  )}

                  {/* File Metadata Rack */}
                  <div className="mt-6 space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        FILE TYPE
                      </p>
                      <p className="mt-0.5 text-lg font-black uppercase text-slate-900">
                        {fileTypeLabel}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        UPDATED
                      </p>
                      <p className="mt-0.5 text-lg font-black text-slate-900">
                        {addedDateLabel}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        ACCESS COST
                      </p>
                      <p className="mt-0.5 text-lg font-black text-slate-900">
                        {estimatedCoinCost} Coins
                      </p>
                    </div>
                  </div>

                  {/* Embedded Adsterra 300x250 Banner */}
                  <AdsterraBanner />
                </div>

                {/* Social Distribution Rack */}
                <div className="border-t border-slate-100 pt-5">
                  <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Distribution Actions
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copied ? "Copied!" : "Copy URL"}
                    </button>
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      Share Hub
                    </button>
                    <a
                      href={
                        shareUrl
                          ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
                          : "#"
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-xl bg-[#1877F2] py-2 text-xs font-bold text-white transition hover:opacity-90"
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
                      className="inline-flex items-center justify-center rounded-xl bg-[#229ED9] py-2 text-xs font-bold text-white transition hover:opacity-90"
                    >
                      Telegram
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Related Items Grid — 5 Columns */}
            {related.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50/50 p-6 sm:p-8">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                      Trending Drops
                    </p>
                    <h2 className="text-xl font-black text-slate-900">
                      Users Also Downloaded
                    </h2>
                  </div>
                  <Link
                    href="/categories"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50"
                  >
                    Browse All
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {related.map((item) => (
                    <Link
                      key={item.id}
                      href={`/download/${item.slug || item.id}`}
                      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-sm"
                    >
                      <div className="relative aspect-[4/5] bg-slate-100">
                        {item.thumbnail_url ? (
                          <img
                            src={item.thumbnail_url}
                            alt={item.title || "Related file"}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-400">
                            No Preview
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-1 text-xs font-bold text-slate-800 transition group-hover:text-blue-600">
                          {item.title || "Untitled File"}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {formatCount(item.downloads_count)} downloads
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Notices */}
      {rewardNotice && (
        <div className="fixed bottom-6 right-6 z-[9999]">
          <div
            className={`rounded-xl border px-4 py-2.5 text-xs font-bold shadow-lg backdrop-blur-md ${
              rewardNoticeType === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : rewardNoticeType === "info"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {rewardNotice}
          </div>
        </div>
      )}

      {/* Modals */}
      {showCoinConfirm && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-5 shadow-xl">
            <h3 className="text-center text-lg font-black text-slate-900">Confirm Spending</h3>
            <p className="mt-1 text-center text-xs text-slate-500">
              Confirm processing total asset value reduction from account wallet balance.
            </p>
            <div className="my-4 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
              <span className="text-xs font-bold text-slate-600">Total Deducted</span>
              <span className="text-sm font-black text-indigo-600">
                {estimatedCoinCost} Coins
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowCoinConfirm(false)}
                className="rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDirectDownload}
                className="rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
              >
                Confirm Use
              </button>
            </div>
          </div>
        </div>
      )}

      {showInsufficientCoins && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-5 shadow-xl">
            <h3 className="text-center text-lg font-black text-slate-900">Wallet Depleted</h3>
            <div className="my-4 rounded-xl border border-red-100 bg-red-50 p-3 text-center text-xs font-semibold text-red-700">
              Current account balance of {currentCoins ?? 0} is insufficient for this{" "}
              {requiredCoins ?? estimatedCoinCost} coin asset unlock.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowInsufficientCoins(false)}
                className="rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Dismiss
              </button>
              <Link
                href="/buy-coins"
                className="rounded-xl bg-amber-500 py-2.5 text-center text-xs font-bold text-white hover:bg-amber-600"
              >
                Recharge Balance
              </Link>
            </div>
          </div>
        </div>
      )}

      {showPreviewModal && previewAsset && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="relative max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-4 right-4 z-10">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="rounded-xl border border-white/20 bg-black/60 px-3 py-1 text-xs font-bold text-white hover:bg-black/80"
              >
                Close
              </button>
            </div>
            <div className="flex items-center justify-center bg-slate-950 p-2">
              {previewKind === "video" ? (
                <video
                  src={previewAsset}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[80vh] w-full object-contain"
                />
              ) : (
                <img
                  src={previewAsset}
                  alt={getDisplayName(file)}
                  className="max-h-[80vh] w-auto max-w-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}