"use client"

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  ImageIcon,
  Mail,
  RefreshCw,
  Search,
  Trash2,
  User2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Inbox,
} from "lucide-react"
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
  user_username?: string | null
  amount: number | null
  coins: number | null
  label: string | null
  payment_method: string | null
  reference_number: string | null
  status: OrderStatus
  created_at: string
  notes?: string | null
  receipt_url?: string | null
  receipt_path?: string | null
  receipt_name?: string | null
  receipt_file_name?: string | null
  proof_url?: string | null
  proof_image_url?: string | null
  screenshot_url?: string | null
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

function playNotificationSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    const now = ctx.currentTime
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()

    osc1.type = "sine"
    osc1.frequency.setValueAtTime(587.33, now) // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15) // A5

    gain1.gain.setValueAtTime(0.2, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

    osc1.connect(gain1)
    gain1.connect(ctx.destination)

    osc1.start(now)
    osc1.stop(now + 0.4)
  } catch (e) {
    console.error("Audio notification play error:", e)
  }
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

function getReceiptUrl(order: Order) {
  const candidates = [
    order.receipt_url,
    order.proof_url,
    order.proof_image_url,
    order.screenshot_url,
    order.receipt_path,
  ]

  for (const value of candidates) {
    if (!value) continue
    if (/^https?:\/\//i.test(value) || value.startsWith("/")) {
      return value
    }
  }

  return null
}

function getReceiptLabel(order: Order) {
  return (
    order.receipt_name ||
    order.receipt_file_name ||
    (order.receipt_path ? order.receipt_path.split("/").pop() : null) ||
    "Receipt preview"
  )
}

