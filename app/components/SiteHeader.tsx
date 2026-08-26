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
  { label: "Leaderboard", href: "/leaderboard", icon: "🏆" },
  { label: "Buy COINS", href: "/upgrade", icon: "🪙" },
  { label: "Earn Coins", href: "/earn-coins", icon: "🎯" },
  { label: "Mystery Box", href: "/mystery-box", icon: "🎁" },
  { label: "Tutorials", href: "/tutorials", icon: "📘" },
]

const STORAGE_KEY = "jb_deleted_message_ids"

function getDismissedIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

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
  const [unreadCount, setUnreadCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  const currentUserIdRef = useRef<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  async function refreshWallet() {
    const userId = currentUserIdRef.current
    if (!userId) return

    const { data } = await supabase
      .from("profiles")
      .select("coins, jb_points")
      .eq("id", userId)
      .maybeSingle()

    setCoins(
      toSafeNumber(data?.coins ?? data?.jb_points)
    )
  }

  async function checkUnreadMessages() {
    const userId = currentUserIdRef.current
    if (!userId) return

    try {
      // 1. Fetch from database (Added title, subject, body para sa deduplication)
      const { data: primaryData } = await supabase
        .from("messages")
        .select("id, is_read, user_id, title, subject, body")
        .or(`user_id.eq.${userId},user_id.is.null`)
        .order("created_at", { ascending: false })

      let allMessages = primaryData || []

      if (!allMessages.length) {
        const { data: fallbackData } = await supabase
          .from("user_messages")
          .select("id, is_read, user_id, title, subject, body")
          .or(`user_id.eq.${userId},user_id.is.null`)
          .order("created_at", { ascending: false })
        
        allMessages = fallbackData || []
      }

      // 2. Filter out dismissed items
      const dismissed = getDismissedIds()
      let validMessages = allMessages.filter(msg => !dismissed.includes(msg.id))

      // 3. Apply LocalStorage logic for global announcements
      let localReadIds: string[] = []
      if (typeof window !== "undefined") {
        try {
          localReadIds = JSON.parse(localStorage.getItem("jb_read_announcements") || "[]")
        } catch (e) {}
      }

      validMessages = validMessages.map(msg => {
        if (!msg.user_id && localReadIds.includes(msg.id)) {
          return { ...msg, is_read: true }
        }
        return msg
      })

      // 4. Exact Deduplication Logic (Kapareho ng sa Messages Page)
      const uniqueList: any[] = []
      const seen = new Set<string>()

      for (const item of validMessages) {
        const titleText = item.title || item.subject || "Announcement"
        const key = `${titleText}-${item.body}`
        if (!seen.has(key)) {
          seen.add(key)
          uniqueList.push(item)
        }
      }

      // 5. Count final unread
      const finalUnreadCount = uniqueList.filter(msg => !msg.is_read).length
      setUnreadCount(finalUnreadCount)

    } catch (err) {
      console.error("Error fetching unread count:", err)
    }
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
      await checkUnreadMessages()
    }

    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-refresh interval (Checks every 2 seconds quietly)
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (currentUserIdRef.current) {
        void checkUnreadMessages()
      }
    }, 2000)

    return () => clearInterval(intervalId)
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

              {/* Message Icon Button with Notification Badge */}
              <Link
                href="/messages"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/30 text-base text-white transition hover:bg-white/20 sm:h-10 sm:w-10 sm:text-lg"
                title="Messages"
                aria-label="Messages"
              >
                💬
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white ring-2 ring-blue-900 shadow-md">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>

              {/* Coins Wallet Box */}
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