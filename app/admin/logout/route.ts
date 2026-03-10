"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  { label: "Dashboard", href: "/admin", icon: "🏠" },
  { label: "Categories", href: "/admin/categories", icon: "📂" },
  { label: "Files", href: "/admin/files", icon: "📁" },
  { label: "Messages", href: "/admin/messages", icon: "💬" },
  { label: "Upgrades", href: "/admin/upgrades", icon: "⬆️" },
]

export default function AdminHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()

    router.replace("/admin/login")
    router.refresh()
  }

  return (
    <div style={{
      background: "white",
      border: "1px solid #e2e8f0",
      borderRadius: "22px",
      padding: "18px 20px",
      boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
      marginBottom: "28px",
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px",
        flexWrap: "wrap",
      }}>

        <div style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
          <Link href="/admin" style={{
            textDecoration: "none",
            fontSize: "30px",
            fontWeight: 800,
            color: "#0f172a",
          }}>
            ADMIN PANEL
          </Link>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {navItems.map((item) => {
              const active = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "12px",
                    textDecoration: "none",
                    fontWeight: 700,
                    background: active ? "#2563eb" : "#f8fafc",
                    color: active ? "white" : "#334155",
                    border: active ? "none" : "1px solid #e2e8f0",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            padding: "10px 18px",
            borderRadius: "12px",
            border: "none",
            background: "#ef4444",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Logout
        </button>

      </div>
    </div>
  )
}