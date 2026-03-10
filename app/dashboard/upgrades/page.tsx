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
  const [showPaymentDetails, setShowPaymentDetails] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    try {
      setLoggingOut(true)
      await supabase.auth.signOut()
      window.location.href = "/login"
    } catch (error) {
      console.error("Logout failed:", error)
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
        setSubmitting(false)
        return
      }

      let receiptUrl: string | null = null

      if (receipt) {
        const ext = receipt.name.split(".").pop()?.toLowerCase() || "jpg"
        const filePath = `${user.id}/${Date.now()}-receipt.${ext}`

        const { error } = await supabase.storage
          .from("upgrade-receipts")
          .upload(filePath, receipt, {
            cacheControl: "3600",
            upsert: false,
          })

        if (!error) {
          const { data } = supabase.storage
            .from("upgrade-receipts")
            .getPublicUrl(filePath)

          receiptUrl = data.publicUrl
        }
      }

      const { error } = await supabase.from("upgrade_requests").insert({
        sender_id: user.id,
        email: user.email,
        name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email ||
          "User",
        plan: "premium",
        subject: "Premium Upgrade Request",
        body: message,
        status: "pending",
        receipt_url: receiptUrl,
      })

      if (error) throw error

      setReceipt(null)

      const fileInput = document.getElementById("receipt-upload") as HTMLInputElement | null
      if (fileInput) fileInput.value = ""

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
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 p-6 text-white shadow-lg">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <div className="mb-3 text-sm font-semibold tracking-[0.25em] text-white/80">
                JB COLLECTIONS
              </div>

              <h1 className="text-3xl font-extrabold md:text-4xl">
                Premium Membership
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Link
                href="/dashboard"
                className="whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
              >
                Dashboard
              </Link>

              <Link
                href="/profile"
                className="whitespace-nowrap rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-md transition hover:bg-slate-100"
              >
                Profile
              </Link>

              <Link
                href="/dashboard/inbox"
                className="whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
              >
                Inbox
              </Link>

              <Link
                href="/dashboard/message-admin"
                className="whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700"
              >
                Message Admin
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="whitespace-nowrap rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 text-2xl text-white shadow-sm">
              ✨
            </div>

            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Upgrade to Premium
              </h2>

              <p className="mt-1 text-slate-600">
                Premium members can access exclusive downloads and special content. Send your
                request below and the admin can review it.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-5">
            <ul className="space-y-3 text-slate-700">
              <li>• Access premium-only files</li>
              <li>• Get exclusive downloadable content</li>
              <li>• Request account upgrade directly from your profile</li>
            </ul>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setShowPaymentDetails(!showPaymentDetails)}
              className="flex w-full items-center justify-between bg-slate-50 px-5 py-4 text-left"
            >
              <span className="text-xl font-bold text-slate-900">
                Premium Payment Details
              </span>
              <span className="text-lg text-slate-600">
                {showPaymentDetails ? "▲" : "▼"}
              </span>
            </button>

            {showPaymentDetails && (
              <div className="space-y-5 border-t border-slate-200 p-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="mb-4 text-2xl font-bold text-slate-900">
                      GCash Payment Information
                    </h3>

                    <div className="space-y-3 text-slate-700">
                      <p>
                        <span className="font-bold">GCash Name:</span> {GCASH_NAME}
                      </p>
                      <p>
                        <span className="font-bold">GCash Number:</span> {GCASH_NUMBER}
                      </p>
                      <p>
                        <span className="font-bold">Price:</span> {PREMIUM_PRICE}
                      </p>
                      <p className="text-sm text-slate-500">
                        Use your email as reference when sending payment.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
                    <h3 className="mb-4 text-2xl font-bold text-slate-900">
                      Scan QR Code
                    </h3>

                    <img
                      src={GCASH_QR}
                      alt="GCash QR"
                      className="mx-auto w-44 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="space-y-5">
                    <div>
                      <label className="mb-2 block font-semibold text-slate-800">
                        Message to Admin
                      </label>

                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block font-semibold text-slate-800">
                        Upload Receipt
                      </label>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <input
                          id="receipt-upload"
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => setReceipt(e.target.files?.[0] || null)}
                          className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-700"
                        />

                        {receipt && (
                          <div className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                            Selected file: {receipt.name}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {submitting ? "Sending..." : "Send Request to Admin"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}