
"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
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
  | { state: "available"; message: "Username is available." | "This is your current username." }
  | { state: "taken"; message: "Username is already taken." }
  | {
      state: "invalid"
      message: "Username must be 3-30 characters and only use letters, numbers, dot, underscore, or dash."
    }
  | { state: "error"; message: "Could not check username right now." }

type ProfileTab = "overview" | "info" | "security"
type RedeemPlan = "premium" | "platinum"

type ProfileViewStats = {
  views: number
  visitors: number
}

type CoinToast = {
  id: string
  amount: number
  label: string
  kind: "earn" | "spend"
}

type SocialReaction = {
  emoji: string
  label: string
  count: number
}

type DownloadHistoryItem = {
  id: string
  title: string
  href: string
  downloaded_at: string
  size_label?: string
  type_label?: string
  preview?: string
}

type ActivityFeedItem = {
  id: string
  icon: string
  title: string
  subtitle: string
  created_at: string
}

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
    return "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-[0_0_30px_rgba(99,102,241,0.35)]"
  }
  if (level === "platinum") {
    return "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-sm font-bold text-white shadow-[0_0_30px_rgba(217,70,239,0.35)]"
  }
  if (level === "premium") {
    return "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-[0_0_30px_rgba(16,185,129,0.35)]"
  }
  return "inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-[0_0_30px_rgba(255,255,255,0.08)]"
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
    ? "rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-[0_10px_30px_rgba(255,255,255,0.16)] transition"
    : "rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
}

function formatCoinAmount(amount: number) {
  if (amount > 0) return `+${amount.toLocaleString()}`
  return `${amount.toLocaleString()}`
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
  if (normalized === "spend_message") return "Messenger feature spent"
  if (normalized === "profile_boost") return "Profile boost spent"

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

function formatShortDate(value?: string | null) {
  if (!value) return "Recently"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently"

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

function SectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-900/80 p-5 shadow-[0_15px_45px_rgba(0,0,0,0.35)] ring-1 ring-white/5 backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(56,189,248,0.18)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon?: string
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/80 p-4 shadow-sm ring-1 ring-white/5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(56,189,248,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
        {icon ? <span className="text-lg">{icon}</span> : null}
      </div>
      <p className="mt-2 truncate text-xl font-black text-white sm:text-2xl">{value}</p>
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

function DetailCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950 p-4 transition duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(56,189,248,0.18)]">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-2 break-words font-bold text-white">{children}</div>
    </div>
  )
}

