"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
  role?: string | null
}

export default function ProfilePageClient() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loggingOut, setLoggingOut] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [authEmail, setAuthEmail] = useState("")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const loadProfile = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setLoading(true)
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          console.error("Failed to get authenticated user:", userError)
          router.replace("/login")
          return
        }

        if (!user) {
          router.replace("/login")
          return
        }

        const userEmail = user.email || ""
        setAuthEmail(userEmail)

        const { data, error } = await supabase
          .from("profiles")
          .select(
            "id, email, full_name, name, username, membership, account_status, status, is_premium, role"
          )
          .eq("id", user.id)
          .maybeSingle()

        if (error) {
          console.error("Failed to load profile:", error)
        }

        const fallbackProfile: UserProfile = {
          id: user.id,
          email: userEmail,
          full_name:
            (user.user_metadata?.full_name as string | undefined) ||
            (user.user_metadata?.name as string | undefined) ||
            "",
          name: (user.user_metadata?.name as string | undefined) || "",
          username: "",
          membership: "standard",
          account_status: "Active",
          status: "Active",
          is_premium: false,
          role: null,
        }

        setProfile(data ?? fallbackProfile)
      } catch (error) {
        console.error("Unexpected profile error:", error)
      } finally {
        if (showLoader) {
          setLoading(false)
        }
      }
    },
    [router, supabase]
  )

  useEffect(() => {
    loadProfile(true)
  }, [loadProfile])

  useEffect(() => {
    function handleFocusRefresh() {
      loadProfile(false)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadProfile(false)
      }
    }

    window.addEventListener("focus", handleFocusRefresh)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    const interval = window.setInterval(() => {
      loadProfile(false)
    }, 30000)

    return () => {
      window.removeEventListener("focus", handleFocusRefresh)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.clearInterval(interval)
    }
  }, [loadProfile])

  async function handleLogout() {
    try {
      setLoggingOut(true)
      setMobileMenuOpen(false)

      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error("Logout failed:", error)
        return
      }

      router.replace("/login")
      router.refresh()
    } catch (error) {
      console.error("Unexpected logout error:", error)
    } finally {
      setLoggingOut(false)
    }
  }

  const successParam = searchParams?.get("success") ?? ""
  const errorParam = searchParams?.get("error") ?? ""

  const successMessage = useMemo(() => {
    if (successParam === "upgrade-requested") {
      return "Your premium upgrade request was sent successfully. Please wait for admin review."
    }

    return ""
  }, [successParam])

  const errorMessage = useMemo(() => {
    if (errorParam === "missing-message") {
      return "Please enter a message before sending your upgrade request."
    }

    if (errorParam === "file-too-large") {
      return "The receipt file is too large. Please upload a file smaller than 10MB."
    }

    if (errorParam === "invalid-file-type") {
      return "Invalid receipt file type. Please upload JPG, PNG, WEBP, or PDF."
    }

    if (errorParam === "upload-failed") {
      return "Receipt upload failed. Please try again."
    }

    if (errorParam === "insert-failed") {
      return "Failed to save your upgrade request. Please try again."
    }

    if (errorParam === "unexpected") {
      return "Something went wrong while sending your request. Please try again."
    }

    return ""
  }, [errorParam])

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

  const isPremiumUser = useMemo(() => {
    const role = String(profile?.role || "").toLowerCase()
    const membership = String(profile?.membership || "").toLowerCase()

    if (role === "admin") return true

    if (typeof profile?.is_premium === "boolean") {
      return profile.is_premium
    }

    return membership === "premium"
  }, [profile])

  const displayMembership = useMemo(() => {
    const role = String(profile?.role || "").toLowerCase()
    const membership = String(profile?.membership || "").toLowerCase()

    const premium =
      typeof profile?.is_premium === "boolean"
        ? profile.is_premium
        : membership === "premium"

    if (role === "admin") {
      return "Premium User/Admin"
    }

    if (premium || membership === "premium") {
      return "Premium User"
    }

    return "Standard User"
  }, [profile])

  const displayStatus = useMemo(() => {
    return profile?.account_status || profile?.status || "Active"
  }, [profile])

  const membershipBadgeClasses = isPremiumUser
    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
    : "bg-slate-100 text-slate-700 border border-slate-200"

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 lg:px-8">
        <div className="mb-8 rounded-3xl bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 p-8 text-white">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-black">Profile</h1>

            <div className="hidden gap-3 lg:flex">
              <Link
                href="/dashboard"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Dashboard
              </Link>

              <Link
                href="/messages"
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
                href="/messages"
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

        {successMessage ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {!isPremiumUser && (
          <div className="mb-8">
            <Link
              href="/upgrade"
              className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
            >
              Upgrade to Premium
            </Link>
          </div>
        )}

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
                <p className="break-all text-lg font-semibold">{displayEmail}</p>
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