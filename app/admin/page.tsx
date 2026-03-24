"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import AdminHeader from "@/app/components/AdminHeader"
import { createClient } from "@/lib/supabase/client"

type StatItem = {
  label: string
  value: string
  icon: string
  color: string
  helper?: string
}

type AdminProfile = {
  role: string | null
}

type RecentUser = {
  id: string
  email: string | null
  full_name?: string | null
  name?: string | null
  username?: string | null
  role?: string | null
  created_at?: string | null
  last_seen?: string | null
}

type DashboardResponse = {
  categories?: number
  files?: number
  messages?: number
  upgrades?: number
  users?: number
  activeToday?: number
  onlineUsers?: number
  recentUsers?: RecentUser[]
}

const cards = [
  {
    title: "Categories",
    description: "Manage categories used for organizing files.",
    href: "/admin/categories",
    icon: "🗂️",
  },
  {
    title: "Files",
    description: "Upload and manage downloadable files.",
    href: "/admin/files",
    icon: "📁",
  },
  {
    title: "Messages",
    description: "Read contact messages and user concerns.",
    href: "/admin/messages",
    icon: "💬",
  },
  {
    title: "Upgrades",
    description: "Review premium upgrade requests.",
    href: "/admin/upgrades",
    icon: "⬆️",
  },
  {
    title: "Users",
    description: "View registered users and manage profiles.",
    href: "/admin/users",
    icon: "👥",
  },
]

const defaultStats: StatItem[] = [
  { label: "Categories", value: "0", icon: "📂", color: "#2563eb" },
  { label: "Files", value: "0", icon: "📁", color: "#0f172a" },
  { label: "Messages", value: "0", icon: "💬", color: "#dc2626" },
  { label: "Upgrades", value: "0", icon: "⬆️", color: "#16a34a" },
  { label: "Total Users", value: "0", icon: "👥", color: "#7c3aed" },
  { label: "Using Website", value: "0", icon: "🌐", color: "#ea580c" },
  { label: "Online Users", value: "0", icon: "🟢", color: "#059669" },
]