export default function AdminCoinPurchasesPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"pending" | "credited" | "rejected" | "all">("pending")
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
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

  const checkAdmin = useCallback(async () => {
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
  }, [supabase, router])

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
      setLoading(false)
      setRefreshing(false)
      return
    }

    if (data && data.length > 0) {
      const userIds = Array.from(
        new Set(data.map((item) => item.user_id).filter(Boolean))
      )

      let profilesMap: Record<
        string,
        { full_name?: string | null; name?: string | null; username?: string | null; email?: string | null }
      > = {}

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, name, username, email")
          .in("id", userIds)

        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = p
            return acc
          }, {} as typeof profilesMap)
        }
      }

      const enrichedOrders: Order[] = data.map((order) => {
        const profile = profilesMap[order.user_id]
        const resolvedName =
          order.payer_name?.trim() ||
          profile?.full_name?.trim() ||
          profile?.name?.trim() ||
          profile?.username?.trim() ||
          "Unknown Account"

        const resolvedEmail =
          order.payer_email?.trim() ||
          profile?.email?.trim() ||
          "No email connected"

        return {
          ...order,
          payer_name: resolvedName,
          payer_email: resolvedEmail,
          user_username: profile?.username || null,
        }
      })

      setOrders(enrichedOrders)
    } else {
      setOrders([])
    }

    setLoading(false)
    setRefreshing(false)
  }, [supabase])

  useEffect(() => {
    let isMounted = true

    ;(async () => {
      const ok = await checkAdmin()
      if (!ok || !isMounted) return
      await loadOrders()
    })()

    // 🔔 REALTIME NOTIFICATION & AUTOMATIC SYNC
    const channel = supabase
      .channel("admin-coin-orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "coin_purchase_orders",
        },
        () => {
          playNotificationSound()
          setToast({
            open: true,
            title: "🔔 New Coin Order Received!",
            message: "A new order was placed and automatically loaded into Payment Queue.",
            variant: "info",
          })
          loadOrders()
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [checkAdmin, loadOrders, supabase])

  function spawnCoinBurst() {
    const next = Array.from({ length: 12 }).map((_, index) => ({
      id: Date.now() + index,
      x: Math.random() * 260 - 130,
      y: -Math.random() * 140 - 30,
    }))

    setBurst(next)
    window.setTimeout(() => setBurst([]), 1200)
  }

  function toggleExpandOrder(id: string) {
    setExpandedOrderId((prev) => (prev === id ? null : id))
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

  const tabCounts = useMemo(() => {
    return {
      pending: orders.filter((o) => o.status === "pending").length,
      credited: orders.filter((o) => o.status === "credited" || o.status === "approved").length,
      rejected: orders.filter((o) => o.status === "rejected" || o.status === "removed").length,
      all: orders.length,
    }
  }, [orders])

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      let tabMatch = true
      if (activeTab === "pending") {
        tabMatch = order.status === "pending"
      } else if (activeTab === "credited") {
        tabMatch = order.status === "credited" || order.status === "approved"
      } else if (activeTab === "rejected") {
        tabMatch = order.status === "rejected" || order.status === "removed"
      }

      const haystack = [
        order.payer_name,
        order.payer_email,
        order.user_username,
        order.user_id,
        order.reference_number,
        order.label,
        order.payment_method,
        order.status,
        order.receipt_name,
        order.receipt_file_name,
        order.receipt_path,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      const queryMatch = query.trim()
        ? haystack.includes(query.trim().toLowerCase())
        : true

      return tabMatch && queryMatch
    })
  }, [orders, activeTab, query])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
          <RefreshCw size={18} className="animate-spin" />
          Loading coin purchases & account profiles...
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
        {/* Simple Page Header */}
        <div className="mt-4 mb-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Coins Purchases
          </h1>

          <button
            onClick={loadOrders}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh Orders
          </button>
        </div>

        {/* Search Bar */}
        <section className="mt-5 rounded-[30px] border border-white/10 bg-slate-900/70 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.35)] backdrop-blur sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <Search size={18} className="text-slate-400 shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, email, username, user ID, or reference number..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
            </label>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-300 text-center sm:text-left shrink-0">
              Showing {filteredOrders.length} orders
            </div>
          </div>
        </section>

        {/* Main Inbox Queue Container */}
        <section className="relative mt-5 overflow-hidden rounded-[30px] border border-white/10 bg-slate-900/70 shadow-[0_18px_60px_rgba(0,0,0,0.36)] backdrop-blur">
          {/* Animated Burst Effect */}
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
                  } as CSSProperties
                }
              >
                🪙
              </span>
            ))}
          </div>

          {/* Category Tabs System */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 pt-4 pb-3 sm:px-6">
            <button
              onClick={() => setActiveTab("pending")}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
                activeTab === "pending"
                  ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Clock3 size={15} />
              Payment Queue
              <span className="ml-1.5 rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-bold">
                {tabCounts.pending}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("credited")}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
                activeTab === "credited"
                  ? "bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/20"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <CheckCircle2 size={15} />
              Credited
              <span className="ml-1.5 rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-bold">
                {tabCounts.credited}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("rejected")}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
                activeTab === "rejected"
                  ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <XCircle size={15} />
              Rejected
              <span className="ml-1.5 rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-bold">
                {tabCounts.rejected}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("all")}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition ${
                activeTab === "all"
                  ? "bg-slate-700 text-white shadow-lg"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Inbox size={15} />
              All Orders
              <span className="ml-1.5 rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-bold">
                {tabCounts.all}
              </span>
            </button>
          </div>

          {/* Orders Inbox List */}
          <div className="grid gap-3 p-4 sm:p-5">
            {filteredOrders.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-16 text-center">
                <p className="text-lg font-bold text-white">No orders found in this view</p>
                <p className="mt-2 text-sm text-slate-400">Try selecting another tab or clearing search.</p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const statusClass =
                  STATUS_STYLES[order.status] ||
                  "border-white/15 bg-white/5 text-slate-200"

                const isBusy = busyId === order.id
                const isExpanded = expandedOrderId === order.id
                const isDone =
                  order.status === "credited" ||
                  order.status === "approved" ||
                  order.status === "rejected" ||
                  order.status === "removed"
                const receiptUrl = getReceiptUrl(order)
                const receiptLabel = getReceiptLabel(order)

                return (
                  <article
                    key={order.id}
                    className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] shadow-[0_12px_30px_rgba(0,0,0,0.25)] transition-all"
                  >
                    {/* Compact Message-Style Row (Always Visible) */}
                    <div
                      onClick={() => toggleExpandOrder(order.id)}
                      className="flex cursor-pointer flex-col gap-3 p-4 hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
                          <User2 size={18} />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-black text-white">
                              {order.payer_name}
                            </p>
                            {order.user_username && (
                              <span className="hidden text-xs font-medium text-violet-300 sm:inline">
                                (@{order.user_username})
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-slate-400">
                            {order.payer_email}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                        <div className="text-left sm:text-right">
                          <p className="text-xs font-bold text-yellow-300">
                            {new Intl.NumberFormat("en-PH").format(order.coins ?? 0)} coins ({formatPeso(order.amount)})
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {formatDate(order.created_at)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <span
                            className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass}`}
                          >
                            {order.status}
                          </span>

                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-slate-300 transition hover:bg-white/10"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Message Content View */}
                    {isExpanded && (
                      <div className="border-t border-white/10 bg-slate-950/50 p-4 sm:p-6">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-400">Account Email</p>
                            <div className="mt-2 flex items-center gap-2 text-sm font-bold text-white">
                              <Mail size={15} className="text-sky-300 shrink-0" />
                              <span className="truncate">{order.payer_email}</span>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Package</p>
                            <p className="mt-2 text-sm font-semibold text-white">{order.label || "Coin Package"}</p>
                            <p className="mt-1 text-xs text-slate-400">{order.payment_method || "GCash / Maya"}</p>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Amount</p>
                            <p className="mt-2 text-lg font-black text-white">{formatPeso(order.amount)}</p>
                            <p className="mt-1 text-xs text-slate-400">Ref: {order.reference_number || "No reference"}</p>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Coins & User ID</p>
                            <p className="mt-2 text-lg font-black text-yellow-300">
                              {new Intl.NumberFormat("en-PH").format(order.coins ?? 0)} coins
                            </p>
                            <p className="mt-1 text-[11px] font-mono text-slate-400 truncate">
                              ID: {order.user_id}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.95fr)]">
                          {/* Receipt Section */}
                          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Receipt Preview</p>
                                <p className="mt-1 text-xs text-slate-300">
                                  Check payment proof before approving.
                                </p>
                              </div>

                              {receiptUrl ? (
                                <a
                                  href={receiptUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-200 transition hover:bg-sky-500/15"
                                >
                                  <ExternalLink size={14} />
                                  Open Receipt
                                </a>
                              ) : null}
                            </div>

                            {receiptUrl ? (
                              <div className="mt-4 overflow-hidden rounded-[22px] border border-white/10 bg-slate-950/60">
                                <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-3">
                                  <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
                                    <ImageIcon size={16} className="shrink-0 text-sky-300" />
                                    <span className="truncate">{receiptLabel}</span>
                                  </div>
                                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                                    Preview Ready
                                  </span>
                                </div>

                                <a href={receiptUrl} target="_blank" rel="noreferrer" className="block">
                                  <img
                                    src={receiptUrl}
                                    alt={receiptLabel}
                                    className="h-[260px] w-full object-contain bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_35%),#020617] sm:h-[320px]"
                                  />
                                </a>
                              </div>
                            ) : (
                              <div className="mt-4 flex min-h-[200px] flex-col items-center justify-center rounded-[22px] border border-dashed border-white/10 bg-slate-950/40 px-5 py-8 text-center sm:min-h-[260px]">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400">
                                  <ImageIcon size={22} />
                                </div>
                                <p className="mt-3 text-sm font-bold text-white">No receipt preview available</p>
                              </div>
                            )}
                          </div>

                          {/* Admin Actions */}
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
                          </div>
                        </div>
                      </div>
                    )}
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
        message={toast.message || ""}
        type={toast.variant}
        onClose={closeToast}
      />
    </div>
  )
}