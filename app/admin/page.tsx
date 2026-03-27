"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import AdminHeader from "@/app/components/AdminHeader"
import { createClient } from "@/lib/supabase/client"

type AdminProfile = {
  role: string | null
}

type RecentUser = {
  id: string
  email: string | null
  full_name?: string | null
  name?: string | null
  username?: string | null
  role?: string | null
  created_at?: string | null
  last_seen?: string | null
}

type DashboardResponse = {
  categories?: number
  files?: number
  messages?: number
  upgrades?: number
  users?: number
  activeToday?: number
  onlineUsers?: number
  recentUsers?: RecentUser[]
}

type NotificationItem = {
  id: string
  type: "user" | "message"
  title: string
  subtitle: string
  meta?: string
  rawDate?: string | null
}

const DISMISSED_USER_NOTIFICATIONS_KEY = "jb_admin_dismissed_user_notifications"
const DISMISSED_MESSAGE_NOTIFICATIONS_KEY = "jb_admin_dismissed_message_notifications"

function getDisplayName(user: RecentUser) {
  return (
    user.full_name?.trim() ||
    user.name?.trim() ||
    user.username?.trim() ||
    user.email?.trim() ||
    "Unknown User"
  )
}

function formatDate(value?: string | null) {
  if (!value) return "—"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function isUserOnline(lastSeen?: string | null) {
  if (!lastSeen) return false

  const time = new Date(lastSeen).getTime()
  if (Number.isNaN(time)) return false

  return Date.now() - time <= 5 * 60 * 1000
}

function readDismissedIds(key: string) {
  if (typeof window === "undefined") return [] as string[]

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((value): value is string => typeof value === "string")
  } catch {
    return []
  }
}

