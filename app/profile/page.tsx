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
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        console.error("Error getting user:", userError)
      }

      if (!user) {
        router.push("/login")
        return
      }

      setAuthEmail(user.email || "")

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()

      if (profileError) {
        console.error("Error fetching profile:", profileError)
      }

      setProfile(
        profileData || {
          id: user.id,
          email: user.email || "",
          full_name:
            (user.user_metadata?.full_name as string | undefined) ||
            (user.user_metadata?.name as string | undefined) ||
            "",
          membership: "Standard User",
          account_status: "Active",
          is_premium: false,
        }
      )
    } catch (error) {
      console.error("Profile fetch failed:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    try {
      setLoggingOut(true)

      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error("Logout error:", error)
        alert("Failed to log out.")
        return
      }

      router.push("/login")
      router.refresh()
    } catch (error) {
      console.error("Logout failed:", error)
      alert("Failed to log out.")
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
    return profile?.email || authEmail || "No email found"
  }, [profile, authEmail])

  const displayMembership = useMemo(() => {
    if (profile?.membership) return profile.membership
    if (profile?.is_premium) return "Premium User"
    return "Standard User"
  }, [profile])

  const displayStatus = useMemo(() => {
    return profile?.account_status || profile?.status || "Active"
  }, [profile])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        {/* HEADER */}
        <div className="mb-6 overflow-hidden rounded-[24px] border border-blue-100 bg-white shadow-sm sm:mb-8 sm:rounded-[30px]">
          <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 px-4 py-5 text-white sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-white blur-3xl" />
              <div className="absolute right-0 top-6 h-48 w-48 rounded-full bg-white blur-3xl" />
            </div>

            <div className="relative">
              {/* TOP ROW */}
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80 sm:text-sm">
                  JB Collections
                </p>

                {/* DESKTOP NAV */}
                <div className="hidden items-center gap-3 lg:flex">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    <span>🏠</span>
                    <span>Dashboard</span>
                  </Link>

                  <Link
                    href="/dashboard/inbox"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    <span>📥</span>
                    <span>My Inbox</span>
                  </Link>

                  <Link
                    href="/admin/messages"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    <span>💬</span>
                    <span>Message Admin</span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <span>🚪</span>
                    <span>{loggingOut ? "Logging out..." : "Logout"}</span>
                  </button>
                </div>

                {/* MOBILE HAMBURGER */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-xl text-white backdrop-blur lg:hidden"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? "✕" : "☰"}
                </button>
              </div>

              {/* MOBILE MENU */}
              {mobileMenuOpen && (
                <div className="mt-4 grid grid-cols-1 gap-3 lg:hidden">
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    <span>🏠</span>
                    <span>Dashboard</span>
                  </Link>

                  <Link
                    href="/dashboard/inbox"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    <span>📥</span>
                    <span>My Inbox</span>
                  </Link>

                  <Link
                    href="/admin/messages"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    <span>💬</span>
                    <span>Message Admin</span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <span>🚪</span>
                    <span>{loggingOut ? "Logging out..." : "Logout"}</span>
                  </button>
                </div>
              )}

              {/* TITLE */}
              <div className="mt-6 max-w-2xl">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/80 sm:hidden">
                  Profile
                </p>

                <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Profile
                </h1>

                <p className="mt-3 text-sm text-white/90 sm:text-base">
                  Manage your account details and request a premium upgrade in one clean and simple place.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* ACCOUNT INFO */}
          <div className="rounded-[24px] border border-blue-100 bg-white p-5 shadow-sm sm:rounded-[30px] sm:p-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-blue-100 text-4xl sm:h-24 sm:w-24 sm:rounded-[28px] sm:text-5xl">
                👤
              </div>

              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900">
                  Account Information
                </h2>
                <p className="text-sm text-slate-500">
                  View and manage your profile details.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-[22px] border border-blue-100 bg-blue-50/40 p-5 sm:rounded-[26px] sm:p-6"
                  >
                    <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                    <div className="mt-6 h-8 w-40 animate-pulse rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                <div className="rounded-[22px] border border-blue-100 bg-blue-50/40 p-5 sm:rounded-[26px] sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Full Name
                  </p>
                  <p className="mt-4 break-words text-xl font-semibold text-slate-900 sm:mt-5 sm:text-2xl">
                    {displayName}
                  </p>
                </div>

                <div className="rounded-[22px] border border-blue-100 bg-blue-50/40 p-5 sm:rounded-[26px] sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Email Address
                  </p>
                  <p className="mt-4 break-all text-xl font-semibold text-slate-900 sm:mt-5 sm:text-2xl">
                    {displayEmail}
                  </p>
                </div>

                <div className="rounded-[22px] border border-blue-100 bg-blue-50/40 p-5 sm:rounded-[26px] sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Membership
                  </p>
                  <p className="mt-4 break-words text-xl font-semibold text-slate-900 sm:mt-5 sm:text-2xl">
                    {displayMembership}
                  </p>
                </div>

                <div className="rounded-[22px] border border-blue-100 bg-blue-50/40 p-5 sm:rounded-[26px] sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Account Status
                  </p>
                  <p className="mt-4 break-words text-xl font-semibold text-emerald-600 sm:mt-5 sm:text-2xl">
                    {displayStatus}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* PREMIUM */}
          <div className="rounded-[24px] border border-blue-100 bg-white p-5 shadow-sm sm:rounded-[30px] sm:p-8">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-2xl text-white shadow-sm">
                ✨
              </div>

              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-900">
                  Upgrade to Premium
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
                  Premium members can access exclusive downloads and special content. Send your request below and the admin can review it from the admin panel.
                </p>
              </div>
            </div>

            <div className="rounded-[22px] border border-blue-100 bg-blue-50/40 p-5 sm:rounded-[26px] sm:p-6">
              <ul className="space-y-4 text-sm text-slate-700 sm:text-base">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                  <span>Access premium-only files</span>
                </li>

                <li className="flex items-start gap-3">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                  <span>Get exclusive downloadable content</span>
                </li>

                <li className="flex items-start gap-3">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                  <span>Request account upgrade directly from your profile</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 overflow-hidden rounded-[22px] border border-blue-100 sm:rounded-[26px]">
              <button
                type="button"
                onClick={() => setShowPaymentDetails(!showPaymentDetails)}
                className="flex w-full items-center justify-between gap-4 bg-white px-5 py-5 text-left hover:bg-blue-50/40 sm:px-6"
              >
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-slate-900 sm:text-xl">
                    Premium Payment Details
                  </h3>
                  <p className="text-sm text-slate-500">
                    Click to view GCash payment information
                  </p>
                </div>

                <span
                  className={`shrink-0 text-xl text-slate-500 transition-transform ${
                    showPaymentDetails ? "rotate-180" : ""
                  }`}
                >
                  ⌄
                </span>
              </button>

              {showPaymentDetails && (
                <div className="border-t border-blue-100 bg-blue-50/30 px-4 py-5 sm:px-6 sm:py-6">
                  <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border border-blue-100 bg-white p-5">
                      <p className="font-semibold text-slate-900">
                        GCash Payment Information
                      </p>

                      <div className="mt-4 space-y-3 text-sm text-slate-600">
                        <p>
                          <span className="font-semibold text-slate-900">
                            GCash Name:
                          </span>{" "}
                          JONATHAN BARRUGA
                        </p>

                        <p>
                          <span className="font-semibold text-slate-900">
                            GCash Number:
                          </span>{" "}
                          09685289257
                        </p>

                        <p>
                          <span className="font-semibold text-slate-900">
                            Reference:
                          </span>{" "}
                          Use your email when sending payment
                        </p>

                        <p>
                          <span className="font-semibold text-slate-900">
                            Note:
                          </span>{" "}
                          After payment, submit your upgrade request below.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-blue-100 bg-white p-5">
                      <p className="mb-4 font-semibold text-slate-900">
                        Scan QR Code
                      </p>

                      <div className="flex justify-center">
                        <Image
                          src="/gcash-qr.jpg"
                          alt="GCash QR Code"
                          width={260}
                          height={260}
                          className="h-auto w-full max-w-[260px] rounded-xl border border-blue-100 object-contain"
                        />
                      </div>
                    </div>
                  </div>

                  <form
                    action="/api/upgrades/request"
                    method="POST"
                    className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 sm:p-6"
                  >
                    <input type="hidden" name="subject" value="Premium upgrade request" />

                    <h4 className="text-lg font-black text-slate-900">
                      Send Upgrade Request
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">
                      Send your message for admin review.
                    </p>

                    <div className="mt-5 grid gap-5">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700">
                          Message to Admin
                        </label>
                        <textarea
                          name="message"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={4}
                          required
                          placeholder="Example: I already sent the payment. Please review and upgrade my account to premium."
                          className="w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="receipt-upload"
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Upload Receipt
                        </label>
                        <input
                          id="receipt-upload"
                          type="file"
                          accept="image/*,.pdf"
                          disabled
                          className="block w-full rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-sm text-slate-400 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-300 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                        />
                        <p className="mt-2 text-sm text-slate-500">
                          Receipt upload will be enabled after the upgrade route is updated to store attachments.
                        </p>
                      </div>

                      <button
                        type="submit"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:w-fit"
                      >
                        <span>📨</span>
                        <span>Send Request to Admin</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}