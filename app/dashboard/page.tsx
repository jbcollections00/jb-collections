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

function HomeFileCard({ file }: { file: HomeFile }) {
  const image = getFileImage(file)
  const title = getFileTitle(file)
  const downloadCount = Number(file.downloads_count || 0)

  return (
    <div className="group overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.045] shadow-[0_12px_34px_rgba(0,0,0,0.26)] backdrop-blur-sm transition duration-300 hover:-translate-y-1.5 hover:border-cyan-400/40 hover:bg-white/[0.07] hover:shadow-[0_22px_52px_rgba(37,99,235,0.22)]">
      <div className="relative aspect-[3/4] overflow-hidden bg-slate-900/60">
        {image ? (
          <img
            src={image}
            alt={title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl">
            {getFileIcon(title)}
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-900/20 to-transparent" />

        <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-slate-950/65 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200 backdrop-blur">
          Featured
        </div>
      </div>

      <div className="p-4">
        <h3 className="line-clamp-2 text-sm font-bold leading-5 text-white sm:text-base sm:leading-6">
          {title}
        </h3>

        <p className="mt-1 hidden text-xs text-slate-300">
          {file.description?.trim() || "Open this file to view details and download it."}
        </p>

        <Link
          href={getFileHref(file)}
          className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:brightness-110"
        >
          Download
        </Link>

        <div className="mt-3 text-center text-xs font-medium text-slate-300">
          {formatNumber(downloadCount)} download{downloadCount === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  onClick,
}: {
  label: string
  value: string
  icon: string
  onClick?: () => void
}) {
  const isClickable = typeof onClick === "function"

  const content = (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-base ring-1 ring-cyan-400/20 sm:h-11 sm:w-11 sm:text-lg">
        {icon}
      </div>

      <div className="min-w-0">
        <div className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-sky-200/75 sm:text-[10px] sm:tracking-[0.18em]">
          {label}
        </div>
        <div className="mt-1 text-xl font-black leading-none text-white sm:text-2xl">
          {value}
        </div>
      </div>
    </div>
  )

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.05] px-3 py-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur-sm transition duration-300 hover:border-cyan-400/40 hover:bg-white/[0.08]"
      >
        {content}
      </button>
    )
  }

  return (
    <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.05] px-3 py-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur-sm">
      {content}
    </div>
  )
}

function SectionHeader({
  title,
  subtitle,
  count,
}: {
  title: string
  subtitle: string
  count: number
}) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
      </div>

      <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-slate-200 shadow-[0_8px_25px_rgba(0,0,0,0.18)] backdrop-blur-sm">
        {formatNumber(count)} item{count === 1 ? "" : "s"}
      </div>
    </div>
  )
}

