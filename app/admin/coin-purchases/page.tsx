"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import SiteHeader from "@/app/components/SiteHeader"

type OrderRow = {
  id: string
  user_id: string
  amount_php: number
  coins: number
  label: string | null
  payment_method: string
  payment_reference: string | null
  proof_url: string | null
  status: "pending" | "approved" | "rejected"
  created_at: string
}

export default function AdminCoinPurchasesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function loadOrders() {
    try {
      setLoading(true)
      setError("")
      const { data, error } = await supabase
        .from("coin_purchase_orders")
        .select("id, user_id, amount_php, coins, label, payment_method, payment_reference, proof_url, status, created_at")
        .order("created_at", { ascending: false })

      if (error) throw error
      setOrders((data as OrderRow[]) || [])
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Failed to load orders.")
    } finally {
      setLoading(false)
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
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to approve order.")
      }

      setMessage(data?.message || "Order approved.")
      await loadOrders()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Failed to approve order.")
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-slate-950 px-4 py-24 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 rounded-[28px] border border-white/10 bg-slate-900/70 p-6">
            <h1 className="text-3xl font-black">Coin Purchase Orders</h1>
            <p className="mt-2 text-sm text-slate-300">Approve payments to credit JB Coins.</p>
          </div>

          {message ? (
            <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-300">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
              {error}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="px-4 py-4">Created</th>
                    <th className="px-4 py-4">User</th>
                    <th className="px-4 py-4">Package</th>
                    <th className="px-4 py-4">Reference</th>
                    <th className="px-4 py-4">Proof</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-sm text-slate-300">Loading orders...</td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-sm text-slate-300">No orders yet.</td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id} className="border-t border-white/10">
                        <td className="px-4 py-4 text-sm">{new Date(order.created_at).toLocaleString()}</td>
                        <td className="px-4 py-4 text-sm">{order.user_id}</td>
                        <td className="px-4 py-4 text-sm">
                          <div className="font-bold">{order.label || `₱${order.amount_php}`}</div>
                          <div className="text-slate-400">{order.coins.toLocaleString()} coins</div>
                        </td>
                        <td className="px-4 py-4 text-sm">{order.payment_reference || "-"}</td>
                        <td className="px-4 py-4 text-sm">
                          {order.proof_url ? (
                            <a href={order.proof_url} target="_blank" rel="noreferrer" className="font-bold text-sky-300 hover:text-sky-200">
                              View proof
                            </a>
                          ) : "-"}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                            order.status === "approved"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : order.status === "rejected"
                                ? "bg-red-500/15 text-red-300"
                                : "bg-amber-500/15 text-amber-300"
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <button
                            type="button"
                            onClick={() => void approveOrder(order.id)}
                            disabled={order.status !== "pending" || approvingId === order.id}
                            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {approvingId === order.id ? "Approving..." : "Approve"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
