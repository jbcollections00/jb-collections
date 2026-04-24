"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  { label: "Dashboard", href: "/admin", icon: "🏠" },
  { label: "Categories", href: "/admin/categories", icon: "📂" },
  { label: "Coin Purchases", href: "/admin/coin-purchases", icon: "🪙" },
  { label: "Upload Files", href: "/admin/files", icon: "📁" },
  { label: "Users", href: "/admin/users", icon: "👥" },
]

export default function AdminHeader() {
  const rawPathname = usePathname()
  const pathname = rawPathname ?? ""

  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [savingMessagesSetting, setSavingMessagesSetting] = useState(false)

  function isActive(href: string) {
    const currentPath = pathname || ""
    if (href === "/admin") return currentPath === "/admin"
    return currentPath.startsWith(href)
  }

  async function loadMessagesSetting() {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("key", "messages_open")
      .maybeSingle()

    if (error) {
      console.error("Failed to load messages setting:", error)
      return
    }

    setMessagesOpen(String(data?.value || "false") === "true")
  }

  async function toggleMessages() {
    try {
      setSavingMessagesSetting(true)

      const newValue = !messagesOpen

      const { error } = await supabase
        .from("app_settings")
        .upsert(
          {
            key: "messages_open",
            value: String(newValue),
          },
          {
            onConflict: "key",
          }
        )

      if (error) {
        throw error
      }

      setMessagesOpen(newValue)
    } catch (error) {
      console.error("Failed to update messages setting:", error)
      alert(
        error instanceof Error
          ? error.message
          : "Failed to update messages setting."
      )
    } finally {
      setSavingMessagesSetting(false)
    }
  }

  useEffect(() => {
    void loadMessagesSetting()
  }, [])

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
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="mx-auto w-full max-w-[1800px] rounded-[24px] border border-slate-800/80 bg-slate-950/95 shadow-[0_16px_40px_rgba(2,6,23,0.55)] backdrop-blur-xl">
          <div className="flex min-h-[72px] items-center gap-3 px-4 py-2.5 sm:px-5 lg:px-6">
            <Link href="/admin" className="flex min-w-0 shrink-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-700">
                <img
                  src="/logo.png"
                  alt="JB Collections"
                  className="h-8 w-8 object-contain"
                />
              </div>

              <div className="min-w-0">
                <div className="truncate text-[15px] font-black tracking-[0.08em] text-white sm:text-[17px]">
                  JB Collections
                </div>
                <div className="hidden text-[9px] font-bold uppercase tracking-[0.28em] text-blue-400 sm:block">
                  Admin Panel
                </div>
              </div>
            </Link>

            <div className="ml-2 hidden min-w-0 flex-1 lg:block">
              <div className="overflow-x-auto scrollbar-none">
                <nav className="flex min-w-max items-center gap-2 pr-2">
                  {navItems.map((item) => {
                    const active = isActive(item.href)

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold whitespace-nowrap transition ${
                          active
                            ? "border-blue-400/35 bg-blue-500/15 text-blue-300 shadow-[0_10px_24px_rgba(59,130,246,0.16)]"
                            : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-600 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        <span className="text-[14px]">{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </nav>
              </div>
            </div>

            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              <button
                type="button"
                onClick={toggleMessages}
                disabled={savingMessagesSetting}
                className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${
                  messagesOpen
                    ? "border-emerald-400/30 bg-emerald-600 hover:bg-emerald-700"
                    : "border-slate-600 bg-slate-800 hover:bg-slate-700"
                }`}
              >
                {savingMessagesSetting
                  ? "Saving..."
                  : messagesOpen
                  ? "Messages Open"
                  : "Messages Closed"}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex h-10 items-center justify-center rounded-full border border-red-400/20 bg-red-600 px-4 text-xs font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-slate-700 bg-slate-900 text-xl text-white transition hover:bg-slate-800 lg:hidden"
              aria-label="Toggle admin menu"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="border-t border-slate-800 bg-slate-950/95 px-4 pb-4 pt-3 lg:hidden">
              <div className="grid gap-2.5">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                    JB Collections
                  </div>
                  <div className="mt-1 text-sm font-black text-white">
                    Admin Control Center
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleMessages}
                  disabled={savingMessagesSetting}
                  className={`inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-bold transition disabled:opacity-70 ${
                    messagesOpen
                      ? "border-emerald-400/30 bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {savingMessagesSetting
                    ? "Saving..."
                    : messagesOpen
                    ? "Messages Open"
                    : "Messages Closed"}
                </button>

                {navItems.map((item) => {
                  const active = isActive(item.href)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                        active
                          ? "border-blue-400/30 bg-blue-500/15 text-blue-300"
                          : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
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
                  className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-70"
                >
                  {loggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="h-[88px] sm:h-[96px]" />
    </>
  )
}