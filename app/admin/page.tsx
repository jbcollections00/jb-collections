"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type DashboardStat = {
  totalUsers: number
  totalCategories: number
  totalFiles: number
  totalMessages: number
  pendingCoinPurchases: number
}

type QuickAction = {
  title: string
  description: string
  href: string
  icon: string
  tone: string
}

const quickActions: QuickAction[] = [
  {
    title: "Manage Categories",
    description: "Create, edit, and organize your content sections.",
    href: "/admin/categories",
    icon: "📂",
    tone: "from-sky-500 to-blue-600",
  },
  {
    title: "Coin Purchases",
    description: "Approve or monitor JB Coin purchase activity.",
    href: "/admin/coin-purchases",
    icon: "🪙",
    tone: "from-amber-500 to-orange-600",
  },
  {
    title: "Announcements",
    description: "Send and view global announcements and support chat.",
    href: "/admin/messages",
    icon: "📢",
    tone: "from-violet-500 to-fuchsia-600",
  },
  {
    title: "Upload Files",
    description: "Add new downloadable content to your site.",
    href: "/admin/files",
    icon: "📁",
    tone: "from-cyan-500 to-indigo-600",
  },
  {
    title: "Manage Users",
    description: "View accounts, roles, and user activity.",
    href: "/admin/users",
    icon: "👥",
    tone: "from-rose-500 to-pink-600",
  },
]

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string
  icon: string
  accent: string
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
            {label}
          </div>
          <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</div>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-xl text-white shadow-md`}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}

function PanelCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-black tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

export default function AdminDashboardPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [adminName, setAdminName] = useState("Admin")
  const [stats, setStats] = useState<DashboardStat>({
    totalUsers: 0,
    totalCategories: 0,
    totalFiles: 0,
    totalMessages: 0,
    pendingCoinPurchases: 0,
  })

  useEffect(() => {
    void loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      setCheckingAuth(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace("/login")
        return
      }

      const [
        profileResult,
        usersResult,
        categoriesResult,
        filesResult,
        messagesResult,
        coinPurchasesResult,
      ] = await Promise.all([
        supabase.from("profiles").select("full_name, name, username").eq("id", user.id).maybeSingle(),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("categories").select("id", { count: "exact", head: true }),
        supabase.from("files").select("id", { count: "exact", head: true }),
        supabase.from("conversation_messages").select("id", { count: "exact", head: true }),
        supabase
          .from("coin_purchases")
          .select("id, status", { count: "exact" }),
      ])

      const profile = profileResult.data as
        | { full_name?: string | null; name?: string | null; username?: string | null }
        | null

      setAdminName(
        profile?.full_name?.trim() ||
          profile?.name?.trim() ||
          profile?.username?.trim() ||
          "Admin"
      )

      const coinRows = Array.isArray(coinPurchasesResult.data) ? coinPurchasesResult.data : []

      setStats({
        totalUsers: usersResult.count || 0,
        totalCategories: categoriesResult.count || 0,
        totalFiles: filesResult.count || 0,
        totalMessages: messagesResult.count || 0,
        pendingCoinPurchases: coinRows.filter(
          (row) => !row.status || String(row.status).toLowerCase() === "pending"
        ).length,
      })
    } catch (error) {
      console.error("Failed to load admin dashboard:", error)
    } finally {
      setCheckingAuth(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-800">Loading admin control center...</p>
          <p className="mt-2 text-sm text-slate-500">Please wait.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <section className="mb-8 overflow-hidden rounded-[30px] border border-slate-200 bg-[#04122b] shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.34),transparent_32%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.34),transparent_28%),linear-gradient(135deg,#071533_0%,#020817_48%,#071a4a_100%)]" />

            <div className="relative px-5 py-7 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
              <div>
                <div className="inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-200 shadow-[0_8px_24px_rgba(6,182,212,0.18)]">
                  Admin Control Center
                </div>

                <h1 className="mt-6 max-w-5xl text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Welcome back,{" "}
                  <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 bg-clip-text text-transparent">
                    {adminName}
                  </span>
                </h1>

                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
                  Manage categories, files, coin purchases, announcements, and users from one premium command center.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/admin/coin-purchases"
                    className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(245,158,11,0.28)] transition hover:scale-[1.02]"
                  >
                    Check Coin Purchases
                  </Link>

                  <Link
                    href="/admin/users"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)] backdrop-blur transition hover:bg-white/15"
                  >
                    Manage Users
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stat Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Total Users"
            value={formatNumber(stats.totalUsers)}
            icon="👥"
            accent="from-sky-500 to-blue-600"
          />
          <StatCard
            label="Categories"
            value={formatNumber(stats.totalCategories)}
            icon="📂"
            accent="from-indigo-500 to-violet-600"
          />
          <StatCard
            label="Total Files"
            value={formatNumber(stats.totalFiles)}
            icon="📁"
            accent="from-cyan-500 to-teal-600"
          />
          <StatCard
            label="Messages"
            value={formatNumber(stats.totalMessages)}
            icon="💬"
            accent="from-fuchsia-500 to-pink-600"
          />
          <StatCard
            label="Pending Coin Buys"
            value={formatNumber(stats.pendingCoinPurchases)}
            icon="🪙"
            accent="from-amber-500 to-orange-600"
          />
        </section>

        <div className="mt-8">
          <PanelCard
            title="Quick Actions"
            subtitle="Open the most important admin pages faster."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${action.tone} text-xl text-white shadow`}
                  >
                    {action.icon}
                  </div>

                  <h3 className="mt-4 text-lg font-black tracking-tight text-slate-950">
                    {action.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{action.description}</p>

                  <div className="mt-4 text-sm font-bold text-blue-600 transition group-hover:translate-x-1">
                    Open page →
                  </div>
                </Link>
              ))}
            </div>
          </PanelCard>
        </div>
      </div>
    </div>
  )
}