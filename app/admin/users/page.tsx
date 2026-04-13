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
  membership_payment_type?: string | null
  membership_started_at?: string | null
  membership_expires_at?: string | null
}

type AdminProfile = {
  role?: string | null
}

type CoinOperation = "add" | "subtract" | "set"
type MembershipPaymentType = "none" | "monthly"
type CatalogueFilter =
  | "all"
  | "standard"
  | "premium"
  | "platinum"
  | "admins"
  | "online"
  | "offline"
type SortOption = "az" | "za" | "newest" | "oldest" | "coins_high" | "coins_low"

function normalizeMembership(value?: string | null) {
  const membership = String(value || "").trim().toLowerCase()
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  return "standard"
}

function formatLocalDateTimeInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function addMonths(dateValue: string, months: number) {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return ""

  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return formatLocalDateTimeInput(next)
}

function isMembershipExpired(user: UserRow) {
  if (String(user.role || "").toLowerCase() === "admin") return false

  const membership = normalizeMembership(user.membership)
  if (membership === "standard") return false
  if (!user.membership_expires_at) return false

  const expiresAt = new Date(user.membership_expires_at).getTime()
  if (Number.isNaN(expiresAt)) return false

  return expiresAt <= Date.now()
}

function getEffectiveMembership(user: UserRow) {
  if (String(user.role || "").toLowerCase() === "admin") return "admin"
  const membership = normalizeMembership(user.membership)
  if (isMembershipExpired(user)) return "standard"
  return membership
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not set"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not set"
  return date.toLocaleString()
}

function isOnlineNow(user: UserRow) {
  if (!user.last_seen) return false
  const seen = new Date(user.last_seen).getTime()
  return Date.now() - seen <= 5 * 60 * 1000
}

function getDisplayName(user: UserRow) {
  return user.full_name || user.name || user.username || user.email || "User"
}

function getInitial(user: UserRow) {
  return getDisplayName(user).charAt(0).toUpperCase()
}

function getMembershipLabel(user: UserRow) {
  const effectiveMembership = getEffectiveMembership(user)
  if (effectiveMembership === "admin") return "Admin"
  if (effectiveMembership === "platinum") return "Platinum"
  if (effectiveMembership === "premium") return "Premium"
  return "Standard"
}