function getDisplayName(user: RecentUser) {
  return (
    user.full_name?.trim() ||
    user.name?.trim() ||
    user.username?.trim() ||
    user.email?.trim() ||
    "Unknown User"
  )
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "U"
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

function formatDate(value?: string | null) {
  if (!value) return "—"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function isUserOnline(lastSeen?: string | null) {
  if (!lastSeen) return false

  const time = new Date(lastSeen).getTime()
  if (Number.isNaN(time)) return false

  return Date.now() - time <= 5 * 60 * 1000
}

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [stats, setStats] = useState<StatItem[]>(defaultStats)
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  const loadStats = useCallback(async (): Promise<{
    stats: StatItem[]
    recentUsers: RecentUser[]
  }> => {
    try {
      const response = await fetch("/api/admin/stats", {
        method: "GET",
        cache: "no-store",
      })

      const data = (await response.json()) as DashboardResponse & {
        error?: string
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch admin stats")
      }

      return {
        stats: [
          {
            label: "Categories",
            value: String(data.categories ?? 0),
            icon: "📂",
            color: "#2563eb",
          },
          {
            label: "Files",
            value: String(data.files ?? 0),
            icon: "📁",
            color: "#0f172a",
          },
          {
            label: "Messages",
            value: String(data.messages ?? 0),
            icon: "💬",
            color: "#dc2626",
          },
          {
            label: "Upgrades",
            value: String(data.upgrades ?? 0),
            icon: "⬆️",
            color: "#16a34a",
          },
          {
            label: "Total Users",
            value: String(data.users ?? 0),
            icon: "👥",
            color: "#7c3aed",
          },
          {
            label: "Using Website",
            value: String(data.activeToday ?? 0),
            icon: "🌐",
            color: "#ea580c",
            helper: "Active within 24 hours",
          },
          {
            label: "Online Users",
            value: String(data.onlineUsers ?? 0),
            icon: "🟢",
            color: "#059669",
            helper: "Active within 5 minutes",
          },
        ],
        recentUsers: Array.isArray(data.recentUsers) ? data.recentUsers : [],
      }
    } catch (error) {
      console.error("Failed to load admin stats:", error)
      return {
        stats: defaultStats,
        recentUsers: [],
      }
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    let refreshInterval: ReturnType<typeof setInterval> | null = null

    async function init() {
      try {
        setCheckingAdmin(true)
        setLoadingRecent(true)

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          router.replace("/secure-admin-portal-7X9")
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle()

        if (profileError) {
          console.error("Failed to load admin profile:", profileError)
          router.replace("/secure-admin-portal-7X9?error=failed")
          return
        }

        const adminProfile = profile as AdminProfile | null

        if (!adminProfile || adminProfile.role !== "admin") {
          router.replace("/secure-admin-portal-7X9?error=not-admin")
          return
        }

        const loaded = await loadStats()

        if (isMounted) {
          setStats(loaded.stats)
          setRecentUsers(loaded.recentUsers)
          setLoadingRecent(false)
        }

        refreshInterval = setInterval(async () => {
          const refreshed = await loadStats()
          if (isMounted) {
            setStats(refreshed.stats)
            setRecentUsers(refreshed.recentUsers)
          }
        }, 5000)
      } catch (error) {
        console.error("Admin auth check failed:", error)
        router.replace("/secure-admin-portal-7X9?error=failed")
      } finally {
        if (isMounted) {
          setCheckingAdmin(false)
        }
      }
    }

    init()

    const channel = supabase
      .channel("admin-dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        async () => {
          const refreshed = await loadStats()
          if (isMounted) {
            setStats(refreshed.stats)
            setRecentUsers(refreshed.recentUsers)
            setLoadingRecent(false)
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
      supabase.removeChannel(channel)
    }
  }, [router, supabase, loadStats])

  if (checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#eef4ff] via-[#f8fbff] to-white px-4">
        <div className="rounded-[24px] border border-slate-200 bg-white px-8 py-6 text-center shadow-[0_12px_28px_rgba(0,0,0,0.05)]">
          <p className="text-lg font-bold text-slate-800">
            Checking admin access.
          </p>
          <p className="mt-2 text-sm text-slate-500">Please wait.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef4ff] via-[#f8fbff] to-white px-4 py-5 text-slate-900 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <AdminHeader />

        <div className="mb-6 rounded-[24px] bg-gradient-to-br from-slate-900 via-blue-900 to-blue-600 px-5 py-6 text-white shadow-[0_20px_45px_rgba(37,99,235,0.18)] sm:mb-7 sm:rounded-[28px] sm:px-7 sm:py-8 lg:mb-8 lg:px-8 lg:py-9">
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/90 sm:text-sm">
            ADMIN OVERVIEW
          </div>

          <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl lg:mt-4 lg:text-[46px]">
            Welcome to your admin workspace
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-100 sm:text-base lg:text-lg">
            Manage categories, files, messages, users, upgrade requests, and live
            user activity from one clean dashboard.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 lg:gap-5">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_12px_28px_rgba(0,0,0,0.05)] sm:rounded-[22px] sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-500">
                    {item.label}
                  </div>
                  <div
                    className="mt-2 text-3xl font-extrabold sm:text-4xl lg:text-[42px]"
                    style={{ color: item.color }}
                  >
                    {item.value}
                  </div>
                  {item.helper ? (
                    <div className="mt-2 text-xs font-medium text-slate-400">
                      {item.helper}
                    </div>
                  ) : null}
                </div>

                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-blue-50 text-3xl sm:h-[58px] sm:w-[58px]">
                  {item.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(0,0,0,0.08)]"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-blue-50 text-4xl">
                {card.icon}
              </div>

              <h2 className="mt-7 text-2xl font-extrabold text-slate-900">
                {card.title}
              </h2>

              <p className="mt-5 text-lg leading-10 text-slate-600">
                {card.description}
              </p>

              <div className="mt-8 text-xl font-extrabold text-blue-600">
                Open page →
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_28px_rgba(0,0,0,0.05)] sm:rounded-[28px] sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900">
                Recent Registered Users
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Latest users who signed up, with their current activity status.
              </p>
            </div>

            <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
              {recentUsers.length} recent user{recentUsers.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="mt-5">
            {loadingRecent ? (
              <div className="rounded-[20px] bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
                Loading recent users...
              </div>
            ) : recentUsers.length === 0 ? (
              <div className="rounded-[20px] bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
                No recent users found.
              </div>
            ) : (
              <div className="overflow-hidden rounded-[20px] border border-slate-200">
                <div className="hidden grid-cols-[1.4fr_1.2fr_1fr_0.8fr] gap-4 bg-slate-50 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500 md:grid">
                  <div>User</div>
                  <div>Email</div>
                  <div>Registered</div>
                  <div>Status</div>
                </div>

                <div className="divide-y divide-slate-200">
                  {recentUsers.map((user) => {
                    const displayName = getDisplayName(user)
                    const online = isUserOnline(user.last_seen)

                    return (
                      <div
                        key={user.id}
                        className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-5 md:grid-cols-[1.4fr_1.2fr_1fr_0.8fr] md:items-center"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-extrabold text-blue-700">
                            {getInitials(displayName)}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-extrabold text-slate-900 sm:text-base">
                              {displayName}
                            </div>
                            <div className="mt-1 text-xs font-medium text-slate-500">
                              Role: {user.role || "user"}
                            </div>
                          </div>
                        </div>

                        <div className="truncate text-sm font-medium text-slate-600">
                          {user.email || "—"}
                        </div>

                        <div className="text-sm font-medium text-slate-600">
                          {formatDate(user.created_at)}
                        </div>

                        <div>
                          {online ? (
                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
                              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-600">
                              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                              Offline
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}