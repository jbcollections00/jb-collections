"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  bio?: string | null
  avatar_url?: string | null
  coins?: number | null
  referral_code?: string | null
}

type CoinHistoryItem = {
  id: string
  amount?: number | null
  type?: string | null
  description?: string | null
  created_at?: string | null
}

type DailyRewardStatus = {
  ok?: boolean
  claimed?: boolean
  alreadyClaimed?: boolean
  coins?: number
  baseCoins?: number
  streak?: number
  streakBonus?: number
  rewardDate?: string
  nextClaimDate?: string
  claimedAt?: string | null
  lastClaimDate?: string | null
  nextMilestone?: {
    target?: number
    remaining?: number
    bonus?: number
  } | null
  message?: string
  error?: string
}

type LeaderboardEntry = {
  rank: number
  id: string
  display_name: string
  username?: string | null
  avatar_url?: string | null
  initials?: string
  coins: number
  membership?: string
  membership_label?: string
  is_current_user?: boolean
}

type LeaderboardResponse = {
  ok?: boolean
  top?: LeaderboardEntry[]
  me?: LeaderboardEntry | null
  error?: string
}

type UsernameStatus =
  | { state: "idle"; message: "" }
  | { state: "checking"; message: "Checking username..." }
  | {
      state: "available"
      message: "Username is available." | "This is your current username."
    }
  | { state: "taken"; message: "Username is already taken." }
  | {
      state: "invalid"
      message: "Username must be 3-30 characters and only use letters, numbers, dot, underscore, or dash."
    }
  | { state: "error"; message: "Could not check username right now." }

type ProfileTab = "overview" | "info" | "security"
type RedeemPlan = "premium" | "platinum"

function normalizeMembership(profile: UserProfile | null) {
  const role = String(profile?.role || "").trim().toLowerCase()
  const membership = String(profile?.membership || "").trim().toLowerCase()

  if (role === "admin") return "admin"
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  if (profile?.is_premium) return "premium"
  return "standard"
}

function getMembershipLabel(level: string) {
  if (level === "admin") return "Administrator"
  if (level === "platinum") return "Platinum User"
  if (level === "premium") return "Premium User"
  return "Standard User"
}

function getMembershipBadgeClasses(level: string) {
  if (level === "admin") {
    return "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white"
  }

  if (level === "platinum") {
    return "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-sm font-bold text-white"
  }

  if (level === "premium") {
    return "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-bold text-white"
  }

  return "inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white"
}

function getInitials(name: string) {
  const cleaned = name.trim()
  if (!cleaned) return "U"

  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase()
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

function isValidUsername(value: string) {
  if (!value) return true
  return /^[a-z0-9_.-]{3,30}$/.test(value)
}

function tabClass(active: boolean) {
  return active
    ? "rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition"
    : "rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-4 shadow-sm ring-1 ring-white/5">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 truncate text-xl font-black text-white sm:text-2xl">{value}</p>
    </div>
  )
}

function DetailCard({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-2 font-bold text-white">{children}</div>
    </div>
  )
}

function formatCoinAmount(amount: number) {
  if (amount > 0) return `+${amount}`
  return `${amount}`
}

function getCoinAmountClasses(amount: number) {
  if (amount > 0) return "text-emerald-400"
  if (amount < 0) return "text-red-400"
  return "text-slate-300"
}

function formatCoinAction(actionType?: string | null, description?: string | null) {
  if (description?.trim()) return description.trim()

  const normalized = String(actionType || "").trim().toLowerCase()

  if (normalized === "download_reward") return "Download reward"
  if (normalized === "signup_bonus") return "Signup bonus"
  if (normalized === "referral_bonus") return "Referral signup bonus"
  if (normalized === "redeem_premium") return "Redeemed Premium"
  if (normalized === "redeem_platinum") return "Redeemed Platinum"
  if (normalized === "admin_adjustment") return "Admin adjustment"
  if (normalized === "daily_reward") return "Daily reward"

  return "JB Coin activity"
}

