"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
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
}

type ProfileRow = {
  role?: string | null
  membership?: string | null
  is_premium?: boolean | null
}

type EventType =
  | "gate_view"
  | "premium_auto_download"
  | "sponsored_open"
  | "download_click"

function getDisplayName(file: FileRow | null) {
  if (!file) return "Download"
  return file.title || "Untitled File"
}

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

function normalizeMembership(value?: string | null) {
  const membership = String(value || "").trim().toLowerCase()
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  return "standard"
}

function pickMonetizedLink(file: FileRow | null) {
  if (!file) return null
  if (file.monetization_enabled === false) return null

  const linkvertise = normalizeExternalUrl(file.linkvertise_url)
  if (linkvertise) return linkvertise

  const shrinkme = normalizeExternalUrl(file.shrinkme_url)
  if (shrinkme) return shrinkme

  return null
}

export default function DownloadGatePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const fileId = params?.id as string
  const unlockedFromQuery = searchParams?.get("unlocked") === "1"

  const [checking, setChecking] = useState(true)
  const [file, setFile] = useState<FileRow | null>(null)
  const [isPremiumUser, setIsPremiumUser] = useState(false)
  const [isPlatinumUser, setIsPlatinumUser] = useState(false)
  const [error, setError] = useState("")

  const [step, setStep] = useState<"waiting" | "ready" | "premium-only" | "platinum-only">(
    "waiting"
  )
  const [countdown, setCountdown] = useState(3)
  const [downloadReady, setDownloadReady] = useState(false)
  const [openingSponsored, setOpeningSponsored] = useState(false)
  const [startingDownload, setStartingDownload] = useState(false)
  const [showStickyAd, setShowStickyAd] = useState(true)

  const hasLoggedGateViewRef = useRef(false)
  const selectedShortlink = useMemo(() => pickMonetizedLink(file), [file])

  useEffect(() => {
    if (!fileId) return
    void loadPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, unlockedFromQuery])

  useEffect(() => {
    if (checking) return
    if (!file) return
    if (isPremiumUser) return
    if (step !== "waiting") return
    if (downloadReady) return
    if (countdown <= 0) return
    if (unlockedFromQuery) return

    const timer = window.setTimeout(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [checking, file, isPremiumUser, step, downloadReady, countdown, unlockedFromQuery])

  async function logEvent(eventType: EventType, meta?: Record<string, unknown>) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !fileId) return

      const { error } = await supabase.from("download_events").insert({
        user_id: user.id,
        file_id: fileId,
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

  async function loadPage() {
    try {
      setChecking(true)
      setError("")
      setFile(null)
      setIsPremiumUser(false)
      setIsPlatinumUser(false)

      setStep("waiting")
      setCountdown(3)
      setDownloadReady(false)
      setOpeningSponsored(false)
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

      const [{ data: fileData, error: fileError }, { data: profileData, error: profileError }] =
        await Promise.all([
          supabase
            .from("files")
            .select(
              "id, title, description, visibility, shrinkme_url, linkvertise_url, monetization_enabled, status"
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

      if (fileError) {
        setError(`Failed to load file: ${fileError.message}`)
        return
      }

      if (!fileData) {
        setError(`No file row found for ID: ${fileId}`)
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
      const visibility = (foundFile.visibility || "free").toLowerCase()
      const shortlink = pickMonetizedLink(foundFile)

      setFile(foundFile)
      setIsPremiumUser(Boolean(premium))
      setIsPlatinumUser(Boolean(platinum))

      if (!hasLoggedGateViewRef.current) {
        hasLoggedGateViewRef.current = true
        void logEvent("gate_view", {
          visibility,
          has_sponsored_link: Boolean(shortlink),
          monetization_enabled: foundFile.monetization_enabled !== false,
          unlocked_from_query: unlockedFromQuery,
        })
      }

      if (premium && (visibility === "free" || visibility === "premium")) {
        void logEvent("premium_auto_download", {
          visibility,
          has_sponsored_link: Boolean(shortlink),
          monetization_enabled: foundFile.monetization_enabled !== false,
        })
        window.location.href = `/api/download/${fileId}`
        return
      }

      if (platinum && visibility === "platinum") {
        void logEvent("premium_auto_download", {
          visibility,
          has_sponsored_link: Boolean(shortlink),
          monetization_enabled: foundFile.monetization_enabled !== false,
        })
        window.location.href = `/api/download/${fileId}`
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

  function handleOpenSponsoredLink() {
    if (openingSponsored) return

    const safeUrl = selectedShortlink

    if (!safeUrl) {
      setDownloadReady(true)
      setStep("ready")
      return
    }

    setOpeningSponsored(true)
    setError("")

    void logEvent("sponsored_open", {
      sponsored_url: safeUrl,
      source: "monetized_link",
    })

    window.location.href = safeUrl
  }

  function handleDirectDownload() {
    if (startingDownload) return

    setStartingDownload(true)

    void logEvent("download_click", {
      source: unlockedFromQuery ? "gate_after_unlock" : "direct_button",
      has_sponsored_link: Boolean(selectedShortlink),
    })

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
  const hasSponsoredLink = Boolean(selectedShortlink)
  const monetizationEnabled = file.monetization_enabled !== false

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
                        {hasSponsoredLink && monetizationEnabled
                          ? `Your free download unlocks in ${countdown} second${countdown === 1 ? "" : "s"}.`
                          : `Your download unlocks in ${countdown} second${countdown === 1 ? "" : "s"}.`}
                      </p>

                      {countdown > 0 && !unlockedFromQuery ? (
                        <div className="inline-flex rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-500">
                          Please wait {countdown}s...
                        </div>
                      ) : hasSponsoredLink && monetizationEnabled && !unlockedFromQuery ? (
                        <button
                          type="button"
                          onClick={handleOpenSponsoredLink}
                          disabled={openingSponsored}
                          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {openingSponsored ? "Opening..." : "Open Sponsored Link"}
                        </button>
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