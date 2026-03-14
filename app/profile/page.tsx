"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type UserProfile = {
  id: string
  email?: string | null
  full_name?: string | null
  name?: string | null
  username?: string | null
  membership?: string | null
  account_status?: string | null
  status?: string | null
  is_premium?: boolean | null
}

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()

  const [loggingOut, setLoggingOut] = useState(false)
  const [showPaymentDetails, setShowPaymentDetails] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [authEmail, setAuthEmail] = useState("")
  const [message, setMessage] = useState("")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      setAuthEmail(user.email || "")

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      setProfile(
        data || {
          id: user.id,
          email: user.email || "",
          full_name:
            (user.user_metadata?.full_name as string | undefined) ||
            (user.user_metadata?.name as string | undefined) ||
            "",
          account_status: "Active",
          is_premium: false,
        }
      )
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    try {
      setLoggingOut(true)
      await supabase.auth.signOut()
      router.push("/login")
      router.refresh()
    } catch (error) {
      console.error(error)
    } finally {
      setLoggingOut(false)
    }
  }

  const displayName = useMemo(() => {
    return (
      profile?.full_name ||
      profile?.name ||
      profile?.username ||
      authEmail?.split("@")[0] ||
      "User"
    )
  }, [profile, authEmail])

  const displayEmail = useMemo(() => {
    return profile?.email || authEmail || "No email"
  }, [profile, authEmail])

  const displayMembership = useMemo(() => {
    return profile?.is_premium ? "Premium User" : "Standard User"
  }, [profile])

  const displayStatus = useMemo(() => {
    return profile?.account_status || profile?.status || "Active"
  }, [profile])

  const membershipBadgeClasses = profile?.is_premium
    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
    : "bg-slate-100 text-slate-700 border border-slate-200"

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 lg:px-8">
        <div className="mb-8 rounded-3xl bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 p-8 text-white">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-black">Profile</h1>

            <div className="hidden gap-3 lg:flex">
              <Link
                href="/dashboard"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Dashboard
              </Link>

              <Link
                href="/dashboard/inbox"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                My Inbox
              </Link>

              <Link
                href="/contact"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Message Admin
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-70"
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white lg:hidden"
            >
              {mobileMenuOpen ? "Close" : "Menu"}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="mt-4 grid gap-3 lg:hidden">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Dashboard
              </Link>

              <Link
                href="/dashboard/inbox"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                My Inbox
              </Link>

              <Link
                href="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Message Admin
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-70"
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
          <button
            type="button"
            onClick={() => setShowPaymentDetails((prev) => !prev)}
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-left transition hover:bg-blue-100"
          >
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Upgrade to Premium
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Access premium-only files and exclusive content.
              </p>
            </div>

            <div className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow-sm">
              {showPaymentDetails ? "Hide ▲" : "Show ▼"}
            </div>
          </button>

          {showPaymentDetails && (
            <div className="mt-6 rounded-2xl border border-blue-100 p-5">
              <h3 className="font-semibold text-slate-900">
                GCash Payment Information
              </h3>

              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <p>
                  <b>Name:</b> JONATHAN BARRUGA
                </p>
                <p>
                  <b>Number:</b> 09685289257
                </p>
                <p>
                  <b>Reference:</b> Use your email
                </p>
              </div>

              <div className="mt-4 flex justify-center">
                <Image
                  src="/gcash-qr.jpg"
                  alt="GCash QR"
                  width={200}
                  height={200}
                  className="rounded-xl border"
                />
              </div>

              <form
                action="/api/upgrade/request"
                method="POST"
                encType="multipart/form-data"
                className="mt-6 space-y-4"
              >
                <input
                  type="hidden"
                  name="subject"
                  value="Premium upgrade request"
                />

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Message to Admin
                  </label>

                  <textarea
                    name="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    required
                    placeholder="Example: I already sent the payment. Please review and upgrade my account to premium."
                    className="mt-2 w-full rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-400"
                  />
                </div>

                <div className="rounded-2xl border-2 border-dashed border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg">📎</span>
                    <label className="text-sm font-extrabold text-blue-900">
                      Upload Receipt
                    </label>
                  </div>

                  <input
                    name="receipt"
                    type="file"
                    accept="image/*,.pdf"
                    className="block w-full rounded-xl border border-blue-200 bg-white px-3 py-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white"
                  />

                  <p className="mt-2 text-xs font-medium text-blue-700">
                    Upload your GCash receipt image or PDF here.
                  </p>
                </div>

                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Send Request to Admin
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-3xl border border-blue-100 bg-white p-6">
          <h2 className="text-xl font-black text-slate-900">
            Account Information
          </h2>

          {loading ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-xl border p-4">
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                  <div className="mt-3 h-6 w-32 animate-pulse rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="text-xs text-slate-400">Full Name</p>
                <p className="text-lg font-semibold">{displayName}</p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-xs text-slate-400">Email</p>
                <p className="text-lg font-semibold">{displayEmail}</p>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-xs text-slate-400">Membership</p>
                <div className="mt-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1.5 text-sm font-bold ${membershipBadgeClasses}`}
                  >
                    {displayMembership}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <p className="text-xs text-slate-400">Status</p>
                <p className="text-lg font-semibold text-emerald-600">
                  {displayStatus}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}