function writeDismissedIds(key: string, ids: string[]) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids))))
  } catch {
    // ignore localStorage write errors
  }
}

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [loadingData, setLoadingData] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [messageCount, setMessageCount] = useState(0)
  const [upgradeCount, setUpgradeCount] = useState(0)
  const [userNotifications, setUserNotifications] = useState<NotificationItem[]>([])
  const [messageNotifications, setMessageNotifications] = useState<NotificationItem[]>([])

  const [dismissedUserNotificationIds, setDismissedUserNotificationIds] = useState<string[]>([])
  const [dismissedMessageNotificationIds, setDismissedMessageNotificationIds] = useState<string[]>([])
  const [storageReady, setStorageReady] = useState(false)

  useEffect(() => {
    setDismissedUserNotificationIds(readDismissedIds(DISMISSED_USER_NOTIFICATIONS_KEY))
    setDismissedMessageNotificationIds(readDismissedIds(DISMISSED_MESSAGE_NOTIFICATIONS_KEY))
    setStorageReady(true)
  }, [])

  const loadDashboard = useCallback(async (): Promise<{
    messageCount: number
    upgradeCount: number
    recentUsers: RecentUser[]
  }> => {
    try {
      const response = await fetch("/api/admin/stats", {
        method: "GET",
        cache: "no-store",
      })

      const data = (await response.json()) as DashboardResponse & {
        error?: string
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch admin stats")
      }

      return {
        messageCount: Number(data.messages ?? 0),
        upgradeCount: Number(data.upgrades ?? 0),
        recentUsers: Array.isArray(data.recentUsers) ? data.recentUsers : [],
      }
    } catch (error) {
      console.error("Failed to load admin dashboard:", error)
      return {
        messageCount: 0,
        upgradeCount: 0,
        recentUsers: [],
      }
    }
  }, [])

  const applyNotifications = useCallback(
    (loaded: { messageCount: number; upgradeCount: number; recentUsers: RecentUser[] }) => {
      const nextUserNotifications: NotificationItem[] = loaded.recentUsers
        .map((userItem) => {
          const displayName = getDisplayName(userItem)
          const online = isUserOnline(userItem.last_seen)

          return {
            id: userItem.id,
            type: "user" as const,
            title: displayName,
            subtitle: online ? "User is online now." : "New registered user.",
            meta: `Registered: ${formatDate(userItem.created_at)}`,
            rawDate: userItem.created_at || null,
          }
        })
        .filter((item) => !dismissedUserNotificationIds.includes(item.id))

      const rawMessageNotifications: NotificationItem[] = [
        {
          id: `messages-count-${loaded.messageCount}`,
          type: "message",
          title: `${loaded.messageCount} message notification${loaded.messageCount === 1 ? "" : "s"}`,
          subtitle: "User contact messages waiting for review.",
        },
        {
          id: `upgrades-count-${loaded.upgradeCount}`,
          type: "message",
          title: `${loaded.upgradeCount} upgrade notification${loaded.upgradeCount === 1 ? "" : "s"}`,
          subtitle: "Premium upgrade requests merged into Messages.",
        },
      ]

      const nextMessageNotifications = rawMessageNotifications.filter(
        (item) => !dismissedMessageNotificationIds.includes(item.id)
      )

      setMessageCount(loaded.messageCount)
      setUpgradeCount(loaded.upgradeCount)
      setUserNotifications(nextUserNotifications)
      setMessageNotifications(nextMessageNotifications)
    },
    [dismissedMessageNotificationIds, dismissedUserNotificationIds]
  )

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true)
    try {
      const loaded = await loadDashboard()
      applyNotifications(loaded)
    } finally {
      setRefreshing(false)
      setLoadingData(false)
    }
  }, [applyNotifications, loadDashboard])

  useEffect(() => {
    if (!storageReady) return

    let isMounted = true

    async function init() {
      try {
        setCheckingAdmin(true)
        setLoadingData(true)

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          router.replace("/secure-admin-portal-7X9")
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle()

        if (profileError) {
          console.error("Failed to load admin profile:", profileError)
          router.replace("/secure-admin-portal-7X9?error=failed")
          return
        }

        const adminProfile = profile as AdminProfile | null

        if (!adminProfile || adminProfile.role !== "admin") {
          router.replace("/secure-admin-portal-7X9?error=not-admin")
          return
        }

        const loaded = await loadDashboard()

        if (isMounted) {
          applyNotifications(loaded)
          setLoadingData(false)
        }
      } catch (error) {
        console.error("Admin auth check failed:", error)
        router.replace("/secure-admin-portal-7X9?error=failed")
      } finally {
        if (isMounted) {
          setCheckingAdmin(false)
        }
      }
    }

    init()

    return () => {
      isMounted = false
    }
  }, [applyNotifications, loadDashboard, router, storageReady, supabase])

  function removeUserNotification(id: string) {
    const nextIds = Array.from(new Set([...dismissedUserNotificationIds, id]))
    setDismissedUserNotificationIds(nextIds)
    writeDismissedIds(DISMISSED_USER_NOTIFICATIONS_KEY, nextIds)
    setUserNotifications((prev) => prev.filter((item) => item.id !== id))
  }

  function removeMessageNotification(id: string) {
    const nextIds = Array.from(new Set([...dismissedMessageNotificationIds, id]))
    setDismissedMessageNotificationIds(nextIds)
    writeDismissedIds(DISMISSED_MESSAGE_NOTIFICATIONS_KEY, nextIds)
    setMessageNotifications((prev) => prev.filter((item) => item.id !== id))
  }

  if (checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-[24px] border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-lg font-bold text-slate-800">Checking admin access.</p>
          <p className="mt-2 text-sm text-slate-500">Please wait.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-4 text-slate-900 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-7xl">
        <AdminHeader />

        <div className="mb-5 rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">
                Admin Panel
              </div>
              <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
                Notifications Dashboard
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Review new user activity and merged message notifications in one place.
              </p>
            </div>

            <button
              type="button"
              onClick={refreshDashboard}
              disabled={refreshing}
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 md:w-auto"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950 sm:text-2xl">
                  User Notifications
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  New user registrations and current activity.
                </p>
              </div>

              <div className="inline-flex w-fit items-center rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
                {userNotifications.length} notification{userNotifications.length === 1 ? "" : "s"}
              </div>
            </div>

            {loadingData ? (
              <div className="rounded-[20px] bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
                Loading user notifications...
              </div>
            ) : userNotifications.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
                No user notifications.
              </div>
            ) : (
              <div className="space-y-3">
                {userNotifications.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[20px] border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-base font-extrabold text-slate-900">
                          {item.title}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">{item.subtitle}</div>
                        {item.meta ? (
                          <div className="mt-2 text-xs font-medium text-slate-500">
                            {item.meta}
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeUserNotification(item.id)}
                        className="shrink-0 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-black text-slate-950 sm:text-2xl">
                Message Notifications
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Contact messages and upgrade requests are merged here.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[20px] bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Messages
                </div>
                <div className="mt-2 text-3xl font-black text-slate-950">{messageCount}</div>
              </div>

              <div className="rounded-[20px] bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Upgrades
                </div>
                <div className="mt-2 text-3xl font-black text-slate-950">{upgradeCount}</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {messageNotifications.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500">
                  No message notifications.
                </div>
              ) : (
                messageNotifications.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[20px] border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-base font-extrabold text-slate-900">
                          {item.title}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">{item.subtitle}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeMessageNotification(item.id)}
                        className="shrink-0 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}