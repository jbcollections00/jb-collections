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
  { label: "Buy COINS", href: "/upgrade", icon: "🪙" },
  { label: "Earn Coins", href: "/earn-coins", icon: "🎯" },
  { label: "Mystery Box", href: "/mystery-box", icon: "🎁" },
  { label: "Tutorials", href: "/tutorials", icon: "📘" },
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
  const [menuOpen, setMenuOpen] = useState(false)

  const currentUserIdRef = useRef<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

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

      await refreshWallet()
    }

    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleCoinsUpdated(event: Event) {
      const customEvent = event as CustomEvent<{ reward?: number }>
      const reward = toSafeNumber(customEvent.detail?.reward)

      if (reward > 0) {
        setCoins((currentCoins) => currentCoins + reward)
      }

      void refreshWallet()
    }

    window.addEventListener("jb-coins-updated", handleCoinsUpdated)

    return () => {
      window.removeEventListener("jb-coins-updated", handleCoinsUpdated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return

      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace("/login")
    setMenuOpen(false)
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="mx-auto w-full max-w-[1800px] overflow-visible rounded-[24px] border border-white/15 bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 shadow-[0_14px_34px_rgba(37,99,235,0.22)] backdrop-blur-xl">
          <div className="flex min-h-[68px] items-center gap-3 px-4 py-2 sm:px-5 lg:px-6">
            <Link href="/dashboard" className="flex shrink-0 items-center gap-3 pr-1 sm:min-w-0 sm:pr-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15 backdrop-blur">
                <img
                  src="/jb-logo.png"
                  alt="JB Collections"
                  className="h-7 w-7 object-contain"
                />
              </div>

              <div className="hidden min-w-0 sm:block">
                <div className="truncate text-[17px] font-black tracking-[0.12em] text-white lg:text-[18px]">
                  JB COLLECTIONS
                </div>
                <div className="text-[9px] font-bold uppercase tracking-[0.28em] text-cyan-100/80">
                  Premium Access Hub
                </div>
              </div>
            </Link>

            <div className="ml-auto flex items-center gap-2">
              <div className="rounded-full border border-white/20 bg-black/30 px-3 py-1.5 sm:min-w-[150px]">
                <div className="flex items-center gap-2">
                  <img src="/jb-coin.png" alt="JB Coin" className="h-4 w-4 object-contain" />
                  <div className="min-w-0">
                    <div className="hidden truncate text-[9px] font-bold uppercase tracking-[0.2em] text-white/65 sm:block">
                      JB Wallet
                    </div>
                    <div className="truncate text-xs font-black text-yellow-300 sm:text-sm">
                      {coins.toLocaleString()} JB
                    </div>
                  </div>
                </div>
              </div>

              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 text-xs font-black text-white transition hover:bg-white/20 sm:h-11 sm:text-sm"
                  aria-label="Toggle menu"
                  aria-expanded={menuOpen}
                >
                  <span className="text-lg leading-none">{menuOpen ? "×" : "☰"}</span>
                  <span>Menu</span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-[calc(100%+12px)] w-[260px] overflow-hidden rounded-3xl border border-white/15 bg-slate-950/95 p-2 shadow-[0_22px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                    <div className="grid gap-1.5">
                      {navItems.map((item) => {
                        const active = isActive(item.href)

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${
                              active
                                ? "bg-white text-blue-700"
                                : "bg-white/10 text-white hover:bg-white/20"
                            }`}
                          >
                            <span className="text-base">{item.icon}</span>
                            <span>{item.label}</span>
                          </Link>
                        )
                      })}

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-3 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white transition hover:bg-red-600"
                      >
                        <span className="text-base">🚪</span>
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="h-[92px] sm:h-[104px]" />
    </>
  )
}