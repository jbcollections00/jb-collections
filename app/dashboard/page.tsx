"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import PresenceTracker from "@/app/components/PresenceTracker"
import SiteHeader from "@/app/components/SiteHeader"
import DailyRewardCard from "@/app/components/DailyRewardCard"

type Category = {
  id: string
  name: string
  description: string | null
  image_url?: string | null
  thumbnail_url?: string | null
  cover_url?: string | null
}

type FileRow = {
  id: string
  category_id: string | null
}

type HomeFile = {
  id: string
  title?: string | null
  name?: string | null
  slug?: string | null
  description?: string | null
  thumbnail_url?: string | null
  cover_url?: string | null
  image_url?: string | null
  downloads_count?: number | null
  created_at?: string | null
  visibility?: "free" | "premium" | "private" | null
}

type HomeSectionsResponse = {
  trending?: HomeFile[]
  top?: HomeFile[]
  latest?: HomeFile[]
}

type CurrentUserProfile = {
  id: string
  role?: string | null
  membership?: string | null
  is_premium?: boolean | null
  full_name?: string | null
  name?: string | null
  username?: string | null
  coins?: number | null
  avatar_url?: string | null
}

type MemberItem = {
  id: string
  full_name?: string | null
  name?: string | null
  username?: string | null
  email?: string | null
  avatar_url?: string | null
  last_seen?: string | null
  status?: string | null
  account_status?: string | null
  created_at?: string | null
}

type LiveStatsResponse = {
  onlineUsers?: number
  activeToday?: number
  totalUsers?: number
  newMembers?: MemberItem[]
  onlineMembers?: MemberItem[]
}

function getCategoryImage(category: Category) {
  return category.thumbnail_url || category.cover_url || category.image_url || null
}

function getFileImage(file: HomeFile) {
  return file.thumbnail_url || file.cover_url || file.image_url || null
}

function getCategoryIcon(name: string) {
  const value = name.toLowerCase()

  if (value.includes("book")) return "📚"
  if (value.includes("media")) return "🎬"
  if (value.includes("software")) return "💻"
  if (value.includes("template")) return "🧩"
  if (value.includes("music")) return "🎵"
  return "📁"
}

function getFileIcon(name: string) {
  const value = name.toLowerCase()

  if (value.includes("book")) return "📚"
  if (value.includes("movie") || value.includes("video")) return "🎬"
  if (value.includes("music") || value.includes("audio")) return "🎵"
  if (value.includes("software") || value.includes("app")) return "💻"
  if (value.includes("game")) return "🎮"
  if (value.includes("template")) return "🧩"
  if (value.includes("document") || value.includes("reviewer")) return "📝"
  return "📦"
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

function AnimatedNumber({
  value,
  duration = 900,
  className = "",
}: {
  value: number
  duration?: number
  className?: string
}) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const target = Number.isFinite(value) ? Math.max(0, value) : 0
    let startTimestamp: number | null = null
    let frame = 0

    function step(timestamp: number) {
      if (startTimestamp === null) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.round(target * eased))

      if (progress < 1) {
        frame = window.requestAnimationFrame(step)
      }
    }

    setDisplayValue(0)
    frame = window.requestAnimationFrame(step)

    return () => window.cancelAnimationFrame(frame)
  }, [value, duration])

  return <span className={className}>{formatNumber(displayValue)}</span>
}


function formatShortDate(value?: string | null) {
  if (!value) return "Recently joined"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently joined"

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function getFileTitle(file: HomeFile) {
  return file.title?.trim() || file.name?.trim() || "Untitled File"
}

function getFileHref(file: HomeFile) {
  return `/download/${file.id}`
}

function getMemberDisplayName(member: MemberItem) {
  return (
    member.full_name?.trim() ||
    member.name?.trim() ||
    member.username?.trim() ||
    member.email?.trim() ||
    "Unnamed User"
  )
}

function getCurrentUserName(profile: CurrentUserProfile | null) {
  return (
    profile?.full_name?.trim() ||
    profile?.name?.trim() ||
    profile?.username?.trim() ||
    "Member"
  )
}

function getInitials(value: string) {
  const words = value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)

  if (words.length === 0) return "JB"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase()
}

function getMembershipLabel(membership?: string | null, isPremiumFlag?: boolean | null) {
  const value = String(membership || "").toLowerCase()

  if (value === "platinum") return "PLATINUM"
  if (value === "premium" || isPremiumFlag) return "PREMIUM"
  if (value === "standard") return "STANDARD"
  return "FREE"
}

function getMembershipTone(membership?: string | null, isPremiumFlag?: boolean | null) {
  const label = getMembershipLabel(membership, isPremiumFlag)

  if (label === "PLATINUM") {
    return "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200"
  }

  if (label === "PREMIUM") {
    return "border-amber-400/30 bg-amber-500/10 text-amber-200"
  }

  if (label === "STANDARD") {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
  }

  return "border-sky-400/30 bg-sky-500/10 text-sky-200"
}

