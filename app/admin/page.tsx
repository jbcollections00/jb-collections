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
  href: string
  icon: string
  tone: string
}

const quickActions: QuickAction[] = [
  {
    title: "Categories",
    href: "/admin/categories",
    icon: "📂",
    tone: "from-sky-500 to-blue-600",
  },
  {
    title: "Coin Purchases",
    href: "/admin/coin-purchases",
    icon: "🪙",
    tone: "from-amber-500 to-orange-600",
  },
  {
    title: "Announcements",
    href: "/admin/messages",
    icon: "📢",
    tone: "from-violet-500 to-fuchsia-600",
  },
  {
    title: "Upload Files",
    href: "/admin/files",
    icon: "📁",
    tone: "from-cyan-500 to-indigo-600",
  },
  {
    title: "Manage Users",
    href: "/admin/users",
    icon: "👥",
    tone: "from-rose-500 to-pink-600",
  },
]

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

export default function AdminDashboardPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [checkingAuth, setCheckingAuth] = useState(true)
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
        usersResult,
        categoriesResult,
        filesResult,
        messagesResult,
        coinPurchasesResult,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("categories").select("id", { count: "exact", head: true }),
        supabase.from("files").select("id", { count: "exact", head: true }),
        supabase.from("conversation_messages").select("id", { count: "exact", head: true }),
        supabase.from("coin_purchases").select("id, status", { count: "exact" }),
      ])

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
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Loading admin control center...</p>
        </div>
      </div>
    )
  }

  // Visual Bar Chart metrics setup
  const chartItems = [
    { label: "Total Users", value: stats.totalUsers, icon: "👥", gradient: "from-sky-500 to-blue-600" },
    { label: "Total Files", value: stats.totalFiles, icon: "📁", gradient: "from-cyan-500 to-teal-600" },
    { label: "Messages", value: stats.totalMessages, icon: "💬", gradient: "from-fuchsia-500 to-pink-600" },
    { label: "Categories", value: stats.totalCategories, icon: "📂", gradient: "from-indigo-500 to-violet-600" },
    { label: "Pending Coins", value: stats.pendingCoinPurchases, icon: "🪙", gradient: "from-amber-500 to-orange-600" },
  ]

  const maxVal = Math.max(...chartItems.map((i) => i.value), 10)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-[1600px] space-y-5 px-3 py-2 sm:px-4">
        {/* Compact Banner */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#04122b] p-4 shadow-md sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="inline-block rounded-md bg-cyan-500/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 border border-cyan-500/20">
                Admin Control Center
              </span>
              <h1 className="mt-1.5 text-xl font-black text-white sm:text-2xl">
                Welcome back,{" "}
                <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 bg-clip-text text-transparent">
                  Admin
                </span>
              </h1>
            </div>
          </div>
        </section>

        {/* System Analytics Bar Chart Section */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900">System Overview & Analytics</h2>
              <p className="text-xs text-slate-500">Live statistics chart representation</p>
            </div>
            <div className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              Real-time Data
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="mt-2 grid grid-cols-5 items-end gap-2 sm:gap-4 h-48 border-b border-slate-200 pb-4 pt-6 px-2">
            {chartItems.map((item) => {
              const heightPercent = Math.max((item.value / maxVal) * 100, 12)
              return (
                <div key={item.label} className="group relative flex h-full flex-col items-center justify-end">
                  {/* Hover Tooltip / Value Badge */}
                  <div className="mb-2 rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-black text-white shadow opacity-90 transition group-hover:scale-110">
                    {formatNumber(item.value)}
                  </div>
                  {/* Visual Bar */}
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full max-w-[50px] rounded-t-xl bg-gradient-to-t ${item.gradient} shadow-sm transition-all duration-500 group-hover:brightness-110`}
                  />
                </div>
              )
            })}
          </div>

          {/* Chart X-Axis Labels */}
          <div className="grid grid-cols-5 gap-2 sm:gap-4 pt-3 text-center">
            {chartItems.map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1">
                <span className="text-lg">{item.icon}</span>
                <span className="text-[11px] font-bold text-slate-600 truncate max-w-full">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Actions (Simplified: Big Icon + Title Only) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 text-base font-black text-slate-900">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-center transition-all hover:-translate-y-1 hover:border-cyan-500/40 hover:bg-white hover:shadow-md"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${action.tone} text-2xl text-white shadow-md`}
                >
                  {action.icon}
                </div>
                <h3 className="mt-2.5 text-xs font-black tracking-tight text-slate-900">
                  {action.title}
                </h3>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}