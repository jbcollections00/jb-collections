"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type UserProfile = {
  full_name?: string | null
  name?: string | null
  username?: string | null
  role?: string | null
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "🏠" },
  { label: "Profile", href: "/profile", icon: "👤" },
  { label: "Messages", href: "/messages", icon: "💬" },
]

export default function SiteHeader() {
  const rawPathname = usePathname()
  const pathname = rawPathname ?? "" // ✅ FIX HERE

  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    let active = true

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !active) return

      const { data } = await supabase
        .from("profiles")
        .select("full_name, name, username, role")
        .eq("id", user.id)
        .maybeSingle()

      if (active) {
        setProfile((data as UserProfile | null) || null)
      }
    }

    loadProfile()

    return () => {
      active = false
    }
  }, [supabase])

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  async function handleLogout() {
    try {
      setLoggingOut(true)
      await supabase.auth.signOut()
      router.replace("/login")
      router.refresh()
    } catch (error) {
      console.error("Logout failed:", error)
      router.replace("/login")
    } finally {
      setLoggingOut(false)
      setMobileMenuOpen(false)
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-transparent px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="mx-auto w-full max-w-[1800px] overflow-hidden rounded-[24px] bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 shadow-[0_12px_30px_rgba(37,99,235,0.22)]">
        
        {/* HEADER CONTENT */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">

          {/* LEFT */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <img
              src="/jb-logo.png"
              alt="JB Collections"
              className="h-10 w-10 object-contain"
            />
            <div className="text-[18px] font-black tracking-[0.15em] text-white sm:text-[20px] lg:text-[22px] whitespace-nowrap">
              JB COLLECTIONS
            </div>
          </Link>

          {/* MOBILE BUTTON */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] border border-white/20 bg-white/10 text-2xl text-white backdrop-blur md:hidden"
          >
            ☰
          </button>

          {/* NAV */}
          <div className="hidden items-center gap-2 lg:flex">
            {navItems.map((item) => {
              const active = isActive(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                    active
                      ? "bg-white text-blue-700 shadow-sm"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center rounded-full bg-red-500 px-5 py-2 text-xs font-bold text-white hover:bg-red-600"
            >
              {loggingOut ? "..." : "Logout"}
            </button>
          </div>
        </div>

        {/* MOBILE MENU */}
        {mobileMenuOpen && (
          <div className="border-t border-white/15 px-4 pb-4 pt-3 lg:hidden">
            <div className="grid gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white"
                >
                  {item.icon} {item.label}
                </Link>
              ))}

              <button
                onClick={handleLogout}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}