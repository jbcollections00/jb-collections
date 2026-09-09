"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

function playNotificationSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    const now = ctx.currentTime
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()

    osc1.type = "sine"
    osc1.frequency.setValueAtTime(587.33, now)
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15)

    gain1.gain.setValueAtTime(0.2, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

    osc1.connect(gain1)
    gain1.connect(ctx.destination)

    osc1.start(now)
    osc1.stop(now + 0.4)
  } catch (e) {
    console.error("Audio notification error:", e)
  }
}

const navItems = [
  { label: "Dashboard", href: "/admin", icon: "📊" },
  { label: "Announcements", href: "/admin/messages", icon: "📢" },
  { label: "Support Inbox", href: "/admin/queries", icon: "📥" },
  { label: "Categories", href: "/admin/categories", icon: "📂" },
  { label: "Coin Purchases", href: "/admin/coin-purchases", icon: "🪙" },
  { label: "Upload Files", href: "/admin/files", icon: "📁" },
  { label: "Users", href: "/admin/users", icon: "👥" },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [pendingCount, setPendingCount] = useState(0)

  const fetchPendingCount = useCallback(async () => {
    const { count, error } = await supabase
      .from("coin_purchase_orders")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")

    if (!error && count !== null) {
      setPendingCount(count)
    }
  }, [supabase])

  useEffect(() => {
    fetchPendingCount()

    // 🔔 REALTIME SIDEBAR LISTENER
    const channel = supabase
      .channel("global-admin-coin-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coin_purchase_orders",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            playNotificationSound()
          }
          fetchPendingCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchPendingCount, supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  return (
    <div className="flex min-h-screen bg-[#020617] text-white">
      {/* Responsive Sidebar Navigation */}
      <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col overflow-hidden border-r border-slate-800 bg-[#030712] p-2.5 transition-all duration-300 lg:w-64 lg:p-3.5">
        {/* Logo & Title */}
        <div className="mb-3 flex items-center justify-center gap-3 border-b border-slate-800/80 pb-3 pt-1 lg:justify-start lg:px-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900 shadow-md">
            <img
              src="/jb-logo.png"
              alt="JB Collections Logo"
              className="h-7 w-7 object-contain"
            />
          </div>
          <div className="hidden min-w-0 lg:block">
            <h1 className="truncate text-sm font-black leading-tight tracking-tight text-white">JB Collections</h1>
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-cyan-400">
              Admin Panel
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-1 flex-col gap-1.5 overflow-hidden">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href)

            const isCoinPurchases = item.href === "/admin/coin-purchases"

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`relative flex items-center justify-center gap-3 rounded-xl px-2.5 py-2.5 text-xs font-bold transition-all lg:justify-start lg:px-3.5 ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <span className="text-lg shrink-0">{item.icon}</span>
                <span className="hidden truncate lg:inline">{item.label}</span>

                {/* Red Notification Badge for Pending Orders */}
                {isCoinPurchases && pendingCount > 0 ? (
                  <span className="ml-auto hidden h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white shadow-md lg:flex">
                    {pendingCount}
                  </span>
                ) : null}

                {/* Red Dot on Mobile / Small Screen */}
                {isCoinPurchases && pendingCount > 0 ? (
                  <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-500 lg:hidden" />
                ) : null}
              </Link>
            )
          })}
        </nav>

        {/* Logout Button */}
        <div className="mt-auto border-t border-slate-800/80 pt-3">
          <button
            onClick={handleLogout}
            title="Logout"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-2.5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-red-700 lg:justify-start lg:px-3.5"
          >
            <span className="text-base shrink-0">🚪</span>
            <span className="hidden lg:inline">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Admin Content Container */}
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}