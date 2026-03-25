"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import AdminHeader from "@/app/components/AdminHeader"

type User = {
  id: string
  email?: string | null
  full_name?: string | null
  name?: string | null
  username?: string | null
  membership?: string | null
  role?: string | null
  account_status?: string | null
  status?: string | null
  is_premium?: boolean | null
  last_seen?: string | null
  created_at?: string | null
}

export default function AdminUserViewPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params?.id as string

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!userId) return
    void loadUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function loadUser() {
    try {
      setLoading(true)
      setError("")

      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "GET",
        cache: "no-store",
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result?.error || "User not found.")
        return
      }

      setUser((result?.user as User) || null)
    } catch (err) {
      console.error(err)
      setError("Failed to load user.")
    } finally {
      setLoading(false)
    }
  }

  function getDisplayName(u: User) {
    return u.full_name || u.name || u.username || u.email || "User"
  }

  function formatDate(value?: string | null) {
    if (!value) return "N/A"

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "N/A"

    return date.toLocaleString()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#eef4ff] via-[#f8fbff] to-white px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mx-auto w-full max-w-5xl">
          <AdminHeader />
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-bold text-slate-800">Loading user...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#eef4ff] via-[#f8fbff] to-white px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mx-auto w-full max-w-5xl">
          <AdminHeader />
          <div className="mt-6 rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-bold text-red-600">{error || "User not found."}</p>
            <button
              onClick={() => router.push("/admin/users")}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              Back to Users
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef4ff] via-[#f8fbff] to-white px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-5xl">
        <AdminHeader />

        <div className="mt-6 rounded-[24px] bg-gradient-to-br from-slate-900 via-blue-900 to-blue-600 px-5 py-6 text-white shadow-sm sm:px-7 sm:py-8">
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/90">
            USER PROFILE
          </div>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{getDisplayName(user)}</h1>
          <p className="mt-3 text-sm leading-7 text-blue-100 sm:text-base">
            View selected member account details.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm font-bold text-slate-500">Email</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {user.email || "No email"}
              </div>
            </div>

            <div>
              <div className="text-sm font-bold text-slate-500">Username</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {user.username || "No username"}
              </div>
            </div>

            <div>
              <div className="text-sm font-bold text-slate-500">Full Name</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {user.full_name || user.name || "No name"}
              </div>
            </div>

            <div>
              <div className="text-sm font-bold text-slate-500">Membership</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {user.membership || "standard"}
              </div>
            </div>

            <div>
              <div className="text-sm font-bold text-slate-500">Role</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {user.role || "user"}
              </div>
            </div>

            <div>
              <div className="text-sm font-bold text-slate-500">Premium Access</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {user.is_premium ? "Yes" : "No"}
              </div>
            </div>

            <div>
              <div className="text-sm font-bold text-slate-500">Account Status</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {user.account_status || user.status || "Active"}
              </div>
            </div>

            <div>
              <div className="text-sm font-bold text-slate-500">Last Seen</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {formatDate(user.last_seen)}
              </div>
            </div>

            <div className="sm:col-span-2">
              <div className="text-sm font-bold text-slate-500">User ID</div>
              <div className="mt-1 break-all text-base font-semibold text-slate-900">
                {user.id}
              </div>
            </div>

            <div>
              <div className="text-sm font-bold text-slate-500">Created At</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {formatDate(user.created_at)}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => router.push("/admin/users")}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              Back to Users
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}