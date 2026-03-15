"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

const ADMIN_LOGIN_PATH = "/secure-admin-portal-7X9"

const navItems = [
  { label: "Dashboard", href: "/admin", icon: "🏠" },
  { label: "Categories", href: "/admin/categories", icon: "📂" },
  { label: "Files", href: "/admin/files", icon: "📁" },
  { label: "Messages", href: "/admin/messages", icon: "💬" },
  { label: "Upgrades", href: "/admin/upgrades", icon: "⬆️" },
  { label: "Users", href: "/admin/users", icon: "👥" },
]

export default function AdminHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin"
    return pathname?.startsWith(href)
  }

  async function handleLogout() {
    try {
      setLoggingOut(true)

      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error("Logout error:", error)
        return
      }

      router.replace(ADMIN_LOGIN_PATH)
      router.refresh()
    } catch (error) {
      console.error("Logout failed:", error)
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="mb-6 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:mb-8 sm:rounded-[30px] sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin"
          className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl"
        >
          ADMIN PANEL
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-300 bg-white text-xl text-slate-700 lg:hidden"
          aria-label="Toggle admin menu"
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      <div className="mt-5 hidden flex-wrap items-center gap-3 lg:flex">
        {navItems.map((item) => {
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[20px] px-6 text-sm font-bold transition ${
                active
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                  : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex min-h-[56px] items-center justify-center rounded-[20px] bg-red-500 px-6 text-sm font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:hidden">
          {navItems.map((item) => {
            const active = isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[20px] px-5 text-sm font-bold transition ${
                  active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex min-h-[56px] items-center justify-center rounded-[20px] bg-red-500 px-5 text-sm font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      )}
    </div>
  )
}