function formatHistoryDate(value?: string | null) {
  if (!value) return "Recent activity"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recent activity"

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export default function ProfilePageClient() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [redeemingPlan, setRedeemingPlan] = useState<RedeemPlan | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [streakLoading, setStreakLoading] = useState(false)
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [authEmail, setAuthEmail] = useState("")
  const [editOpen, setEditOpen] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")
  const [saveError, setSaveError] = useState("")
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview")

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>({
    state: "idle",
    message: "",
  })

  const [coinHistory, setCoinHistory] = useState<CoinHistoryItem[]>([])
  const [dailyRewardStatus, setDailyRewardStatus] = useState<DailyRewardStatus | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [myLeaderboardRank, setMyLeaderboardRank] = useState<LeaderboardEntry | null>(null)

  const [coinPopup, setCoinPopup] = useState<{
    id: string
    amount: number
  } | null>(null)

  const [fullNameInput, setFullNameInput] = useState("")
  const [usernameInput, setUsernameInput] = useState("")
  const [bioInput, setBioInput] = useState("")
  const [avatarUrlInput, setAvatarUrlInput] = useState("")
  const [newPasswordInput, setNewPasswordInput] = useState("")
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRealtimeEventRef = useRef<string | null>(null)

  const originalProfileRef = useRef<{
    full_name: string
    username: string
    bio: string
    avatar_url: string
  }>({
    full_name: "",
    username: "",
    bio: "",
    avatar_url: "",
  })

  const showCoinPopup = useCallback((amount: number, id?: string) => {
    if (amount <= 0) return

    setCoinPopup({
      id: id || `${Date.now()}`,
      amount,
    })

    if (popupTimerRef.current) clearTimeout(popupTimerRef.current)

    popupTimerRef.current = setTimeout(() => {
      setCoinPopup(null)
    }, 2500)
  }, [])

  const loadProfile = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) setLoading(true)

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
            "id, email, full_name, name, username, membership, account_status, status, is_premium, role, bio, avatar_url, coins, referral_code"
          )
          .eq("id", user.id)
          .maybeSingle()

        if (error) {
          console.error("Profile load error:", error)
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
          bio: "",
          avatar_url: "",
          coins: 0,
          referral_code: "",
        }

        const finalProfile = (data as UserProfile | null) ?? fallbackProfile
        setProfile(finalProfile)

        const original = {
          full_name: finalProfile.full_name || finalProfile.name || "",
          username: finalProfile.username || "",
          bio: finalProfile.bio || "",
          avatar_url: finalProfile.avatar_url || "",
        }

        originalProfileRef.current = original
        setFullNameInput(original.full_name)
        setUsernameInput(original.username)
        setBioInput(original.bio)
        setAvatarUrlInput(original.avatar_url)
      } catch (err) {
        console.error("Unexpected profile error:", err)
      } finally {
        if (showLoader) setLoading(false)
      }
    },
    [router, supabase]
  )

  const loadCoinHistory = useCallback(async () => {
    try {
      if (!profile?.id) return

      setHistoryLoading(true)

      const { data, error } = await supabase
        .from("coin_history")
        .select("id, amount, type, description, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(12)

      if (error) {
        console.error("Coin history load error:", error)
        setCoinHistory([])
        return
      }

      setCoinHistory(Array.isArray(data) ? (data as CoinHistoryItem[]) : [])
    } catch (err) {
      console.error("Coin history load error:", err)
      setCoinHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [profile?.id, supabase])

  const loadDailyRewardStatus = useCallback(async () => {
    try {
      setStreakLoading(true)

      const response = await fetch("/api/daily-reward", {
        method: "GET",
        cache: "no-store",
      })

      const data = (await response.json()) as DailyRewardStatus

      if (!response.ok) {
        console.error("Daily reward status fetch error:", data?.error)
        return
      }

      setDailyRewardStatus(data)
    } catch (err) {
      console.error("Daily reward status fetch error:", err)
    } finally {
      setStreakLoading(false)
    }
  }, [])

  const loadLeaderboard = useCallback(async () => {
    try {
      setLeaderboardLoading(true)

      const response = await fetch("/api/leaderboard", {
        method: "GET",
        cache: "no-store",
      })

      const data = (await response.json()) as LeaderboardResponse

      if (!response.ok) {
        console.error("Leaderboard fetch error:", data?.error)
        return
      }

      setLeaderboard(Array.isArray(data.top) ? data.top : [])
      setMyLeaderboardRank(data.me || null)
    } catch (err) {
      console.error("Leaderboard fetch error:", err)
    } finally {
      setLeaderboardLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfile(true)
  }, [loadProfile])

  useEffect(() => {
    void loadDailyRewardStatus()
    void loadLeaderboard()
  }, [loadDailyRewardStatus, loadLeaderboard])

  useEffect(() => {
    if (!profile?.id) return
    void loadCoinHistory()
  }, [profile?.id, loadCoinHistory])

  useEffect(() => {
    if (editOpen) return

    const refresh = () => loadProfile(false)
    window.addEventListener("focus", refresh)

    return () => {
      window.removeEventListener("focus", refresh)
    }
  }, [loadProfile, editOpen])

  useEffect(() => {
    if (!profile?.id) return

    const channel = supabase
      .channel(`profile-coins-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coin_history",
          filter: `user_id=eq.${profile.id}`,
        },
        async (payload) => {
          const eventId =
            String((payload.new as { id?: string } | null)?.id || "") ||
            String((payload.old as { id?: string } | null)?.id || "")

          if (eventId && lastRealtimeEventRef.current === eventId) return
          if (eventId) lastRealtimeEventRef.current = eventId

          const inserted = payload.new as {
            amount?: number
            id?: string
            type?: string
          } | null

          if (inserted?.amount && Number(inserted.amount) > 0) {
            showCoinPopup(Number(inserted.amount), String(inserted.id || eventId || Date.now()))
          }

          await loadProfile(false)
          await loadCoinHistory()
          await loadDailyRewardStatus()
          await loadLeaderboard()

          window.dispatchEvent(new Event("jb-coins-updated"))

          if (inserted?.amount && Number(inserted.amount) > 0) {
            window.dispatchEvent(
              new CustomEvent("jb-coins-popup", {
                detail: { amount: Number(inserted.amount) },
              })
            )
          }

          if (inserted?.type === "daily_reward") {
            window.dispatchEvent(
              new CustomEvent("jb-daily-reward-claimed", {
                detail: { coins: Number(inserted.amount || 0) },
              })
            )
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [profile?.id, supabase, loadProfile, loadCoinHistory, loadDailyRewardStatus, loadLeaderboard, showCoinPopup])

  useEffect(() => {
    return () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current)
    }
  }, [])

  const currentForm = useMemo(
    () => ({
      full_name: fullNameInput.trim(),
      username: normalizeUsername(usernameInput),
      bio: bioInput.trim(),
      avatar_url: avatarUrlInput.trim(),
    }),
    [fullNameInput, usernameInput, bioInput, avatarUrlInput]
  )

  const hasUnsavedChanges = useMemo(() => {
    const original = originalProfileRef.current
    return (
      currentForm.full_name !== original.full_name ||
      currentForm.username !== original.username ||
      currentForm.bio !== original.bio ||
      currentForm.avatar_url !== original.avatar_url
    )
  }, [currentForm])

  const checkUsernameAvailability = useCallback(
    async (username: string) => {
      const normalized = normalizeUsername(username)

      if (!normalized) {
        setUsernameStatus({ state: "idle", message: "" })
        return
      }

      if (!isValidUsername(normalized)) {
        setUsernameStatus({
          state: "invalid",
          message:
            "Username must be 3-30 characters and only use letters, numbers, dot, underscore, or dash.",
        })
        return
      }

      if (normalized === (profile?.username || "")) {
        setUsernameStatus({
          state: "available",
          message: "This is your current username.",
        })
        return
      }

      setUsernameStatus({ state: "checking", message: "Checking username..." })

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", normalized)
          .limit(1)

        if (error) {
          console.error("Username check error:", error)
          setUsernameStatus({
            state: "error",
            message: "Could not check username right now.",
          })
          return
        }

        const taken = Array.isArray(data) && data.length > 0
        setUsernameStatus(
          taken
            ? { state: "taken", message: "Username is already taken." }
            : { state: "available", message: "Username is available." }
        )
      } catch (err) {
        console.error("Unexpected username check error:", err)
        setUsernameStatus({
          state: "error",
          message: "Could not check username right now.",
        })
      }
    },
    [profile?.username, supabase]
  )

  useEffect(() => {
    if (!editOpen) return

    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current)

    usernameTimerRef.current = setTimeout(() => {
      void checkUsernameAvailability(usernameInput)
    }, 500)

    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current)
    }
  }, [usernameInput, editOpen, checkUsernameAvailability])

  const saveProfile = useCallback(
    async (showSuccess = false) => {
      if (!profile?.id) return false

      const trimmedFullName = fullNameInput.trim()
      const trimmedUsername = normalizeUsername(usernameInput)
      const trimmedBio = bioInput.trim()
      const trimmedAvatarUrl = avatarUrlInput.trim()

      if (!trimmedFullName) {
        setSaveError("Full name is required.")
        return false
      }

      if (trimmedUsername && !isValidUsername(trimmedUsername)) {
        setSaveError(
          "Username must be 3-30 characters and only use letters, numbers, dot, underscore, or dash."
        )
        return false
      }

      if (trimmedUsername && usernameStatus.state === "taken") {
        setSaveError("Please choose a different username.")
        return false
      }

      try {
        setSaving(true)
        setSaveError("")
        if (showSuccess) setSaveMessage("")

        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: trimmedFullName,
            username: trimmedUsername || null,
            bio: trimmedBio || null,
            avatar_url: trimmedAvatarUrl || null,
          })
          .eq("id", profile.id)

        if (error) {
          console.error("Save profile error:", error)
          setSaveError(error.message || "Failed to save profile.")
          return false
        }

        originalProfileRef.current = {
          full_name: trimmedFullName,
          username: trimmedUsername,
          bio: trimmedBio,
          avatar_url: trimmedAvatarUrl,
        }

        setProfile((prev) =>
          prev
            ? {
                ...prev,
                full_name: trimmedFullName,
                username: trimmedUsername || null,
                bio: trimmedBio || null,
                avatar_url: trimmedAvatarUrl || null,
              }
            : prev
        )

        if (showSuccess) {
          setSaveMessage("Profile updated successfully.")
        }

        return true
      } catch (err) {
        console.error("Unexpected save error:", err)
        setSaveError("Something went wrong while saving.")
        return false
      } finally {
        setSaving(false)
      }
    },
    [
      avatarUrlInput,
      bioInput,
      fullNameInput,
      profile?.id,
      supabase,
      usernameInput,
      usernameStatus.state,
    ]
  )

  useEffect(() => {
    if (!editOpen) return
    if (!hasUnsavedChanges) return
    if (!fullNameInput.trim()) return
    if (usernameInput.trim() && !isValidUsername(normalizeUsername(usernameInput))) return
    if (usernameStatus.state === "taken" || usernameStatus.state === "checking") return

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)

    autosaveTimerRef.current = setTimeout(() => {
      void saveProfile(false)
    }, 1200)

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [
    editOpen,
    hasUnsavedChanges,
    fullNameInput,
    usernameInput,
    usernameStatus.state,
    bioInput,
    avatarUrlInput,
    saveProfile,
  ])

  async function handleAvatarUpload(file: File) {
    if (!profile?.id) return

    try {
      setUploadingAvatar(true)
      setSaveError("")
      setSaveMessage("")

      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const filePath = `${profile.id}/${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          upsert: true,
        })

      if (uploadError) {
        console.error("Avatar upload error:", uploadError)
        setSaveError(uploadError.message || "Failed to upload image.")
        return
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath)
      const publicUrl = data.publicUrl

      setAvatarUrlInput(publicUrl)
      setSaveMessage("Image uploaded. Saving profile...")
    } catch (err) {
      console.error("Unexpected avatar upload error:", err)
      setSaveError("Something went wrong while uploading the image.")
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleRedeem(plan: RedeemPlan) {
    try {
      setRedeemingPlan(plan)
      setSaveError("")
      setSaveMessage("")

      const response = await fetch("/api/redeem-membership", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      })

      const data = (await response.json()) as {
        success?: boolean
        message?: string
        error?: string
      }

      if (!response.ok) {
        throw new Error(data.error || "Redeem failed.")
      }

      setSaveMessage(
        data.message ||
          (plan === "premium"
            ? "Premium redeemed successfully."
            : "Platinum redeemed successfully.")
      )

      await loadProfile(false)
      await loadCoinHistory()
      await loadLeaderboard()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Redeem failed."
      setSaveError(message)
    } finally {
      setRedeemingPlan(null)
    }
  }

  async function handleChangePassword() {
    try {
      setSaveError("")
      setSaveMessage("")

      const trimmedNewPassword = newPasswordInput.trim()
      const trimmedConfirmPassword = confirmPasswordInput.trim()

      if (!trimmedNewPassword) {
        setSaveError("Please enter your new password.")
        return
      }

      if (trimmedNewPassword.length < 6) {
        setSaveError("Password must be at least 6 characters.")
        return
      }

      if (!trimmedConfirmPassword) {
        setSaveError("Please confirm your new password.")
        return
      }

      if (trimmedNewPassword !== trimmedConfirmPassword) {
        setSaveError("Passwords do not match.")
        return
      }

      setPasswordLoading(true)

      const { error } = await supabase.auth.updateUser({
        password: trimmedNewPassword,
      })

      if (error) {
        setSaveError(error.message || "Failed to update password.")
        return
      }

      setSaveMessage("Password updated successfully.")
      setNewPasswordInput("")
      setConfirmPasswordInput("")
    } catch (err) {
      console.error("Password update error:", err)
      setSaveError("Something went wrong while updating password.")
    } finally {
      setPasswordLoading(false)
    }
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
  const membershipLevel = normalizeMembership(profile)
  const displayMembership = getMembershipLabel(membershipLevel)
  const membershipBadgeClasses = getMembershipBadgeClasses(membershipLevel)
  const displayStatus = profile?.account_status || profile?.status || "Active"
  const initials = getInitials(displayName)

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "https://jb-collections.com")

  const publicProfileText = profile?.username
    ? `${siteUrl}/u/${profile.username}`
    : "Set username first"

  const referralCode = profile?.referral_code?.trim() || ""
  const referralLink = referralCode
    ? `${siteUrl}/signup?ref=${referralCode}`
    : "Referral code unavailable"

  const jbPoints = Number(profile?.coins || 0)
  const streak = Number(dailyRewardStatus?.streak || 0)
  const streakBonus = Number(dailyRewardStatus?.streakBonus || 0)
  const baseCoins = Number(dailyRewardStatus?.baseCoins || 15)
  const nextMilestone = dailyRewardStatus?.nextMilestone || null

  const hasPremiumAccess =
    membershipLevel === "premium" ||
    membershipLevel === "platinum" ||
    membershipLevel === "admin"

  const hasPlatinumAccess =
    membershipLevel === "platinum" || membershipLevel === "admin"

  const canRedeemPremium =
    membershipLevel !== "admin" &&
    membershipLevel !== "premium" &&
    membershipLevel !== "platinum" &&
    jbPoints >= 2000

  const canRedeemPlatinum =
    membershipLevel !== "admin" &&
    membershipLevel !== "platinum" &&
    jbPoints >= 2600

  if (loading) {
    return (
      <>
        <SiteHeader />
        <div className="min-h-screen bg-slate-950 pt-28">
          <div className="mx-auto max-w-7xl px-4 pb-10">
            <div className="h-44 animate-pulse rounded-[32px] border border-white/10 bg-slate-900/80 ring-1 ring-white/5" />
            <div className="-mt-14 h-64 animate-pulse rounded-[32px] border border-white/10 bg-slate-900/80 ring-1 ring-white/5" />
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-[24px] border border-white/10 bg-slate-900/80 ring-1 ring-white/5"
                />
              ))}
            </div>
            <div className="mt-6 h-80 animate-pulse rounded-[32px] border border-white/10 bg-slate-900/80 ring-1 ring-white/5" />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteHeader />

      <div className="min-h-screen bg-slate-950 pt-28">
        <div className="mx-auto max-w-7xl px-4 pb-10">
          {successMessage && (
            <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 shadow-sm">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 shadow-sm">
              {errorMessage}
            </div>
          )}

          {saveMessage && (
            <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 shadow-sm">
              {saveMessage}
            </div>
          )}

          {saveError && (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 shadow-sm">
              {saveError}
            </div>
          )}

          <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.26),transparent_28%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.25),transparent_30%),linear-gradient(135deg,#0ea5e9_0%,#2563eb_45%,#4f46e5_75%,#7c3aed_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_40%)]" />
            <div className="relative h-20 sm:h-14" />
          </section>

          <section className="-mt-14 relative z-10 overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_28%),linear-gradient(135deg,#0f172a_0%,#111827_55%,#020617_100%)] p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative group w-fit">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      className="h-28 w-28 rounded-[28px] object-cover ring-2 ring-white/20 shadow-lg"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-[28px] bg-white/10 text-3xl font-black ring-1 ring-white/10 shadow-lg">
                      {initials}
                    </div>
                  )}

                  {editOpen && (
                    <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-[28px] bg-black/55 opacity-0 transition group-hover:opacity-100">
                      <span className="text-sm font-bold text-white">
                        {uploadingAvatar ? "Uploading..." : "Change"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingAvatar}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void handleAvatarUpload(file)
                        }}
                      />
                    </label>
                  )}
                </div>

                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-white/70">
                    Account Profile
                  </p>

                  <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                    {displayName}
                  </h1>

                  <p className="mt-2 text-sm text-white/75 sm:text-base">{displayEmail}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={membershipBadgeClasses}>{displayMembership}</span>

                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                      {displayStatus}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                    <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-sky-300">
                      Public link: {publicProfileText}
                    </span>

                    {profile?.username ? (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(publicProfileText)
                            setSaveMessage("Profile link copied.")
                            setSaveError("")
                          } catch {
                            setSaveError("Could not copy profile link.")
                            setSaveMessage("")
                          }
                        }}
                        className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 font-semibold text-white transition hover:bg-white/15"
                      >
                        Copy Link
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditOpen((prev) => !prev)
                    setSaveMessage("")
                    setSaveError("")
                  }}
                  className="rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-5 py-3 font-bold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110"
                >
                  {editOpen ? "Close Editor" : "Edit Profile"}
                </button>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-white/90 backdrop-blur-sm">
              {profile?.bio?.trim()
                ? profile.bio
                : "No bio yet. Open the profile editor and add a short introduction about yourself."}
            </div>
          </section>

          <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Membership"
              value={
                membershipLevel === "admin"
                  ? "Admin"
                  : membershipLevel === "platinum"
                    ? "Platinum"
                    : membershipLevel === "premium"
                      ? "Premium"
                      : "Standard"
              }
            />
            <StatCard label="Status" value={displayStatus} />
            <StatCard label="Username" value={profile?.username || "Not set"} />
            <StatCard
              label="Leaderboard Rank"
              value={leaderboardLoading ? "Loading..." : `#${myLeaderboardRank?.rank || "-"}`}
            />
          </section>

          {editOpen && (
            <>
              <section className="mt-6">
                <div className="rounded-[28px] border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-yellow-400/10 to-orange-500/10 p-5 shadow-lg">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <img
                        src="/jb-coin.png"
                        alt="JB Coin"
                        className="h-14 w-14 object-contain drop-shadow-lg"
                      />

                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-amber-200">
                          JB Coins
                        </p>
                        <p className="mt-1 text-2xl font-black text-white sm:text-3xl">
                          {jbPoints.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-xs font-bold text-amber-200">
                      Balance
                    </div>
                  </div>
                </div>
              </section>

              <section className="mt-6 rounded-[32px] border border-white/10 bg-slate-900/80 p-6 shadow-sm ring-1 ring-white/5">
                <div className="mb-5">
                  <h2 className="text-xl font-black text-white">Edit Your Profile</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Changes save automatically while you type.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-200">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullNameInput}
                      onChange={(e) => setFullNameInput(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-200">
                      Username
                    </label>
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400"
                      placeholder="yourusername"
                    />
                    {usernameStatus.message ? (
                      <p
                        className={`mt-2 text-sm font-medium ${
                          usernameStatus.state === "available"
                            ? "text-emerald-400"
                            : usernameStatus.state === "checking"
                              ? "text-slate-400"
                              : usernameStatus.state === "taken" ||
                                  usernameStatus.state === "invalid" ||
                                  usernameStatus.state === "error"
                                ? "text-red-400"
                                : "text-slate-400"
                        }`}
                      >
                        {usernameStatus.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-200">
                      Profile Image
                    </label>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      {avatarUrlInput ? (
                        <img
                          src={avatarUrlInput}
                          alt="Profile preview"
                          className="h-24 w-24 rounded-2xl object-cover ring-1 ring-white/10"
                        />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-slate-950 text-lg font-bold text-slate-300 ring-1 ring-white/10">
                          {initials}
                        </div>
                      )}

                      <div className="flex-1">
                        <label className="inline-flex cursor-pointer items-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-200">
                          {uploadingAvatar ? "Uploading..." : "Upload Image"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingAvatar}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) void handleAvatarUpload(file)
                            }}
                          />
                        </label>
                        <p className="mt-2 text-sm text-slate-400">
                          Upload a square image for the best result.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-bold text-slate-200">
                      Bio
                    </label>
                    <textarea
                      value={bioInput}
                      onChange={(e) => setBioInput(e.target.value)}
                      rows={4}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400"
                      placeholder="Write a short bio about yourself"
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await saveProfile(true)
                      if (ok) setEditOpen(false)
                    }}
                    disabled={saving || usernameStatus.state === "checking"}
                    className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving ? "Saving..." : "Save Now"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditOpen(false)
                      setSaveError("")
                      setSaveMessage("")
                      setUsernameStatus({ state: "idle", message: "" })

                      const original = originalProfileRef.current
                      setFullNameInput(original.full_name)
                      setUsernameInput(original.username)
                      setBioInput(original.bio)
                      setAvatarUrlInput(original.avatar_url)
                    }}
                    className="rounded-2xl border border-white/10 bg-slate-950 px-5 py-3 text-sm font-bold text-slate-200 transition hover:bg-slate-900"
                  >
                    Cancel
                  </button>

                  <span className="text-sm text-slate-400">
                    {saving
                      ? "Saving changes..."
                      : hasUnsavedChanges
                        ? "Unsaved changes detected."
                        : "All changes saved."}
                  </span>
                </div>
              </section>
            </>
          )}

          <section className="mt-6 rounded-[32px] border border-white/10 bg-slate-900/80 p-4 shadow-sm ring-1 ring-white/5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={tabClass(activeTab === "overview")}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("info")}
                className={tabClass(activeTab === "info")}
              >
                Personal Info
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("security")}
                className={tabClass(activeTab === "security")}
              >
                Security
              </button>
            </div>
          </section>

          {activeTab === "overview" && (
            <>
              <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-[32px] border border-white/10 bg-slate-900/80 p-6 shadow-sm ring-1 ring-white/5">
                  <div className="mb-4">
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-400">
                      About
                    </p>
                    <h2 className="mt-1 text-xl font-black text-white">Profile Overview</h2>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-slate-950 p-5">
                    <p className="text-sm leading-7 text-slate-200">
                      {profile?.bio?.trim()
                        ? profile.bio
                        : "No bio yet. Add a short intro so your profile looks more complete and premium."}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <DetailCard label="Display Name">{displayName}</DetailCard>
                    <DetailCard label="Public Profile">
                      <span className="break-all">{publicProfileText}</span>
                    </DetailCard>
                  </div>
                </div>

                <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-6 shadow-sm ring-1 ring-white/5">
                  <div className="mb-4">
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-400">
                      Account
                    </p>
                    <h2 className="mt-1 text-xl font-black text-white">Quick Summary</h2>
                  </div>

                  <div className="space-y-4">
                    <DetailCard label="Access Level">{displayMembership}</DetailCard>
                    <DetailCard label="Status">{displayStatus}</DetailCard>
                    <DetailCard label="Email">
                      <span className="break-all">{displayEmail}</span>
                    </DetailCard>
                  </div>
                </div>
              </section>

              <section className="mt-6 rounded-[32px] border border-white/10 bg-slate-900/80 p-6 shadow-sm ring-1 ring-white/5">
                <div className="mb-5">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-400">
                    Rewards
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white">JB Rewards</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Use your JB Coins to redeem membership rewards, keep your streak, and view the full leaderboard on its own page.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-white/10 bg-slate-950 p-5">
                    <div className="flex items-center gap-4">
                      <img
                        src="/jb-coin.png"
                        alt="JB Coin"
                        className="h-16 w-16 object-contain drop-shadow-lg"
                      />

                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                          Your JB Coins
                        </p>
                        <p className="mt-1 text-4xl font-black text-yellow-400">
                          {jbPoints}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-2 text-sm font-bold">
                      <p className="text-amber-300">Redeem Premium = 2000 JB Coins</p>
                      <p className="text-fuchsia-300">Redeem Platinum = 2600 JB Coins</p>
                    </div>

                    <div className="mt-5 grid gap-3">
                      <button
                        type="button"
                        onClick={() => void handleRedeem("premium")}
                        disabled={!canRedeemPremium || redeemingPlan !== null}
                        className="rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {redeemingPlan === "premium"
                          ? "Redeeming Premium..."
                          : hasPremiumAccess
                            ? "Premium Already Active"
                            : canRedeemPremium
                              ? "Redeem Premium"
                              : "Need 2000 JB Coins"}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleRedeem("platinum")}
                        disabled={!canRedeemPlatinum || redeemingPlan !== null}
                        className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {redeemingPlan === "platinum"
                          ? "Redeeming Platinum..."
                          : hasPlatinumAccess
                            ? "Platinum Already Active"
                            : canRedeemPlatinum
                              ? "Redeem Platinum"
                              : "Need 2600 JB Coins"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-orange-400/20 bg-[linear-gradient(135deg,rgba(251,146,60,0.14),rgba(239,68,68,0.08),rgba(15,23,42,0.9))] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-orange-200">
                          Daily Streak
                        </p>
                        <h3 className="mt-1 text-3xl font-black text-white">
                          🔥 {streak} Day{streak === 1 ? "" : "s"}
                        </h3>
                      </div>

                      {streakLoading ? (
                        <span className="text-xs font-bold text-orange-200">Loading...</span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Base Daily Reward
                        </p>
                        <p className="mt-2 text-xl font-black text-amber-300">
                          +{baseCoins} JB Coins
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Today&apos;s Streak Bonus
                        </p>
                        <p className="mt-2 text-xl font-black text-emerald-300">
                          +{streakBonus} JB Coins
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Next Milestone
                      </p>
                      <p className="mt-2 text-sm font-bold text-white">
                        {nextMilestone
                          ? `Day ${nextMilestone.target} • ${nextMilestone.remaining} day${nextMilestone.remaining === 1 ? "" : "s"} left`
                          : "Keep claiming daily"}
                      </p>
                      <p className="mt-1 text-sm text-orange-200">
                        {nextMilestone
                          ? `Bonus reward: +${nextMilestone.bonus} JB Coins`
                          : "More bonus rewards ahead"}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Day 3
                        </p>
                        <p className="mt-2 text-sm font-black text-yellow-300">+10</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Day 7
                        </p>
                        <p className="mt-2 text-sm font-black text-yellow-300">+40</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Day 14
                        </p>
                        <p className="mt-2 text-sm font-black text-yellow-300">+75</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Day 30
                        </p>
                        <p className="mt-2 text-sm font-black text-yellow-300">+200</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-white/10 bg-slate-950 p-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                      Referral Link
                    </p>

                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white break-all">
                      {referralLink}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (!referralCode) {
                              setSaveError("Referral code unavailable.")
                              setSaveMessage("")
                              return
                            }
                            await navigator.clipboard.writeText(referralLink)
                            setSaveMessage("Referral link copied.")
                            setSaveError("")
                          } catch {
                            setSaveError("Could not copy referral link.")
                            setSaveMessage("")
                          }
                        }}
                        className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                      >
                        Copy Referral Link
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void loadCoinHistory()
                          void loadDailyRewardStatus()
                          void loadLeaderboard()
                        }}
                        className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
                      >
                        Refresh Rewards
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-slate-950 p-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                      Leaderboard Page
                    </p>

                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                      <p className="text-sm font-semibold text-white">
                        Open the full JB Coin leaderboard on its own page for a cleaner profile view.
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        Your current rank: {leaderboardLoading ? "Loading..." : `#${myLeaderboardRank?.rank || "-"}`}
                      </p>
                      <Link
                        href="/leaderboard"
                        className="mt-4 inline-flex rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:brightness-110"
                      >
                        Open Leaderboard
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-[24px] border border-white/10 bg-slate-950 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-400">
                        History
                      </p>
                      <h3 className="mt-1 text-lg font-black text-white">
                        Recent JB Coin Activity
                      </h3>
                    </div>

                    {historyLoading ? (
                      <span className="text-sm text-slate-400">Loading...</span>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-3">
                    {!historyLoading && coinHistory.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-slate-400">
                        No JB Coin activity yet.
                      </div>
                    ) : null}

                    {coinHistory.map((item) => {
                      const amount = Number(item.amount || 0)

                      return (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white">
                              {formatCoinAction(item.type, item.description)}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {formatHistoryDate(item.created_at)}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className={`text-sm font-black ${getCoinAmountClasses(amount)}`}>
                              {formatCoinAmount(amount)} JB Coins
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === "info" && (
            <section className="mt-6 rounded-[32px] border border-white/10 bg-slate-900/80 p-6 shadow-sm ring-1 ring-white/5">
              <div className="mb-4">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-400">
                  Account Details
                </p>
                <h2 className="mt-1 text-xl font-black text-white">
                  Personal Information
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <DetailCard label="Full Name">{displayName}</DetailCard>
                <DetailCard label="Email">
                  <span className="break-all">{displayEmail}</span>
                </DetailCard>
                <DetailCard label="Username">{profile?.username || "Not set yet"}</DetailCard>
                <DetailCard label="Bio">{profile?.bio || "No bio yet"}</DetailCard>
              </div>
            </section>
          )}

          {activeTab === "security" && (
            <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-6 shadow-sm ring-1 ring-white/5">
                <div className="mb-4">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-400">
                    Security
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white">Account Safety</h2>
                </div>

                <div className="grid gap-4">
                  <DetailCard label="Login Email">
                    <span className="break-all">{displayEmail}</span>
                  </DetailCard>
                  <DetailCard label="Account Status">{displayStatus}</DetailCard>

                  <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Change Password
                    </p>

                    <div className="mt-3 grid gap-3">
                      <input
                        type="password"
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400"
                      />

                      <input
                        type="password"
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400"
                      />

                      <button
                        type="button"
                        onClick={() => void handleChangePassword()}
                        disabled={passwordLoading}
                        className="rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {passwordLoading ? "Updating Password..." : "Change Password"}
                      </button>

                      <p className="text-xs text-slate-400">
                        Use at least 6 characters for your new password.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-white/10 bg-slate-900/80 p-6 shadow-sm ring-1 ring-white/5">
                <div className="mb-4">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-400">
                    Membership
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white">Plan & Access</h2>
                </div>

                <div className="grid gap-4">
                  <DetailCard label="Current Plan">{displayMembership}</DetailCard>
                  <DetailCard label="Premium Access">
                    {membershipLevel === "premium" ||
                    membershipLevel === "platinum" ||
                    membershipLevel === "admin"
                      ? "Enabled"
                      : "Not active"}
                  </DetailCard>
                  <DetailCard label="Current Streak">
                    {streak} Day{streak === 1 ? "" : "s"}
                  </DetailCard>
                  <DetailCard label="Leaderboard Rank">
                    {leaderboardLoading ? "Loading..." : `#${myLeaderboardRank?.rank || "-"}`}
                  </DetailCard>

                  {membershipLevel === "admin" ||
                  membershipLevel === "premium" ||
                  membershipLevel === "platinum" ? (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
                      Your account already has elevated access.
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-300">
                      Earn more JB Coins to unlock Premium or Platinum access.
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {coinPopup ? (
        <div className="pointer-events-none fixed right-4 top-24 z-[9999] animate-bounce sm:right-6">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-300/40 bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 px-4 py-3 shadow-2xl shadow-amber-900/30">
            <img
              src="/jb-coin.png"
              alt="JB Coin"
              className="h-9 w-9 object-contain drop-shadow"
            />
            <div className="leading-tight">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-900/80">
                JB Coins Added
              </p>
              <p className="text-lg font-black text-slate-950">
                +{coinPopup.amount} JB Coins
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}