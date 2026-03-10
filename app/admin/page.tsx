"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import AdminHeader from "@/app/components/AdminHeader"
import { createClient } from "@/lib/supabase/client"

type StatItem = {
  label: string
  value: string
  icon: string
  color: string
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
]

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [stats, setStats] = useState<StatItem[]>([
    { label: "Categories", value: "0", icon: "📂", color: "#2563eb" },
    { label: "Files", value: "0", icon: "📁", color: "#0f172a" },
    { label: "Messages", value: "0", icon: "💬", color: "#dc2626" },
    { label: "Upgrades", value: "0", icon: "⬆️", color: "#16a34a" },
  ])

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  async function checkAdminAndLoad() {
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
        .single()

      if (profileError || profile?.role !== "admin") {
        router.replace("/secure-admin-portal-7X9")
        return
      }

      await loadStats()
    } catch (error) {
      console.error("Admin auth check failed:", error)
      router.replace("/secure-admin-portal-7X9")
    } finally {
      setCheckingAdmin(false)
    }
  }

  async function loadStats() {
    try {
      const [
        { count: categoriesCount, error: categoriesError },
        { count: filesCount, error: filesError },
        { count: messagesCount, error: messagesError },
        { count: upgradesCount, error: upgradesError },
      ] = await Promise.all([
        supabase.from("categories").select("*", { count: "exact", head: true }),
        supabase.from("files").select("*", { count: "exact", head: true }),
        supabase.from("messages").select("*", { count: "exact", head: true }),
        supabase.from("upgrades").select("*", { count: "exact", head: true }),
      ])

      if (categoriesError) console.error("Categories count error:", categoriesError.message)
      if (filesError) console.error("Files count error:", filesError.message)
      if (messagesError) console.error("Messages count error:", messagesError.message)
      if (upgradesError) console.error("Upgrades count error:", upgradesError.message)

      setStats([
        {
          label: "Categories",
          value: String(categoriesCount ?? 0),
          icon: "📂",
          color: "#2563eb",
        },
        {
          label: "Files",
          value: String(filesCount ?? 0),
          icon: "📁",
          color: "#0f172a",
        },
        {
          label: "Messages",
          value: String(messagesCount ?? 0),
          icon: "💬",
          color: "#dc2626",
        },
        {
          label: "Upgrades",
          value: String(upgradesCount ?? 0),
          icon: "⬆️",
          color: "#16a34a",
        },
      ])
    } catch (error) {
      console.error("Failed to load admin stats:", error)
    }
  }

  if (checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#eef4ff] via-[#f8fbff] to-white px-4">
        <div className="rounded-[24px] border border-slate-200 bg-white px-8 py-6 text-center shadow-[0_12px_28px_rgba(0,0,0,0.05)]">
          <p className="text-lg font-bold text-slate-800">Checking admin access...</p>
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
            Manage categories, files, messages, and upgrade requests from one clean dashboard.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_12px_28px_rgba(0,0,0,0.05)] sm:rounded-[22px] sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-500">{item.label}</div>
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

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="block min-h-[200px] rounded-[22px] border border-slate-200 bg-white px-5 py-6 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.07)] transition hover:-translate-y-1 hover:shadow-xl sm:min-h-[220px] sm:rounded-[26px] sm:px-6 sm:py-7"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] bg-gradient-to-br from-blue-50 to-blue-100 text-3xl sm:mb-5 sm:h-[72px] sm:w-[72px] sm:rounded-[20px] sm:text-[34px]">
                {card.icon}
              </div>

              <h2 className="text-2xl font-extrabold sm:text-[30px]">{card.title}</h2>

              <p className="mt-3 text-sm leading-7 text-slate-500 sm:text-base">
                {card.description}
              </p>

              <div className="mt-5 text-sm font-bold text-blue-600 sm:mt-6 sm:text-[15px]">
                Open page →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}