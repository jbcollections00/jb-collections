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
  last_seen?: string | null
  created_at?: string | null
}

type AdminProfile = {
  role?: string | null
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

  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  useEffect(() => {
    checkAdminAndLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedUser) return

    setEditFullName(selectedUser.full_name || selectedUser.name || "")
    setEditUsername(selectedUser.username || "")
    setEditMembership(
      String(selectedUser.membership || (selectedUser.is_premium ? "premium" : "standard"))
    )
    setEditAccountStatus(
      String(selectedUser.account_status || selectedUser.status || "Active")
    )
    setEditRole(String(selectedUser.role || "user"))
    setEditIsPremium(Boolean(selectedUser.is_premium))
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
        router.replace("/admin/login")
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle<AdminProfile>()

      if (profileError || profile?.role !== "admin") {
        router.replace("/admin/login?error=not-admin")
        return
      }

      await loadUsers()
    } catch (error) {
      console.error("Admin users auth check failed:", error)
      router.replace("/admin/login?error=failed")
    } finally {
      setCheckingAdmin(false)
    }
  }

  async function loadUsers() {
    try {
      setLoading(true)
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
      setLoading(false)
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

  function getMembershipBadge(user: UserRow) {
    const premium =
      typeof user.is_premium === "boolean"
        ? user.is_premium
        : String(user.membership || "").toLowerCase() === "premium"

    if (String(user.role || "").toLowerCase() === "admin") {
      return "bg-violet-100 text-violet-700"
    }

    return premium
      ? "bg-emerald-100 text-emerald-700"
      : "bg-slate-100 text-slate-700"
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

      const normalizedMembership = editIsPremium ? "premium" : editMembership
      const normalizedRole = editRole.trim() || "user"
      const normalizedStatus = editAccountStatus.trim() || "Active"

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
          is_premium: editIsPremium,
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
      await loadUsers()
    } catch (error) {
      console.error("Save user error:", error)
      setErrorMessage("Failed to update user.")
    } finally {
      setSaving(false)
    }
  }

  if (checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#eef4ff] via-[#f8fbff] to-white px-4">
        <div className="rounded-[24px] border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-lg font-bold text-slate-800">Checking admin access...</p>
          <p className="mt-2 text-sm text-slate-500">Please wait.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef4ff] via-[#f8fbff] to-white px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <AdminHeader />

        <div className="mb-6 rounded-[24px] bg-gradient-to-br from-slate-900 via-blue-900 to-blue-600 px-5 py-6 text-white shadow-sm sm:px-7 sm:py-8">
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/90">
            USER MANAGEMENT
          </div>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Manage Registered Users</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-100 sm:text-base">
            View registered accounts, monitor online status, and update membership,
            status, and roles.
          </p>
        </div>

        {(errorMessage || successMessage) && (
          <div
            className={`mb-5 rounded-2xl px-4 py-3 text-sm font-bold ${
              errorMessage
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {errorMessage || successMessage}
          </div>
        )}

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, username, membership, or role"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-4 text-lg font-extrabold text-slate-900">
              Registered Users
            </div>

            <div className="max-h-[700px] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-5 text-sm text-slate-500">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="px-4 py-5 text-sm text-slate-500">No users found.</div>
              ) : (
                filteredUsers.map((user) => {
                  const active = selectedUser?.id === user.id
                  const isOnline = getOnlineStatus(user)

                  return (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-4 text-left transition ${
                        active ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-extrabold text-blue-700">
                        {getInitial(user)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 truncate text-sm font-extrabold text-slate-900 sm:text-base">
                          {getDisplayName(user)}
                        </div>

                        <div className="truncate text-xs text-slate-600 sm:text-sm">
                          {user.email || "No email"}
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${getMembershipBadge(
                              user
                            )}`}
                          >
                            {String(user.role || "").toLowerCase() === "admin"
                              ? "Admin"
                              : user.is_premium || String(user.membership || "").toLowerCase() === "premium"
                                ? "Premium"
                                : "Standard"}
                          </span>

                          <span
                            className={`text-[11px] font-bold ${
                              isOnline ? "text-emerald-600" : "text-slate-400"
                            }`}
                          >
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

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            {!selectedUser ? (
              <div className="text-sm text-slate-500">Select a user to view details.</div>
            ) : (
              <>
                <div className="mb-5">
                  <h2 className="text-2xl font-extrabold text-slate-900">
                    {getDisplayName(selectedUser)}
                  </h2>

                  <div className="mt-2 space-y-1 text-sm leading-7 text-slate-600">
                    <div>
                      <strong>Email:</strong> {selectedUser.email || "No email"}
                    </div>
                    <div>
                      <strong>User ID:</strong> {selectedUser.id}
                    </div>
                    <div>
                      <strong>Online Status:</strong>{" "}
                      {getOnlineStatus(selectedUser) ? "Online" : "Offline"}
                    </div>
                    <div>
                      <strong>Last Seen:</strong>{" "}
                      {selectedUser.last_seen
                        ? new Date(selectedUser.last_seen).toLocaleString()
                        : "No activity yet"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Full Name
                    </label>
                    <input
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      Username
                    </label>
                    <input
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700">
                        Membership
                      </label>
                      <select
                        value={editMembership}
                        onChange={(e) => setEditMembership(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                      >
                        <option value="standard">Standard</option>
                        <option value="premium">Premium</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700">
                        Role
                      </label>
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700">
                        Account Status
                      </label>
                      <select
                        value={editAccountStatus}
                        onChange={(e) => setEditAccountStatus(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                      >
                        <option value="Active">Active</option>
                        <option value="Pending">Pending</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Banned">Banned</option>
                      </select>
                    </div>

                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900">
                      <input
                        type="checkbox"
                        checked={editIsPremium}
                        onChange={(e) => {
                          setEditIsPremium(e.target.checked)
                          setEditMembership(e.target.checked ? "premium" : "standard")
                        }}
                      />
                      Premium User
                    </label>
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