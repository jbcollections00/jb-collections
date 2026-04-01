"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import AdminHeader from "@/app/components/AdminHeader"
import { createClient } from "@/lib/supabase/client"

type UserRow = {
  id: string
  email: string | null
  full_name: string | null
  name: string | null
  username: string | null
  membership: string | null
  account_status: string | null
  status: string | null
  is_premium: boolean | null
  role: string | null
  jb_points?: number | null
  last_seen?: string | null
  created_at?: string | null
}

type AdminProfile = {
  role?: string | null
}

type CoinOperation = "add" | "subtract" | "set"

function normalizeMembership(value?: string | null) {
  const membership = String(value || "").trim().toLowerCase()
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  return "standard"
}

export default function AdminUsersPage() {
  const supabase = createClient()
  const router = useRouter()

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [users, setUsers] = useState<UserRow[]>([])
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [search, setSearch] = useState("")

  const [editFullName, setEditFullName] = useState("")
  const [editUsername, setEditUsername] = useState("")
  const [editMembership, setEditMembership] = useState("standard")
  const [editAccountStatus, setEditAccountStatus] = useState("Active")
  const [editRole, setEditRole] = useState("user")
  const [editIsPremium, setEditIsPremium] = useState(false)

  const [editCoins, setEditCoins] = useState("")
  const [coinReason, setCoinReason] = useState("")
  const [coinOperation, setCoinOperation] = useState<CoinOperation>("add")
  const [coinLoading, setCoinLoading] = useState(false)

  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [coinErrorMessage, setCoinErrorMessage] = useState("")
  const [coinSuccessMessage, setCoinSuccessMessage] = useState("")

  const [isEditingUserForm, setIsEditingUserForm] = useState(false)
  const [isEditingCoinForm, setIsEditingCoinForm] = useState(false)

  useEffect(() => {
    void checkAdminAndLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedUser) return

    const normalizedMembership = normalizeMembership(
      selectedUser.membership || (selectedUser.is_premium ? "premium" : "standard")
    )

    setEditFullName(selectedUser.full_name || selectedUser.name || "")
    setEditUsername(selectedUser.username || "")
    setEditMembership(normalizedMembership)
    setEditAccountStatus(
      String(selectedUser.account_status || selectedUser.status || "Active")
    )
    setEditRole(String(selectedUser.role || "user"))
    setEditIsPremium(normalizedMembership === "premium" || normalizedMembership === "platinum")

    setEditCoins("")
    setCoinReason("")
    setCoinOperation("add")
    setCoinErrorMessage("")
    setCoinSuccessMessage("")
    setIsEditingUserForm(false)
    setIsEditingCoinForm(false)
  }, [selectedUser])

  async function checkAdminAndLoad() {
    try {
      setCheckingAdmin(true)
      setErrorMessage("")
      setSuccessMessage("")

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace("/secure-admin-portal-7X9")
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle<AdminProfile>()

      if (profileError || profile?.role !== "admin") {
        router.replace("/secure-admin-portal-7X9?error=not-admin")
        return
      }

      await loadUsers(true)
    } catch (error) {
      console.error("Admin users auth check failed:", error)
      router.replace("/secure-admin-portal-7X9?error=failed")
    } finally {
      setCheckingAdmin(false)
    }
  }

  async function loadUsers(showLoader = true) {
    try {
      if (showLoader) {
        setLoading(true)
      }
      setErrorMessage("")
      setSuccessMessage("")

      const res = await fetch("/api/admin/users", {
        method: "GET",
        cache: "no-store",
      })

      const result = await res.json()

      if (!res.ok) {
        setErrorMessage(result?.error || "Failed to load users.")
        return
      }

      const nextUsers = (result?.users as UserRow[]) || []

      setUsers(nextUsers)
      setSelectedUser((current) => {
        if (!current) return nextUsers[0] || null
        return nextUsers.find((u) => u.id === current.id) || nextUsers[0] || null
      })
    } catch (error) {
      console.error("Load users error:", error)
      setErrorMessage("Failed to load users.")
    } finally {
      if (showLoader) {
        setLoading(false)
      }
    }
  }

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()

    return users.filter((user) => {
      if (!term) return true

      return (
        (user.email || "").toLowerCase().includes(term) ||
        (user.full_name || "").toLowerCase().includes(term) ||
        (user.name || "").toLowerCase().includes(term) ||
        (user.username || "").toLowerCase().includes(term) ||
        (user.membership || "").toLowerCase().includes(term) ||
        (user.role || "").toLowerCase().includes(term)
      )
    })
  }, [users, search])

  function getDisplayName(user: UserRow) {
    return user.full_name || user.name || user.username || user.email || "User"
  }

  function getInitial(user: UserRow) {
    return getDisplayName(user).charAt(0).toUpperCase()
  }

  function getMembershipLabel(user: UserRow) {
    if (String(user.role || "").toLowerCase() === "admin") {
      return "Admin"
    }

    const membership = normalizeMembership(user.membership)
    if (membership === "platinum") return "Platinum"
    if (membership === "premium") return "Premium"
    return "Standard"
  }

  function getMembershipBadge(user: UserRow) {
    const membership = normalizeMembership(user.membership)

    if (String(user.role || "").toLowerCase() === "admin") {
      return "bg-violet-500/20 text-violet-300 border border-violet-400/30"
    }

    if (membership === "platinum") {
      return "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-400/30"
    }

    if (membership === "premium") {
      return "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
    }

    return "bg-slate-700/70 text-slate-200 border border-slate-600"
  }

  function getOnlineStatus(user: UserRow) {
    if (!user.last_seen) return false
    const seen = new Date(user.last_seen).getTime()
    return Date.now() - seen <= 5 * 60 * 1000
  }

  async function saveUser() {
    if (!selectedUser) return

    try {
      setSaving(true)
      setErrorMessage("")
      setSuccessMessage("")

      const normalizedMembership = normalizeMembership(editMembership)
      const normalizedRole = editRole.trim() || "user"
      const normalizedStatus = editAccountStatus.trim() || "Active"
      const normalizedIsPremium =
        normalizedMembership === "premium" || normalizedMembership === "platinum"

      const res = await fetch("/api/admin/users/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedUser.id,
          full_name: editFullName.trim() || null,
          username: editUsername.trim() || null,
          membership: normalizedMembership,
          is_premium: normalizedIsPremium,
          account_status: normalizedStatus,
          status: normalizedStatus,
          role: normalizedRole,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        setErrorMessage(result?.error || "Failed to update user.")
        return
      }

      setSuccessMessage("User profile updated successfully.")
      setIsEditingUserForm(false)
      await loadUsers(false)
    } catch (error) {
      console.error("Save user error:", error)
      setErrorMessage("Failed to update user.")
    } finally {
      setSaving(false)
    }
  }

  async function applyCoinAdjustment() {
    if (!selectedUser) return

    try {
      setCoinLoading(true)
      setCoinErrorMessage("")
      setCoinSuccessMessage("")
      setErrorMessage("")
      setSuccessMessage("")

      const amount = Number(editCoins)

      if (!Number.isFinite(amount) || amount < 0) {
        setCoinErrorMessage("Please enter a valid coin amount.")
        return
      }

      if (!coinReason.trim()) {
        setCoinErrorMessage("Please enter a reason.")
        return
      }

      const res = await fetch("/api/admin/users/adjust-coins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          amount,
          operation: coinOperation,
          reason: coinReason.trim(),
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        setCoinErrorMessage(result?.error || "Failed to adjust JB Coins.")
        return
      }

      const updatedCoins = Number(result?.newCoins ?? selectedUser.jb_points ?? 0)

      setSelectedUser((current) =>
        current
          ? {
              ...current,
              jb_points: updatedCoins,
            }
          : current
      )

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === selectedUser.id
            ? {
                ...user,
                jb_points: updatedCoins,
              }
            : user
        )
      )

      setCoinSuccessMessage(result?.message || "JB Coins updated successfully.")
      setEditCoins("")
      setCoinReason("")
      setCoinOperation("add")
      setIsEditingCoinForm(false)
    } catch (error) {
      console.error("Apply coin adjustment error:", error)
      setCoinErrorMessage("Failed to adjust JB Coins.")
    } finally {
      setCoinLoading(false)
    }
  }

  if (checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
        <div className="rounded-[24px] border border-slate-800 bg-slate-900 px-8 py-6 text-center shadow-2xl">
          <p className="text-lg font-bold text-white">Checking admin access...</p>
          <p className="mt-2 text-sm text-slate-400">Please wait.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] px-4 py-5 text-slate-100 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <AdminHeader />

        <div className="mb-6 rounded-[24px] border border-blue-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-5 py-6 text-white shadow-2xl sm:px-7 sm:py-8">
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-300">
            USER MANAGEMENT
          </div>

          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold sm:text-4xl">Manage Registered Users</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                View registered accounts, monitor online status, and update membership,
                status, roles, and JB Coins.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadUsers(true)}
              disabled={loading || saving || coinLoading}
              className="inline-flex items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-sm font-bold text-blue-200 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Refreshing..." : "Refresh Users"}
            </button>
          </div>
        </div>

        {(errorMessage || successMessage) && (
          <div
            className={`mb-5 rounded-2xl px-4 py-3 text-sm font-bold ${
              errorMessage
                ? "border border-red-500/30 bg-red-500/10 text-red-300"
                : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {errorMessage || successMessage}
          </div>
        )}

        <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl sm:p-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, username, membership, or role"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
            <div className="border-b border-slate-800 px-4 py-4 text-lg font-extrabold text-white">
              Registered Users
            </div>

            <div className="max-h-[700px] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-5 text-sm text-slate-400">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="px-4 py-5 text-sm text-slate-400">No users found.</div>
              ) : (
                filteredUsers.map((user) => {
                  const active = selectedUser?.id === user.id
                  const isOnline = getOnlineStatus(user)

                  return (
                    <button
                      key={user.id}
                      onClick={() => {
                        if (isEditingUserForm || isEditingCoinForm || saving || coinLoading) {
                          return
                        }
                        setSelectedUser(user)
                      }}
                      className={`flex w-full items-center gap-3 border-b border-slate-800 px-4 py-4 text-left transition ${
                        active
                          ? "bg-blue-500/10"
                          : "bg-slate-900 hover:bg-slate-800/80"
                      }`}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-lg font-extrabold text-blue-300">
                        {getInitial(user)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 truncate text-sm font-extrabold text-white sm:text-base">
                          {getDisplayName(user)}
                        </div>

                        <div className="truncate text-xs text-slate-400 sm:text-sm">
                          {user.email || "No email"}
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${getMembershipBadge(
                              user
                            )}`}
                          >
                            {getMembershipLabel(user)}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                              isOnline ? "text-emerald-400" : "text-slate-500"
                            }`}
                          >
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                isOnline ? "animate-pulse bg-emerald-400" : "bg-slate-600"
                              }`}
                            />
                            {isOnline ? "Online" : "Offline"}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl sm:p-6">
            {!selectedUser ? (
              <div className="text-sm text-slate-400">Select a user to view details.</div>
            ) : (
              <>
                <div className="mb-5">
                  <h2 className="text-2xl font-extrabold text-white">
                    {getDisplayName(selectedUser)}
                  </h2>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getMembershipBadge(
                        selectedUser
                      )}`}
                    >
                      {getMembershipLabel(selectedUser)}
                    </span>

                    <span className="inline-flex rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
                      {Number(selectedUser.jb_points || 0).toLocaleString()} JB Coins
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-sm leading-7 text-slate-300">
                    <div>
                      <strong className="text-white">Email:</strong> {selectedUser.email || "No email"}
                    </div>
                    <div>
                      <strong className="text-white">User ID:</strong> {selectedUser.id}
                    </div>
                    <div>
                      <strong className="text-white">Online Status:</strong>{" "}
                      {getOnlineStatus(selectedUser) ? "Online" : "Offline"}
                    </div>
                    <div>
                      <strong className="text-white">Last Seen:</strong>{" "}
                      {selectedUser.last_seen
                        ? new Date(selectedUser.last_seen).toLocaleString()
                        : "No activity yet"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-200">
                      Full Name
                    </label>
                    <input
                      value={editFullName}
                      onChange={(e) => {
                        setEditFullName(e.target.value)
                        setIsEditingUserForm(true)
                      }}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-200">
                      Username
                    </label>
                    <input
                      value={editUsername}
                      onChange={(e) => {
                        setEditUsername(e.target.value)
                        setIsEditingUserForm(true)
                      }}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-200">
                        Membership
                      </label>
                      <select
                        value={editMembership}
                        onChange={(e) => {
                          const nextMembership = normalizeMembership(e.target.value)
                          setEditMembership(nextMembership)
                          setEditIsPremium(
                            nextMembership === "premium" || nextMembership === "platinum"
                          )
                          setIsEditingUserForm(true)
                        }}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                      >
                        <option value="standard">Standard</option>
                        <option value="premium">Premium</option>
                        <option value="platinum">Platinum</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-200">
                        Role
                      </label>
                      <select
                        value={editRole}
                        onChange={(e) => {
                          setEditRole(e.target.value)
                          setIsEditingUserForm(true)
                        }}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-200">
                        Account Status
                      </label>
                      <select
                        value={editAccountStatus}
                        onChange={(e) => {
                          setEditAccountStatus(e.target.value)
                          setIsEditingUserForm(true)
                        }}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                      >
                        <option value="Active">Active</option>
                        <option value="Pending">Pending</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Banned">Banned</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-200">
                      <input
                        type="checkbox"
                        checked={editIsPremium}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setEditIsPremium(checked)
                          setIsEditingUserForm(true)

                          if (!checked) {
                            setEditMembership("standard")
                          } else if (editMembership === "standard") {
                            setEditMembership("premium")
                          }
                        }}
                      />
                      Premium Access
                    </label>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 sm:p-5">
                    <div className="mb-4">
                      <h3 className="text-lg font-extrabold text-white">JB Coins Control</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Add, subtract, or set the exact JB Coin balance for this user.
                      </p>
                    </div>

                    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-300">
                      Current Balance: {Number(selectedUser.jb_points || 0).toLocaleString()} JB Coins
                    </div>

                    {coinErrorMessage ? (
                      <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
                        {coinErrorMessage}
                      </div>
                    ) : null}

                    {coinSuccessMessage ? (
                      <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-300">
                        {coinSuccessMessage}
                      </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-200">
                          Operation
                        </label>
                        <select
                          value={coinOperation}
                          onChange={(e) => {
                            setCoinOperation(e.target.value as CoinOperation)
                            setIsEditingCoinForm(true)
                          }}
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                        >
                          <option value="add">Add Coins</option>
                          <option value="subtract">Subtract Coins</option>
                          <option value="set">Set Exact Coins</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-200">
                          Amount
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editCoins}
                          onChange={(e) => {
                            setEditCoins(e.target.value)
                            setIsEditingCoinForm(true)
                          }}
                          placeholder="Enter amount"
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-200">
                          Reason
                        </label>
                        <input
                          value={coinReason}
                          onChange={(e) => {
                            setCoinReason(e.target.value)
                            setIsEditingCoinForm(true)
                          }}
                          placeholder="Enter reason"
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={applyCoinAdjustment}
                        disabled={coinLoading}
                        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {coinLoading ? "Applying..." : "Apply Coin Adjustment"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditCoins("")
                          setCoinReason("")
                          setCoinOperation("add")
                          setCoinErrorMessage("")
                          setCoinSuccessMessage("")
                          setIsEditingCoinForm(false)
                        }}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-700 px-5 py-3 text-sm font-bold text-slate-100 transition hover:bg-slate-600"
                      >
                        Reset Coin Form
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={saveUser}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving ? "Saving..." : "Save User Changes"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}