function FileSection({
  title,
  subtitle,
  files,
  loading,
}: {
  title: string
  subtitle: string
  files: HomeFile[]
  loading: boolean
}) {
  return (
    <section className="mt-12">
      <SectionHeader title={title} subtitle={subtitle} count={files.length} />

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
          No items available yet.
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
        .select("id, role, membership, is_premium, full_name, name, username, coins")
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
        <SiteHeader />

        <div className="mx-auto w-full max-w-[1800px] px-4 pb-8 pt-24 sm:px-6 sm:pb-10 sm:pt-28 lg:px-8">
          <DailyRewardCard />

          <section className="mt-3 overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.04] shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <div className="relative overflow-hidden border-b border-white/10 px-5 py-7 sm:px-6 sm:py-8 lg:px-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.15),_transparent_34%)]" />
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200">
                    Premium Dashboard
                  </div>

                  <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                    Welcome back,{" "}
                    <span className="bg-gradient-to-r from-sky-300 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                      {getCurrentUserName(currentUserProfile)}
                    </span>
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                    Explore categories, discover trending files, track live activity, and enjoy a
                    cleaner premium experience across JB Collections.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/messages"
                      className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/40 transition hover:brightness-110"
                    >
                      Open Messages
                    </Link>

                    <Link
                      href="/upgrade"
                      className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-bold text-slate-100 transition hover:bg-white/[0.09]"
                    >
                      Open JB Store
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:min-w-[360px]">
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-sm">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200/75">
                      Membership
                    </div>
                    <div className="mt-2 text-xl font-black text-white sm:text-2xl">
                      {membership ? membership.toUpperCase() : "FREE"}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-sm">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200/75">
                      JB Coins
                    </div>
                    <div className="mt-2 text-xl font-black text-yellow-300 sm:text-2xl">
                      {formatNumber(Number(currentUserProfile?.coins || 0))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-sm">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200/75">
                      Categories
                    </div>
                    <div className="mt-2 text-xl font-black text-white sm:text-2xl">
                      {formatNumber(categories.length)}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-sm">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200/75">
                      Total Files
                    </div>
                    <div className="mt-2 text-xl font-black text-white sm:text-2xl">
                      {formatNumber(totalFiles)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-6 sm:px-6 sm:py-7 lg:px-8">
              <section>
                <SectionHeader
                  title="Categories"
                  subtitle="Explore premium-ready downloadable collections."
                  count={categories.length}
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
                    No categories available yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-5 md:grid-cols-4 lg:grid-cols-5">
                    {categories.map((category) => {
                      const image = getCategoryImage(category)
                      const count = fileCounts[category.id] || 0

                      return (
                        <div
                          key={category.id}
                          className="group overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm transition duration-300 hover:-translate-y-1.5 hover:border-cyan-400/40 hover:bg-white/[0.06]"
                        >
                          <div className="relative aspect-[3/4] overflow-hidden bg-slate-900/60">
                            {image ? (
                              <img
                                src={image}
                                alt={category.name}
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-5xl">
                                {getCategoryIcon(category.name)}
                              </div>
                            )}

                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/20 to-transparent" />

                            <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-slate-950/65 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200 backdrop-blur">
                              Category
                            </div>
                          </div>

                          <div className="p-4">
                            <h3 className="text-sm font-bold leading-5 text-white sm:text-base sm:leading-6">
                              {category.name}
                            </h3>

                            <p className="mt-1 line-clamp-2 text-xs text-slate-300">
                              {category.description?.trim() || "Open this collection to browse files."}
                            </p>

                            <Link
                              href={`/category/${category.id}`}
                              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:brightness-110"
                            >
                              Open Category
                            </Link>

                            <div className="mt-3 text-center text-xs font-medium text-slate-300">
                              {formatNumber(count)} file{count === 1 ? "" : "s"}
                            </div>
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
              />

              <FileSection
                title="⭐ Top Picks"
                subtitle="Highlighted files worth checking first."
                files={topFiles}
                loading={sectionsLoading}
              />

              <FileSection
                title="🆕 New Uploads"
                subtitle="Fresh files recently added to your website."
                files={latestFiles}
                loading={sectionsLoading}
              />

              <section className="mt-12">
                <div className="rounded-[30px] border border-white/10 bg-[#061229]/72 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-5">
                  <div className="mb-4">
                    <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                      Live Community
                    </h2>
                    <p className="mt-1 text-sm text-slate-300">
                      Track members, activity, and new signups in real time.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard
                      label="Members"
                      value={formatNumber(liveStats.totalUsers)}
                      icon="👥"
                    />

                    <StatCard
                      label="Online"
                      value={formatNumber(liveStats.onlineUsers)}
                      icon="🔥"
                      onClick={
                        canToggleOnlineUsers
                          ? () => setShowOnlineMembers((prev) => !prev)
                          : undefined
                      }
                    />

                    <StatCard
                      label="Today"
                      value={formatNumber(liveStats.activeToday)}
                      icon="📈"
                    />

                    <StatCard
                      label="New"
                      value={formatNumber(newMembers.length)}
                      icon="🆕"
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
                              <div className="text-sm font-bold text-white">
                                {getMemberDisplayName(member)}
                              </div>
                              <div className="mt-1 text-xs text-emerald-400">Online now</div>
                              <div className="mt-2 text-xs text-slate-300">
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
                              <div className="text-base font-bold text-white">
                                {getMemberDisplayName(member)}
                              </div>
                              <div className="mt-2 text-sm text-slate-300">
                                Joined: {formatShortDate(member.created_at)}
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