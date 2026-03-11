"use client"

import Link from "next/link"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

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
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    try {
      setLoggingOut(true)
      await supabase.auth.signOut()
      window.location.href = "/login"
    } catch (error) {
      console.error(error)
      setLoggingOut(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    try {
      setSubmitting(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert("You must be logged in.")
        return
      }

      let receiptUrl: string | null = null

      if (receipt) {
        const ext = receipt.name.split(".").pop() || "jpg"
        const path = `${user.id}/${Date.now()}-${receipt.name}`

        const { error: uploadError } = await supabase.storage
          .from("upgrade-receipts")
          .upload(path, receipt)

        if (!uploadError) {
          const { data } = supabase.storage
            .from("upgrade-receipts")
            .getPublicUrl(path)

          receiptUrl = data.publicUrl
        }
      }

      const { error } = await supabase.from("upgrade_requests").insert({
        sender_id: user.id,
        email: user.email,
        name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email,
        plan: "premium",
        subject: "Premium Upgrade Request",
        body: message,
        status: "pending",
        receipt_url: receiptUrl,
      })

      if (error) throw error

      setReceipt(null)

      const input = document.getElementById(
        "receipt-upload"
      ) as HTMLInputElement | null
      if (input) input.value = ""

      alert("Upgrade request sent to admin.")
    } catch (err) {
      console.error(err)
      alert("Failed to send request.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">

        <section className="rounded-2xl bg-white p-6 shadow">
          <h1 className="text-3xl font-bold mb-4">Premium Membership</h1>

          <div className="grid md:grid-cols-2 gap-6">

            <div className="border rounded-xl p-5">
              <h2 className="font-bold text-xl mb-3">GCash Payment</h2>

              <p><b>Name:</b> {GCASH_NAME}</p>
              <p><b>Number:</b> {GCASH_NUMBER}</p>
              <p><b>Price:</b> {PREMIUM_PRICE}</p>

              <img
                src={GCASH_QR}
                className="mt-4 w-44 border rounded"
              />
            </div>

            <form onSubmit={handleSubmit} className="border rounded-xl p-5">

              <label className="font-semibold block mb-2">
                Message to Admin
              </label>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full border rounded-lg p-3 mb-4"
              />

              <label className="font-semibold block mb-2">
                Upload Receipt
              </label>

              <input
                id="receipt-upload"
                type="file"
                accept="image/*,.pdf"
                onChange={(e) =>
                  setReceipt(e.target.files?.[0] || null)
                }
                className="mb-4"
              />

              {receipt && (
                <div className="text-sm mb-3">
                  Selected: {receipt.name}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg"
              >
                {submitting ? "Sending..." : "Send Request"}
              </button>
            </form>

          </div>

          <div className="mt-6">
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              Logout
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}