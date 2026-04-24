"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type UserProfile = {
  id?: string | null
  full_name?: string | null
  name?: string | null
  username?: string | null
  role?: string | null
  coins?: number | null
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "🏠" },
  { label: "Profile", href: "/profile", icon: "👤" },
  { label: "Messages", href: "/messages", icon: "💬" },
  { label: "JB STORE", href: "/upgrade", icon: "🪙" },
]

function toSafeNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function SiteHeader() {
  const pathname = usePathname() ?? ""
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [coins, setCoins] = useState(0)
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const currentUserIdRef = useRef<string | null>(null)

  const isAdmin = String(profile?.role || "").toLowerCase() === "admin"

  const visibleNavItems = navItems.filter((item) => {
    if (item.href === "/messages") return isAdmin || messagesOpen
    return true
  })

  async function loadSettings() {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("key", "messages_open")
      .maybeSingle()

    setMessagesOpen(data?.value === "true")
  }

  async function refreshWallet() {
    const userId = currentUserIdRef.current
    if (!userId) return

    const { data } = await supabase
      .from("profiles")
      .select("coins")
      .eq("id", userId)
      .maybeSingle()

    setCoins(toSafeNumber(data?.coins))
  }

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      currentUserIdRef.current = user.id

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      setProfile(data as UserProfile)

      await Promise.all([refreshWallet(), loadSettings()])
    }

    void init()
  }, [])

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace("/login")
    setMobileMenuOpen(false)
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="mx-auto w-full max-w-[1800px] overflow-hidden rounded-[24px] border border-white/15 bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 shadow-[0_14px_34px_rgba(37,99,235,0.22)] backdrop-blur-xl">
          <div className="flex min-h-[68px] items-center gap-3 px-4 py-2 sm:px-5 lg:px-6">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-3 pr-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15 backdrop-blur">
                <img
                  src="/jb-logo.png"
                  alt="JB Collections"
                  className="h-7 w-7 object-contain"
                />
              </div>

              <div className="min-w-0">
                <div className="truncate text-[15px] font-black tracking-[0.12em] text-white sm:text-[17px] lg:text-[18px]">
                  JB COLLECTIONS
                </div>
                <div className="hidden text-[9px] font-bold uppercase tracking-[0.28em] text-cyan-100/80 sm:block">
                  Premium Access Hub
                </div>
              </div>
            </Link>

            <nav className="ml-2 hidden items-center gap-2 lg:flex">
              {visibleNavItems.map((item) => {
                const active = isActive(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold transition ${
                      active
                        ? "bg-white text-blue-700 shadow-[0_10px_24px_rgba(255,255,255,0.22)]"
                        : "bg-white/10 text-white hover:bg-white/18"
                    }`}
                  >
                    <span className="text-[15px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            <div className="ml-auto hidden items-center gap-2 lg:flex">
              <div className="min-w-[150px] rounded-full border border-white/20 bg-black/30 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <img src="/jb-coin.png" alt="JB Coin" className="h-4 w-4 object-contain" />
                  <div className="min-w-0">
                    <div className="truncate text-[9px] font-bold uppercase tracking-[0.2em] text-white/65">
                      JB Wallet
                    </div>
                    <div className="truncate text-sm font-black text-yellow-300">
                      {coins.toLocaleString()} JB
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="inline-flex h-10 items-center rounded-full border border-red-300/20 bg-red-500 px-4 text-xs font-bold text-white transition hover:bg-red-600"
              >
                Logout
              </button>
            </div>

            <div className="ml-auto flex items-center gap-2 lg:hidden">
              <div className="rounded-full border border-white/20 bg-black/25 px-3 py-2 text-xs font-black text-yellow-300">
                {coins.toLocaleString()} JB
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-2xl font-black text-white transition hover:bg-white/20"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? "×" : "☰"}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="border-t border-white/15 bg-slate-950/20 px-4 pb-4 pt-3 lg:hidden">
              <div className="grid gap-2">
                {visibleNavItems.map((item) => {
                  const active = isActive(item.href)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${
                        active
                          ? "bg-white text-blue-700"
                          : "bg-white/10 text-white hover:bg-white/20"
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
                  className="mt-1 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white transition hover:bg-red-600"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="h-[92px] sm:h-[104px]" />
    </>
  )
}