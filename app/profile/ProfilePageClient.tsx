"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import SiteHeader from "@/app/components/SiteHeader"

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

  const loadProfile = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true)

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
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

        if (error) console.error("Profile load error:", error)

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
      } catch (err) {
        console.error("Unexpected error:", err)
      } finally {
        if (showLoader) setLoading(false)
      }
    },
    [router, supabase]
  )

  useEffect(() => {
    loadProfile(true)
  }, [loadProfile])

  useEffect(() => {
    const refresh = () => loadProfile(false)

    window.addEventListener("focus", refresh)

    const interval = setInterval(() => loadProfile(false), 30000)

    return () => {
      window.removeEventListener("focus", refresh)
      clearInterval(interval)
    }
  }, [loadProfile])

  async function handleLogout() {
    setLoggingOut(true)

    await supabase.auth.signOut()
    router.replace("/login")
    router.refresh()

    setLoggingOut(false)
  }

  const successParam = searchParams?.get("success") ?? ""
  const errorParam = searchParams?.get("error") ?? ""

  const successMessage =
    successParam === "upgrade-requested"
      ? "Your premium upgrade request was sent successfully. Please wait for admin review."
      : ""

  const errorMessage =
    errorParam === "missing-message"
      ? "Please enter a message."
      : errorParam === "file-too-large"
      ? "File too large (max 10MB)."
      : errorParam === "invalid-file-type"
      ? "Invalid file type."
      : errorParam === "upload-failed"
      ? "Upload failed."
      : errorParam === "insert-failed"
      ? "Save failed."
      : errorParam === "unexpected"
      ? "Something went wrong."
      : ""

  const displayName =
    profile?.full_name ||
    profile?.name ||
    profile?.username ||
    authEmail.split("@")[0] ||
    "User"

  const displayEmail = profile?.email || authEmail || "No email"

  const isPremiumUser =
    profile?.role === "admin" ||
    profile?.is_premium ||
    profile?.membership === "premium"

  const displayMembership = isPremiumUser
    ? "Premium User"
    : "Standard User"

  const displayStatus =
    profile?.account_status || profile?.status || "Active"

  const membershipBadgeClasses = isPremiumUser
    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
    : "bg-slate-100 text-slate-700 border border-slate-200"

  return (
    <>
      <SiteHeader />

      <div className="min-h-screen bg-slate-50 pt-20">
        <div className="mx-auto w-full max-w-[1800px] px-4 py-6 lg:px-8">

          {successMessage && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </div>
          )}

          {!isPremiumUser && (
            <div className="mb-8">
              <Link
                href="/upgrade"
                className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100"
              >
                Upgrade to Premium
              </Link>
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black text-slate-900">
              Account Information
            </h2>

            {loading ? (
              <p className="mt-4">Loading...</p>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">

                <div className="rounded-2xl border bg-slate-50 p-5">
                  <p className="text-xs text-slate-400">Full Name</p>
                  <p className="text-lg font-semibold">{displayName}</p>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-5">
                  <p className="text-xs text-slate-400">Email</p>
                  <p className="text-lg font-semibold break-all">
                    {displayEmail}
                  </p>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-5">
                  <p className="text-xs text-slate-400">Membership</p>
                  <span className={membershipBadgeClasses}>
                    {displayMembership}
                  </span>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-5">
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
    </>
  )
}