"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  { label: "Dashboard", href: "/admin", icon: "🏠" },
  { label: "Categories", href: "/admin/categories", icon: "📂" },
  { label: "Messages", href: "/admin/messages", icon: "💬" },
  { label: "Upload Files", href: "/admin/files", icon: "📁" },
  { label: "Users", href: "/admin/users", icon: "👥" },
]

export default function AdminHeader() {
  const rawPathname = usePathname()
  const pathname = rawPathname ?? "" // ✅ FIX HERE

  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin"
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    try {
      setLoggingOut(true)
      await supabase.auth.signOut()
      router.replace("/")
      router.refresh()
    } catch (error) {
      console.error("Logout failed:", error)
    } finally {
      setLoggingOut(false)
      setMobileMenuOpen(false)
    }
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-sky-100/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-[1800px] items-center gap-3 px-4 sm:h-24 sm:px-6 lg:px-8">
          <Link
            href="/admin"
            className="group flex min-w-0 items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 sm:h-12 sm:w-12">
              <img
                src="/logo.png"
                alt="JB Collections"
                className="h-full w-full object-contain"
              />
            </div>

            <div className="min-w-0">
              <div className="truncate text-lg font-black tracking-tight text-slate-900 sm:text-xl">
                JB Collections
              </div>
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-600">
                Admin Panel
              </div>
            </div>
          </Link>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            {navItems.map((item) => {
              const active = isActive(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition ${
                    active
                      ? "bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white shadow-[0_10px_25px_rgba(37,99,235,0.28)]"
                      : "bg-white text-slate-700 ring-1 ring-slate-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900 hover:shadow-sm"
                  }`}
                >
                  <span className="text-[15px] leading-none">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="ml-1 inline-flex items-center justify-center rounded-full bg-red-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 lg:hidden"
            aria-label="Toggle admin menu"
          >
            <span className="text-lg">{mobileMenuOpen ? "✕" : "☰"}</span>
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-slate-200 bg-white/95 px-4 pb-4 pt-3 backdrop-blur-xl sm:px-6 lg:hidden">
            <div className="grid gap-2">
              {navItems.map((item) => {
                const active = isActive(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                      active
                        ? "bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white shadow-[0_10px_25px_rgba(37,99,235,0.22)]"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100"
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
                className="inline-flex items-center justify-center rounded-2xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <div className="h-20 sm:h-24" />
    </>
  )
}