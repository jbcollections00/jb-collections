"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import SiteHeader from "@/app/components/SiteHeader"

type PaymentMethod = "gcash" | "maya"

function parsePositiveNumber(value: string | null | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

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

export default function PaymentPage() {
  const searchParams = useSearchParams()

  const initialAmount = parsePositiveNumber(searchParams.get("amount"), 500)
  const initialCoins = parsePositiveNumber(searchParams.get("coins"), 7500)
  const initialLabel = searchParams.get("label")?.trim() || "JB Coin Package"
  const initialMethod =
    searchParams.get("method")?.toLowerCase() === "maya" ? "maya" : "gcash"

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initialMethod as PaymentMethod
  )
  const [payerName, setPayerName] = useState("")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [notes, setNotes] = useState(
    `I paid for ${initialLabel} - ${formatCoins(initialCoins)}.`
  )
  const [receipt, setReceipt] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const packageDetails = useMemo(
    () => ({
      label: initialLabel,
      amount: initialAmount,
      coins: initialCoins,
    }),
    [initialAmount, initialCoins, initialLabel]
  )

  const paymentInfo = useMemo(() => {
    if (paymentMethod === "maya") {
      return {
        label: "Maya",
        accountName: "JONATHAN BARRUGA",
        accountNumber: "09685289257",
        qr: "/maya-qr.jpg",
        helper: "Scan the Maya QR or send to the Maya number below.",
        accent:
          "from-emerald-500/20 via-teal-500/10 to-cyan-500/20 border-emerald-400/20",
        button: "bg-emerald-600 hover:bg-emerald-700",
        badge: "bg-emerald-500/15 text-emerald-200 border-emerald-400/20",
      }
    }

    return {
      label: "GCash",
      accountName: "JONATHAN BARRUGA",
      accountNumber: "09685289257",
      qr: "/gcash-qr.jpg",
      helper: "Scan the GCash QR or send to the GCash number below.",
      accent:
        "from-sky-500/20 via-blue-500/10 to-indigo-500/20 border-sky-400/20",
      button: "bg-blue-600 hover:bg-blue-700",
      badge: "bg-blue-500/15 text-blue-200 border-blue-400/20",
    }
  }, [paymentMethod])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    try {
      setSubmitting(true)

      const formData = new FormData()
      formData.append("subject", `JB Coin Payment - ${packageDetails.label}`)
      formData.append("message", notes)
      formData.append("payment_name", payerName)
      formData.append("payment_method", paymentInfo.label)
      formData.append("reference_number", referenceNumber)
      formData.append("amount", String(packageDetails.amount))
      formData.append("coins", String(packageDetails.coins))
      formData.append("package_label", packageDetails.label)

      if (receipt) {
        formData.append("receipt", receipt)
      }

      const response = await fetch("/api/upgrades/request", {
        method: "POST",
        body: formData,
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(result?.error || "Failed to submit payment proof.")
      }

      alert("Payment proof submitted successfully. Please wait for admin confirmation.")

      setPayerName("")
      setReferenceNumber("")
      setNotes(`I paid for ${packageDetails.label} - ${formatCoins(packageDetails.coins)}.`)
      setReceipt(null)

      const input = document.getElementById("receipt-upload") as HTMLInputElement | null
      if (input) input.value = ""
    } catch (error) {
      console.error("Payment submission failed:", error)
      alert(error instanceof Error ? error.message : "Failed to submit payment proof.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <SiteHeader />

      <div className="min-h-screen bg-slate-950 text-white">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute left-[-120px] top-[80px] h-[260px] w-[260px] rounded-full bg-sky-500/15 blur-3xl" />
          <div className="absolute right-[-120px] top-[140px] h-[260px] w-[260px] rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div className="absolute bottom-[120px] left-[10%] h-[220px] w-[220px] rounded-full bg-cyan-400/10 blur-3xl" />
        </div>

        <div className="relative px-3 pb-8 pt-20 sm:px-4 sm:pb-10 sm:pt-24 lg:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 flex flex-wrap items-center gap-3"></div>

            <div className="mb-5 overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-4 shadow-2xl sm:p-5 lg:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <div className="mb-2 inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200 sm:text-xs">
                    Premium Checkout
                  </div>

                  <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
                    Complete Your JB Coin Payment
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                    Pay using {paymentInfo.label}, upload your receipt, and wait for admin
                    confirmation of your JB Coin top-up.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:min-w-[320px]">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      Package
                    </div>
                    <div className="mt-1 text-sm font-bold text-white">
                      {packageDetails.label}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      Total
                    </div>
                    <div className="mt-1 text-sm font-black text-amber-300">
                      {formatPeso(packageDetails.amount)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-[0.92fr_1.08fr]">
              <section className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/80 shadow-2xl backdrop-blur">
                <div className="border-b border-white/10 p-4 sm:p-5">
                  <div className="mb-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("gcash")}
                      className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition sm:px-5 sm:py-3 ${
                        paymentMethod === "gcash"
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                          : "bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      GCash
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod("maya")}
                      className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition sm:px-5 sm:py-3 ${
                        paymentMethod === "maya"
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40"
                          : "bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      Maya
                    </button>
                  </div>

                  <div
                    className={`rounded-[22px] border bg-gradient-to-br p-4 sm:p-5 ${paymentInfo.accent}`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                          Selected Payment
                        </div>
                        <div className="mt-1 text-xl font-black text-white">
                          {paymentInfo.label}
                        </div>
                      </div>

                      <div
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${paymentInfo.badge}`}
                      >
                        Verified Wallet
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[170px_1fr]">
                      <div className="rounded-[20px] border border-white/10 bg-white p-2.5">
                        <img
                          src={paymentInfo.qr}
                          alt={`${paymentInfo.label} QR`}
                          className="mx-auto h-auto w-full max-w-[180px] rounded-xl object-contain"
                        />
                      </div>

                      <div className="grid gap-3 text-sm text-slate-200">
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                            Account Name
                          </div>
                          <div className="mt-1 text-base font-bold text-white break-words">
                            {paymentInfo.accountName}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                            Mobile Number
                          </div>
                          <div className="mt-1 text-base font-bold text-white">
                            {paymentInfo.accountNumber}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
                          {paymentInfo.helper}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-4 sm:p-5">
                  <div className="rounded-[22px] border border-amber-400/20 bg-amber-400/10 p-4">
                    <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-200">
                      Order Summary
                    </div>

                    <div className="grid gap-3">
                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <span className="text-sm text-slate-300">Package</span>
                        <span className="text-right text-sm font-bold text-white">
                          {packageDetails.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <span className="text-sm text-slate-300">JB Coins</span>
                        <span className="text-right text-sm font-bold text-white">
                          {formatCoins(packageDetails.coins)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                        <span className="text-sm text-slate-300">Amount to Pay</span>
                        <span className="text-right text-lg font-black text-amber-200">
                          {formatPeso(packageDetails.amount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-slate-950/70 p-4">
                    <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                      Payment Reminders
                    </div>

                    <ul className="grid gap-2 text-sm leading-6 text-slate-300">
                      <li>• Send the exact amount only.</li>
                      <li>• Make sure the payer name matches your receipt.</li>
                      <li>• Save your transaction reference number.</li>
                      <li>• Upload a clear screenshot or PDF of your receipt.</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/80 shadow-2xl backdrop-blur">
                <div className="border-b border-white/10 p-4 sm:p-5">
                  <h2 className="text-xl font-black text-white sm:text-2xl">
                    Submit Payment Proof
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Fill in your payment details below so the admin can verify your top-up.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="grid gap-4 p-4 sm:p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-200">
                        Payer Name
                      </label>
                      <input
                        required
                        type="text"
                        value={payerName}
                        onChange={(e) => setPayerName(e.target.value)}
                        placeholder="Enter full name used in payment"
                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-200">
                        Reference Number
                      </label>
                      <input
                        required
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="Enter transaction reference"
                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-200">
                        Selected Package
                      </label>
                      <input
                        readOnly
                        value={packageDetails.label}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-300 outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-200">
                        Amount
                      </label>
                      <input
                        readOnly
                        value={formatPeso(packageDetails.amount)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-300 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-200">
                      Notes to Admin
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-200">
                      Upload Receipt
                    </label>
                    <input
                      id="receipt-upload"
                      required
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setReceipt(e.target.files?.[0] || null)}
                      className="block w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-700"
                    />

                    {receipt ? (
                      <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 break-words">
                        Selected file: {receipt.name}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                      Final Confirmation
                    </div>
                    <p className="text-sm leading-6 text-slate-300">
                      By submitting this form, you confirm that you sent{" "}
                      <span className="font-bold text-white">
                        {formatPeso(packageDetails.amount)}
                      </span>{" "}
                      via <span className="font-bold text-white">{paymentInfo.label}</span> for{" "}
                      <span className="font-bold text-white">
                        {formatCoins(packageDetails.coins)}
                      </span>
                      .
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className={`mt-1 inline-flex items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${paymentInfo.button}`}
                  >
                    {submitting ? "Submitting..." : "Submit Payment Proof"}
                  </button>
                </form>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}