function getLevelInfo(coins: number) {
  if (coins >= 20000) {
    return {
      level: "Legend",
      currentMin: 20000,
      nextMin: 30000,
      accent: "from-fuchsia-500 via-violet-500 to-sky-500",
      badge: "👑",
      message: "You are in the top collector lane.",
    }
  }

  if (coins >= 10000) {
    return {
      level: "Elite",
      currentMin: 10000,
      nextMin: 20000,
      accent: "from-amber-400 via-orange-500 to-pink-500",
      badge: "🏆",
      message: "Your dashboard is fully powered up.",
    }
  }

  if (coins >= 5000) {
    return {
      level: "Pro",
      currentMin: 5000,
      nextMin: 10000,
      accent: "from-cyan-400 via-sky-500 to-blue-600",
      badge: "⚡",
      message: "You are building serious momentum.",
    }
  }

  if (coins >= 1000) {
    return {
      level: "Rising",
      currentMin: 1000,
      nextMin: 5000,
      accent: "from-emerald-400 via-cyan-500 to-sky-600",
      badge: "🚀",
      message: "Keep earning coins to unlock more status.",
    }
  }

  return {
    level: "Starter",
    currentMin: 0,
    nextMin: 1000,
    accent: "from-slate-400 via-sky-500 to-cyan-500",
    badge: "✨",
    message: "Start exploring and grow your collector rank.",
  }
}

function getProgressPercent(coins: number, currentMin: number, nextMin: number) {
  const range = Math.max(nextMin - currentMin, 1)
  const progress = Math.min(Math.max(coins - currentMin, 0), range)
  return Math.max(6, Math.round((progress / range) * 100))
}

function dedupeFiles(files: HomeFile[]) {
  const seen = new Set<string>()
  return files.filter((file) => {
    if (!file.id || seen.has(file.id)) return false
    seen.add(file.id)
    return true
  })
}

function getRecommendedFiles(
  trendingFiles: HomeFile[],
  topFiles: HomeFile[],
  latestFiles: HomeFile[],
  membershipLabel: string,
) {
  const combined = dedupeFiles([...topFiles, ...trendingFiles, ...latestFiles])

  if (membershipLabel === "PREMIUM" || membershipLabel === "PLATINUM") {
    return combined.filter((file) => file.visibility !== "private").slice(0, 10)
  }

  return combined.filter((file) => file.visibility !== "private").slice(0, 10)
}

function getCategorySpotlight(categories: Category[], fileCounts: Record<string, number>) {
  return [...categories]
    .sort((a, b) => (fileCounts[b.id] || 0) - (fileCounts[a.id] || 0))
    .slice(0, 4)
}

function getFeaturedFile(
  recommendedFiles: HomeFile[],
  trendingFiles: HomeFile[],
  topFiles: HomeFile[],
  latestFiles: HomeFile[],
) {
  return (
    recommendedFiles[0] ||
    trendingFiles[0] ||
    topFiles[0] ||
    latestFiles[0] ||
    null
  )
}

function getContinueExploringFiles(
  recommendedFiles: HomeFile[],
  trendingFiles: HomeFile[],
  latestFiles: HomeFile[],
  featuredFileId?: string | null,
) {
  return dedupeFiles([...latestFiles, ...trendingFiles, ...recommendedFiles])
    .filter((file) => file.id !== featuredFileId)
    .slice(0, 6)
}

function getCategoryHref(category: Category) {
  return `/category/${category.id}`
}


