"use client"

import { useEffect, useMemo, useState } from "react"
import AdminHeader from "@/app/components/AdminHeader"
import { createClient } from "@/lib/supabase/client"
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Eye,
  ImageIcon,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react"

type OrderStatus = "pending" | "approved" | "rejected"

type OrderRow = {
  id: string
  user_id: string
  amount_php: number
  coins: number
  label: string | null
  payment_method: string
  payment_reference: string | null
  proof_url: string | null
  status: OrderStatus
  created_at: string
}

type FilterType = "all" | OrderStatus
type SortType = "newest" | "oldest" | "amount_high" | "amount_low" | "coins_high" | "coins_low"

function formatPeso(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCoins(value: number) {
  return `${new Intl.NumberFormat("en-PH").format(value)} JB Coins`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function getStatusClass(status: OrderStatus) {
  if (status === "approved") {
    return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
  }

  if (status === "rejected") {
    return "border-red-400/20 bg-red-500/10 text-red-300"
  }

  return "border-amber-400/20 bg-amber-500/10 text-amber-300"
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_14px_34px_rgba(2,6,23,0.32)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
          {label}
        </div>
        <div className="rounded-2xl bg-white/10 p-2 text-sky-200">
          <Icon size={16} />
        </div>
      </div>

      <div className={`mt-3 text-3xl font-black tracking-tight ${color}`}>{value}</div>
    </div>
  )
}

export default function AdminCoinPurchasesPage() {
  const supabase = useMemo(() => createClient(), [])

  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [sortBy, setSortBy] = useState<SortType>("newest")

  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null)

  async function loadOrders(showLoader = true) {
    try {
      if (showLoader) setLoading(true)
      else setRefreshing(true)

      setError("")

      const { data, error } = await supabase
        .from("coin_purchase_orders")
        .select(
          "id, user_id, amount_php, coins, label, payment_method, payment_reference, proof_url, status, created_at"
        )
        .order("created_at", { ascending: false })

      if (error) throw error

      setOrders((data as OrderRow[]) || [])
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Failed to load orders.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadOrders()
  }, [])

  async function approveOrder(id: string) {
    try {
      setApprovingId(id)
      setError("")
      setMessage("")

      const res = await fetch(`/api/admin/coin-purchases/${id}/approve`, {
        method: "POST",
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || "Failed to approve order.")
      }

      setMessage(data?.message || "Order approved and JB Coins credited.")
      await loadOrders(false)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Failed to approve order.")
    } finally {
      setApprovingId(null)
    }
  }

  async function rejectOrder(id: string) {
    try {
      setRejectingId(id)
      setError("")
      setMessage("")

      const res = await fetch(`/api/admin/coin-purchases/${id}/reject`, {
        method: "POST",
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || "Failed to reject order.")
      }

      setMessage(data?.message || "Order rejected successfully.")
      await loadOrders(false)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Failed to reject order.")
    } finally {
      setRejectingId(null)
    }
  }

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase()

    let nextOrders = orders.filter((order) => {
      const matchesFilter = filter === "all" ? true : order.status === filter

      if (!term) return matchesFilter

      const haystack = [
        order.user_id,
        order.label || "",
        order.payment_method,
        order.payment_reference || "",
        order.status,
        String(order.amount_php),
        String(order.coins),
      ]
        .join(" ")
        .toLowerCase()

      return matchesFilter && haystack.includes(term)
    })

    nextOrders = [...nextOrders].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime() || 0
      const timeB = new Date(b.created_at).getTime() || 0

      if (sortBy === "newest") return timeB - timeA
      if (sortBy === "oldest") return timeA - timeB
      if (sortBy === "amount_high") return b.amount_php - a.amount_php
      if (sortBy === "amount_low") return a.amount_php - b.amount_php
      if (sortBy === "coins_high") return b.coins - a.coins
      if (sortBy === "coins_low") return a.coins - b.coins
      return 0
    })

    return nextOrders
  }, [orders, search, filter, sortBy])

  const stats = {
    total: orders.length,
    pending: orders.filter((order) => order.status === "pending").length,
    approved: orders.filter((order) => order.status === "approved").length,
    rejected: orders.filter((order) => order.status === "rejected").length,
  }

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_25%),linear-gradient(180deg,#020617_0%,#0b1220_48%,#111827_100%)] px-3 py-4 text-white sm:px-5 lg:px-8">
        <div className="mx-auto w-full max-w-[1800px]">
          <AdminHeader />

          <section className="mt-4 overflow-hidden rounded-[30px] border border-white/10 bg-slate-900/75 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
            <div className="relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.22),transparent_30%),linear-gradient(135deg,#0f172a_0%,#0b1220_45%,#111827_100%)]" />
              <div className="relative flex flex-col gap-5 px-5 py-6 sm:px-6 sm:py-7 lg:flex-row lg:items-end lg:justify-between lg:px-8">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-sky-200">
                    <ShieldCheck size={14} />
                    Admin Payments
                  </div>

                  <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                    Coin Purchase Orders
                  </h1>

                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Review payment proofs, verify references, and approve or reject coin purchase requests
                    in a cleaner premium admin layout.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void loadOrders(false)}
                  disabled={refreshing}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
                >
                  <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                  {refreshing ? "Refreshing..." : "Refresh Orders"}
                </button>
              </div>
            </div>
          </section>

          <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard label="Total" value={stats.total} icon={BadgeCheck} color="text-white" />
            <StatCard label="Pending" value={stats.pending} icon={Clock3} color="text-amber-300" />
            <StatCard label="Approved" value={stats.approved} icon={CheckCircle2} color="text-emerald-300" />
            <StatCard label="Rejected" value={stats.rejected} icon={X} color="text-red-300" />
          </section>

          {message ? (
            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-300">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
              {error}
            </div>
          ) : null}

          <section className="mt-5 rounded-[28px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.26)] backdrop-blur sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative xl:flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search user id, package, reference, method, or status"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(["all", "pending", "approved", "rejected"] as FilterType[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={`rounded-2xl px-4 py-2.5 text-sm font-black capitalize transition ${
                      filter === item
                        ? "bg-sky-500 text-white shadow-lg"
                        : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-sky-400/40"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="amount_high">Highest Amount</option>
                <option value="amount_low">Lowest Amount</option>
                <option value="coins_high">Most Coins</option>
                <option value="coins_low">Least Coins</option>
              </select>
            </div>
          </section>

          <section className="mt-5">
            {loading ? (
              <div className="rounded-[28px] border border-white/10 bg-slate-900/75 px-4 py-16 text-center text-sm font-semibold text-slate-300 shadow-xl backdrop-blur">
                Loading purchase orders...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-white/10 bg-slate-900/75 px-4 py-16 text-center shadow-xl backdrop-blur">
                <div className="mx-auto max-w-md">
                  <div className="text-lg font-black text-white">No matching orders found</div>
                  <div className="mt-2 text-sm text-slate-400">
                    Try changing the search term, filter, or sort option.
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredOrders.map((order) => (
                  <article
                    key={order.id}
                    className="rounded-[28px] border border-white/10 bg-slate-900/80 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.26)] backdrop-blur sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          {formatDate(order.created_at)}
                        </div>
                        <div className="mt-2 text-lg font-black text-white">
                          {order.label || formatPeso(order.amount_php)}
                        </div>
                      </div>

                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${getStatusClass(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                          Amount
                        </div>
                        <div className="mt-1 text-base font-black text-amber-300">
                          {formatPeso(order.amount_php)}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                          Coins
                        </div>
                        <div className="mt-1 text-base font-black text-white">
                          {formatCoins(order.coins)}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                          Method
                        </div>
                        <div className="mt-1 text-sm font-black capitalize text-white">
                          {order.payment_method || "—"}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                          Reference
                        </div>
                        <div className="mt-1 truncate text-sm font-semibold text-slate-200">
                          {order.payment_reference || "—"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                        User ID
                      </div>
                      <div className="mt-1 break-all text-sm text-slate-300">{order.user_id}</div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {order.proof_url ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setPreviewProofUrl(order.proof_url)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
                          >
                            <Eye size={16} />
                            Preview Proof
                          </button>

                          <a
                            href={order.proof_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-black text-sky-200 transition hover:bg-sky-500/15"
                          >
                            <ImageIcon size={16} />
                            Open Proof
                          </a>
                        </>
                      ) : (
                        <div className="sm:col-span-2 rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm font-semibold text-slate-400">
                          No proof uploaded.
                        </div>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => void approveOrder(order.id)}
                        disabled={
                          order.status !== "pending" ||
                          approvingId === order.id ||
                          rejectingId === order.id
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle2 size={16} />
                        {approvingId === order.id
                          ? "Approving..."
                          : order.status === "approved"
                            ? "Approved"
                            : "Approve"}
                      </button>

                      <button
                        type="button"
                        onClick={() => void rejectOrder(order.id)}
                        disabled={
                          order.status !== "pending" ||
                          rejectingId === order.id ||
                          approvingId === order.id
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <X size={16} />
                        {rejectingId === order.id
                          ? "Rejecting..."
                          : order.status === "rejected"
                            ? "Rejected"
                            : "Reject"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {previewProofUrl ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 px-3 py-4 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl rounded-[28px] border border-white/10 bg-slate-900 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-black text-white">Receipt Preview</div>
                <div className="text-sm text-slate-400">
                  Review the uploaded proof before approving or rejecting.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewProofUrl(null)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
                aria-label="Close proof preview"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/30">
              <img
                src={previewProofUrl}
                alt="Payment proof"
                className="max-h-[75vh] w-full object-contain"
              />
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <a
                href={previewProofUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/10 px-5 py-3 text-sm font-black text-sky-200 transition hover:bg-sky-500/15"
              >
                Open Original
              </a>

              <button
                type="button"
                onClick={() => setPreviewProofUrl(null)}
                className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
