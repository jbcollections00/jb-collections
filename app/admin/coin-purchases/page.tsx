"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  Coins,
  Clock3,
  Mail,
  RefreshCw,
  Search,
  Trash2,
  User2,
  Wallet,
  XCircle,
} from "lucide-react"
import AdminHeader from "@/app/components/AdminHeader"
import AdminToast from "@/app/components/AdminToast"
import { createClient } from "@/lib/supabase/client"

type OrderStatus =
  | "pending"
  | "approved"
  | "credited"
  | "rejected"
  | "removed"
  | string

type Order = {
  id: string
  user_id: string
  payer_name: string | null
  payer_email: string | null
  amount: number | null
  coins: number | null
  label: string | null
  payment_method: string | null
  reference_number: string | null
  status: OrderStatus
  created_at: string
  notes?: string | null
}

type ToastState = {
  open: boolean
  title: string
  message?: string
  variant?: "success" | "error" | "info"
}

type CoinBurst = {
  id: number
  x: number
  y: number
}

const STATUS_STYLES: Record<string, string> = {
  pending: "border-amber-400/25 bg-amber-500/10 text-amber-200",
  approved: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
  credited: "border-sky-400/25 bg-sky-500/10 text-sky-200",
  rejected: "border-rose-400/25 bg-rose-500/10 text-rose-200",
  removed: "border-slate-400/25 bg-slate-500/10 text-slate-200",
}

function formatPeso(value: number | null | undefined) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value ?? 0)
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return value
  }
}