function getMembershipBadge(user: UserRow) {
  const effectiveMembership = getEffectiveMembership(user)

  if (effectiveMembership === "admin") {
    return "border-violet-400/30 bg-violet-500/15 text-violet-200"
  }
  if (effectiveMembership === "platinum") {
    return "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-200"
  }
  if (effectiveMembership === "premium") {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
  }
  return "border-slate-600 bg-slate-800/80 text-slate-200"
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: string
}) {
  return (
    <div className={`rounded-[24px] border px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.18)] ${tone}`}>
      <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/70">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black tracking-tight text-white">{value}</div>
    </div>
  )
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[28px] border border-slate-800/90 bg-slate-900/90 p-5 shadow-[0_18px_40px_rgba(2,6,23,0.34)] backdrop-blur sm:p-6">
      <div className="mb-5">
        <h3 className="text-lg font-black tracking-tight text-white">{title}</h3>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      {children}
    </div>
  )
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
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [catalogueFilter, setCatalogueFilter] = useState<CatalogueFilter>("all")
  const [sortBy, setSortBy] = useState<SortOption>("az")

  const [editFullName, setEditFullName] = useState("")
  const [editUsername, setEditUsername] = useState("")
  const [editMembership, setEditMembership] = useState("standard")
  const [editAccountStatus, setEditAccountStatus] = useState("Active")
  const [editRole, setEditRole] = useState("user")
  const [editIsPremium, setEditIsPremium] = useState(false)

  const [editMembershipPaymentType, setEditMembershipPaymentType] =
    useState<MembershipPaymentType>("none")
  const [editMembershipDurationMonths, setEditMembershipDurationMonths] = useState("1")
  const [editMembershipStartedAt, setEditMembershipStartedAt] = useState("")
  const [editMembershipExpiresAt, setEditMembershipExpiresAt] = useState("")

  const [editCoins, setEditCoins] = useState("")
  const [coinReason, setCoinReason] = useState("")
  const [coinOperation, setCoinOperation] = useState<CoinOperation>("add")
  const [coinLoading, setCoinLoading] = useState(false)

  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [coinErrorMessage, setCoinErrorMessage] = useState("")
  const [coinSuccessMessage, setCoinSuccessMessage] = useState("")

  useEffect(() => {
    void checkAdminAndLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedUser) return

    const normalizedMembership = normalizeMembership(
      selectedUser.membership || (selectedUser.is_premium ? "premium" : "standard")
    )

    const defaultStart = selectedUser.membership_started_at
      ? formatLocalDateTimeInput(new Date(selectedUser.membership_started_at))
      : formatLocalDateTimeInput(new Date())

    const existingExpires = selectedUser.membership_expires_at
      ? formatLocalDateTimeInput(new Date(selectedUser.membership_expires_at))
      : addMonths(defaultStart, 1)

    const existingPaymentType =
      String(selectedUser.membership_payment_type || "").trim().toLowerCase() === "monthly"
        ? "monthly"
        : "none"

    setEditFullName(selectedUser.full_name || selectedUser.name || "")
    setEditUsername(selectedUser.username || "")
    setEditMembership(normalizedMembership)
    setEditAccountStatus(String(selectedUser.account_status || selectedUser.status || "Active"))
    setEditRole(String(selectedUser.role || "user"))
    setEditIsPremium(normalizedMembership === "premium" || normalizedMembership === "platinum")
    setEditMembershipPaymentType(existingPaymentType)
    setEditMembershipDurationMonths("1")
    setEditMembershipStartedAt(defaultStart)
    setEditMembershipExpiresAt(existingExpires)

    setEditCoins("")
    setCoinReason("")
    setCoinOperation("add")
    setCoinErrorMessage("")
    setCoinSuccessMessage("")
  }, [selectedUser])

  useEffect(() => {
    if (editMembershipPaymentType !== "monthly") return
    if (!editMembershipStartedAt) return

    const months = Math.max(1, Number(editMembershipDurationMonths) || 1)
    setEditMembershipExpiresAt(addMonths(editMembershipStartedAt, months))
  }, [editMembershipPaymentType, editMembershipDurationMonths, editMembershipStartedAt])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setUserModalOpen(false)
      }
    }

    if (userModalOpen) {
      window.addEventListener("keydown", handleEscape)
    }

    return () => {
      window.removeEventListener("keydown", handleEscape)
    }
  }, [userModalOpen])

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
      if (showLoader) setLoading(true)
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
      if (showLoader) setLoading(false)
    }
  }

  const catalogueCounts = useMemo(() => {
    return {
      all: users.length,
      standard: users.filter((user) => getEffectiveMembership(user) === "standard").length,
      premium: users.filter((user) => getEffectiveMembership(user) === "premium").length,
      platinum: users.filter((user) => getEffectiveMembership(user) === "platinum").length,
      admins: users.filter((user) => String(user.role || "").toLowerCase() === "admin").length,
      online: users.filter((user) => isOnlineNow(user)).length,
      offline: users.filter((user) => !isOnlineNow(user)).length,
    }
  }, [users])

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()

    let nextUsers = users.filter((user) => {
      const matchesSearch =
        !term ||
        (user.email || "").toLowerCase().includes(term) ||
        (user.full_name || "").toLowerCase().includes(term) ||
        (user.name || "").toLowerCase().includes(term) ||
        (user.username || "").toLowerCase().includes(term) ||
        (user.membership || "").toLowerCase().includes(term) ||
        (user.role || "").toLowerCase().includes(term)

      if (!matchesSearch) return false

      if (catalogueFilter === "all") return true
      if (catalogueFilter === "standard") return getEffectiveMembership(user) === "standard"
      if (catalogueFilter === "premium") return getEffectiveMembership(user) === "premium"
      if (catalogueFilter === "platinum") return getEffectiveMembership(user) === "platinum"
      if (catalogueFilter === "admins") return String(user.role || "").toLowerCase() === "admin"
      if (catalogueFilter === "online") return isOnlineNow(user)
      if (catalogueFilter === "offline") return !isOnlineNow(user)

      return true
    })

    nextUsers = [...nextUsers].sort((a, b) => {
      const nameA = getDisplayName(a).toLowerCase()
      const nameB = getDisplayName(b).toLowerCase()
      const timeA = new Date(a.created_at || 0).getTime() || 0
      const timeB = new Date(b.created_at || 0).getTime() || 0
      const coinsA = Number(a.jb_points || 0)
      const coinsB = Number(b.jb_points || 0)

      if (sortBy === "az") return nameA.localeCompare(nameB)
      if (sortBy === "za") return nameB.localeCompare(nameA)
      if (sortBy === "newest") return timeB - timeA
      if (sortBy === "oldest") return timeA - timeB
      if (sortBy === "coins_high") return coinsB - coinsA
      if (sortBy === "coins_low") return coinsA - coinsB

      return 0
    })

    return nextUsers
  }, [users, search, catalogueFilter, sortBy])

  const totalUsers = users.length
  const onlineUsers = users.filter((user) => isOnlineNow(user)).length
  const premiumUsers = users.filter((user) => {
    const membership = getEffectiveMembership(user)
    return membership === "premium" || membership === "platinum"
  }).length
  const adminsCount = users.filter((user) => String(user.role || "").toLowerCase() === "admin").length

  function openUserModal(user: UserRow) {
    setSelectedUser(user)
    setCoinErrorMessage("")
    setCoinSuccessMessage("")
    setErrorMessage("")
    setSuccessMessage("")
    setUserModalOpen(true)
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

      const paymentType =
        normalizedMembership === "standard" ? "none" : editMembershipPaymentType

      const membershipStartedAt =
        paymentType === "monthly" && editMembershipStartedAt
          ? new Date(editMembershipStartedAt).toISOString()
          : null

      const membershipExpiresAt =
        paymentType === "monthly" && editMembershipExpiresAt
          ? new Date(editMembershipExpiresAt).toISOString()
          : null

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
          membership_payment_type: paymentType,
          membership_duration_months:
            paymentType === "monthly"
              ? Math.max(1, Number(editMembershipDurationMonths) || 1)
              : null,
          membership_started_at: membershipStartedAt,
          membership_expires_at: membershipExpiresAt,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        setErrorMessage(result?.error || "Failed to update user.")
        return
      }

      setSuccessMessage("User profile updated successfully.")
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
    } catch (error) {
      console.error("Apply coin adjustment error:", error)
      setCoinErrorMessage("Failed to adjust JB Coins.")
    } finally {
      setCoinLoading(false)
    }
  }

  const catalogueButtons: Array<{ key: CatalogueFilter; label: string }> = [
    { key: "all", label: "All" },
    { key: "standard", label: "Standard" },
    { key: "premium", label: "Premium" },
    { key: "platinum", label: "Platinum" },
    { key: "admins", label: "Admins" },
    { key: "online", label: "Online" },
    { key: "offline", label: "Offline" },
  ]

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
    <div className="min-h-screen bg-[#020617] text-slate-100">
      <AdminHeader />

      <div className="mx-auto w-full max-w-[1800px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <section className="mb-6 overflow-hidden rounded-[32px] border border-blue-500/20 bg-[#04122b] shadow-[0_20px_55px_rgba(15,23,42,0.22)]">
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.34),transparent_32%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.34),transparent_28%),linear-gradient(135deg,#071533_0%,#020817_48%,#071a4a_100%)]" />
            <div className="absolute inset-y-0 right-0 w-[40%] bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.22),transparent_62%)]" />

            <div className="relative px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-4xl">
                  <div className="inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-200 shadow-[0_8px_24px_rgba(6,182,212,0.18)]">
                    User Management
                  </div>

                  <h1 className="mt-5 text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-5xl">
                    Admin User Catalogue
                  </h1>

                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                    Browse users like a premium catalogue with filters, sorting, live counts,
                    and click-to-open popup editing.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => loadUsers(true)}
                  disabled={loading || saving || coinLoading}
                  className="inline-flex items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/15 px-5 py-3 text-sm font-bold text-blue-100 transition hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Refreshing..." : "Refresh Users"}
                </button>
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatChip label="Total Users" value={totalUsers.toLocaleString()} tone="border-white/10 bg-white/10" />
                <StatChip label="Online Now" value={onlineUsers.toLocaleString()} tone="border-emerald-400/20 bg-emerald-500/10" />
                <StatChip label="Premium / Platinum" value={premiumUsers.toLocaleString()} tone="border-amber-400/20 bg-amber-500/10" />
                <StatChip label="Admins" value={adminsCount.toLocaleString()} tone="border-violet-400/20 bg-violet-500/10" />
              </div>
            </div>
          </div>
        </section>

        {(errorMessage || successMessage) && (
          <div
            className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold shadow-sm ${
              errorMessage
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {errorMessage || successMessage}
          </div>
        )}

        <section className="mb-5 rounded-[28px] border border-slate-800/90 bg-slate-900/90 p-4 shadow-[0_18px_40px_rgba(2,6,23,0.34)] backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, username, membership, or role"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <div className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-slate-300">
                Showing {filteredUsers.length.toLocaleString()} users
              </div>
              <div className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-slate-300">
                Selected: {selectedUser ? getDisplayName(selectedUser) : "None"}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {catalogueButtons.map((item) => {
                const active = catalogueFilter === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setCatalogueFilter(item.key)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${
                      active
                        ? "border-blue-400/30 bg-blue-500/15 text-blue-200"
                        : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">
                      {catalogueCounts[item.key]}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm font-bold text-slate-300">Sort</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-blue-500"
              >
                <option value="az">Name A–Z</option>
                <option value="za">Name Z–A</option>
                <option value="newest">Newest Joined</option>
                <option value="oldest">Oldest Joined</option>
                <option value="coins_high">Most Coins</option>
                <option value="coins_low">Least Coins</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-800/90 bg-slate-900/90 p-5 shadow-[0_18px_40px_rgba(2,6,23,0.34)]">
          <div className="mb-5">
            <h2 className="text-2xl font-black text-white">Registered Users</h2>
            <p className="mt-1 text-sm text-slate-400">
              Compact profile cards with catalogue filters and sorting.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-10 text-sm text-slate-400">
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-10 text-sm text-slate-400">
              No users found.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {filteredUsers.map((user) => {
                const online = isOnlineNow(user)

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => openUserModal(user)}
                    className="group rounded-[24px] border border-slate-800 bg-slate-950/80 p-4 text-left shadow-[0_12px_30px_rgba(2,6,23,0.28)] transition hover:-translate-y-1 hover:border-blue-500/30 hover:bg-slate-900"
                  >
                    <div className="relative w-fit">
                      <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-blue-500/15 text-2xl font-black text-blue-200 ring-1 ring-blue-400/20">
                        {getInitial(user)}
                      </div>
                      <span
                        className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-slate-950 ${
                          online ? "bg-emerald-400" : "bg-slate-600"
                        }`}
                      />
                    </div>

                    <div className="mt-4">
                      <div className="line-clamp-1 text-[15px] font-black text-white">
                        {getDisplayName(user)}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                        {user.email || "No email"}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {userModalOpen && selectedUser ? (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 p-3 backdrop-blur-sm sm:p-5">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[30px] border border-slate-800 bg-[#020617] shadow-[0_24px_80px_rgba(2,6,23,0.65)]">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4 sm:px-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-blue-300">
                  User Profile Popup
                </div>
                <div className="mt-1 text-lg font-black text-white">{getDisplayName(selectedUser)}</div>
              </div>

              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-xl text-white transition hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {(errorMessage || successMessage) && (
                <div
                  className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold shadow-sm ${
                    errorMessage
                      ? "border-red-500/30 bg-red-500/10 text-red-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  {errorMessage || successMessage}
                </div>
              )}

              <div className="overflow-hidden rounded-[30px] border border-slate-800/90 bg-slate-900/90 shadow-[0_18px_40px_rgba(2,6,23,0.34)]">
                <div className="relative h-40 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_45%,#312e81_100%)]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.18),transparent_34%)]" />
                </div>

                <div className="relative px-5 pb-5 sm:px-6">
                  <div className="-mt-14 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex items-end gap-4">
                      <div className="flex h-28 w-28 items-center justify-center rounded-[28px] border-4 border-slate-900 bg-gradient-to-br from-blue-500/25 to-violet-500/25 text-4xl font-black text-white shadow-[0_12px_30px_rgba(15,23,42,0.35)] backdrop-blur">
                        {getInitial(selectedUser)}
                      </div>

                      <div className="pb-1">
                        <h2 className="text-3xl font-black tracking-tight text-white">
                          {getDisplayName(selectedUser)}
                        </h2>
                        <div className="mt-1 text-sm text-slate-300">
                          {selectedUser.email || "No email"}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getMembershipBadge(
                              selectedUser
                            )}`}
                          >
                            {getMembershipLabel(selectedUser)}
                          </span>

                          <span className="inline-flex rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 text-xs font-bold text-slate-200">
                            {String(selectedUser.role || "user")}
                          </span>

                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                              isOnlineNow(selectedUser)
                                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                                : "border-slate-700 bg-slate-950/80 text-slate-300"
                            }`}
                          >
                            {isOnlineNow(selectedUser) ? "Online" : "Offline"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center backdrop-blur">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">
                          JB Coins
                        </div>
                        <div className="mt-1 text-xl font-black text-amber-300">
                          {Number(selectedUser.jb_points || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center backdrop-blur">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">
                          Payment
                        </div>
                        <div className="mt-1 text-sm font-black text-white">
                          {selectedUser.membership_payment_type || "none"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center backdrop-blur">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">
                          Joined
                        </div>
                        <div className="mt-1 text-sm font-black text-white">
                          {selectedUser.created_at
                            ? new Date(selectedUser.created_at).toLocaleDateString()
                            : "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                      <span className="font-bold text-white">User ID:</span> {selectedUser.id}
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                      <span className="font-bold text-white">Last Seen:</span> {formatDateTime(selectedUser.last_seen)}
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                      <span className="font-bold text-white">Membership Starts:</span> {formatDateTime(selectedUser.membership_started_at)}
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                      <span className="font-bold text-white">Membership Expires:</span> {formatDateTime(selectedUser.membership_expires_at)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <div className="space-y-5">
                  <SectionCard
                    title="Profile & Access"
                    subtitle="Edit the user profile, role, membership, and account status."
                  >
                    <div className="grid gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-200">Full Name</label>
                        <input
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-200">Username</label>
                        <input
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-200">Membership</label>
                          <select
                            value={editMembership}
                            onChange={(e) => {
                              const nextMembership = normalizeMembership(e.target.value)
                              setEditMembership(nextMembership)
                              setEditIsPremium(
                                nextMembership === "premium" || nextMembership === "platinum"
                              )

                              if (nextMembership === "standard") {
                                setEditMembershipPaymentType("none")
                                setEditMembershipStartedAt("")
                                setEditMembershipExpiresAt("")
                              } else if (!editMembershipStartedAt) {
                                const now = formatLocalDateTimeInput(new Date())
                                setEditMembershipStartedAt(now)
                                setEditMembershipExpiresAt(addMonths(now, 1))
                              }
                            }}
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                          >
                            <option value="standard">Standard</option>
                            <option value="premium">Premium</option>
                            <option value="platinum">Platinum</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-200">Role</label>
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-200">Account Status</label>
                          <select
                            value={editAccountStatus}
                            onChange={(e) => setEditAccountStatus(e.target.value)}
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                          >
                            <option value="Active">Active</option>
                            <option value="Pending">Pending</option>
                            <option value="Suspended">Suspended</option>
                            <option value="Banned">Banned</option>
                          </select>
                        </div>

                        <label className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-200">
                          <input
                            type="checkbox"
                            checked={editIsPremium}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setEditIsPremium(checked)

                              if (!checked) {
                                setEditMembership("standard")
                                setEditMembershipPaymentType("none")
                                setEditMembershipStartedAt("")
                                setEditMembershipExpiresAt("")
                              } else if (editMembership === "standard") {
                                const now = formatLocalDateTimeInput(new Date())
                                setEditMembership("premium")
                                setEditMembershipPaymentType("monthly")
                                setEditMembershipStartedAt(now)
                                setEditMembershipExpiresAt(addMonths(now, 1))
                              }
                            }}
                          />
                          Premium Access
                        </label>
                      </div>

                      {editMembership !== "standard" ? (
                        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-bold text-slate-200">Payment Type</label>
                              <select
                                value={editMembershipPaymentType}
                                onChange={(e) => {
                                  const nextType = e.target.value as MembershipPaymentType
                                  setEditMembershipPaymentType(nextType)

                                  if (nextType === "monthly") {
                                    const baseStart =
                                      editMembershipStartedAt || formatLocalDateTimeInput(new Date())
                                    setEditMembershipStartedAt(baseStart)
                                    setEditMembershipExpiresAt(
                                      addMonths(
                                        baseStart,
                                        Math.max(1, Number(editMembershipDurationMonths) || 1)
                                      )
                                    )
                                  } else {
                                    setEditMembershipStartedAt("")
                                    setEditMembershipExpiresAt("")
                                  }
                                }}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                              >
                                <option value="none">No payment schedule</option>
                                <option value="monthly">Monthly</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-bold text-slate-200">Duration</label>
                              <select
                                value={editMembershipDurationMonths}
                                onChange={(e) => setEditMembershipDurationMonths(e.target.value)}
                                disabled={editMembershipPaymentType !== "monthly"}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <option value="1">1 Month</option>
                                <option value="2">2 Months</option>
                                <option value="3">3 Months</option>
                                <option value="6">6 Months</option>
                                <option value="12">12 Months</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-bold text-slate-200">Start Date</label>
                              <input
                                type="datetime-local"
                                value={editMembershipStartedAt}
                                onChange={(e) => setEditMembershipStartedAt(e.target.value)}
                                disabled={editMembershipPaymentType !== "monthly"}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-bold text-slate-200">Expiry Date</label>
                              <input
                                type="datetime-local"
                                value={editMembershipExpiresAt}
                                onChange={(e) => setEditMembershipExpiresAt(e.target.value)}
                                disabled={editMembershipPaymentType !== "monthly"}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <button
                        onClick={saveUser}
                        disabled={saving}
                        className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {saving ? "Saving..." : "Save User Changes"}
                      </button>
                    </div>
                  </SectionCard>
                </div>

                <div className="space-y-5">
                  <SectionCard
                    title="Account Snapshot"
                    subtitle="Quick account information and activity details."
                  >
                    <div className="grid gap-3 text-sm text-slate-300">
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
                        <span className="font-bold text-white">Online Status:</span>{" "}
                        {isOnlineNow(selectedUser) ? "Online" : "Offline"}
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
                        <span className="font-bold text-white">Current Payment Type:</span>{" "}
                        {selectedUser.membership_payment_type || "none"}
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
                        <span className="font-bold text-white">Created At:</span>{" "}
                        {formatDateTime(selectedUser.created_at)}
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="JB Coins Control"
                    subtitle="Add, subtract, or set the exact JB Coin balance for this user."
                  >
                    <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-300">
                      Current Balance: {Number(selectedUser.jb_points || 0).toLocaleString()} JB Coins
                    </div>

                    {coinErrorMessage ? (
                      <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
                        {coinErrorMessage}
                      </div>
                    ) : null}

                    {coinSuccessMessage ? (
                      <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-300">
                        {coinSuccessMessage}
                      </div>
                    ) : null}

                    <div className="grid gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-200">Operation</label>
                        <select
                          value={coinOperation}
                          onChange={(e) => setCoinOperation(e.target.value as CoinOperation)}
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                        >
                          <option value="add">Add Coins</option>
                          <option value="subtract">Subtract Coins</option>
                          <option value="set">Set Exact Coins</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-200">Amount</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={editCoins}
                          onChange={(e) => setEditCoins(e.target.value)}
                          placeholder="Enter amount"
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-200">Reason</label>
                        <input
                          value={coinReason}
                          onChange={(e) => setCoinReason(e.target.value)}
                          placeholder="Enter reason"
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={applyCoinAdjustment}
                        disabled={coinLoading}
                        className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
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
                        }}
                        className="inline-flex items-center justify-center rounded-2xl bg-slate-700 px-5 py-3 text-sm font-bold text-slate-100 transition hover:bg-slate-600"
                      >
                        Reset Coin Form
                      </button>
                    </div>
                  </SectionCard>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setUserModalOpen(false)}
            className="absolute inset-0 -z-10"
            aria-hidden="true"
          />
        </div>
      ) : null}
    </div>
  )
}
