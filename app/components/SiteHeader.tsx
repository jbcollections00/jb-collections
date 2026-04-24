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

type ParticipantRow = {
  conversation_id: string
  last_read_at: string | null
}

type CoinPopupDetail = {
  amount?: number
  label?: string
}

// ✅ UPDATED NAV (Messages is admin only)
const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "🏠" },
  { label: "Profile", href: "/profile", icon: "👤" },
  { label: "Messages", href: "/messages", icon: "💬", adminOnly: true },
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
  const [unreadCount, setUnreadCount] = useState(0)

  const currentUserIdRef = useRef<string | null>(null)

  // ✅ ADMIN CHECK
  const isAdmin = String(profile?.role || "").toLowerCase() === "admin"

  // ✅ FILTER NAV ITEMS
  const visibleNavItems = navItems.filter((item: any) => {
    if (item.adminOnly && !isAdmin) return false
    return true
  })

  async function refreshWalletSummary() {
    try {
      const userId = currentUserIdRef.current
      if (!userId) return

      const { data } = await supabase
        .from("profiles")
        .select("coins")
        .eq("id", userId)
        .maybeSingle()

      const nextCoins = toSafeNumber(data?.coins)
      setCoins(nextCoins)
    } catch (err) {
      console.error(err)
    }
  }

  // ⚠️ UNREAD COUNT (ADMIN ONLY NOW)
  async function loadUnreadCount(userId: string) {
    try {
      if (!isAdmin) return // 🚫 BLOCK FOR NON-ADMIN

      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", userId)
        .is("deleted_at", null)

      const rows = (participants as ParticipantRow[]) || []

      let total = 0

      for (const row of rows) {
        const since = row.last_read_at || "1970-01-01"

        const { count } = await supabase
          .from("conversation_messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", row.conversation_id)
          .neq("sender_id", userId)
          .gt("created_at", since)

        total += count || 0
      }

      setUnreadCount(total)
    } catch (err) {
      console.error(err)
      setUnreadCount(0)
    }
  }

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      currentUserIdRef.current = user.id

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, name, username, role, coins")
        .eq("id", user.id)
        .maybeSingle()

      const profileData = data as UserProfile
      setProfile(profileData)

      const nextCoins = toSafeNumber(profileData?.coins)
      setCoins(nextCoins)

      // ✅ FIX: ONLY ADMIN LOADS UNREAD
      if (profileData?.role === "admin") {
        await Promise.all([
          refreshWalletSummary(),
          loadUnreadCount(user.id),
        ])
      } else {
        await refreshWalletSummary()
      }
    }

    loadProfile()
  }, [])

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  return (
    <header className="fixed top-0 w-full z-50 bg-gradient-to-r from-cyan-600 to-indigo-600 p-4 flex items-center justify-between">
      
      {/* LOGO */}
      <Link href="/dashboard" className="flex items-center gap-2">
        <img src="/jb-logo.png" className="w-8 h-8" />
        <span className="text-white font-bold">JB COLLECTIONS</span>
      </Link>

      {/* NAV */}
      <div className="flex gap-4 items-center">
        {visibleNavItems.map((item: any) => {
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative px-4 py-2 rounded-full text-sm font-bold ${
                active
                  ? "bg-white text-blue-700"
                  : "text-white hover:bg-white/20"
              }`}
            >
              {item.icon} {item.label}

              {/* 🔴 UNREAD BADGE (ADMIN ONLY) */}
              {item.href === "/messages" && unreadCount > 0 && isAdmin && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 rounded-full">
                  {unreadCount}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* WALLET + LOGOUT */}
      <div className="flex items-center gap-4">
        <div className="text-yellow-300 font-bold">
          {coins.toLocaleString()} JB
        </div>

        <button
          onClick={handleLogout}
          className="bg-red-500 px-4 py-2 rounded-full text-white font-bold"
        >
          Logout
        </button>
      </div>
    </header>
  )
}