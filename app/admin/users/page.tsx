"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Users, Search, RefreshCw, ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type AdminUser = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
  premium: boolean | null
  is_premium: boolean | null
  created_at: string | null
}

function formatDate(value: string | null) {
  if (!value) return "—"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleString()
}

export default function AdminUsersPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    let active = true

    async function loadUsers() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
          router.replace("/admin/secure-admin-portal-7X9")
          return
        }

        const res = await fetch("/api/admin/users", {
          method: "GET",
          cache: "no-store",
        })

        const data = await res.json()

        if (!res.ok) {
          if (res.status === 401) {
            router.replace("/admin/secure-admin-portal-7X9")
            return
          }

          if (res.status === 403) {
            router.replace("/admin")
            return
          }

          throw new Error(data?.error || "Failed to load users")
        }

        if (!active) return
        setUsers(Array.isArray(data.users) ? data.users : [])
      } catch (err: any) {
        if (!active) return
        setError(err?.message || "Failed to load users")
      } finally {
        if (!active) return
        setLoading(false)
      }
    }

    loadUsers()

    return () => {
      active = false
    }
  }, [router, supabase])

  async function handleRefresh() {
    try {
      setRefreshing(true)
      setError("")

      const res = await fetch("/api/admin/users", {
        method: "GET",
        cache: "no-store",
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to refresh users")
      }

      setUsers(Array.isArray(data.users) ? data.users : [])
    } catch (err: any) {
      setError(err?.message || "Failed to refresh users")
    } finally {
      setRefreshing(false)
    }
  }

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return users

    return users.filter((user) => {
      return [user.email, user.full_name, user.role].some((value) =>
        String(value || "").toLowerCase().includes(term)
      )
    })
  }, [search, users])

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="text-sm text-neutral-500">Loading users...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Users className="h-4 w-4" />
              <span>Admin Panel</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
              Registered Users
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Link>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-2xl bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or role..."
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-black focus:bg-white"
            />
          </div>
        </div>

        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-left">
              <thead className="bg-neutral-100">
                <tr className="text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-4 font-semibold">Full Name</th>
                  <th className="px-4 py-4 font-semibold">Email</th>
                  <th className="px-4 py-4 font-semibold">Role</th>
                  <th className="px-4 py-4 font-semibold">Premium</th>
                  <th className="px-4 py-4 font-semibold">Is Premium</th>
                  <th className="px-4 py-4 font-semibold">Registered</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-neutral-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="border-t border-neutral-200 text-sm text-neutral-700">
                      <td className="px-4 py-4">{user.full_name || "—"}</td>
                      <td className="px-4 py-4">{user.email || "—"}</td>
                      <td className="px-4 py-4">{user.role || "member"}</td>
                      <td className="px-4 py-4">{user.premium ? "TRUE" : "FALSE"}</td>
                      <td className="px-4 py-4">{user.is_premium ? "TRUE" : "FALSE"}</td>
                      <td className="px-4 py-4">{formatDate(user.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}