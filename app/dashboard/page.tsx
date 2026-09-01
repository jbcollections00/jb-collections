"use client"

import Link from "next/link"
import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import PresenceTracker from "@/app/components/PresenceTracker"
import DailyRewardCard from "@/app/components/DailyRewardCard"
import TopDownloaderAd from "@/app/components/TopDownloaderAd"

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
  user_name?: string | null
}

type HomeSectionsResponse = {
  trending?: HomeFile[]
  top?: HomeFile[]
  latest?: HomeFile[]
  recent_downloads?: HomeFile[]
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
  newJoinsCount?: number
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
  return `/download/${file.slug || file.id}`
}

function getCurrentUserName(profile: CurrentUserProfile | null) {
  if (!profile) return "Collector"
  return profile.full_name?.trim() || profile.name?.trim() || profile.username?.trim() || "Collector"
}

function getMemberDisplayName(member: MemberItem) {
  return member.full_name?.trim() || member.name?.trim() || member.username?.trim() || member.email?.split("@")[0] || "Anonymous Member"
}

function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean)
  if (parts.length === 0) return "C"
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// --- WEEKLY LEADERBOARD POPUP MODAL ---
function WeeklyLeaderboardModal() {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const hasSeenModal = sessionStorage.getItem("hasSeenLeaderboardModal")
    if (!hasSeenModal) {
      const timer = setTimeout(() => {
        setIsOpen(true)
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleClose = () => {
    sessionStorage.setItem("hasSeenLeaderboardModal", "true")
    setIsOpen(false)
  }

  const handleAction = () => {
    handleClose()
    router.push("/leaderboard")
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />
      
      <div className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-amber-500/20 bg-slate-900/95 p-6 text-center shadow-[0_0_50px_rgba(234,179,8,0.25)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-300 text-white">
        <button 
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-400/40 bg-gradient-to-br from-amber-400/20 to-yellow-600/20 shadow-[0_0_30px_rgba(234,179,8,0.3)]">
          <span className="text-3xl">🏆</span>
        </div>

        <h2 className="text-2xl font-black text-white">
          Weekly Race is Live!
        </h2>
        
        <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-left shadow-inner">
          <p className="mb-2 text-sm font-bold text-amber-400">Paano Sumali at Manalo ng JB Coins:</p>
          <ol className="list-decimal space-y-2 pl-4 text-[13px] font-medium text-slate-300">
            <li>Kumita ng coins sa pamamagitan ng daily check-ins, tasks, at activities.</li>
            <li>Nagsisimula ang race tuwing <strong className="text-white">Lunes (12:00 AM)</strong> at nagre-reset tuwing <strong className="text-white">Linggo (11:59 PM)</strong>.</li>
            <li>Ang Top 3 members na may pinakamaming naipong coins ngayong linggo ay mananalo ng rewards!</li>
          </ol>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-950/80 p-3 text-center border border-white/10">
            <div>
              <p className="text-[11px] text-amber-400 font-bold">🥇 1st Place</p>
              <p className="text-sm font-black text-white">+500 JB</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-300 font-bold">🥈 2nd Place</p>
              <p className="text-sm font-black text-white">+300 JB</p>
            </div>
            <div>
              <p className="text-[11px] text-amber-600 font-bold">🥉 3rd Place</p>
              <p className="text-sm font-black text-white">+200 JB</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-full bg-slate-800/60 py-1.5 text-xs font-bold text-amber-300 border border-amber-500/20">
          🔥 1,000 JB Coins Total Prize Pool Every Week!
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button 
            onClick={handleAction}
            className="w-full rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 py-3 font-bold text-slate-950 shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] hover:shadow-amber-500/40"
          >
            View Leaderboard Now
          </button>
          <button 
            onClick={handleClose}
            className="w-full rounded-xl py-2.5 font-semibold text-slate-400 transition-colors hover:bg-white/5 hover:text-white text-xs"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  )
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 px-3 py-1 text-xs font-black text-slate-950 shadow-[0_0_15px_rgba(251,191,36,0.6)]">
        🏆 #1
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-300 px-2.5 py-1 text-xs font-black text-slate-950 shadow-[0_0_12px_rgba(241,245,249,0.5)]">
        🥈 #2
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-700 via-amber-600 to-amber-800 px-2.5 py-1 text-xs font-black text-amber-100 shadow-[0_0_12px_rgba(180,83,9,0.4)]">
        🥉 #3
      </div>
    )
  }
  return (
    <div className="absolute top-3 right-3 z-10 rounded-full border border-white/20 bg-slate-950/80 px-2.5 py-1 text-xs font-bold text-slate-200 backdrop-blur-md">
      #{rank}
    </div>
  )
}

function HomeFileCard({ file, rank, isLiveActivity = false }: { file: HomeFile; rank?: number; isLiveActivity?: boolean }) {
  const image = getFileImage(file)
  const title = getFileTitle(file)
  const downloadCount = Number(file.downloads_count || 0)
  const visibility = String(file.visibility || "free").toLowerCase()
  const badgeText = visibility === "premium" ? "Premium" : visibility === "private" ? "Private" : "Featured"

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-cyan-400/50 hover:shadow-[0_20px_40px_rgba(34,211,238,0.15)]">
      <div className="relative">
        {rank ? <RankBadge rank={rank} /> : null}

        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-950">
          {image ? (
            <img
              src={image}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-5xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950">
              {getFileIcon(title)}
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

          <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-slate-950/70 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-cyan-300 backdrop-blur-md">
            {badgeText}
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 text-[11px] font-medium text-white">
            <span className="flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/75 px-2.5 py-1 backdrop-blur-md text-slate-200">
              ⚡ {formatNumber(downloadCount)}
            </span>
            <span className="rounded-full border border-white/10 bg-slate-950/75 px-2.5 py-1 backdrop-blur-md text-cyan-200">
              {visibility === "premium" ? "VIP" : "Open"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4 pt-3">
        <div>
          <h3 className="line-clamp-2 text-center text-sm font-bold text-white transition-colors duration-200 group-hover:text-cyan-300 sm:text-base">
            {title}
          </h3>

          {!isLiveActivity && (
            <>
              {file.user_name ? (
                <p className="mt-2 text-center text-xs font-medium text-slate-400 truncate">
                  By <span className="text-cyan-300 font-semibold">{file.user_name}</span>
                </p>
              ) : file.description?.trim() ? (
                <p className="mt-2 line-clamp-2 text-center text-xs leading-5 text-slate-400">
                  {file.description.trim()}
                </p>
              ) : null}
            </>
          )}
        </div>

        {!isLiveActivity && (
          <Link
            href={getFileHref(file)}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all duration-300 hover:brightness-125 hover:shadow-cyan-500/25"
          >
            <span>Open File</span>
            <span>→</span>
          </Link>
        )}
      </div>
    </div>
  )
}

function SmartStatCard({
  label,
  value,
  icon,
  tone,
  onClick,
}: {
  label: string
  value: string
  icon: string
  tone: string
  onClick?: () => void
}) {
  const isClickable = typeof onClick === "function"

  const content = (
    <div className="flex items-center gap-3 sm:gap-4 w-full">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl shadow-inner ${tone}`}>
        {icon}
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        <span className="truncate text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
          {label}
        </span>
        <span className="text-xl font-black text-white sm:text-2xl tracking-tight">
          {value}
        </span>
      </div>
    </div>
  )

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group min-w-0 rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-slate-800/50 hover:shadow-[0_10px_25px_rgba(34,211,238,0.15)] w-full"
      >
        {content}
      </button>
    )
  }

  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-900/40 p-4 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-slate-800/40 w-full">
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
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>

      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-4 py-1.5 text-xs font-bold text-slate-300 backdrop-blur-md shadow-lg">
        {badge ? <span className="text-cyan-400">{badge}</span> : null}
        {badge ? <span>•</span> : null}
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
  showRank = false,
  maxItems = 5,
  isLiveActivity = false,
}: {
  title: string
  subtitle: string
  files: HomeFile[]
  loading: boolean
  emptyMessage: string
  badge?: string
  variant?: "standard" | "hot" | "curated" | "fresh"
  showRank?: boolean
  maxItems?: number
  isLiveActivity?: boolean
}) {
  const variantClass =
    variant === "hot"
      ? "bg-[radial-gradient(ellipse_at_top_left,rgba(239,68,68,0.08),transparent_50%)] border-rose-500/20"
      : variant === "curated"
        ? "bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.08),transparent_50%)] border-purple-500/20"
        : variant === "fresh"
          ? "bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.08),transparent_50%)] border-emerald-500/20"
          : "border-white/10"

  const displayedFiles = files.slice(0, maxItems)

  return (
    <section className={`mt-10 overflow-hidden rounded-3xl border bg-slate-950/40 p-6 backdrop-blur-xl shadow-2xl ${variantClass}`}>
      <SectionHeader title={title} subtitle={subtitle} count={displayedFiles.length} badge={badge} />

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: maxItems }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 p-2 space-y-3"
            >
              <div className="aspect-[3/4] animate-pulse rounded-2xl bg-slate-800/60" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-800/60 mx-auto" />
                <div className="h-8 w-full animate-pulse rounded-xl bg-slate-800/60" />
              </div>
            </div>
          ))}
        </div>
      ) : displayedFiles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 px-6 py-12 text-center text-sm font-medium text-slate-400">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {displayedFiles.map((file, idx) => (
            <HomeFileCard key={file.id} file={file} rank={showRank ? idx + 1 : undefined} isLiveActivity={isLiveActivity} />
          ))}
        </div>
      )}
    </section>
  )
}

function DashboardPageContent() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [categories, setCategories] = useState<Category[]>([])
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [sectionsLoading, setSectionsLoading] = useState(true)
  const [, setTrendingFiles] = useState<HomeFile[]>([])
  const [topFiles, setTopFiles] = useState<HomeFile[]>([])
  const [latestFiles, setLatestFiles] = useState<HomeFile[]>([])
  const [recentDownloads, setRecentDownloads] = useState<HomeFile[]>([])

  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfile | null>(null)
  const [onlineMembers, setOnlineMembers] = useState<MemberItem[]>([])
  const [newMembers, setNewMembers] = useState<MemberItem[]>([])
  const [showOnlineMembers, setShowOnlineMembers] = useState(false)

  const [liveStats, setLiveStats] = useState({
    onlineUsers: 0,
    activeToday: 0,
    totalUsers: 0,
    newJoinsCount: 0,
  })

  useEffect(() => {
    let isMounted = true

    async function checkUserAndLoad() {
      try {
        setLoading(true)
        setCheckingAuth(true)

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (!isMounted) return

        if (userError || !user) {
          router.replace("/login")
          return
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, role, membership, is_premium, full_name, name, username, coins, avatar_url")
          .eq("id", user.id)
          .maybeSingle()

        if (!isMounted) return

        setCurrentUserProfile((profileData as CurrentUserProfile | null) || null)

        await Promise.all([fetchDashboardData(), fetchHomeSections(), fetchLiveStats()])
      } catch (error) {
        console.error("Dashboard auth check failed:", error)
        if (isMounted) router.replace("/login")
      } finally {
        if (isMounted) {
          setCheckingAuth(false)
          setLoading(false)
          setSectionsLoading(false)
        }
      }
    }

    checkUserAndLoad()

    // 🔄 REAL-TIME AUTO-POLLING: Kusa nitong itinatawag ang live stats bawat 15 segundo
    const interval = setInterval(() => {
      if (isMounted) {
        fetchLiveStats()
      }
    }, 15000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [supabase, router])

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
      
      // Fixed: Filter recent downloads to ensure unique files
      const rawRecent = Array.isArray(data.recent_downloads) ? data.recent_downloads : []
      const uniqueRecentDownloads = rawRecent.filter(
        (file, index, self) => index === self.findIndex((t) => t.id === file.id)
      )
      setRecentDownloads(uniqueRecentDownloads)

    } catch (error) {
      console.error("Error fetching homepage sections:", error)
      setTrendingFiles([])
      setTopFiles([])
      setLatestFiles([])
      setRecentDownloads([])
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
        newJoinsCount: Number(data.newJoinsCount ?? data.newMembers?.length ?? 0),
      })

      setOnlineMembers(Array.isArray(data.onlineMembers) ? data.onlineMembers : [])
      setNewMembers(Array.isArray(data.newMembers) ? data.newMembers : [])
    } catch (error) {
      console.error("Error fetching live stats:", error)
      setLiveStats({
        onlineUsers: 0,
        activeToday: 0,
        totalUsers: 0,
        newJoinsCount: 0,
      })
      setOnlineMembers([])
      setNewMembers([])
    }
  }

  const role = String(currentUserProfile?.role || "").toLowerCase()
  const currentUserName = getCurrentUserName(currentUserProfile)
  const canToggleOnlineUsers = role === "admin"

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030712] px-4">
        <div className="relative rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-center shadow-2xl backdrop-blur-2xl">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
          <p className="mt-4 text-base font-bold text-white">Authenticating...</p>
          <p className="mt-1 text-xs text-slate-400">Loading your profile setup</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <PresenceTracker />
      
      {/* 🏆 WEEKLY LEADERBOARD POPUP */}
      <WeeklyLeaderboardModal />

      <div className="relative min-h-screen bg-[#030712] text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
        {/* Glowing Background Elements */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-indigo-600/15 blur-[120px]" />
          <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[140px]" />
          <div className="absolute -bottom-40 left-1/3 h-[600px] w-[600px] rounded-full bg-purple-600/15 blur-[140px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-20" />
        </div>

        <div className="mx-auto w-full max-w-[1700px] px-4 pb-12 pt-6 sm:px-6 lg:px-8 space-y-4">
          <DailyRewardCard />

          {/* 🚀 TOP DOWNLOADER PROMO AD BANNER */}
          <TopDownloaderAd
            targetUrl="/leaderboard"
            title="⚡ Rank #1 Top Downloader Gets Bonus Coins & Perks!"
            description="I-download ang pinakabagong files araw-araw, humabol sa rankings, at manalo ng exclusive JB Coins rewards!"
            badgeText="TOP DOWNLOADER RACE"
          />

          <section className="overflow-hidden rounded-[36px] border border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-2xl">
            {/* HERO BANNER */}
            <div className="relative overflow-hidden border-b border-white/10 px-6 py-10 sm:px-10 sm:py-12">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-transparent" />

              <div className="relative z-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-bold text-cyan-300 backdrop-blur-md">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                    </span>
                    <span>Dashboard Active</span>
                  </div>

                  <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                    Welcome back,{" "}
                    <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
                      {currentUserName}
                    </span>
                  </h1>
                  <p className="mt-2 text-sm text-slate-400 sm:text-base">
                    Discover, download, and manage premium collections in real-time.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 lg:p-10">
              {/* 📁 SECTION 1: Categories Grid */}
              <section className="mt-2">
                <div className="mb-8 flex flex-col items-center justify-center text-center">
                  <h2 className="text-2xl font-black tracking-tight text-white sm:text-4xl">
                    Featured Collections
                  </h2>
                  <p className="mt-2 text-sm text-slate-400 max-w-lg">
                    Browse curated library collections organized specifically for you.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-bold text-purple-300 backdrop-blur-md">
                    <span>Library Catalog</span>
                    <span>•</span>
                    <span>{formatNumber(categories.length)} item{categories.length === 1 ? "" : "s"}</span>
                  </div>
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 max-w-5xl mx-auto">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <div
                        key={index}
                        className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 p-3 space-y-4"
                      >
                        <div className="aspect-[16/9] animate-pulse rounded-2xl bg-slate-800/60" />
                        <div className="space-y-2 p-3">
                          <div className="h-5 w-1/2 animate-pulse rounded bg-slate-800/60 mx-auto" />
                          <div className="h-10 w-full animate-pulse rounded-xl bg-slate-800/60" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : categories.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/30 px-6 py-12 text-center text-sm font-medium text-slate-400">
                    📁 No categories found. Check back later!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 max-w-5xl mx-auto">
                    {categories.map((category) => {
                      const image = getCategoryImage(category)
                      const count = fileCounts[category.id] || 0

                      return (
                        <div
                          key={category.id}
                          className="group relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-b from-slate-900/90 via-slate-950/90 to-purple-950/30 p-2 shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-purple-400/50 hover:shadow-[0_20px_50px_rgba(168,85,247,0.2)]"
                        >
                          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-slate-950">
                            {image ? (
                              <img
                                src={image}
                                alt={category.name}
                                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-6xl bg-slate-900">
                                {getCategoryIcon(category.name)}
                              </div>
                            )}

                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                            <div className="absolute left-3.5 top-3.5 rounded-full border border-purple-400/30 bg-purple-950/80 px-3.5 py-1 text-[10px] font-black uppercase tracking-widest text-purple-200 backdrop-blur-md">
                              CATEGORY
                            </div>

                            <div className="absolute bottom-3.5 left-3.5 rounded-full border border-white/15 bg-slate-950/80 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
                              📁 {formatNumber(count)} file{count === 1 ? "" : "s"}
                            </div>
                          </div>

                          <div className="p-5">
                            <h3 className="text-lg font-bold text-white text-center transition-colors group-hover:text-purple-300">
                              {category.name}
                            </h3>

                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400 text-center">
                              {category.description?.trim() || "Explore all files inside this collection."}
                            </p>

                            <Link
                              href={`/category/${category.id}`}
                              className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all duration-300 hover:brightness-125 hover:shadow-purple-500/25"
                            >
                              <span>Explore Collection</span>
                              <span>→</span>
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* 🔥 SECTION 2: Top Downloaded */}
              <FileSection
                title="🔥 Top Downloaded"
                subtitle="The community's most downloaded files."
                files={topFiles}
                loading={sectionsLoading}
                emptyMessage="🔥 No top downloaded files yet."
                badge="Popular"
                variant="hot"
                showRank={true}
                maxItems={5}
              />

              {/* 🆕 SECTION 3: New Uploads */}
              <FileSection
                title="🆕 Fresh Releases"
                subtitle="Recently published downloads."
                files={latestFiles}
                loading={sectionsLoading}
                emptyMessage="🆕 No new uploads yet."
                badge="Latest"
                variant="fresh"
                maxItems={10}
              />

              {/* ⚡ SECTION 4: Recent Member Activity */}
              <FileSection
                title="⚡ Live Activity Feed"
                subtitle="Real-time downloads happening across the network."
                files={recentDownloads}
                loading={sectionsLoading}
                emptyMessage="⚡ No recent activity recorded yet."
                badge="Activity"
                variant="curated"
                maxItems={5}
                isLiveActivity={true}
              />

              {/* 👥 SECTION 5: Live Community */}
              <section className="mt-12">
                <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
                  <div className="mb-6">
                    <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                      Community Live Pulse
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Real-time usage metrics and active member interactions.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <SmartStatCard
                      label="Total Members"
                      value={formatNumber(liveStats.totalUsers)}
                      icon="👥"
                      tone="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    />

                    <SmartStatCard
                      label="Online Now"
                      value={formatNumber(liveStats.onlineUsers)}
                      icon="🔥"
                      tone="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      onClick={
                        canToggleOnlineUsers
                          ? () => setShowOnlineMembers((prev) => !prev)
                          : undefined
                      }
                    />

                    <SmartStatCard
                      label="Active Today"
                      value={formatNumber(liveStats.activeToday)}
                      icon="📈"
                      tone="bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    />

                    <SmartStatCard
                      label="New Joins"
                      value={formatNumber(liveStats.newJoinsCount || newMembers.length)}
                      icon="🆕"
                      tone="bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    />
                  </div>

                  {canToggleOnlineUsers && showOnlineMembers ? (
                    <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/80 p-5 backdrop-blur-xl">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold text-white">Online Members List</h3>
                          <p className="text-xs text-slate-400">Click a user to open their profile details.</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowOnlineMembers(false)}
                          className="rounded-xl border border-white/10 bg-slate-800/80 px-3.5 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-slate-700/80"
                        >
                          Hide List
                        </button>
                      </div>

                      {onlineMembers.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/10 bg-slate-900/30 px-4 py-8 text-center text-sm text-slate-400">
                          No members currently active.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {onlineMembers.map((member) => (
                            <Link
                              key={member.id}
                              href={`/admin/users/${member.id}`}
                              className="group rounded-xl border border-white/10 bg-slate-900/50 p-3.5 transition duration-200 hover:border-cyan-400/40 hover:bg-slate-800/60"
                            >
                              <div className="flex items-center gap-3">
                                {member.avatar_url ? (
                                  <img
                                    src={member.avatar_url}
                                    alt={getMemberDisplayName(member)}
                                    className="h-10 w-10 rounded-xl object-cover ring-2 ring-white/10"
                                  />
                                ) : (
                                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-black text-white ring-2 ring-white/10">
                                    {getInitials(getMemberDisplayName(member))}
                                  </div>
                                )}

                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-bold text-white group-hover:text-cyan-300">
                                    {getMemberDisplayName(member)}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-0.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span>Active Now</span>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-2.5 text-[11px] text-slate-400 pt-2 border-t border-white/5">
                                Joined: {formatShortDate(member.created_at)}
                              </div>
                            </Link>
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

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#030712] px-4 text-white">
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 px-8 py-6 text-center font-bold shadow-2xl backdrop-blur-xl">
            Initializing interface...
          </div>
        </div>
      }
    >
      <DashboardPageContent />
    </Suspense>
  )
}