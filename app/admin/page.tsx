"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Users,
  FileText,
  Inbox,
  FolderTree,
  Coins,
  Megaphone,
  Upload,
  UserCheck,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Stats = {
  totalUsers: number
  totalFiles: number
  supportQueries: number
  totalCategories: number
  pendingCoins: number
}

export default function AdminDashboardPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalFiles: 0,
    supportQueries: 0,
    totalCategories: 0,
    pendingCoins: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const [
          { count: usersCount },
          { count: filesCount },
          { count: queriesCount },
          { count: categoriesCount },
          { count: pendingCoinsCount },
        ] = await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("files").select("*", { count: "exact", head: true }),
          supabase.from("queries").select("*", { count: "exact", head: true }),
          supabase.from("categories").select("*", { count: "exact", head: true }),
          supabase
            .from("coin_purchase_orders")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending"),
        ])

        setStats({
          totalUsers: usersCount ?? 0,
          totalFiles: filesCount ?? 0,
          supportQueries: queriesCount ?? 0, // Zero if no query records exist
          totalCategories: categoriesCount ?? 0,
          pendingCoins: pendingCoinsCount ?? 0,
        })
      } catch (error) {
        console.error("Error loading dashboard stats:", error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [supabase])

  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "from-blue-600 to-blue-400",
    },
    {
      label: "Total Files",
      value: stats.totalFiles,
      icon: FileText,
      color: "from-cyan-600 to-teal-400",
    },
    {
      label: "Support Inbox",
      value: stats.supportQueries,
      icon: Inbox,
      color: "from-fuchsia-600 to-pink-500",
    },
    {
      label: "Categories",
      value: stats.totalCategories,
      icon: FolderTree,
      color: "from-purple-600 to-indigo-500",
    },
    {
      label: "Pending Coins",
      value: stats.pendingCoins,
      icon: Coins,
      color: "from-amber-500 to-orange-400",
    },
  ]

  const quickActions = [
    {
      label: "Categories",
      href: "/admin/categories",
      icon: FolderTree,
      bgColor: "bg-blue-500",
    },
    {
      label: "Coin Purchases",
      href: "/admin/coin-purchases",
      icon: Coins,
      bgColor: "bg-amber-500",
    },
    {
      label: "Announcements",
      href: "/admin/messages",
      icon: Megaphone,
      bgColor: "bg-purple-600",
    },
    {
      label: "Upload Files",
      href: "/admin/files",
      icon: Upload,
      bgColor: "bg-cyan-500",
    },
    {
      label: "Manage Users",
      href: "/admin/users",
      icon: UserCheck,
      bgColor: "bg-pink-600",
    },
  ]

  // Highest value calculation for relative bar graph height
  const maxStatValue = Math.max(...statCards.map((s) => s.value), 1)

  return (
    <div className="space-y-6 text-white">
      {/* System Overview & Analytics */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between pb-6">
          <div>
            <h2 className="text-xl font-black text-white">
              System Overview & Analytics
            </h2>
            <p className="text-xs text-slate-400">
              Live statistics chart representation
            </p>
          </div>
          <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-300 border border-slate-700">
            Real-time Data
          </span>
        </div>

        {/* Bar Chart Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 items-end pt-8">
          {statCards.map((card) => {
            const Icon = card.icon
            const barHeightPercent = Math.max(
              (card.value / maxStatValue) * 100,
              12
            )

            return (
              <div
                key={card.label}
                className="flex flex-col items-center gap-3 group"
              >
                {/* Number Badge */}
                <span className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-black text-white border border-slate-700 shadow-md">
                  {loading ? "..." : card.value}
                </span>

                {/* Vertical Bar Representation */}
                <div className="flex h-36 w-full items-end justify-center rounded-2xl bg-slate-800/40 p-2">
                  <div
                    style={{ height: `${barHeightPercent}%` }}
                    className={`w-full max-w-[56px] rounded-xl bg-gradient-to-t ${card.color} shadow-lg transition-all duration-500 group-hover:brightness-110`}
                  />
                </div>

                {/* Icon & Label */}
                <div className="flex flex-col items-center text-center">
                  <Icon size={18} className="text-slate-400 mb-1" />
                  <span className="text-xs font-bold text-slate-300">
                    {card.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur">
        <h3 className="text-base font-black text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.label}
                href={action.href}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 transition-all hover:border-slate-700 hover:bg-slate-800/50 hover:scale-[1.02]"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${action.bgColor} text-white shadow-md`}
                >
                  <Icon size={22} />
                </div>
                <span className="text-xs font-bold text-white">
                  {action.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}