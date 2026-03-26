"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  function isActive(href: string) {
    return pathname === href
  }

  function getNavClass(href: string) {
    return `inline-flex items-center justify-center rounded-2xl px-5 py-2 text-sm font-semibold shadow-sm transition ${
      isActive(href)
        ? "bg-white text-sky-700"
        : "bg-blue-600 text-white hover:bg-blue-700"
    }`
  }

  async function handleLogout() {
    try {
      setLoggingOut(true)

      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error("Logout error:", error)
        alert("Failed to log out.")
        return
      }

      router.replace("/login")
      router.refresh()
    } catch (error) {
      console.error("Logout failed:", error)
      alert("Failed to log out.")
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 text-white shadow-sm">
      <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-3 text-white">
          <img
            src="/logo.png"
            alt="JB Collections"
            className="h-8 w-8 object-contain"
          />
          <span className="text-sm font-black uppercase tracking-[0.22em] sm:text-base">
            JB COLLECTIONS
          </span>
        </Link>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/dashboard" className={getNavClass("/dashboard")}>
            Dashboard
          </Link>

          <Link href="/profile" className={getNavClass("/profile")}>
            👤 Profile
          </Link>

          <Link href="/contact" className={getNavClass("/contact")}>
            💬 Messages
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center justify-center rounded-2xl bg-red-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            🚪 {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-xl text-white backdrop-blur lg:hidden"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {mobileMenuOpen ? (
        <div className="border-t border-white/10 px-4 pb-4 lg:hidden">
          <div className="grid grid-cols-1 gap-3 pt-3">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={getNavClass("/dashboard")}
            >
              Dashboard
            </Link>

            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className={getNavClass("/profile")}
            >
              👤 Profile
            </Link>

            <Link
              href="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className={getNavClass("/contact")}
            >
              💬 Messages
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              🚪 {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}