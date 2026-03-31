"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import PresenceTracker from "@/app/components/PresenceTracker"
import SiteHeader from "@/app/components/SiteHeader"

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

function HomeFileCard({ file }: { file: HomeFile }) {
  const image = getFileImage(file)
  const title = getFileTitle(file)
  const downloadCount = Number(file.downloads_count || 0)

  return (
    <div className="group overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-white/[0.06] hover:shadow-[0_18px_45px_rgba(37,99,235,0.22)]">
      <div className="relative aspect-[4/2.6] overflow-hidden bg-slate-900/60">
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

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/20 to-transparent" />
      </div>

      <div className="p-4">
        <h3 className="text-sm font-bold leading-5 text-white sm:text-base sm:leading-6">
          {title}
        </h3>

        <p className="hidden">
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
  onClick,
}: {
  label: string
  value: string
  onClick?: () => void
}) {
  const isClickable = typeof onClick === "function"

  const content = (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200/75">
        {label}
      </div>
      <div className="mt-3 text-3xl font-black leading-none text-white">{value}</div>
    </>
  )

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-[24px] border border-white/10 bg-white/[0.05] px-5 py-5 text-left shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-white/[0.08]"
      >
        {content}
      </button>
    )
  }

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.05] px-5 py-5 text-left shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm">
      {content}
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
    <section className="mt-10">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
        </div>

        <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-slate-200 shadow-[0_8px_25px_rgba(0,0,0,0.18)] backdrop-blur-sm">
          {formatNumber(files.length)} item{files.length === 1 ? "" : "s"}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
            >
              <div className="aspect-[4/2.6] animate-pulse bg-white/10" />
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
        .select("id, role, membership, is_premium")
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

        <div className="mx-auto w-full max-w-[1800px] px-4 pb-6 pt-24 sm:px-6 sm:pb-8 sm:pt-28 lg:px-8">
          <section className="mt-2 rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-6 lg:p-7">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
                  Categories
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Explore premium-ready downloadable collections.
                </p>
              </div>

              <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-slate-200 shadow-[0_8px_25px_rgba(0,0,0,0.18)] backdrop-blur-sm">
                Total files: {formatNumber(totalFiles)}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                  >
                    <div className="aspect-[4/2.6] animate-pulse bg-white/10" />
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
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {categories.map((category) => {
                  const image = getCategoryImage(category)
                  const count = fileCounts[category.id] || 0

                  return (
                    <div
                      key={category.id}
                      className="group overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-white/[0.06]"
                    >
                      <div className="relative aspect-[4/2.6] overflow-hidden bg-slate-900/60">
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

            <section className="mt-10">
              <div className="rounded-[28px] border border-white/10 bg-[#061229]/70 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                  <StatCard label="Total Members" value={formatNumber(liveStats.totalUsers)} />

                  <StatCard
                    label="Online Users"
                    value={`🔥 ${formatNumber(liveStats.onlineUsers)}`}
                    onClick={
                      canToggleOnlineUsers
                        ? () => setShowOnlineMembers((prev) => !prev)
                        : undefined
                    }
                  />

                  <StatCard label="Active Today" value={formatNumber(liveStats.activeToday)} />

                  <StatCard label="New Member/s" value={formatNumber(newMembers.length)} />
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
          </section>
        </div>
      </div>
    </>
  )
}