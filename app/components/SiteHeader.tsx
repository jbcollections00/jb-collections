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

type WalletSummaryResponse = {
  ok?: boolean
  summary?: {
    balance?: number | string | null
    pendingCoins?: number | string | null
    lifetimePurchased?: number | string | null
  }
  balance?: number | string | null
}

type ProfileCoinsResponse = {
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

function toSafeNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

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
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const currentCoinsRef = useRef(0)

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

  async function refreshWalletSummary(showPopupForIncrease = false) {
    try {
      const currentUserId = currentUserIdRef.current

      if (!currentUserId) return

      let nextBalance = 0

      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("coins")
        .eq("id", currentUserId)
        .maybeSingle()

      if (!profileError && profileRow) {
        nextBalance = toSafeNumber((profileRow as ProfileCoinsResponse).coins)
      } else {
        const res = await fetch("/api/wallet/summary", {
          method: "GET",
          cache: "no-store",
        })

        const data = (await res.json().catch(() => null)) as WalletSummaryResponse | null

        if (!res.ok) {
          throw new Error("Failed to load wallet summary.")
        }

        nextBalance = toSafeNumber(data?.summary?.balance ?? data?.balance)
      }

      const previousBalance = currentCoinsRef.current

      setCoins(nextBalance)
      currentCoinsRef.current = nextBalance
      setProfile((prev) => (prev ? { ...prev, coins: nextBalance } : prev))

      if (showPopupForIncrease && nextBalance > previousBalance) {
        showAnimatedCoinPopup(nextBalance - previousBalance, "Wallet updated")
      }
    } catch (error) {
      console.error("Failed to load wallet summary:", error)
    }
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

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !active) return

      currentUserIdRef.current = user.id

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, name, username, role, coins")
        .eq("id", user.id)
        .maybeSingle()

      const nextProfile = (data as UserProfile | null) || null

      if (active) {
        setProfile(nextProfile)
        const nextCoins = toSafeNumber(nextProfile?.coins)
        setCoins(nextCoins)
        currentCoinsRef.current = nextCoins
      }

      await Promise.all([refreshWalletSummary(false), loadUnreadCount(user.id)])
    }

    void loadProfile()

    function handleCoinUpdate() {
      void refreshWalletSummary(true)
      triggerWalletPulse()
    }

    function handleDailyRewardClaimed(event: Event) {
      const customEvent = event as CustomEvent<{
        coins?: number
        label?: string
      }>
      const amount = Number(customEvent.detail?.coins || 0)
      const label = customEvent.detail?.label || "Daily reward claimed"

      void refreshWalletSummary(false)
      showAnimatedCoinPopup(amount, label)
    }

    function handleGenericCoinPopup(event: Event) {
      const customEvent = event as CustomEvent<CoinPopupDetail>
      const amount = Number(customEvent.detail?.amount || 0)
      const label = customEvent.detail?.label || ""

      void refreshWalletSummary(false)
      showAnimatedCoinPopup(amount, label)
    }

    function handleManualUnreadRefresh() {
      if (currentUserIdRef.current) {
        void loadUnreadCount(currentUserIdRef.current)
      }
    }

    function handleWindowFocus() {
      void refreshWalletSummary(false)
      if (currentUserIdRef.current) {
        void loadUnreadCount(currentUserIdRef.current)
      }
    }

    window.addEventListener("jb-coins-updated", handleCoinUpdate)
    window.addEventListener("jb-daily-reward-claimed", handleDailyRewardClaimed as EventListener)
    window.addEventListener("jb-coins-popup", handleGenericCoinPopup as EventListener)
    window.addEventListener("jb-messages-updated", handleManualUnreadRefresh)
    window.addEventListener("focus", handleWindowFocus)

    const unreadChannel = supabase
      .channel("site-header-unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_messages" },
        async () => {
          if (currentUserIdRef.current) {
            await loadUnreadCount(currentUserIdRef.current)
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_participants" },
        async () => {
          if (currentUserIdRef.current) {
            await loadUnreadCount(currentUserIdRef.current)
          }
        }
      )
      .subscribe()

    const walletChannel = supabase
      .channel("site-header-wallet")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "coin_history" },
        async (payload) => {
          const row = payload.new as { user_id?: string; amount?: number }
          if (row?.user_id && row.user_id === currentUserIdRef.current) {
            await refreshWalletSummary(true)
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "upgrades" },
        async () => {
          await refreshWalletSummary(false)
        }
      )
      .subscribe()

    pollTimerRef.current = setInterval(() => {
      void refreshWalletSummary(false)
    }, 15000)

    return () => {
      active = false
      clearPopupTimers()
      window.removeEventListener("jb-coins-updated", handleCoinUpdate)
      window.removeEventListener("jb-daily-reward-claimed", handleDailyRewardClaimed as EventListener)
      window.removeEventListener("jb-coins-popup", handleGenericCoinPopup as EventListener)
      window.removeEventListener("jb-messages-updated", handleManualUnreadRefresh)
      window.removeEventListener("focus", handleWindowFocus)
      void supabase.removeChannel(unreadChannel)
      void supabase.removeChannel(walletChannel)

      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
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

        @keyframes jbBadgePulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.08);
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

        .jb-badge-pulse {
          animation: jbBadgePulse 1.5s ease-in-out infinite;
        }
      `}</style>

      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="mx-auto w-full max-w-[1800px] overflow-hidden rounded-[24px] border border-white/15 bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 shadow-[0_14px_34px_rgba(37,99,235,0.22)] backdrop-blur-xl">
          <div className="flex min-h-[68px] items-center gap-3 px-4 py-2 sm:px-5 lg:px-6">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-3 pr-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15 backdrop-blur">
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
              {navItems.map((item) => {
                const active = isActive(item.href)
                const isMessages = item.href === "/messages"

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

                    {isMessages && unreadCount > 0 && (
                      <span className="jb-badge-pulse absolute -right-1.5 -top-1.5 inline-flex min-w-[24px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1.5 py-[3px] text-[10px] font-black leading-none text-white shadow-[0_8px_18px_rgba(239,68,68,0.55)]">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>

            <div className="ml-auto hidden items-center gap-2 lg:flex">
              <div
                className={`min-w-[150px] rounded-full border border-white/20 bg-black/30 px-3 py-1.5 transition ${
                  walletAnimate ? "jb-wallet-pulse" : ""
                } ${walletShake ? "jb-wallet-shake" : ""}`}
                title={`${displayName} • ${coins.toLocaleString()} JB Coins`}
              >
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
                disabled={loggingOut}
                className="inline-flex h-10 items-center rounded-full border border-red-300/20 bg-red-500 px-4 text-xs font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/20 bg-white/10 text-xl text-white backdrop-blur transition hover:bg-white/15 lg:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="border-t border-white/15 px-4 pb-4 pt-3 lg:hidden">
              <div className="grid gap-2.5">
                <div
                  className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-yellow-300 transition ${
                    walletAnimate ? "jb-wallet-pulse" : ""
                  } ${walletShake ? "jb-wallet-shake" : ""}`}
                >
                  <img src="/jb-coin.png" alt="JB Coin" className="h-5 w-5 object-contain" />
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">
                      {displayName}
                    </div>
                    <div className="truncate text-sm font-black text-yellow-300">
                      {coins.toLocaleString()} JB Coins
                    </div>
                  </div>
                </div>

                {navItems.map((item) => {
                  const active = isActive(item.href)
                  const isMessages = item.href === "/messages"

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                        active
                          ? "border-white/20 bg-white text-blue-700"
                          : "border-white/10 bg-white/10 text-white hover:bg-white/15"
                      }`}
                    >
                      <span>
                        {item.icon} {item.label}
                      </span>

                      {isMessages && unreadCount > 0 ? (
                        <span className="inline-flex min-w-[24px] items-center justify-center rounded-full border border-white/60 bg-red-500 px-1.5 py-[3px] text-[10px] font-black leading-none text-white shadow-[0_8px_18px_rgba(239,68,68,0.55)]">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      ) : null}
                    </Link>
                  )
                })}

                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="rounded-2xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-70"
                >
                  {loggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="h-[84px] sm:h-[92px]" />

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
