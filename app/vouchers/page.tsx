"use client"

import { useState } from "react"
import SiteHeader from "@/app/components/SiteHeader"

export default function VoucherPage() {
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  async function handleRedeem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    try {
      setLoading(true)
      setErrorMessage("")
      setSuccessMessage("")

      const response = await fetch("/api/vouchers/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: code.trim() }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(result?.error || "Failed to redeem voucher.")
      }

      setSuccessMessage(
        result?.message ||
          `Voucher redeemed successfully. ${result?.coins || 0} JB Coins added.`
      )
      setCode("")
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to redeem voucher.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SiteHeader />

      <div className="min-h-screen bg-slate-950 px-4 py-24 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[28px] border border-white/10 bg-slate-900/80 p-6 shadow-2xl sm:p-8">
            <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.2em] text-amber-300">
              JB Voucher
            </div>

            <h1 className="text-3xl font-black text-white sm:text-4xl">
              Redeem Voucher Code
            </h1>

            <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">
              Enter your voucher code to instantly add JB Coins to your wallet.
            </p>

            {(errorMessage || successMessage) && (
              <div
                className={`mt-5 rounded-2xl px-4 py-3 text-sm font-bold ${
                  errorMessage
                    ? "border border-red-500/30 bg-red-500/10 text-red-300"
                    : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {errorMessage || successMessage}
              </div>
            )}

            <form onSubmit={handleRedeem} className="mt-6 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-200">
                  Voucher Code
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="JB-XXXX-XXXX-XXXX"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-amber-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Redeeming..." : "Redeem Voucher"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}