"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import SiteHeader from "@/app/components/SiteHeader"

const PREMIUM_PRICE = "₱300 / year"
const GCASH_NAME = "JONATHAN BARRUGA"
const GCASH_NUMBER = "09685289257"
const GCASH_QR = "/gcash-qr.jpg"

export default function PremiumMembershipPage() {
  const supabase = createClient()

  const [message, setMessage] = useState(
    "I already sent the payment. Please review and upgrade my account to premium."
  )
  const [receipt, setReceipt] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    try {
      setSubmitting(true)

      const formData = new FormData()
      formData.append("subject", "Premium Upgrade Request")
      formData.append("message", message)

      if (receipt) {
        formData.append("receipt", receipt)
      }

      const response = await fetch("/api/upgrades/request", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to send request.")
      }

      setReceipt(null)

      const input = document.getElementById("receipt-upload") as HTMLInputElement | null
      if (input) input.value = ""

      alert("Upgrade request sent to admin.")
    } catch (err) {
      console.error("Upgrade request failed:", err)
      alert(err instanceof Error ? err.message : "Failed to send request.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <SiteHeader />

      <div className="min-h-screen bg-slate-100 px-4 py-6 pt-24 md:px-6 sm:pt-28">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow">
            <div className="mb-6">
              <h1 className="mb-2 text-3xl font-bold text-slate-900">Premium Membership</h1>
              <p className="text-slate-600">
                Send your payment proof and request premium access.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border p-5">
                <h2 className="mb-3 text-xl font-bold">GCash Payment</h2>

                <p className="mb-2">
                  <b>Name:</b> {GCASH_NAME}
                </p>
                <p className="mb-2">
                  <b>Number:</b> {GCASH_NUMBER}
                </p>
                <p className="mb-2">
                  <b>Price:</b> {PREMIUM_PRICE}
                </p>

                <p className="mb-4 text-sm text-slate-500">
                  Use your email as reference when sending payment.
                </p>

                <img
                  src={GCASH_QR}
                  alt="GCash QR"
                  className="mt-4 w-44 rounded border"
                />
              </div>

              <form onSubmit={handleSubmit} className="rounded-xl border p-5">
                <label className="mb-2 block font-semibold">Message to Admin</label>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="mb-4 w-full rounded-lg border p-3"
                />

                <label className="mb-2 block font-semibold">Upload Receipt</label>

                <input
                  id="receipt-upload"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setReceipt(e.target.files?.[0] || null)}
                  className="mb-4 block w-full text-sm"
                />

                {receipt && (
                  <div className="mb-4 rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    Selected: {receipt.name}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? "Sending..." : "Send Request"}
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}