export default function AdminCoinPurchasesPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "credited" | "rejected" | "removed"
  >("all")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [burst, setBurst] = useState<CoinBurst[]>([])
  const [toast, setToast] = useState<ToastState>({
    open: false,
    title: "",
    message: "",
    variant: "info",
  })

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }))
  }, [])

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.replace("/secure-admin-portal-7X9")
      return false
    }

    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (data?.role !== "admin") {
      router.replace("/secure-admin-portal-7X9")
      return false
    }

    return true
  }

  const loadOrders = useCallback(async () => {
    setRefreshing(true)

    const { data, error } = await supabase
      .from("coin_purchase_orders")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      setToast({
        open: true,
        title: "Failed to load orders",
        message: error.message,
        variant: "error",
      })
    } else if (data) {
      setOrders(data)
    }

    setLoading(false)
    setRefreshing(false)
  }, [supabase])

  useEffect(() => {
    ;(async () => {
      const ok = await checkAdmin()
      if (!ok) return
      await loadOrders()
    })()
  }, [loadOrders])

  function spawnCoinBurst() {
    const next = Array.from({ length: 12 }).map((_, index) => ({
      id: Date.now() + index,
      x: Math.random() * 260 - 130,
      y: -Math.random() * 140 - 30,
    }))

    setBurst(next)
    window.setTimeout(() => setBurst([]), 1200)
  }

  async function handleApprove(order: Order) {
    if (busyId) return

    setBusyId(order.id)

    try {
      const response = await fetch(
        `/api/admin/coin-purchases/${order.id}/approve`,
        {
          method: "POST",
        }
      )

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || "Approval failed.")
      }

      spawnCoinBurst()
      setToast({
        open: true,
        title: "Coins credited successfully",
        message:
          payload?.message ||
          `${order.coins ?? 0} coins were added to the user wallet.`,
        variant: "success",
      })

      await loadOrders()
    } catch (error) {
      setToast({
        open: true,
        title: "Approval failed",
        message:
          error instanceof Error ? error.message : "Something went wrong.",
        variant: "error",
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(order: Order) {
    if (busyId) return

    setBusyId(order.id)

    try {
      const response = await fetch(
        `/api/admin/coin-purchases/${order.id}/reject`,
        {
          method: "POST",
        }
      )

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || "Reject failed.")
      }

      setToast({
        open: true,
        title: "Order rejected",
        message:
          payload?.message ||
          "The order status has been updated to rejected.",
        variant: "info",
      })

      await loadOrders()
    } catch (error) {
      setToast({
        open: true,
        title: "Reject failed",
        message:
          error instanceof Error ? error.message : "Something went wrong.",
        variant: "error",
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(order: Order) {
    if (busyId) return

    const confirmed = window.confirm(
      "Delete this order permanently? This cannot be undone."
    )

    if (!confirmed) return

    setBusyId(order.id)

    try {
      const response = await fetch(
        `/api/admin/coin-purchases/${order.id}/delete`,
        {
          method: "POST",
        }
      )

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || "Delete failed.")
      }

      setToast({
        open: true,
        title: "Order deleted",
        message:
          payload?.message || "The payment order was removed successfully.",
        variant: "success",
      })

      await loadOrders()
    } catch (error) {
      setToast({
        open: true,
        title: "Delete failed",
        message:
          error instanceof Error ? error.message : "Something went wrong.",
        variant: "error",
      })
    } finally {
      setBusyId(null)
    }
  }

  const filteredOrders = orders.filter((order) => {
    const statusMatch = statusFilter === "all" ? true : order.status === statusFilter

    const haystack = [
      order.payer_name,
      order.payer_email,
      order.reference_number,
      order.label,
      order.payment_method,
      order.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    const queryMatch = query.trim()
      ? haystack.includes(query.trim().toLowerCase())
      : true

    return statusMatch && queryMatch
  })

  const totals = {
    totalAmount: orders.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    totalCoins: orders.reduce((sum, item) => sum + (item.coins ?? 0), 0),
    pending: orders.filter((item) => item.status === "pending").length,
    credited: orders.filter((item) => item.status === "credited").length,
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
          <RefreshCw size={18} className="animate-spin" />
          Loading coin purchases...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_22%),linear-gradient(180deg,#020617_0%,#08101f_52%,#0f172a_100%)] px-4 py-4 text-white sm:px-6 sm:py-6 lg:px-8">
      <style jsx global>{`
        @keyframes coin-burst {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) scale(0.4) rotate(0deg);
          }
          10% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--x), var(--y), 0) scale(1.15)
              rotate(180deg);
          }
        }

        @keyframes soft-pop {
          0% {
            transform: scale(0.96);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1850px]">
        <AdminHeader />

        <section className="relative mt-4 overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/75 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_28%),linear-gradient(135deg,#0f172a_0%,#0b1220_42%,#111827_100%)]" />

          <div className="relative px-5 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-sky-200">
                  10/10 Admin Coin Control Center
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl xl:text-5xl">
                  Review, approve, credit, and track every JB Coin payment in one place
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  Approving an order automatically credits the user wallet and writes a transaction log.
                  You can also reject or permanently delete payment records here.
                </p>
              </div>

              <button
                onClick={loadOrders}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                Refresh Orders
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 [animation:soft-pop_300ms_ease]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Total Sales</p>
                    <h2 className="mt-2 text-3xl font-black text-white">{formatPeso(totals.totalAmount)}</h2>
                  </div>
                  <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300">
                    <Wallet size={22} />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 [animation:soft-pop_350ms_ease]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Coins Ordered</p>
                    <h2 className="mt-2 text-3xl font-black text-white">
                      {new Intl.NumberFormat("en-PH").format(totals.totalCoins)}
                    </h2>
                  </div>
                  <div className="rounded-2xl bg-yellow-500/15 p-3 text-yellow-300">
                    <Coins size={22} />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 [animation:soft-pop_400ms_ease]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Pending Orders</p>
                    <h2 className="mt-2 text-3xl font-black text-white">{totals.pending}</h2>
                  </div>
                  <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-300">
                    <Clock3 size={22} />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 [animation:soft-pop_450ms_ease]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Credited Orders</p>
                    <h2 className="mt-2 text-3xl font-black text-white">{totals.credited}</h2>
                  </div>
                  <div className="rounded-2xl bg-sky-500/15 p-3 text-sky-300">
                    <CheckCircle2 size={22} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[30px] border border-white/10 bg-slate-900/70 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.35)] backdrop-blur sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, reference, package..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as typeof statusFilter)
              }
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white outline-none"
            >
              <option value="all" className="bg-slate-900">All statuses</option>
              <option value="pending" className="bg-slate-900">Pending</option>
              <option value="approved" className="bg-slate-900">Approved</option>
              <option value="credited" className="bg-slate-900">Credited</option>
              <option value="rejected" className="bg-slate-900">Rejected</option>
              <option value="removed" className="bg-slate-900">Removed</option>
            </select>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-300">
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
          </div>
        </section>

        <section className="relative mt-5 overflow-hidden rounded-[30px] border border-white/10 bg-slate-900/70 shadow-[0_18px_60px_rgba(0,0,0,0.36)] backdrop-blur">
          <div className="absolute inset-0 pointer-events-none">
            {burst.map((coin) => (
              <span
                key={coin.id}
                className="absolute left-1/2 top-[88px] inline-flex h-9 w-9 items-center justify-center rounded-full border border-yellow-300/40 bg-yellow-400/15 text-lg shadow-[0_10px_30px_rgba(250,204,21,0.25)]"
                style={
                  {
                    "--x": `${coin.x}px`,
                    "--y": `${coin.y}px`,
                    animation: "coin-burst 1.1s ease forwards",
                  } as React.CSSProperties
                }
              >
                🪙
              </span>
            ))}
          </div>

          <div className="relative border-b border-white/10 px-5 py-4 sm:px-6">
            <h2 className="text-xl font-black text-white">Payment Queue</h2>
            <p className="mt-1 text-sm text-slate-400">
              Approve to auto-credit the wallet and write transaction history.
              Reject to stop it. Delete permanently to remove the record.
            </p>
          </div>

          <div className="grid gap-4 p-4 sm:p-5">
            {filteredOrders.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-16 text-center">
                <p className="text-lg font-bold text-white">No orders found</p>
                <p className="mt-2 text-sm text-slate-400">Try another search or status filter.</p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const statusClass =
                  STATUS_STYLES[order.status] ||
                  "border-white/15 bg-white/5 text-slate-200"

                const isBusy = busyId === order.id
                const isDone =
                  order.status === "credited" ||
                  order.status === "approved" ||
                  order.status === "rejected" ||
                  order.status === "removed"

                return (
                  <article
                    key={order.id}
                    className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.25)] sm:p-5"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-slate-200">
                            <User2 size={14} />
                            {order.payer_name || "Unknown payer"}
                          </div>

                          <div
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] ${statusClass}`}
                          >
                            {order.status}
                          </div>

                          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300">
                            {formatDate(order.created_at)}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Email</p>
                            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                              <Mail size={15} className="text-slate-400" />
                              <span className="truncate">{order.payer_email || "No email"}</span>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Package</p>
                            <p className="mt-2 text-sm font-semibold text-white">{order.label || "JB Coin Package"}</p>
                            <p className="mt-1 text-xs text-slate-400">{order.payment_method || "Unknown method"}</p>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Amount</p>
                            <p className="mt-2 text-lg font-black text-white">{formatPeso(order.amount)}</p>
                            <p className="mt-1 text-xs text-slate-400">Ref: {order.reference_number || "No reference"}</p>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Coins</p>
                            <p className="mt-2 text-lg font-black text-yellow-300">
                              {new Intl.NumberFormat("en-PH").format(order.coins ?? 0)} coins
                            </p>
                            <p className="mt-1 text-xs text-slate-400">User ID: {order.user_id}</p>
                          </div>
                        </div>
                      </div>

                      <div className="xl:w-[280px]">
                        <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Admin Actions</p>

                          <div className="mt-4 grid gap-3">
                            <button
                              onClick={() => handleApprove(order)}
                              disabled={isBusy || isDone}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isBusy ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={16} />
                              )}
                              Approve + Auto Credit
                            </button>

                            <button
                              onClick={() => handleReject(order)}
                              disabled={isBusy || isDone}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500/90 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isBusy ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : (
                                <XCircle size={16} />
                              )}
                              Reject Order
                            </button>

                            <button
                              onClick={() => handleDelete(order)}
                              disabled={isBusy}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-700 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isBusy ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                              Delete Permanently
                            </button>
                          </div>

                          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-xs leading-6 text-slate-300">
                            Approve credits the wallet. Reject blocks the payment. Delete permanently removes the order record.
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </section>
      </div>

      <AdminToast
        open={toast.open}
        title={toast.title}
        description={toast.message}
        variant={toast.variant}
        onClose={closeToast}
      />
    </div>
  )
}
