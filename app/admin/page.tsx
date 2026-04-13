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
  pendingUpgrades: number
  pendingCoinPurchases: number
}

type RecentItem = {
  id: string
  label: string
  sublabel: string
  href: string
}

type QuickAction = {
  title: string
  description: string
  href: string
  icon: string
  tone: string
}

type BasicStatusRow = {
  id: string
  full_name?: string | null
  created_at?: string | null
  status?: string | null
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
    title: "Review Payments",
    description: "Check upgrade requests and payment submissions.",
    href: "/admin/upgrades",
    icon: "💰",
    tone: "from-emerald-500 to-teal-600",
  },
  {
    title: "Coin Purchases",
    description: "Approve or monitor JB Coin purchase activity.",
    href: "/admin/coin-purchases",
    icon: "🪙",
    tone: "from-amber-500 to-orange-600",
  },
  {
    title: "Open Messages",
    description: "Jump into admin conversations and support chat.",
    href: "/admin/messages",
    icon: "💬",
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

function formatDate(value?: string | null) {
  if (!value) return "Recently"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently"
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function isPendingStatus(status?: string | null) {
  const value = String(status || "").trim().toLowerCase()
  return value === "" || value === "pending"
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

  const [loading, setLoading] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [adminName, setAdminName] = useState("Admin")
  const [stats, setStats] = useState<DashboardStat>({
    totalUsers: 0,
    totalCategories: 0,
    totalFiles: 0,
    totalMessages: 0,
    pendingUpgrades: 0,
    pendingCoinPurchases: 0,
  })
  const [recentRows, setRecentRows] = useState<RecentItem[]>([])

  useEffect(() => {
    void loadDashboard()
  }, [])

  async function loadDashboard() {
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

      const [
        profileResult,
        usersResult,
        categoriesResult,
        filesResult,
        messagesResult,
        upgradesResult,
        coinPurchasesResult,
      ] = await Promise.all([
        supabase.from("profiles").select("full_name, name, username").eq("id", user.id).maybeSingle(),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("categories").select("id", { count: "exact", head: true }),
        supabase.from("files").select("id", { count: "exact", head: true }),
        supabase.from("conversation_messages").select("id", { count: "exact", head: true }),
        supabase
          .from("upgrades")
          .select("id, full_name, created_at, status", { count: "exact" })
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("coin_purchases")
          .select("id, full_name, created_at, status", { count: "exact" })
          .order("created_at", { ascending: false })
          .limit(5),
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

      const upgradeRows = (Array.isArray(upgradesResult.data) ? upgradesResult.data : []) as BasicStatusRow[]
      const coinRows = (Array.isArray(coinPurchasesResult.data) ? coinPurchasesResult.data : []) as BasicStatusRow[]

      setStats({
        totalUsers: usersResult.count || 0,
        totalCategories: categoriesResult.count || 0,
        totalFiles: filesResult.count || 0,
        totalMessages: messagesResult.count || 0,
        pendingUpgrades: upgradeRows.filter((row) => isPendingStatus(row.status)).length,
        pendingCoinPurchases: coinRows.filter((row) => isPendingStatus(row.status)).length,
      })

      const recentUpgradeItems: RecentItem[] = upgradeRows.slice(0, 3).map((row) => ({
        id: `upgrade-${row.id}`,
        label: row.full_name?.trim() || "Upgrade Request",
        sublabel: `${isPendingStatus(row.status) ? "Pending" : row.status || "Updated"} • ${formatDate(row.created_at)}`,
        href: "/admin/upgrades",
      }))

      const recentCoinItems: RecentItem[] = coinRows.slice(0, 3).map((row) => ({
        id: `coin-${row.id}`,
        label: row.full_name?.trim() || "Coin Purchase",
        sublabel: `${isPendingStatus(row.status) ? "Pending" : row.status || "Updated"} • ${formatDate(row.created_at)}`,
        href: "/admin/coin-purchases",
      }))

      setRecentRows([...recentUpgradeItems, ...recentCoinItems].slice(0, 6))
    } catch (error) {
      console.error("Failed to load admin dashboard:", error)
      setStats({
        totalUsers: 0,
        totalCategories: 0,
        totalFiles: 0,
        totalMessages: 0,
        pendingUpgrades: 0,
        pendingCoinPurchases: 0,
      })
      setRecentRows([])
    } finally {
      setCheckingAuth(false)
      setLoading(false)
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
            <div className="absolute inset-y-0 right-0 w-[42%] bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.20),transparent_62%)]" />

            <div className="relative px-5 py-7 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
              <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_420px] xl:items-center">
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
                    Manage categories, files, payments, coin purchases, messages, and users from one premium
                    command center.
                  </p>

                  <div className="mt-7 flex flex-wrap gap-3">
                    <Link
                      href="/admin/upgrades"
                      className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(59,130,246,0.28)] transition hover:scale-[1.02]"
                    >
                      Review Payments
                    </Link>

                    <Link
                      href="/admin/coin-purchases"
                      className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)] backdrop-blur transition hover:bg-white/15"
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-[24px] border border-white/12 bg-white/10 px-5 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.18)] backdrop-blur-md">
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-100/75">
                      Total Users
                    </div>
                    <div className="mt-3 text-3xl font-black text-white sm:text-4xl">
                      {formatNumber(stats.totalUsers)}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/12 bg-white/10 px-5 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.18)] backdrop-blur-md">
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-100/75">
                      Total Files
                    </div>
                    <div className="mt-3 text-3xl font-black text-white sm:text-4xl">
                      {formatNumber(stats.totalFiles)}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/12 bg-white/10 px-5 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.18)] backdrop-blur-md">
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-100/75">
                      Pending Payments
                    </div>
                    <div className="mt-3 text-3xl font-black text-white sm:text-4xl">
                      {formatNumber(stats.pendingUpgrades)}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/12 bg-white/10 px-5 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.18)] backdrop-blur-md">
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-100/75">
                      Pending Coin Buys
                    </div>
                    <div className="mt-3 text-3xl font-black text-white sm:text-4xl">
                      {formatNumber(stats.pendingCoinPurchases)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
            label="Pending Payments"
            value={formatNumber(stats.pendingUpgrades)}
            icon="💰"
            accent="from-emerald-500 to-green-600"
          />
          <StatCard
            label="Pending Coin Purchases"
            value={formatNumber(stats.pendingCoinPurchases)}
            icon="🪙"
            accent="from-amber-500 to-orange-600"
          />
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.25fr_0.95fr]">
          <PanelCard
            title="Quick Actions"
            subtitle="Open the most important admin pages faster."
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
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

          <PanelCard
            title="Recent Activity"
            subtitle="Latest payment and coin purchase entries."
          >
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                    <div className="mt-2 h-3 w-28 animate-pulse rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : recentRows.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm font-medium text-slate-500">
                No recent admin activity found yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentRows.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
                  >
                    <div className="text-base font-bold text-slate-950">{item.label}</div>
                    <div className="mt-1 text-sm text-slate-500">{item.sublabel}</div>
                  </Link>
                ))}
              </div>
            )}
          </PanelCard>
        </div>
      </div>
    </div>
  )
}
