"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import AdminHeader from "@/app/components/AdminHeader"
import { createClient } from "@/lib/supabase/client"

type StatItem = {
  label: string
  value: string
  icon: string
  color: string
}

type AdminProfile = {
  role: string | null
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
  { label: "Online Users", value: "0", icon: "🟢", color: "#059669" },
]

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [stats, setStats] = useState<StatItem[]>(defaultStats)

  useEffect(() => {
    let isMounted = true
    let refreshInterval: ReturnType<typeof setInterval> | null = null

    async function init() {
      try {
        setCheckingAdmin(true)

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

        const loadedStats = await loadStats()

        if (isMounted) {
          setStats(loadedStats)
        }

        refreshInterval = setInterval(async () => {
          const refreshedStats = await loadStats()
          if (isMounted) {
            setStats(refreshedStats)
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
          const refreshedStats = await loadStats()
          if (isMounted) {
            setStats(refreshedStats)
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
  }, [router, supabase])

  async function loadStats(): Promise<StatItem[]> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

      const [
        categoriesResult,
        filesResult,
        messagesResult,
        upgradesResult,
        usersResult,
        onlineUsersResult,
      ] = await Promise.all([
        supabase.from("categories").select("*", { count: "exact", head: true }),
        supabase.from("files").select("*", { count: "exact", head: true }),
        supabase.from("messages").select("*", { count: "exact", head: true }),
        supabase.from("upgrades").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gte("last_seen", fiveMinutesAgo),
      ])

      if (categoriesResult.error) {
        console.error("Categories count error:", categoriesResult.error.message)
      }
      if (filesResult.error) {
        console.error("Files count error:", filesResult.error.message)
      }
      if (messagesResult.error) {
        console.error("Messages count error:", messagesResult.error.message)
      }
      if (upgradesResult.error) {
        console.error("Upgrades count error:", upgradesResult.error.message)
      }
      if (usersResult.error) {
        console.error("Users count error:", usersResult.error.message)
      }
      if (onlineUsersResult.error) {
        console.error("Online users count error:", onlineUsersResult.error.message)
      }

      return [
        {
          label: "Categories",
          value: String(categoriesResult.count ?? 0),
          icon: "📂",
          color: "#2563eb",
        },
        {
          label: "Files",
          value: String(filesResult.count ?? 0),
          icon: "📁",
          color: "#0f172a",
        },
        {
          label: "Messages",
          value: String(messagesResult.count ?? 0),
          icon: "💬",
          color: "#dc2626",
        },
        {
          label: "Upgrades",
          value: String(upgradesResult.count ?? 0),
          icon: "⬆️",
          color: "#16a34a",
        },
        {
          label: "Total Users",
          value: String(usersResult.count ?? 0),
          icon: "👥",
          color: "#7c3aed",
        },
        {
          label: "Online Users",
          value: String(onlineUsersResult.count ?? 0),
          icon: "🟢",
          color: "#059669",
        },
      ]
    } catch (error) {
      console.error("Failed to load admin stats:", error)
      return defaultStats
    }
  }

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
            Manage categories, files, messages, users, and upgrade requests from one
            clean dashboard.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 lg:gap-5">
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
      </div>
    </div>
  )
}