function HomeFileCard({ file }: { file: HomeFile }) {
  const image = getFileImage(file)
  const title = getFileTitle(file)
  const downloadCount = Number(file.downloads_count || 0)
  const visibility = String(file.visibility || "free").toLowerCase()
  const badgeText = visibility === "premium" ? "Premium" : visibility === "private" ? "Private" : "Featured"

  return (
    <div className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] shadow-[0_14px_36px_rgba(0,0,0,0.28)] backdrop-blur-sm transition duration-300 hover:-translate-y-1.5 hover:border-cyan-400/40 hover:bg-white/[0.07] hover:shadow-[0_24px_60px_rgba(37,99,235,0.24)]">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-24 bg-cyan-400/10 blur-3xl opacity-0 transition duration-300 group-hover:opacity-100" />

      <div className="relative aspect-[3/4] overflow-hidden bg-slate-900/60">
        {image ? (
          <img
            src={image}
            alt={title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">
            {getFileIcon(title)}
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/20 to-transparent" />

        <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-slate-950/65 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200 backdrop-blur">
          {badgeText}
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-white/90">
          <span className="rounded-full border border-white/10 bg-slate-950/50 px-2.5 py-1 backdrop-blur">
            {formatNumber(downloadCount)} downloads
          </span>
          <span className="rounded-full border border-white/10 bg-slate-950/50 px-2.5 py-1 backdrop-blur">
            {visibility === "premium" ? "Premium" : "Open"}
          </span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="line-clamp-2 text-sm font-bold leading-5 text-white sm:text-base sm:leading-6">
          {title}
        </h3>

        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">
          {file.description?.trim() || "Open this file to view details and download it."}
        </p>

        <Link
          href={getFileHref(file)}
          className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition duration-300 hover:brightness-110"
        >
          Open File
        </Link>
      </div>
    </div>
  )
}

function SmartStatCard({
  label,
  value,
  icon,
  tone,
  hint,
  onClick,
}: {
  label: string
  value: string
  icon: string
  tone: string
  hint: string
  onClick?: () => void
}) {
  const isClickable = typeof onClick === "function"

  const content = (
    <div className="flex items-start gap-3 sm:gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ring-1 sm:h-12 sm:w-12 ${tone}`}>
        {icon}
      </div>

      <div className="min-w-0">
        <div className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
          {label}
        </div>
        <div className="mt-1 text-2xl font-black leading-none text-white sm:text-[28px]">
          {value}
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-300">{hint}</p>
      </div>
    </div>
  )

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 rounded-[24px] border border-white/10 bg-white/[0.05] p-4 text-left shadow-[0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-white/[0.08]"
      >
        {content}
      </button>
    )
  }

  return (
    <div className="min-w-0 rounded-[24px] border border-white/10 bg-white/[0.05] p-4 text-left shadow-[0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-cyan-400/20 hover:bg-white/[0.07]">
      {content}
    </div>
  )
}

function SectionHeader({
  title,
  subtitle,
  count,
  badge,
}: {
  title: string
  subtitle: string
  count: number
  badge?: string
}) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
      </div>

      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-slate-200 shadow-[0_8px_25px_rgba(0,0,0,0.18)] backdrop-blur-sm">
        {badge ? <span>{badge}</span> : null}
        <span>
          {formatNumber(count)} item{count === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  )
}