function getReactionStyles(emoji: string) {
  if (emoji === "❤️") return "border-pink-400/20 bg-pink-500/10 text-pink-200"
  if (emoji === "🔥") return "border-orange-400/20 bg-orange-500/10 text-orange-200"
  if (emoji === "👑") return "border-amber-400/20 bg-amber-500/10 text-amber-200"
  return "border-cyan-400/20 bg-cyan-500/10 text-cyan-200"
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
  const [viewStatsLoading, setViewStatsLoading] = useState(false)
  const [downloadsLoading, setDownloadsLoading] = useState(false)

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
  const [profileViewStats, setProfileViewStats] = useState<ProfileViewStats>({
    views: 0,
    visitors: 0,
  })

  const [coinToasts, setCoinToasts] = useState<CoinToast[]>([])
  const [walletPulse, setWalletPulse] = useState(false)
  const [walletShake, setWalletShake] = useState(false)

  const [fullNameInput, setFullNameInput] = useState("")
  const [usernameInput, setUsernameInput] = useState("")
  const [bioInput, setBioInput] = useState("")
  const [avatarUrlInput, setAvatarUrlInput] = useState("")
  const [newPasswordInput, setNewPasswordInput] = useState("")
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)

  const [socialReactions, setSocialReactions] = useState<SocialReaction[]>([
    { emoji: "❤️", label: "Likes", count: 0 },
    { emoji: "🔥", label: "Hype", count: 0 },
    { emoji: "👑", label: "Premium Love", count: 0 },
  ])
  const [selectedReaction, setSelectedReaction] = useState("❤️")
  const [downloadsHistory, setDownloadsHistory] = useState<DownloadHistoryItem[]>([])

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  const addCoinToast = useCallback((amount: number, label: string) => {
    if (amount === 0) return
    const kind = amount > 0 ? "earn" : "spend"
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setCoinToasts((prev) => [...prev, { id, amount, label, kind }])
    if (amount > 0) setWalletPulse(true)
    window.setTimeout(() => {
      setCoinToasts((prev) => prev.filter((item) => item.id !== id))
    }, 2400)
    window.setTimeout(() => setWalletPulse(false), 900)
  }, [])

  const triggerInsufficientCoins = useCallback((message: string) => {
    setSaveError(message)
    setWalletShake(true)
    window.setTimeout(() => setWalletShake(false), 550)
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
        setAvatarUrlInput(original.avatar_url || "")
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

  const loadProfileViewStats = useCallback(async () => {
    try {
      setViewStatsLoading(true)

      const username = normalizeUsername(profile?.username || "")
      if (!username) {
        setProfileViewStats({ views: 0, visitors: 0 })
        return
      }

      const response = await fetch(`/api/profile/views?username=${encodeURIComponent(username)}`, {
        method: "GET",
        cache: "no-store",
      })

      if (!response.ok) {
        setProfileViewStats({ views: 0, visitors: 0 })
        return
      }

      const data = (await response.json()) as Partial<ProfileViewStats>

      setProfileViewStats({
        views: Number(data.views || 0),
        visitors: Number(data.visitors || 0),
      })
    } catch (err) {
      console.error("Profile views fetch error:", err)
      setProfileViewStats({ views: 0, visitors: 0 })
    } finally {
      setViewStatsLoading(false)
    }
  }, [profile?.username])

  const loadDownloadsHistory = useCallback(async () => {
    try {
      if (!profile?.id) {
        setDownloadsHistory([])
        return
      }

      setDownloadsLoading(true)

      const { data, error } = await supabase
        .from("coin_history")
        .select("id, description, created_at")
        .eq("user_id", profile.id)
        .in("type", ["download_reward"])
        .order("created_at", { ascending: false })
        .limit(6)

      if (error) {
        console.error("Download history load error:", error)
        setDownloadsHistory([])
        return
      }

      const items: DownloadHistoryItem[] = (Array.isArray(data) ? data : []).map((item: { id: string; description?: string | null; created_at?: string | null }, index: number) => ({
        id: item.id,
        title: item.description?.trim() || `Downloaded file ${index + 1}`,
        href: "/downloads",
        downloaded_at: item.created_at || new Date().toISOString(),
        type_label: "Download",
        size_label: "Saved item",
      }))

      setDownloadsHistory(items)
    } catch (err) {
      console.error("Download history load error:", err)
      setDownloadsHistory([])
    } finally {
      setDownloadsLoading(false)
    }
  }, [profile?.id, supabase])

  useEffect(() => {
    void loadProfile(true)
  }, [loadProfile])

  useEffect(() => {
    void loadDailyRewardStatus()
    void loadLeaderboard()
  }, [loadDailyRewardStatus, loadLeaderboard])

  useEffect(() => {
    if (!profile?.id) return
    void loadCoinHistory()
    void loadDownloadsHistory()
  }, [profile?.id, loadCoinHistory, loadDownloadsHistory])

  useEffect(() => {
    if (!profile?.username) {
      setProfileViewStats({ views: 0, visitors: 0 })
      return
    }
    void loadProfileViewStats()
  }, [profile?.username, loadProfileViewStats])

  useEffect(() => {
    if (editOpen) return

    const refresh = () => void loadProfile(false)
    window.addEventListener("focus", refresh)
    return () => window.removeEventListener("focus", refresh)
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
            description?: string
          } | null

          if (inserted?.amount) {
            addCoinToast(Number(inserted.amount), inserted.description || formatCoinAction(inserted.type))
          }

          await loadProfile(false)
          await loadCoinHistory()
          await loadDailyRewardStatus()
          await loadLeaderboard()
          await loadProfileViewStats()
          await loadDownloadsHistory()

          window.dispatchEvent(new Event("jb-coins-updated"))
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [
    profile?.id,
    supabase,
    addCoinToast,
    loadCoinHistory,
    loadDailyRewardStatus,
    loadLeaderboard,
    loadProfile,
    loadProfileViewStats,
    loadDownloadsHistory,
  ])

  useEffect(() => {
    const popupListener = (event: Event) => {
      const detail = (event as CustomEvent<{ amount?: number; label?: string }>).detail
      if (!detail?.amount) return
      addCoinToast(Number(detail.amount), detail.label || "JB Coins updated")
    }

    window.addEventListener("jb-coins-popup", popupListener as EventListener)
    return () => {
      window.removeEventListener("jb-coins-popup", popupListener as EventListener)
    }
  }, [addCoinToast])

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

        if (showSuccess) setSaveMessage("Profile updated successfully.")
        return true
      } catch (err) {
        console.error("Unexpected save error:", err)
        setSaveError("Something went wrong while saving.")
        return false
      } finally {
        setSaving(false)
      }
    },
    [avatarUrlInput, bioInput, fullNameInput, profile?.id, supabase, usernameInput, usernameStatus.state]
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
  }, [editOpen, hasUnsavedChanges, fullNameInput, usernameInput, usernameStatus.state, saveProfile])

  async function handleAvatarUpload(file: File) {
    if (!profile?.id) return

    try {
      setUploadingAvatar(true)
      setSaveError("")
      setSaveMessage("")

      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
      const filePath = `${profile.id}/${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, {
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
    const cost = plan === "premium" ? 2000 : 2600
    if (jbPoints < cost) {
      triggerInsufficientCoins(`Not enough JB Coins. You need ${cost.toLocaleString()} coins.`)
      return
    }

    try {
      setRedeemingPlan(plan)
      setSaveError("")
      setSaveMessage("")
      addCoinToast(-cost, plan === "premium" ? "Premium unlock" : "Platinum unlock")

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
          (plan === "premium" ? "Premium redeemed successfully." : "Platinum redeemed successfully.")
      )

      await loadProfile(false)
      await loadCoinHistory()
      await loadLeaderboard()
      await loadProfileViewStats()
      await loadDownloadsHistory()
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

  async function handleClaimDailyReward() {
    try {
      setSaveError("")
      setSaveMessage("")

      const response = await fetch("/api/daily-reward", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = (await response.json()) as DailyRewardStatus

      if (!response.ok) {
        setSaveError(data.error || data.message || "Failed to claim daily reward.")
        return
      }

      const total = Number(data.coins || 0)
      addCoinToast(total, "Daily reward claimed")
      setSaveMessage(data.message || "Daily reward claimed successfully.")

      await loadProfile(false)
      await loadCoinHistory()
      await loadDailyRewardStatus()
      await loadLeaderboard()
      await loadProfileViewStats()
      await loadDownloadsHistory()
    } catch (err) {
      console.error("Daily reward claim error:", err)
      setSaveError("Failed to claim daily reward.")
    }
  }

  function handleReactionClick(emoji: string) {
    setSelectedReaction(emoji)
    setSocialReactions((prev) =>
      prev.map((item) =>
        item.emoji === emoji
          ? {
              ...item,
              count: item.count + 1,
            }
          : item
      )
    )
    setSaveMessage(`You reacted with ${emoji}`)
    window.setTimeout(() => {
      setSaveMessage((prev) => (prev === `You reacted with ${emoji}` ? "" : prev))
    }, 1600)
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
    profile?.full_name || profile?.name || profile?.username || authEmail.split("@")[0] || "User"

  const displayEmail = profile?.email || authEmail || "No email"
  const membershipLevel = normalizeMembership(profile)
  const displayMembership = getMembershipLabel(membershipLevel)
  const membershipBadgeClasses = getMembershipBadgeClasses(membershipLevel)
  const displayStatus = profile?.account_status || profile?.status || "Active"
  const initials = getInitials(displayName)

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "https://jb-collections.com")

  const publicProfileText = profile?.username ? `${siteUrl}/u/${profile.username}` : "Set username first"
  const referralCode = profile?.referral_code?.trim() || ""
  const referralLink = referralCode ? `${siteUrl}/signup?ref=${referralCode}` : "Referral code unavailable"

  const jbPoints = Number(profile?.coins || 0)
  const streak = Number(dailyRewardStatus?.streak || 0)
  const streakBonus = Number(dailyRewardStatus?.streakBonus || 0)
  const baseCoins = Number(dailyRewardStatus?.baseCoins || 15)
  const nextMilestone = dailyRewardStatus?.nextMilestone || null
  const todayRewardCoins = Number(dailyRewardStatus?.coins || baseCoins + streakBonus || 15)

  const hasPremiumAccess =
    membershipLevel === "premium" || membershipLevel === "platinum" || membershipLevel === "admin"
  const hasPlatinumAccess = membershipLevel === "platinum" || membershipLevel === "admin"

  const canRedeemPremium =
    membershipLevel !== "admin" &&
    membershipLevel !== "premium" &&
    membershipLevel !== "platinum" &&
    jbPoints >= 2000

  const canRedeemPlatinum =
    membershipLevel !== "admin" && membershipLevel !== "platinum" && jbPoints >= 2600

  const reactionTotal = socialReactions.reduce((sum, item) => sum + item.count, 0)

  const derivedReactions = useMemo<SocialReaction[]>(
    () => [
      { emoji: "❤️", label: "Likes", count: Math.max(Math.floor(profileViewStats.views * 0.18), 12) },
      { emoji: "🔥", label: "Hype", count: Math.max(Math.floor(profileViewStats.visitors * 0.12), 6) },
      {
        emoji: "👑",
        label: "Premium Love",
        count: membershipLevel === "standard" ? 3 : membershipLevel === "premium" ? 12 : 24,
      },
    ],
    [membershipLevel, profileViewStats.views, profileViewStats.visitors]
  )

  useEffect(() => {
    setSocialReactions((prev) =>
      prev.map((item) => {
        const match = derivedReactions.find((entry) => entry.emoji === item.emoji)
        return match
          ? {
              ...item,
              count: Math.max(item.count, match.count),
            }
          : item
      })
    )
  }, [derivedReactions])

  const activityFeed = useMemo<ActivityFeedItem[]>(() => {
    const coinItems = coinHistory.slice(0, 4).map((item) => {
      const amount = Number(item.amount || 0)
      return {
        id: `coin-${item.id}`,
        icon: amount >= 0 ? "🪙" : "💸",
        title: formatCoinAction(item.type, item.description),
        subtitle:
          amount >= 0
            ? `Earned ${formatCoinAmount(amount)} JB Coins`
            : `Spent ${formatCoinAmount(amount)} JB Coins`,
        created_at: item.created_at || new Date().toISOString(),
      }
    })

    const downloadItems = downloadsHistory.slice(0, 3).map((item) => ({
      id: `download-${item.id}`,
      icon: "⬇️",
      title: item.title,
      subtitle: "Downloaded a file from the collection",
      created_at: item.downloaded_at,
    }))

    return [...downloadItems, ...coinItems]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 7)
  }, [coinHistory, downloadsHistory])

  const walletLedgerItems = useMemo(
    () =>
      coinHistory.slice(0, 3).map((item) => {
        const amount = Number(item.amount || 0)
        const isEarn = amount >= 0
        return {
          id: item.id,
          label: formatCoinAction(item.type, item.description),
          amountLabel: `${isEarn ? "+" : ""}${amount.toLocaleString()} 🪙`,
          amountClass: isEarn ? "text-emerald-200" : "text-red-300",
        }
      }),
    [coinHistory]
  )

  const walletLedgerTotals = useMemo(() => {
    const credits = coinHistory.reduce((sum, item) => {
      const amount = Number(item.amount || 0)
      return amount > 0 ? sum + amount : sum
    }, 0)

    const debits = coinHistory.reduce((sum, item) => {
      const amount = Number(item.amount || 0)
      return amount < 0 ? sum + Math.abs(amount) : sum
    }, 0)

    return { credits, debits }
  }, [coinHistory])

  const gamerTitle =
    membershipLevel === "admin"
      ? "System Commander"
      : membershipLevel === "platinum"
        ? "Elite Collector"
        : membershipLevel === "premium"
          ? "Premium Hunter"
          : "Rising Collector"

  const achievementCards = [
    {
      icon: "🏆",
      label: "Wallet Power",
      value: `${jbPoints.toLocaleString()} coins`,
    },
    {
      icon: "👁",
      label: "Public Reach",
      value: `${profileViewStats.views.toLocaleString()} views`,
    },
    {
      icon: "⬇️",
      label: "Downloads",
      value: `${downloadsHistory.length.toLocaleString()} recent`,
    },
    {
      icon: "🔥",
      label: "Current Streak",
      value: `${streak} day${streak === 1 ? "" : "s"}`,
    },
  ]

  if (loading) {
    return (
      <>
        <SiteHeader />
        <div className="min-h-screen bg-slate-950 pt-28">
          <div className="mx-auto w-full max-w-md px-3 pb-10 sm:max-w-2xl sm:px-4 lg:max-w-7xl">
            <div className="h-56 animate-pulse rounded-[32px] border border-white/10 bg-slate-900/80 ring-1 ring-white/5" />
            <div className="-mt-14 h-72 animate-pulse rounded-[32px] border border-white/10 bg-slate-900/80 ring-1 ring-white/5" />
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

      <style jsx>{`
        @keyframes profileGlow {
          0%,
          100% {
            transform: scale(1) translateY(0px);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.08) translateY(-6px);
            opacity: 1;
          }
        }

        @keyframes coinFloat {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-8px) rotate(4deg);
          }
        }

        @keyframes cardPulse {
          0%,
          100% {
            box-shadow: 0 0 0 rgba(56, 189, 248, 0);
          }
          50% {
            box-shadow: 0 0 38px rgba(56, 189, 248, 0.12);
          }
        }

        @keyframes walletPulse {
          0% {
            transform: scale(1);
          }
          40% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes walletShake {
          0%,100% {
            transform: translateX(0);
          }
          20% {
            transform: translateX(-6px);
          }
          40% {
            transform: translateX(6px);
          }
          60% {
            transform: translateX(-5px);
          }
          80% {
            transform: translateX(5px);
          }
        }

        @keyframes coinToastIn {
          0% {
            opacity: 0;
            transform: translateY(28px) scale(0.9);
          }
          18% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(-120px) scale(1.06);
          }
        }

        @keyframes coinBurst {
          0% {
            transform: scale(0.85);
            opacity: 0;
          }
          20% {
            transform: scale(1.08);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .profile-glow {
          animation: profileGlow 8s ease-in-out infinite;
        }

        .coin-float {
          animation: coinFloat 4s ease-in-out infinite;
        }

        .card-pulse {
          animation: cardPulse 5s ease-in-out infinite;
        }

        .wallet-pulse {
          animation: walletPulse 0.9s ease-out;
        }

        .wallet-shake {
          animation: walletShake 0.55s ease-in-out;
        }

        .coin-toast {
          animation: coinToastIn 2.4s ease-out forwards;
        }

        .coin-burst {
          animation: coinBurst 0.32s ease-out;
        }
      `}</style>

      <div className="min-h-screen bg-slate-950 pt-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.15),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.15),transparent_30%)]" />

        <div className="pointer-events-none fixed inset-x-0 top-28 z-50 flex justify-center">
          <div className="relative w-full max-w-7xl px-4">
            {coinToasts.map((toast) => (
              <div
                key={toast.id}
                className={`coin-toast absolute right-0 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${
                  toast.kind === "earn"
                    ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                    : "border-red-400/30 bg-red-500/15 text-red-300"
                }`}
              >
                <div className="coin-burst flex items-center gap-3 font-black">
                  <span className="text-lg">{toast.kind === "earn" ? "🪙" : "💸"}</span>
                  <div>
                    <div>{formatCoinAmount(toast.amount)} JB Coins</div>
                    <div className="text-xs font-semibold opacity-80">{toast.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

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

          <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.28),transparent_30%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.25),transparent_32%),linear-gradient(135deg,#0ea5e9_0%,#2563eb_40%,#4f46e5_70%,#7c3aed_100%)] shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
            <div className="profile-glow absolute -left-10 top-10 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="profile-glow absolute right-8 top-4 h-48 w-48 rounded-full bg-fuchsia-300/18 blur-3xl" />
            <div className="profile-glow absolute bottom-0 left-1/3 h-36 w-36 rounded-full bg-amber-300/18 blur-3xl" />

            <div className="relative px-4 py-6 sm:px-8 lg:px-10">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-center">
                  <div className="relative">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={displayName}
                        className="h-28 w-28 rounded-[30px] border border-white/20 object-cover shadow-2xl"
                      />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-[30px] border border-white/20 bg-white/10 text-4xl font-black text-white shadow-2xl">
                        {initials}
                      </div>
                    )}
                    <div className="absolute -bottom-2 -right-2 rounded-full border border-white/20 bg-emerald-500 px-3 py-1 text-xs font-black text-white shadow-xl">
                      LIVE
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className={membershipBadgeClasses}>{displayMembership}</div>
                      <div className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-white/90">
                        {gamerTitle}
                      </div>
                    </div>

                    <h1 className="mt-3 truncate text-3xl font-black text-white sm:text-4xl">{displayName}</h1>
                    <p className="mt-1 text-sm font-semibold text-cyan-100">{displayEmail}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-cyan-100/70">{displayStatus}</p>

                    <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                      {achievementCards.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-white backdrop-blur"
                        >
                          <p className="text-xs uppercase tracking-wide text-white/60">
                            {item.icon} {item.label}
                          </p>
                          <p className="mt-1 text-sm font-black">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div
                  className={`w-full lg:w-[380px] rounded-[28px] border border-amber-300/20 bg-black/20 p-5 text-white shadow-2xl backdrop-blur ${
                    walletPulse ? "wallet-pulse" : ""
                  } ${walletShake ? "wallet-shake" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-100/80">JB Coin Wallet</p>
                      <div className="mt-2 flex items-end gap-3">
                        <span className="coin-float text-4xl">🪙</span>
                        <div>
                          <p className="text-4xl font-black text-amber-200">{jbPoints.toLocaleString()}</p>
                          <p className="text-sm font-semibold text-amber-100/80">Real balance from wallet</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/70">
                        Ledger Source
                      </p>
                      <p className="mt-1 text-xs font-semibold text-white/90">coin_history</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/70">
                        Recent Credits
                      </p>
                      <p className="mt-1 text-lg font-black text-emerald-200">
                        +{walletLedgerTotals.credits.toLocaleString()} 🪙
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/70">
                        Recent Debits
                      </p>
                      <p className="mt-1 text-lg font-black text-red-300">
                        -{walletLedgerTotals.debits.toLocaleString()} 🪙
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100/70">
                        Latest Real Wallet Entries
                      </p>
                      <p className="text-[11px] font-semibold text-amber-100/70">
                        Showing newest {Math.min(walletLedgerItems.length, 3)} entries
                      </p>
                    </div>

                    <div className="grid gap-2 text-sm text-amber-50/90">
                      {walletLedgerItems.length > 0 ? (
                        walletLedgerItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                          >
                            <span className="truncate">{item.label}</span>
                            <span className={`shrink-0 font-black ${item.amountClass}`}>{item.amountLabel}</span>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-3 py-3 text-sm text-amber-100/70">
                          No wallet entries yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => setEditOpen((prev) => !prev)}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-900 transition hover:scale-[1.02]"
                >
                  {editOpen ? "Close Edit Profile" : "Edit Profile"}
                </button>

                {profile?.username ? (
                  <Link
                    href={`/u/${profile.username}`}
                    className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                  >
                    View Public Profile
                  </Link>
                ) : null}

                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(referralLink)}
                  className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15"
                >
                  Copy Referral Link
                </button>
              </div>
            </div>
          </section>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="JB Coins" value={jbPoints.toLocaleString()} hint="Your current balance" icon="🪙" />
            <StatCard
              label="Daily Streak"
              value={`${streak} Day${streak === 1 ? "" : "s"}`}
              hint="Keep claiming every day"
              icon="🔥"
            />
            <StatCard
              label="Profile Views"
              value={viewStatsLoading ? "Loading..." : profileViewStats.views.toLocaleString()}
              hint="Total public profile views"
              icon="👁"
            />
            <StatCard
              label="Unique Visitors"
              value={viewStatsLoading ? "Loading..." : profileViewStats.visitors.toLocaleString()}
              hint="Different people who visited"
              icon="🌐"
            />
            <StatCard label="Reactions" value={reactionTotal.toLocaleString()} hint="Love from your profile" icon="❤️" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => setActiveTab("overview")} className={tabClass(activeTab === "overview")}>
              Overview
            </button>
            <button type="button" onClick={() => setActiveTab("info")} className={tabClass(activeTab === "info")}>
              Info
            </button>
            <button type="button" onClick={() => setActiveTab("security")} className={tabClass(activeTab === "security")}>
              Security
            </button>
          </div>

          {editOpen ? (
            <div className="mt-6">
              <SectionCard
                title="Edit Profile"
                subtitle="This autosaves while you type. You can also save manually."
                action={
                  <button
                    type="button"
                    onClick={() => void saveProfile(true)}
                    disabled={saving}
                    className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving ? "Saving..." : "Save now"}
                  </button>
                }
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Full Name</label>
                    <input
                      value={fullNameInput}
                      onChange={(e) => setFullNameInput(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-0 transition focus:border-cyan-400"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Username</label>
                    <input
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-0 transition focus:border-cyan-400"
                      placeholder="username"
                    />
                    {usernameStatus.message ? (
                      <p
                        className={`mt-2 text-xs font-semibold ${
                          usernameStatus.state === "taken" || usernameStatus.state === "invalid" || usernameStatus.state === "error"
                            ? "text-red-300"
                            : usernameStatus.state === "checking"
                              ? "text-amber-300"
                              : "text-emerald-300"
                        }`}
                      >
                        {usernameStatus.message}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950 p-4 md:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Bio</label>
                    <textarea
                      value={bioInput}
                      onChange={(e) => setBioInput(e.target.value)}
                      rows={4}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-0 transition focus:border-cyan-400"
                      placeholder="Tell people about yourself"
                    />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Avatar URL</label>
                    <input
                      value={avatarUrlInput}
                      onChange={(e) => setAvatarUrlInput(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-0 transition focus:border-cyan-400"
                      placeholder="https://..."
                    />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Upload Avatar</label>
                    <label className="mt-2 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-white/15 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-cyan-400/50">
                      {uploadingAvatar ? "Uploading..." : "Choose image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void handleAvatarUpload(file)
                        }}
                      />
                    </label>
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : null}

          {activeTab === "overview" ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr,0.95fr]">
              <div className="space-y-6">
                <SectionCard
                  title="Profile Identity"
                  subtitle="This is the social layer that makes the page feel more like a real premium profile."
                >
                  <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                    <div className="rounded-[24px] border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(15,23,42,0.95))] p-5">
                      <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">Bio Highlight</p>
                      <p className="mt-3 text-lg font-bold leading-relaxed text-white">
                        {profile?.bio?.trim()
                          ? profile.bio
                          : "Collector profile powered by JB Coins, daily streaks, downloads, and premium progression."}
                      </p>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Profile Type</p>
                          <p className="mt-2 text-base font-black text-white">{gamerTitle}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Membership</p>
                          <p className="mt-2 text-base font-black text-white">{displayMembership}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-fuchsia-400/20 bg-[linear-gradient(135deg,rgba(217,70,239,0.12),rgba(15,23,42,0.95))] p-5">
                      <p className="text-xs uppercase tracking-[0.16em] text-fuchsia-200">Reactions</p>
                      <h3 className="mt-2 text-3xl font-black text-white">{reactionTotal.toLocaleString()}</h3>
                      <p className="mt-1 text-sm text-slate-300">People can feel the energy around this profile.</p>

                      <div className="mt-4 grid gap-3">
                        {socialReactions.map((item) => (
                          <button
                            key={item.emoji}
                            type="button"
                            onClick={() => handleReactionClick(item.emoji)}
                            className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition hover:scale-[1.01] ${getReactionStyles(
                              item.emoji
                            )} ${selectedReaction === item.emoji ? "ring-1 ring-white/20" : ""}`}
                          >
                            <span className="font-black">
                              {item.emoji} {item.label}
                            </span>
                            <span className="text-sm font-black">{item.count.toLocaleString()}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="JB Coins Engine"
                  subtitle="Make the economy obvious. Spending, earning, and value are shown clearly here."
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-amber-400/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.18),rgba(15,23,42,0.92))] p-5">
                      <p className="text-xs uppercase tracking-[0.16em] text-amber-200">Daily Reward</p>
                      <h3 className="mt-2 text-3xl font-black text-white">+{todayRewardCoins.toLocaleString()} JB Coins</h3>
                      <p className="mt-2 text-sm text-amber-100/80">
                        Base reward: +{baseCoins.toLocaleString()} • Streak bonus: +{streakBonus.toLocaleString()}
                      </p>

                      <button
                        type="button"
                        onClick={() => void handleClaimDailyReward()}
                        disabled={Boolean(dailyRewardStatus?.claimed || dailyRewardStatus?.alreadyClaimed || streakLoading)}
                        className="mt-5 w-full rounded-2xl bg-amber-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {streakLoading
                          ? "Loading..."
                          : dailyRewardStatus?.claimed || dailyRewardStatus?.alreadyClaimed
                            ? "Already claimed today"
                            : `Claim +${todayRewardCoins.toLocaleString()} JB Coins`}
                      </button>

                      {dailyRewardStatus?.nextClaimDate ? (
                        <p className="mt-3 text-xs text-slate-300">Next claim: {dailyRewardStatus.nextClaimDate}</p>
                      ) : null}
                    </div>

                    <div className="rounded-[24px] border border-orange-400/20 bg-[linear-gradient(135deg,rgba(251,146,60,0.14),rgba(239,68,68,0.08),rgba(15,23,42,0.9))] p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-orange-200">Daily Streak</p>
                          <h3 className="mt-1 text-3xl font-black text-white">🔥 {streak} Day{streak === 1 ? "" : "s"}</h3>
                        </div>
                        {streakLoading ? <span className="text-xs font-bold text-orange-200">Loading...</span> : null}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Base Daily Reward</p>
                          <p className="mt-2 text-xl font-black text-amber-300">+{baseCoins} JB Coins</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Today's Streak Bonus</p>
                          <p className="mt-2 text-xl font-black text-emerald-300">+{streakBonus} JB Coins</p>
                        </div>
                      </div>

                      {nextMilestone?.target ? (
                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Next Milestone</p>
                          <p className="mt-2 text-base font-bold text-white">
                            Reach {Number(nextMilestone.target).toLocaleString()} days to unlock +{Number(nextMilestone.bonus || 0).toLocaleString()} bonus coins.
                          </p>
                          <p className="mt-1 text-sm text-slate-300">
                            Remaining: {Number(nextMilestone.remaining || 0).toLocaleString()} day(s)
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Downloads History"
                  subtitle="This makes the page feel like a real user profile instead of just a settings screen."
                  action={
                    <Link
                      href="/downloads"
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
                    >
                      View all
                    </Link>
                  }
                >
                  {downloadsLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-slate-950" />
                      ))}
                    </div>
                  ) : downloadsHistory.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950 p-6 text-sm font-semibold text-slate-400">
                      No downloads yet. Once this user downloads files, they will appear here.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                      {downloadsHistory.map((item) => (
                        <div
                          key={item.id}
                          className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950 transition duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(56,189,248,0.22)]"
                        >
                          <div className="relative aspect-[3/4] border-b border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.20),transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.65),rgba(2,6,23,0.98))]">
                            {item.preview ? (
                              <img
                                src={item.preview}
                                alt={item.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-cyan-400/20 bg-cyan-500/10 text-3xl shadow-[0_0_30px_rgba(34,211,238,0.18)]">
                                  ⬇️
                                </div>
                                <div className="px-3">
                                  <p className="line-clamp-2 text-sm font-black text-white">{item.title}</p>
                                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                                    Portrait Preview
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white backdrop-blur">
                              {item.type_label || "Download"}
                            </div>
                          </div>

                          <div className="space-y-3 p-4">
                            <div>
                              <p className="line-clamp-2 text-sm font-black text-white">{item.title}</p>
                              <p className="mt-1 text-xs text-slate-400">{formatShortDate(item.downloaded_at)}</p>
                            </div>

                            <div className="grid gap-2">
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">File Size</p>
                                <p className="mt-1 text-xs font-black text-white">{item.size_label || "Unknown size"}</p>
                              </div>

                              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">File Type</p>
                                <p className="mt-1 text-xs font-black text-white">{item.type_label || "Saved item"}</p>
                              </div>
                            </div>

                            <Link
                              href={item.href}
                              className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
                            >
                              Open
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Recent Coin Activity" subtitle="Users feel the economy more when history is visible.">
                  {historyLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-16 animate-pulse rounded-2xl border border-white/10 bg-slate-950" />
                      ))}
                    </div>
                  ) : coinHistory.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950 p-6 text-sm font-semibold text-slate-400">
                      No coin activity yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {coinHistory.map((item) => {
                        const amount = Number(item.amount || 0)
                        return (
                          <div
                            key={item.id}
                            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950 p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-white">
                                {formatCoinAction(item.type, item.description)}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">{formatHistoryDate(item.created_at)}</p>
                            </div>

                            <div className={`text-lg font-black ${getCoinAmountClasses(amount)}`}>
                              {formatCoinAmount(amount)} JB Coins
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </SectionCard>
              </div>

              <div className="space-y-6">
                <SectionCard title="Activity Feed" subtitle="A social-style timeline gives the profile more life.">
                  {activityFeed.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950 p-6 text-sm font-semibold text-slate-400">
                      Activity will appear here after coins, rewards, or downloads are recorded.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activityFeed.map((item) => (
                        <div key={item.id} className="rounded-[24px] border border-white/10 bg-slate-950 p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg">
                              {item.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-white">{item.title}</p>
                              <p className="mt-1 text-sm text-slate-300">{item.subtitle}</p>
                              <p className="mt-2 text-xs text-slate-500">{formatHistoryDate(item.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Leaderboard" subtitle="Make coins social so the value feels bigger.">
                  {leaderboardLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="h-14 animate-pulse rounded-2xl border border-white/10 bg-slate-950" />
                      ))}
                    </div>
                  ) : leaderboard.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950 p-6 text-sm font-semibold text-slate-400">
                      No leaderboard data yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leaderboard.map((entry) => (
                        <div
                          key={entry.id}
                          className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${
                            entry.is_current_user
                              ? "border-amber-400/25 bg-amber-400/10"
                              : "border-white/10 bg-slate-950"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-white">
                              {entry.avatar_url ? (
                                <img src={entry.avatar_url} alt={entry.display_name} className="h-11 w-11 rounded-2xl object-cover" />
                              ) : (
                                entry.initials || getInitials(entry.display_name)
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-white">
                                #{entry.rank} {entry.display_name}
                              </p>
                              <p className="truncate text-xs text-slate-400">
                                {entry.membership_label || entry.membership || "User"}
                                {entry.username ? ` • @${entry.username}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-black text-amber-300">{Number(entry.coins || 0).toLocaleString()}</p>
                            <p className="text-xs text-slate-400">JB Coins</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {myLeaderboardRank ? (
                    <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                      <p className="text-xs uppercase tracking-wide text-cyan-200">Your Rank</p>
                      <p className="mt-2 text-xl font-black text-white">#{myLeaderboardRank.rank}</p>
                      <p className="mt-1 text-sm text-cyan-100">{Number(myLeaderboardRank.coins || 0).toLocaleString()} JB Coins</p>
                    </div>
                  ) : null}
                </SectionCard>

                <SectionCard title="Profile Details" subtitle="Useful links and identity details.">
                  <div className="grid gap-3">
                    <DetailCard label="Public Profile">{publicProfileText}</DetailCard>
                    <DetailCard label="Referral Code">{referralCode || "No referral code yet"}</DetailCard>
                    <DetailCard label="Referral Link">{referralLink}</DetailCard>
                    <DetailCard label="Membership">{displayMembership}</DetailCard>
                    <DetailCard label="Status">{displayStatus}</DetailCard>
                  </div>
                </SectionCard>
              </div>
            </div>
          ) : null}

          {activeTab === "info" ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <SectionCard title="Public Info" subtitle="This is what helps users trust your profile.">
                <div className="grid gap-3">
                  <DetailCard label="Full Name">{displayName}</DetailCard>
                  <DetailCard label="Email">{displayEmail}</DetailCard>
                  <DetailCard label="Username">{profile?.username ? `@${profile.username}` : "Not set"}</DetailCard>
                  <DetailCard label="Bio">{profile?.bio || "No bio yet"}</DetailCard>
                </div>
              </SectionCard>

              <SectionCard title="Profile Highlights" subtitle="This makes the page feel personal, not just technical.">
                <div className="grid gap-3">
                  {achievementCards.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
                    >
                      {item.icon} {item.label}: {item.value}
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          ) : null}

          {activeTab === "security" ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <SectionCard title="Change Password" subtitle="Update your password securely.">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400">New Password</label>
                    <input
                      type="password"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                      placeholder="Enter new password"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                      placeholder="Confirm new password"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleChangePassword()}
                    disabled={passwordLoading}
                    className="w-full rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {passwordLoading ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </SectionCard>

              <SectionCard title="Account Notes" subtitle="Small reminders to keep the page safe and smooth.">
                <div className="grid gap-3">
                  {[
                    "Profile data autosaves while the edit section is open.",
                    "Username checks for availability before saving.",
                    "Avatar upload uses your Supabase avatars bucket.",
                    "Real-time coin updates listen to coin_history changes.",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-200">
                      {item}
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
