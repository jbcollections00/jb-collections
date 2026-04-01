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
  jb_points?: number | null
  last_seen?: string | null
  created_at?: string | null
}

type AdjustOperation = "add" | "subtract" | "set"

export default function AdminUserViewPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params?.id as string

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [coinAmount, setCoinAmount] = useState("")
  const [coinReason, setCoinReason] = useState("")
  const [coinOperation, setCoinOperation] = useState<AdjustOperation>("add")
  const [coinSubmitting, setCoinSubmitting] = useState(false)
  const [coinMessage, setCoinMessage] = useState("")
  const [coinError, setCoinError] = useState("")

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

  async function handleAdjustCoins() {
    try {
      setCoinError("")
      setCoinMessage("")

      if (!user?.id) {
        setCoinError("User not found.")
        return
      }

      const parsedAmount = Number(coinAmount)

      if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
        setCoinError("Please enter a valid coin amount.")
        return
      }

      if (!coinReason.trim()) {
        setCoinError("Please enter a reason.")
        return
      }

      setCoinSubmitting(true)

      const res = await fetch("/api/admin/users/adjust-coins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          amount: parsedAmount,
          operation: coinOperation,
          reason: coinReason.trim(),
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        setCoinError(result?.error || "Failed to adjust coins.")
        return
      }

      setUser((prev) =>
        prev
          ? {
              ...prev,
              jb_points: Number(result?.newCoins ?? prev.jb_points ?? 0),
            }
          : prev
      )

      setCoinMessage(result?.message || "JB Coins updated successfully.")
      setCoinAmount("")
      setCoinReason("")
    } catch (err) {
      console.error(err)
      setCoinError("Failed to adjust coins.")
    } finally {
      setCoinSubmitting(false)
    }
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

            <div>
              <div className="text-sm font-bold text-slate-500">JB Coins</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {Number(user.jb_points || 0).toLocaleString()}
              </div>
            </div>

            <div>
              <div className="text-sm font-bold text-slate-500">Created At</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {formatDate(user.created_at)}
              </div>
            </div>

            <div className="sm:col-span-2">
              <div className="text-sm font-bold text-slate-500">User ID</div>
              <div className="mt-1 break-all text-base font-semibold text-slate-900">
                {user.id}
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="text-lg font-extrabold text-slate-900">Adjust JB Coins</h2>
              <p className="mt-1 text-sm text-slate-600">
                Add, subtract, or set the exact coin balance for this user.
              </p>
            </div>

            {coinMessage ? (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                {coinMessage}
              </div>
            ) : null}

            {coinError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                {coinError}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-600">
                  Operation
                </label>
                <select
                  value={coinOperation}
                  onChange={(e) => setCoinOperation(e.target.value as AdjustOperation)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="add">Add Coins</option>
                  <option value="subtract">Subtract Coins</option>
                  <option value="set">Set Exact Coins</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-600">
                  Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={coinAmount}
                  onChange={(e) => setCoinAmount(e.target.value)}
                  placeholder="Enter coin amount"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold text-slate-600">
                  Reason
                </label>
                <textarea
                  value={coinReason}
                  onChange={(e) => setCoinReason(e.target.value)}
                  rows={4}
                  placeholder="Write the reason for this coin adjustment..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={handleAdjustCoins}
                disabled={coinSubmitting}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {coinSubmitting ? "Updating Coins..." : "Save Coin Adjustment"}
              </button>

              <button
                onClick={() => {
                  setCoinAmount("")
                  setCoinReason("")
                  setCoinOperation("add")
                  setCoinMessage("")
                  setCoinError("")
                }}
                type="button"
                className="inline-flex items-center justify-center rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-300"
              >
                Reset
              </button>
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