function FileSection({
  title,
  subtitle,
  files,
  loading,
  emptyMessage,
  badge,
  variant = "standard",
}: {
  title: string
  subtitle: string
  files: HomeFile[]
  loading: boolean
  emptyMessage: string
  badge?: string
  variant?: "standard" | "hot" | "curated" | "fresh"
}) {
  const variantClass =
    variant === "hot"
      ? "bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.08),transparent_32%),rgba(255,255,255,0.02)]"
      : variant === "curated"
        ? "bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.1),transparent_32%),rgba(255,255,255,0.02)]"
        : variant === "fresh"
          ? "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_32%),rgba(255,255,255,0.02)]"
          : "bg-transparent"

  return (
    <section className={`mt-12 overflow-hidden rounded-[30px] border border-white/8 p-5 sm:p-6 ${variantClass}`}>
      <SectionHeader title={title} subtitle={subtitle} count={files.length} badge={badge} />

      {loading ? (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
            >
              <div className="aspect-[3/4] animate-pulse bg-white/10" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                <div className="h-10 w-full animate-pulse rounded-2xl bg-white/10" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-center text-sm font-medium text-slate-300">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4 lg:grid-cols-5">
          {files.map((file) => (
            <HomeFileCard key={file.id} file={file} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [categories, setCategories] = useState<Category[]>([])
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [sectionsLoading, setSectionsLoading] = useState(true)
  const [trendingFiles, setTrendingFiles] = useState<HomeFile[]>([])
  const [topFiles, setTopFiles] = useState<HomeFile[]>([])
  const [latestFiles, setLatestFiles] = useState<HomeFile[]>([])

  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfile | null>(null)
  const [onlineMembers, setOnlineMembers] = useState<MemberItem[]>([])
  const [newMembers, setNewMembers] = useState<MemberItem[]>([])
  const [showOnlineMembers, setShowOnlineMembers] = useState(false)

  const [liveStats, setLiveStats] = useState({
    onlineUsers: 0,
    activeToday: 0,
    totalUsers: 0,
  })

  useEffect(() => {
    checkUserAndLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null

    fetchLiveStats()

    intervalId = setInterval(() => {
      fetchLiveStats()
    }, 20000)

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkUserAndLoad() {
    try {
      setLoading(true)
      setCheckingAuth(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace("/login")
        return
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, role, membership, is_premium, full_name, name, username, coins, avatar_url")
        .eq("id", user.id)
        .maybeSingle()

      setCurrentUserProfile((profileData as CurrentUserProfile | null) || null)

      await Promise.all([fetchDashboardData(), fetchHomeSections(), fetchLiveStats()])
    } catch (error) {
      console.error("Dashboard auth check failed:", error)
      router.replace("/login")
    } finally {
      setCheckingAuth(false)
      setLoading(false)
      setSectionsLoading(false)
    }
  }

  async function fetchDashboardData() {
    const [{ data: categoriesData, error: categoriesError }, { data: filesData, error: filesError }] =
      await Promise.all([
        supabase.from("categories").select("*").order("name", { ascending: true }),
        supabase.from("files").select("id, category_id"),
      ])

    if (categoriesError) {
      console.error("Error fetching categories:", categoriesError)
      setCategories([])
    } else {
      setCategories(categoriesData || [])
    }

    if (filesError) {
      console.error("Error fetching files:", filesError)
      setFileCounts({})
    } else {
      const counts: Record<string, number> = {}

      ;((filesData as FileRow[]) || []).forEach((file) => {
        if (!file.category_id) return
        counts[file.category_id] = (counts[file.category_id] || 0) + 1
      })

      setFileCounts(counts)
    }
  }

  async function fetchHomeSections() {
    try {
      const response = await fetch("/api/home/sections", {
        method: "GET",
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Failed to load homepage sections")
      }

      const data = (await response.json()) as HomeSectionsResponse

      setTrendingFiles(Array.isArray(data.trending) ? data.trending : [])
      setTopFiles(Array.isArray(data.top) ? data.top : [])
      setLatestFiles(Array.isArray(data.latest) ? data.latest : [])
    } catch (error) {
      console.error("Error fetching homepage sections:", error)
      setTrendingFiles([])
      setTopFiles([])
      setLatestFiles([])
    }
  }

  async function fetchLiveStats() {
    try {
      const response = await fetch("/api/site/live-stats", {
        method: "GET",
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Failed to load live stats")
      }

      const data = (await response.json()) as LiveStatsResponse

      setLiveStats({
        onlineUsers: Number(data.onlineUsers || 0),
        activeToday: Number(data.activeToday || 0),
        totalUsers: Number(data.totalUsers || 0),
      })

      setOnlineMembers(Array.isArray(data.onlineMembers) ? data.onlineMembers : [])
      setNewMembers(Array.isArray(data.newMembers) ? data.newMembers : [])
    } catch (error) {
      console.error("Error fetching live stats:", error)
      setLiveStats({
        onlineUsers: 0,
        activeToday: 0,
        totalUsers: 0,
      })
      setOnlineMembers([])
      setNewMembers([])
    }
  }

  const totalFiles = Object.values(fileCounts).reduce((sum, count) => sum + count, 0)
  const membership = String(currentUserProfile?.membership || "").toLowerCase()
  const isPremiumFlag = currentUserProfile?.is_premium === true
  const role = String(currentUserProfile?.role || "").toLowerCase()
  const coins = Number(currentUserProfile?.coins || 0)
  const currentUserName = getCurrentUserName(currentUserProfile)
  const membershipLabel = getMembershipLabel(currentUserProfile?.membership, isPremiumFlag)
  const levelInfo = getLevelInfo(coins)
  const progressPercent = getProgressPercent(coins, levelInfo.currentMin, levelInfo.nextMin)
  const coinsToNextLevel = Math.max(levelInfo.nextMin - coins, 0)
  const recommendedFiles = getRecommendedFiles(trendingFiles, topFiles, latestFiles, membershipLabel)
  const spotlightCategories = getCategorySpotlight(categories, fileCounts)
  const featuredFile = getFeaturedFile(recommendedFiles, trendingFiles, topFiles, latestFiles)
  const continueExploringFiles = getContinueExploringFiles(
    recommendedFiles,
    trendingFiles,
    latestFiles,
    featuredFile?.id,
  )
  const browseCategoriesHref = categories[0] ? getCategoryHref(categories[0]) : "/dashboard"

  const canSeeNewMembers =
    role === "admin" ||
    membership === "premium" ||
    membership === "platinum" ||
    isPremiumFlag

  const canToggleOnlineUsers = role === "admin"

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.05] px-8 py-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <p className="text-lg font-semibold text-white">Checking your account...</p>
          <p className="mt-2 text-sm text-slate-300">Please wait.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <PresenceTracker />

      <div className="min-h-screen bg-[#020617] text-white">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.18),_transparent_30%),linear-gradient(180deg,_#030712_0%,_#020617_45%,_#061229_100%)]" />
        <div className="fixed inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.08]" />
        <SiteHeader />

        <div className="mx-auto w-full max-w-[1800px] px-4 pb-8 pt-24 sm:px-6 sm:pb-10 sm:pt-28 lg:px-8">
          <DailyRewardCard />

          <section className="mt-3 overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.04] shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <div className="relative overflow-hidden border-b border-white/10 px-5 py-7 sm:px-6 sm:py-8 lg:px-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.18),_transparent_34%)]" />
              <div className="absolute right-0 top-0 h-60 w-60 rounded-full bg-cyan-400/10 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />

              <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_420px]">
                <div className="max-w-4xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200">
                    <span>Premium Dashboard</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    <span>Live</span>
                  </div>

                  <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
                    Welcome back,{" "}
                    <span className="bg-gradient-to-r from-sky-300 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                      {currentUserName}
                    </span>
                  </h1>

                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                    Your collector hub is ready. Discover trending content, continue browsing your
                    favorite collections, and track your growth across JB Collections in a more
                    premium Netflix-style experience.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href="/messages"
                      className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/40 transition duration-300 hover:-translate-y-0.5 hover:brightness-110"
                    >
                      Open Messages
                    </Link>

                    <Link
                      href="/upgrade"
                      className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-bold text-slate-100 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.09]"
                    >
                      Open JB Store
                    </Link>

                    <Link
                      href="/leaderboard"
                      className="inline-flex items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10 px-5 py-3 text-sm font-bold text-amber-100 transition duration-300 hover:-translate-y-0.5 hover:bg-amber-500/15"
                    >
                      View Leaderboard
                    </Link>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {[
                      "Personalized picks",
                      "Live community",
                      "Premium library",
                      "Collector progress",
                    ].map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-slate-200 shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-sm"
                      >
                        {item}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm transition duration-300 hover:border-cyan-400/25 hover:bg-white/[0.07]">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                        Your Status
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-lg font-black text-white">
                        <span>{levelInfo.badge}</span>
                        <span>{levelInfo.level}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-300">{levelInfo.message}</p>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm transition duration-300 hover:border-emerald-400/25 hover:bg-white/[0.07]">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                        Community Pulse
                      </div>
                      <div className="mt-2 text-lg font-black text-white">
                        <AnimatedNumber value={liveStats.onlineUsers} /> online now
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-300">
                        Live members active across the platform right now.
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm transition duration-300 hover:border-violet-400/25 hover:bg-white/[0.07]">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                        Fresh Content
                      </div>
                      <div className="mt-2 text-lg font-black text-white">
                        <AnimatedNumber value={latestFiles.length} /> new picks
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-300">
                        Recently added files ready for your next download.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-slate-950/45 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-md">
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${levelInfo.accent}`} />
                  <div className="absolute right-4 top-4 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />

                  <div className="relative flex items-start gap-4">
                    <div className="relative">
                      {currentUserProfile?.avatar_url ? (
                        <img
                          src={currentUserProfile.avatar_url}
                          alt={currentUserName}
                          className="h-20 w-20 rounded-[24px] object-cover ring-1 ring-white/15"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-sky-500 via-blue-600 to-violet-600 text-2xl font-black text-white ring-1 ring-white/15">
                          {getInitials(currentUserName)}
                        </div>
                      )}

                      <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-slate-950 bg-emerald-400 text-[11px] shadow-lg shadow-emerald-900/40">
                        ✓
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-xl font-black text-white">{currentUserName}</h2>
                        <div
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${getMembershipTone(
                            currentUserProfile?.membership,
                            isPremiumFlag,
                          )}`}
                        >
                          {membershipLabel}
                        </div>
                      </div>

                      <p className="mt-1 text-sm text-slate-300">{levelInfo.badge} {levelInfo.level} Collector</p>
                      <p className="mt-3 text-xs leading-5 text-slate-400">
                        {coinsToNextLevel > 0
                          ? `${formatNumber(coinsToNextLevel)} JB Coins left until your next level.`
                          : "You already reached the current top visible level range."}
                      </p>
                    </div>
                  </div>

                  <div className="relative mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                          JB Coin Power
                        </div>
                        <div className="mt-2 text-3xl font-black text-yellow-300 drop-shadow-[0_0_20px_rgba(253,224,71,0.18)]">
                          <AnimatedNumber value={coins} />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-right">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-yellow-100/80">
                          Rank Progress
                        </div>
                        <div className="mt-1 text-lg font-black text-white">
                          <AnimatedNumber value={progressPercent} />
                          %
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-300">
                        <span>{levelInfo.level}</span>
                        <span>
                          Next at {formatNumber(levelInfo.nextMin)}
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${levelInfo.accent} transition-all duration-700`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
                        Categories
                      </div>
                      <div className="mt-2 text-xl font-black text-white">
                        <AnimatedNumber value={categories.length} />
                      </div>
                      <p className="mt-1 text-xs text-slate-400">Collections ready to explore.</p>
                    </div>

                    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
                        Total Files
                      </div>
                      <div className="mt-2 text-xl font-black text-white">
                        <AnimatedNumber value={totalFiles} />
                      </div>
                      <p className="mt-1 text-xs text-slate-400">Resources available right now.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-6 sm:px-6 sm:py-7 lg:px-8">
              <section>
                <SectionHeader
                  title="Platform Overview"
                  subtitle="A smarter snapshot of your dashboard, content, and community activity."
                  count={4}
                  badge="⚡"
                />

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SmartStatCard
                    label="Collections"
                    value={formatNumber(categories.length)}
                    icon="📂"
                    tone="bg-cyan-400/10 text-cyan-200 ring-cyan-400/20"
                    hint="Organized categories ready for browsing and downloads."
                  />

                  <SmartStatCard
                    label="Resources"
                    value={formatNumber(totalFiles)}
                    icon="📦"
                    tone="bg-violet-400/10 text-violet-200 ring-violet-400/20"
                    hint="Your website library is packed with downloadable content."
                  />

                  <SmartStatCard
                    label="Online Now"
                    value={formatNumber(liveStats.onlineUsers)}
                    icon="🔥"
                    tone="bg-emerald-400/10 text-emerald-200 ring-emerald-400/20"
                    hint="Active members are browsing your platform in real time."
                    onClick={
                      canToggleOnlineUsers
                        ? () => setShowOnlineMembers((prev) => !prev)
                        : undefined
                    }
                  />

                  <SmartStatCard
                    label="Fresh Today"
                    value={formatNumber(latestFiles.length)}
                    icon="🆕"
                    tone="bg-amber-400/10 text-amber-200 ring-amber-400/20"
                    hint="New uploads and fresh picks to keep the homepage exciting."
                  />
                </div>

              </section>

              <section className="mt-12">
                <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(8,15,33,0.98),rgba(14,23,48,0.94),rgba(37,99,235,0.22))] shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
                  {featuredFile ? (
                    <div className="grid gap-0 xl:grid-cols-[1.2fr_0.8fr]">
                      <div className="relative min-h-[360px] overflow-hidden p-6 sm:p-8">
                        <div className="absolute inset-0">
                          {getFileImage(featuredFile) ? (
                            <img
                              src={getFileImage(featuredFile) || undefined}
                              alt={getFileTitle(featuredFile)}
                              className="h-full w-full object-cover opacity-30"
                            />
                          ) : null}
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_28%),linear-gradient(90deg,rgba(2,6,23,0.92),rgba(2,6,23,0.76),rgba(2,6,23,0.42))]" />
                        </div>

                        <div className="relative z-10 max-w-2xl">
                          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200">
                            <span>Featured Spotlight</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                            <span>Dashboard Pick</span>
                          </div>

                          <h2 className="mt-5 text-3xl font-black tracking-tight text-white drop-shadow-[0_10px_30px_rgba(14,165,233,0.12)] sm:text-4xl xl:text-5xl">
                            {getFileTitle(featuredFile)}
                          </h2>

                          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-200 sm:text-base">
                            {featuredFile.description?.trim() ||
                              "A premium highlighted item from your collection, chosen to give the dashboard a stronger cinematic homepage feel."}
                          </p>

                          <div className="mt-5 flex flex-wrap gap-3">
                            <div className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-slate-100">
                              {formatNumber(Number(featuredFile.downloads_count || 0))} downloads
                            </div>
                            <div className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-slate-100">
                              {String(featuredFile.visibility || "free").toUpperCase()}
                            </div>
                            <div className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-slate-100">
                              Personalized homepage feature
                            </div>
                          </div>

                          <div className="mt-6 flex flex-wrap gap-3">
                            <Link
                              href={getFileHref(featuredFile)}
                              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/40 transition duration-300 hover:-translate-y-0.5 hover:brightness-110"
                            >
                              Open Featured File
                            </Link>

                            <Link
                              href={browseCategoriesHref}
                              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-bold text-slate-100 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.09]"
                            >
                              Browse All Categories
                            </Link>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-white/10 bg-slate-950/30 p-6 xl:border-l xl:border-t-0">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-black text-white">Continue Exploring</h3>
                            <p className="mt-1 text-sm text-slate-300">
                              Fast access to the next files worth opening.
                            </p>
                          </div>

                          <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                            {formatNumber(continueExploringFiles.length)} picks
                          </div>
                        </div>

                        <div className="mt-5 space-y-3">
                          {continueExploringFiles.length === 0 ? (
                            <div className="rounded-[22px] border border-dashed border-white/15 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-300">
                              Add more content and this quick-access spotlight will automatically fill in.
                            </div>
                          ) : (
                            continueExploringFiles.map((file) => (
                              <Link
                                key={file.id}
                                href={getFileHref(file)}
                                className="group flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] p-3 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-white/[0.07]"
                              >
                                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[18px] bg-slate-900/70 ring-1 ring-white/10">
                                  {getFileImage(file) ? (
                                    <img
                                      src={getFileImage(file) || undefined}
                                      alt={getFileTitle(file)}
                                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-2xl">
                                      {getFileIcon(getFileTitle(file))}
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="line-clamp-1 text-sm font-bold text-white">
                                    {getFileTitle(file)}
                                  </div>
                                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">
                                    {file.description?.trim() || "Open this file to continue browsing your library."}
                                  </div>
                                  <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-cyan-200">
                                    <span>{formatNumber(Number(file.downloads_count || 0))} downloads</span>
                                    <span>•</span>
                                    <span>{String(file.visibility || "free").toUpperCase()}</span>
                                  </div>
                                </div>
                              </Link>
                            ))
                          )}
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                          {spotlightCategories.slice(0, 2).map((category) => (
                            <Link
                              key={category.id}
                              href={getCategoryHref(category)}
                              className="rounded-[20px] border border-white/10 bg-white/[0.04] p-3 transition duration-300 hover:border-cyan-400/25 hover:bg-white/[0.07]"
                            >
                              <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
                                Spotlight
                              </div>
                              <div className="mt-2 line-clamp-1 text-sm font-black text-white">
                                {category.name}
                              </div>
                              <div className="mt-1 text-xs text-slate-300">
                                {formatNumber(fileCounts[category.id] || 0)} files ready
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="px-6 py-14 text-center sm:px-8">
                      <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-slate-200">
                        Featured Spotlight
                      </div>
                      <h2 className="mt-5 text-3xl font-black tracking-tight text-white">
                        Your homepage banner is ready for content
                      </h2>
                      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                        Add more files with thumbnails and descriptions to unlock a cinematic featured spotlight here.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section className="mt-12">
                <SectionHeader
                  title="🎯 Recommended For You"
                  subtitle="Handpicked content based on your dashboard activity and top platform picks."
                  count={recommendedFiles.length}
                  badge="Personal"
                />

                {sectionsLoading ? (
                  <div className="grid grid-cols-2 gap-5 md:grid-cols-4 lg:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={index}
                        className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                      >
                        <div className="aspect-[3/4] animate-pulse bg-white/10" />
                        <div className="space-y-2 p-4">
                          <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                          <div className="h-10 w-full animate-pulse rounded-2xl bg-white/10" />
                          <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recommendedFiles.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-center text-sm font-medium text-slate-300">
                    🚀 No recommendations yet. Add more featured files or activity to power this section.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-5 md:grid-cols-4 lg:grid-cols-5">
                    {recommendedFiles.map((file) => (
                      <HomeFileCard key={file.id} file={file} />
                    ))}
                  </div>
                )}
              </section>

              <section className="mt-12">
                <SectionHeader
                  title="Category Spotlight"
                  subtitle="Your strongest collections with the most content available right now."
                  count={spotlightCategories.length}
                  badge="Top"
                />

                {loading ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-36 animate-pulse rounded-[24px] border border-white/10 bg-white/[0.05]"
                      />
                    ))}
                  </div>
                ) : spotlightCategories.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-center text-sm font-medium text-slate-300">
                    📁 No spotlight categories yet. Upload more files to bring this section to life.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {spotlightCategories.map((category) => {
                      const image = getCategoryImage(category)
                      const count = fileCounts[category.id] || 0

                      return (
                        <Link
                          key={category.id}
                          href={`/category/${category.id}`}
                          className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_12px_34px_rgba(0,0,0,0.24)] transition duration-300 hover:-translate-y-1 hover:border-cyan-400/30 hover:bg-white/[0.06]"
                        >
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.08),_transparent_30%)] opacity-0 transition duration-300 group-hover:opacity-100" />
                          <div className="relative flex items-start gap-4">
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[20px] bg-slate-900/70 ring-1 ring-white/10">
                              {image ? (
                                <img
                                  src={image}
                                  alt={category.name}
                                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-3xl">
                                  {getCategoryIcon(category.name)}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <h3 className="truncate text-base font-black text-white">
                                  {category.name}
                                </h3>
                                <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-200">
                                  {formatNumber(count)} files
                                </span>
                              </div>

                              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">
                                {category.description?.trim() || "Open this collection to browse files."}
                              </p>

                              <div className="mt-4 inline-flex items-center text-sm font-semibold text-cyan-200 transition group-hover:translate-x-1">
                                Open Category →
                              </div>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </section>

              <section className="mt-12">
                <SectionHeader
                  title="Categories"
                  subtitle="Explore premium-ready downloadable collections."
                  count={categories.length}
                  badge="Library"
                />

                {loading ? (
                  <div className="grid grid-cols-2 gap-5 md:grid-cols-4 lg:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={index}
                        className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                      >
                        <div className="aspect-[3/4] animate-pulse bg-white/10" />
                        <div className="space-y-3 p-4">
                          <div className="mx-auto h-4 w-3/4 animate-pulse rounded bg-white/10" />
                          <div className="h-10 w-full animate-pulse rounded-2xl bg-white/10" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : categories.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-center text-sm font-medium text-slate-300">
                    📁 No categories available yet. Create your first collection and this area will light up.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-5 md:grid-cols-4 lg:grid-cols-5">
                    {categories.map((category) => {
                      const image = getCategoryImage(category)
                      const count = fileCounts[category.id] || 0

                      return (
                        <div
                          key={category.id}
                          className="group overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm transition duration-300 hover:-translate-y-1.5 hover:border-cyan-400/40 hover:bg-white/[0.06] hover:shadow-[0_22px_52px_rgba(14,165,233,0.15)]"
                        >
                          <div className="relative aspect-[3/4] overflow-hidden bg-slate-900/60">
                            {image ? (
                              <img
                                src={image}
                                alt={category.name}
                                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-5xl">
                                {getCategoryIcon(category.name)}
                              </div>
                            )}

                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-900/20 to-transparent" />

                            <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-slate-950/65 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200 backdrop-blur">
                              Category
                            </div>

                            <div className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-slate-950/50 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                              {formatNumber(count)} file{count === 1 ? "" : "s"}
                            </div>
                          </div>

                          <div className="p-4">
                            <h3 className="text-sm font-bold leading-5 text-white sm:text-base sm:leading-6">
                              {category.name}
                            </h3>

                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-300">
                              {category.description?.trim() || "Open this collection to browse files."}
                            </p>

                            <Link
                              href={`/category/${category.id}`}
                              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition duration-300 hover:brightness-110"
                            >
                              Open Category
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              <FileSection
                title="🔥 Trending Now"
                subtitle="Most viewed and downloaded items on your website."
                files={trendingFiles}
                loading={sectionsLoading}
                emptyMessage="🔥 No trending items yet. Add more activity and featured files to spark this section."
                badge="Hot"
                variant="hot"
              />

              <FileSection
                title="⭐ Top Picks"
                subtitle="Highlighted files worth checking first."
                files={topFiles}
                loading={sectionsLoading}
                emptyMessage="⭐ No top picks yet. Choose a few strong featured files to fill this row."
                badge="Curated"
                variant="curated"
              />

              <FileSection
                title="🆕 New Uploads"
                subtitle="Fresh files recently added to your website."
                files={latestFiles}
                loading={sectionsLoading}
                emptyMessage="🆕 No new uploads yet. Your latest content will appear here automatically."
                badge="Fresh"
                variant="fresh"
              />

              <section className="mt-12">
                <div className="rounded-[30px] border border-white/10 bg-[#061229]/72 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-5">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                        Live Community
                      </h2>
                      <p className="mt-1 text-sm text-slate-300">
                        Track members, activity, and new signups in real time.
                      </p>
                    </div>

                    <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100">
                      <span className="mr-2 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      Live updating every 20s
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <SmartStatCard
                      label="Members"
                      value={formatNumber(liveStats.totalUsers)}
                      icon="👥"
                      tone="bg-cyan-400/10 text-cyan-200 ring-cyan-400/20"
                      hint="Your total registered users across the platform."
                    />

                    <SmartStatCard
                      label="Online"
                      value={formatNumber(liveStats.onlineUsers)}
                      icon="🔥"
                      tone="bg-emerald-400/10 text-emerald-200 ring-emerald-400/20"
                      hint={canToggleOnlineUsers ? "Tap to show the live online user list." : "Live online members right now."}
                      onClick={
                        canToggleOnlineUsers
                          ? () => setShowOnlineMembers((prev) => !prev)
                          : undefined
                      }
                    />

                    <SmartStatCard
                      label="Today"
                      value={formatNumber(liveStats.activeToday)}
                      icon="📈"
                      tone="bg-violet-400/10 text-violet-200 ring-violet-400/20"
                      hint="Members who were active today on your site."
                    />

                    <SmartStatCard
                      label="New"
                      value={formatNumber(newMembers.length)}
                      icon="🆕"
                      tone="bg-amber-400/10 text-amber-200 ring-amber-400/20"
                      hint="Fresh signups detected in the current day."
                    />
                  </div>

                  {canToggleOnlineUsers && showOnlineMembers ? (
                    <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-white">Online Users</h3>
                          <p className="text-xs text-slate-300">Click a member to view profile.</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowOnlineMembers(false)}
                          className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.12]"
                        >
                          Close
                        </button>
                      </div>

                      {onlineMembers.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-6 text-center text-sm text-slate-300">
                          No users online right now.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {onlineMembers.map((member) => (
                            <Link
                              key={member.id}
                              href={`/admin/users/${member.id}`}
                              className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 transition hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-white/[0.08]"
                            >
                              <div className="flex items-center gap-3">
                                {member.avatar_url ? (
                                  <img
                                    src={member.avatar_url}
                                    alt={getMemberDisplayName(member)}
                                    className="h-11 w-11 rounded-2xl object-cover ring-1 ring-white/10"
                                  />
                                ) : (
                                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-violet-600 text-sm font-black text-white ring-1 ring-white/10">
                                    {getInitials(getMemberDisplayName(member))}
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <div className="truncate text-sm font-bold text-white">
                                    {getMemberDisplayName(member)}
                                  </div>
                                  <div className="mt-1 text-xs text-emerald-400">Online now</div>
                                </div>
                              </div>

                              <div className="mt-3 text-xs text-slate-300">
                                Joined: {formatShortDate(member.created_at)}
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {canSeeNewMembers ? (
                    <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
                      <div className="mb-3">
                        <h3 className="text-sm font-bold text-white">New Member/s</h3>
                        <p className="text-xs text-slate-300">Users who joined today.</p>
                      </div>

                      {newMembers.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-6 text-center text-sm text-slate-300">
                          No new members yet today.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {newMembers.map((member) => (
                            <div
                              key={member.id}
                              className="rounded-2xl border border-white/10 bg-white/[0.05] p-4"
                            >
                              <div className="flex items-center gap-3">
                                {member.avatar_url ? (
                                  <img
                                    src={member.avatar_url}
                                    alt={getMemberDisplayName(member)}
                                    className="h-11 w-11 rounded-2xl object-cover ring-1 ring-white/10"
                                  />
                                ) : (
                                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-cyan-500 to-sky-600 text-sm font-black text-white ring-1 ring-white/10">
                                    {getInitials(getMemberDisplayName(member))}
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <div className="truncate text-base font-bold text-white">
                                    {getMemberDisplayName(member)}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-300">
                                    Joined: {formatShortDate(member.created_at)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
