"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  { label: "Dashboard", href: "/admin", icon: "匠" },
  { label: "Announcements", href: "/admin/messages", icon: "討" },
  { label: "Support Inbox", href: "/admin/queries", icon: "📥" }, // <-- Added Support Inbox
  { label: "Categories", href: "/admin/categories", icon: "唐" },
  { label: "Coin Purchases", href: "/admin/coin-purchases", icon: "ｪ" },
  { label: "Upload Files", href: "/admin/files", icon: "刀" },
  { label: "Users", href: "/admin/users", icon: "則" },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  return (
    <div className="flex min-h-screen bg-[#020617] text-white">
      {/* Sidebar Navigation */}
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-slate-800 bg-[#030712] p-4">
        {/* Logo & Title */}
        <div className="mb-6 flex items-center gap-3 border-b border-slate-800/80 px-2 pb-5 pt-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 font-black text-white shadow-md">
            JB
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-white">JB Collections</h1>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400">
              Admin Panel
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-1 flex-col gap-2">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Logout Button */}
        <div className="mt-auto border-t border-slate-800/80 pt-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-red-700"
          >
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Admin Content Container */}
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}