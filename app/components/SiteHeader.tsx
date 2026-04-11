"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type UserProfile = {
  full_name?: string | null
  name?: string | null
  username?: string | null
  role?: string | null
  coins?: number | null
}

type FloatingCoin = {
  id: number
  left: number
  delay: number
  duration: number
  rotate: number
}

type ParticipantRow = {
  conversation_id: string
  last_read_at: string | null
}

type CoinPopupDetail = {
  amount?: number
  label?: string
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "🏠" },
  { label: "Profile", href: "/profile", icon: "👤" },
  { label: "Messages", href: "/messages", icon: "💬" },
  { label: "JB STORE", href: "/upgrade", icon: "🪙" },
]

export default function SiteHeader() {
  const rawPathname = usePathname()
  const pathname = rawPathname ?? ""

  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [coins, setCoins] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)

  const [showCoinPopup, setShowCoinPopup] = useState(false)
  const [coinPopupAmount, setCoinPopupAmount] = useState(0)
  const [coinPopupLabel, setCoinPopupLabel] = useState("JB Coins updated")
  const [burstCoins, setBurstCoins] = useState<FloatingCoin[]>([])

  const [walletAnimate, setWalletAnimate] = useState(false)
  const [walletShake, setWalletShake] = useState(false)

  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const walletPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const walletShakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearPopupTimers() {
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current)
      popupTimerRef.current = null
    }

    if (burstTimerRef.current) {
      clearTimeout(burstTimerRef.current)
      burstTimerRef.current = null
    }

    if (walletPulseTimerRef.current) {
      clearTimeout(walletPulseTimerRef.current)
      walletPulseTimerRef.current = null
    }

    if (walletShakeTimerRef.current) {
      clearTimeout(walletShakeTimerRef.current)
      walletShakeTimerRef.current = null
    }
  }

  function triggerWalletPulse() {
    setWalletAnimate(true)

    if (walletPulseTimerRef.current) {
      clearTimeout(walletPulseTimerRef.current)
    }

    walletPulseTimerRef.current = setTimeout(() => {
      setWalletAnimate(false)
    }, 700)
  }

  function triggerWalletShake() {
    setWalletShake(true)

    if (walletShakeTimerRef.current) {
      clearTimeout(walletShakeTimerRef.current)
    }

    walletShakeTimerRef.current = setTimeout(() => {
      setWalletShake(false)
    }, 550)
  }

  function createCoinBurst(amount: number) {
    const safeAmount = Math.abs(amount)
    const total = Math.min(Math.max(safeAmount + 4, 8), 18)

    const items: FloatingCoin[] = Array.from({ length: total }).map((_, index) => ({
      id: Date.now() + index,
      left: 10 + Math.random() * 80,
      delay: Math.random() * 0.18,
      duration: 1.5 + Math.random() * 0.9,
      rotate: -35 + Math.random() * 70,
    }))

    setBurstCoins(items)

    if (burstTimerRef.current) clearTimeout(burstTimerRef.current)
    burstTimerRef.current = setTimeout(() => {
      setBurstCoins([])
    }, 2600)
  }

  function showAnimatedCoinPopup(amount: number, label?: string) {
    if (amount === 0) {
      triggerWalletShake()
      return
    }

    clearPopupTimers()
    setCoinPopupAmount(amount)
    setCoinPopupLabel(label?.trim() || (amount > 0 ? "JB Coins earned" : "JB Coins spent"))
    setShowCoinPopup(true)
    createCoinBurst(amount)

    if (amount > 0) {
      triggerWalletPulse()
    } else {
      triggerWalletShake()
    }

    popupTimerRef.current = setTimeout(() => {
      setShowCoinPopup(false)
    }, 2200)
  }

  async function loadUnreadCount(userId: string) {
    try {
      const { data: participants, error: participantsError } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", userId)
        .is("deleted_at", null)

      if (participantsError) {
        throw participantsError
      }

      const participantRows = (participants as ParticipantRow[]) || []

      if (participantRows.length === 0) {
        setUnreadCount(0)
        return
      }

      let totalUnread = 0

      for (const row of participantRows) {
        const since = row.last_read_at || "1970-01-01T00:00:00.000Z"

        const { count, error: countError } = await supabase
          .from("conversation_messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", row.conversation_id)
          .is("deleted_at", null)
          .neq("sender_id", userId)
          .gt("created_at", since)

        if (countError) {
          throw countError
        }

        totalUnread += count || 0
      }

      setUnreadCount(totalUnread)
    } catch (error) {
      console.error("Failed to load unread count:", error)
      setUnreadCount(0)
    }
  }

  useEffect(() => {
    let active = true
    let currentUserId: string | null = null

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !active) return

      currentUserId = user.id

      const { data } = await supabase
        .from("profiles")
        .select("full_name, name, username, role, coins")
        .eq("id", user.id)
        .maybeSingle()

      if (active) {
        setProfile((data as UserProfile | null) || null)
        setCoins(Number(data?.coins || 0))
      }

      await loadUnreadCount(user.id)
    }

    void loadProfile()

    function handleCoinUpdate() {
      void loadProfile()
      triggerWalletPulse()
    }

    function handleDailyRewardClaimed(event: Event) {
      const customEvent = event as CustomEvent<{
        coins?: number
        label?: string
      }>
      const amount = Number(customEvent.detail?.coins || 0)
      const label = customEvent.detail?.label || "Daily reward claimed"

      void loadProfile()
      showAnimatedCoinPopup(amount, label)
    }

    function handleGenericCoinPopup(event: Event) {
      const customEvent = event as CustomEvent<CoinPopupDetail>
      const amount = Number(customEvent.detail?.amount || 0)
      const label = customEvent.detail?.label || ""

      void loadProfile()
      showAnimatedCoinPopup(amount, label)
    }

    function handleManualUnreadRefresh() {
      if (currentUserId) {
        void loadUnreadCount(currentUserId)
      }
    }

    window.addEventListener("jb-coins-updated", handleCoinUpdate)
    window.addEventListener("jb-daily-reward-claimed", handleDailyRewardClaimed as EventListener)
    window.addEventListener("jb-coins-popup", handleGenericCoinPopup as EventListener)
    window.addEventListener("jb-messages-updated", handleManualUnreadRefresh)

    const channel = supabase
      .channel("site-header-unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_messages" },
        async () => {
          if (currentUserId) {
            await loadUnreadCount(currentUserId)
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_participants" },
        async () => {
          if (currentUserId) {
            await loadUnreadCount(currentUserId)
          }
        }
      )
      .subscribe()

    return () => {
      active = false
      clearPopupTimers()
      window.removeEventListener("jb-coins-updated", handleCoinUpdate)
      window.removeEventListener("jb-daily-reward-claimed", handleDailyRewardClaimed as EventListener)
      window.removeEventListener("jb-coins-popup", handleGenericCoinPopup as EventListener)
      window.removeEventListener("jb-messages-updated", handleManualUnreadRefresh)
      void supabase.removeChannel(channel)
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

  const displayName =
    profile?.full_name?.trim() ||
    profile?.name?.trim() ||
    profile?.username?.trim() ||
    "User"

  return (
    <>
      <style jsx>{`
        @keyframes jbCoinPopupIn {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.92);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes jbCoinFly {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.7) rotate(0deg);
          }
          15% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(-170px) scale(1.15) rotate(360deg);
          }
        }

        @keyframes jbWalletPulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(251, 191, 36, 0);
          }
          45% {
            transform: scale(1.08);
            box-shadow: 0 0 28px rgba(251, 191, 36, 0.45);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(251, 191, 36, 0);
          }
        }

        @keyframes jbWalletShake {
          0%,
          100% {
            transform: translateX(0);
          }
          20% {
            transform: translateX(-5px);
          }
          40% {
            transform: translateX(5px);
          }
          60% {
            transform: translateX(-4px);
          }
          80% {
            transform: translateX(4px);
          }
        }

        .jb-coin-popup-in {
          animation: jbCoinPopupIn 0.28s ease-out;
        }

        .jb-wallet-pulse {
          animation: jbWalletPulse 0.7s ease-out;
        }

        .jb-wallet-shake {
          animation: jbWalletShake 0.55s ease-in-out;
        }
      `}</style>

      <header className="fixed inset-x-0 top-0 z-50 bg-transparent px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="mx-auto w-full max-w-[1800px] overflow-hidden rounded-[24px] bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 shadow-[0_12px_30px_rgba(37,99,235,0.22)]">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <Link href="/dashboard" className="flex items-center gap-3">
              <img
                src="/jb-logo.png"
                alt="JB Collections"
                className="h-10 w-10 object-contain"
              />
              <div className="whitespace-nowrap text-[18px] font-black tracking-[0.15em] text-white sm:text-[20px] lg:text-[22px]">
                JB COLLECTIONS
              </div>
            </Link>

            <div
              className={`hidden items-center gap-2 rounded-full border border-white/20 bg-black/30 px-4 py-2 transition lg:flex ${
                walletAnimate ? "jb-wallet-pulse" : ""
              } ${walletShake ? "jb-wallet-shake" : ""}`}
              title={`${displayName} • ${coins.toLocaleString()} JB Coins`}
            >
              <img src="/jb-coin.png" alt="JB Coin" className="h-5 w-5 object-contain" />
              <span className="text-sm font-bold text-yellow-300">
                {coins.toLocaleString()} JB
              </span>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] border border-white/20 bg-white/10 text-2xl text-white backdrop-blur md:hidden"
            >
              ☰
            </button>

            <div className="hidden items-center gap-2 lg:flex">
              {navItems.map((item) => {
                const active = isActive(item.href)
                const isMessages = item.href === "/messages"

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                      active
                        ? "bg-white text-blue-700 shadow-sm"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>

                    {isMessages && unreadCount > 0 && (
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-[0_4px_14px_rgba(239,68,68,0.45)]">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                )
              })}

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex items-center rounded-full bg-red-500 px-5 py-2 text-xs font-bold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loggingOut ? "..." : "Logout"}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="border-t border-white/15 px-4 pb-4 pt-3 lg:hidden">
              <div className="grid gap-2">
                <div
                  className={`flex items-center gap-2 rounded-xl bg-black/30 px-4 py-2 font-bold text-yellow-300 transition ${
                    walletAnimate ? "jb-wallet-pulse" : ""
                  } ${walletShake ? "jb-wallet-shake" : ""}`}
                >
                  <img src="/jb-coin.png" alt="JB Coin" className="h-5 w-5 object-contain" />
                  {coins.toLocaleString()} JB Coins
                </div>

                {navItems.map((item) => {
                  const isMessages = item.href === "/messages"

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white"
                    >
                      <span>
                        {item.icon} {item.label}
                      </span>

                      {isMessages && unreadCount > 0 && (
                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-[0_4px_14px_rgba(239,68,68,0.45)]">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </Link>
                  )
                })}

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

      {showCoinPopup ? (
        <div className="pointer-events-none fixed inset-0 z-[215] flex items-start justify-center pt-24 sm:pt-28">
          <div className="jb-coin-popup-in rounded-full border border-amber-300/40 bg-slate-950/90 px-5 py-3 text-center shadow-2xl backdrop-blur-md">
            <img
              src="/jb-coin.png"
              alt="JB Coin"
              className="mx-auto h-10 w-10 object-contain"
            />
            <div
              className={`mt-1 text-sm font-bold ${
                coinPopupAmount >= 0 ? "text-amber-300" : "text-red-300"
              }`}
            >
              {coinPopupAmount > 0 ? "+" : ""}
              {coinPopupAmount} JB Coins
            </div>
            <div className="mt-1 text-[11px] font-semibold text-white/70">
              {coinPopupLabel}
            </div>
          </div>
        </div>
      ) : null}

      {burstCoins.map((coin) => (
        <div
          key={coin.id}
          className="pointer-events-none fixed left-0 right-0 top-28 z-[214]"
          style={{
            left: `${coin.left}%`,
            animationName: "jbCoinFly",
            animationDuration: `${coin.duration}s`,
            animationDelay: `${coin.delay}s`,
            animationTimingFunction: "ease-out",
            animationFillMode: "forwards",
            transform: `rotate(${coin.rotate}deg)`,
          }}
        >
          <img
            src="/jb-coin.png"
            alt="JB Coin"
            className="h-8 w-8 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]"
          />
        </div>
      ))}
    </>
  )
}