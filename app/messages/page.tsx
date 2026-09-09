"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Lock,
  Megaphone,
  ArrowLeft,
  Trash2,
  Paperclip,
  Download,
  Gift,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import SiteHeader from "@/app/components/SiteHeader"

type AttachmentItem = {
  id?: string
  name?: string
  file_name?: string
  title?: string
  url?: string
  file_path?: string
}

type UserMessage = {
  id: string
  user_id: string | null
  title?: string | null
  subject?: string | null
  body: string
  created_at: string
  is_read?: boolean
  has_reward?: boolean
  attachments?: AttachmentItem[] | string[] | null
  attachment_url?: string | null
}

const STORAGE_KEY = "jb_deleted_message_ids"

function getDismissedIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveDismissedId(id: string) {
  if (typeof window === "undefined") return
  try {
    const current = getDismissedIds()
    if (!current.includes(id)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, id]))
    }
  } catch (err) {
    console.error("Failed to save deleted message state:", err)
  }
}

function isImageFile(url: string, name?: string) {
  const fileStr = (name || url).toLowerCase()
  return (
    /\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(fileStr) ||
    url.startsWith("data:image/")
  )
}

function MessagesPageContent() {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<UserMessage[]>([])
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [showMobileList, setShowMobileList] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [userName, setUserName] = useState<string>("User")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Reward States
  const [claimedMessageIds, setClaimedMessageIds] = useState<string[]>([])
  const [isClaiming, setIsClaiming] = useState(false)
  const [rewardModal, setRewardModal] = useState<{ open: boolean; coins: number }>({
    open: false,
    coins: 0,
  })

  const selectedMessage = useMemo(() => {
    return messages.find((item) => item.id === selectedMessageId) || null
  }, [messages, selectedMessageId])

  const totalUnreadCount = useMemo(() => {
    return messages.filter((item) => !item.is_read).length
  }, [messages])

  const messageFromUrl = searchParams.get("message") || searchParams.get("conversation")

  useEffect(() => {
    void initializePage()
  }, [])

  useEffect(() => {
    if (loading || !messages.length || !messageFromUrl) return
    const exists = messages.some((item) => item.id === messageFromUrl)
    if (!exists || selectedMessageId === messageFromUrl) return

    setSelectedMessageId(messageFromUrl)
    setShowMobileList(false)
  }, [messageFromUrl, messages, loading, selectedMessageId])

  useEffect(() => {
    if (selectedMessageId) {
      const currentMsg = messages.find((m) => m.id === selectedMessageId)
      if (currentMsg && !currentMsg.is_read) {
        markAsRead(selectedMessageId)
      }
    }
  }, [selectedMessageId, messages])

  function syncUrl(messageId: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (messageId) {
      params.set("message", messageId)
      params.delete("conversation")
    } else {
      params.delete("message")
      params.delete("conversation")
    }
    const query = params.toString()
    const nextUrl = query ? `${pathname}?${query}` : pathname
    router.replace(nextUrl, { scroll: false })
  }

  function openMessage(messageId: string) {
    syncUrl(messageId)
    setSelectedMessageId(messageId)
    setShowMobileList(false)
  }

  async function initializePage() {
    try {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, name, username")
        .eq("id", user.id)
        .maybeSingle()

      if (profile) {
        setUserName(profile.full_name || profile.name || profile.username || "User")
      }

      // Load Claim History
      const { data: claims } = await supabase
        .from("reward_claims")
        .select("message_id")
        .eq("user_id", user.id)

      if (claims) {
        setClaimedMessageIds(claims.map((c) => c.message_id))
      }

      await loadMessages(user.id)
    } catch (err) {
      console.error("Initialization error:", err)
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(activeUserId: string) {
    try {
      const { data, error: fetchErr } = await supabase
        .from("messages")
        .select("*")
        .or(`user_id.eq.${activeUserId},user_id.is.null`)
        .order("created_at", { ascending: false })

      let loadedList: UserMessage[] = (data as UserMessage[]) || []

      if (fetchErr) {
        const { data: viewData } = await supabase
          .from("user_messages")
          .select("*")
          .order("created_at", { ascending: false })
        loadedList = (viewData as UserMessage[]) || []
      }

      const dismissed = getDismissedIds()
      let filteredList = loadedList.filter((msg) => !dismissed.includes(msg.id))

      if (typeof window !== "undefined") {
        try {
          const readStorageKey = "jb_read_announcements"
          const localReadIds = JSON.parse(localStorage.getItem(readStorageKey) || "[]")
          filteredList = filteredList.map((msg) => {
            if (!msg.user_id && localReadIds.includes(msg.id)) {
              return { ...msg, is_read: true }
            }
            return msg
          })
        } catch (err) {
          console.error("Error reading local state:", err)
        }
      }

      const uniqueList: UserMessage[] = []
      const seen = new Set<string>()

      for (const item of filteredList) {
        const titleText = item.title || item.subject || "Announcement"
        const key = `${titleText}-${item.body}`
        if (!seen.has(key)) {
          seen.add(key)
          uniqueList.push(item)
        }
      }

      setMessages(uniqueList)

      if (uniqueList.length > 0) {
        const requestedId = searchParams.get("message") || searchParams.get("conversation")
        const requestedExists = requestedId ? uniqueList.some((m) => m.id === requestedId) : false
        const initialId = requestedExists ? requestedId! : uniqueList[0].id

        if (initialId) {
          syncUrl(initialId)
          setSelectedMessageId(initialId)
          setShowMobileList(false)
        }
      } else {
        syncUrl(null)
        setSelectedMessageId(null)
      }
    } catch (err) {
      console.error("Error loading user messages:", err)
    }
  }

  function markAsRead(messageId: string) {
    const targetMsg = messages.find((m) => m.id === messageId)

    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, is_read: true } : msg))
    )

    if (!targetMsg) return

    if (targetMsg.user_id) {
      void supabase
        .from("messages")
        .update({ is_read: true })
        .eq("id", messageId)
        .then(({ error }) => {
          if (error) console.error("Failed to update DB read status:", error)
        })
    } else {
      try {
        const readStorageKey = "jb_read_announcements"
        const currentRead = JSON.parse(localStorage.getItem(readStorageKey) || "[]")
        if (!currentRead.includes(messageId)) {
          localStorage.setItem(readStorageKey, JSON.stringify([...currentRead, messageId]))
        }
      } catch (err) {
        console.error("Failed to save read state locally:", err)
      }
    }
  }

  async function handleDeleteMessage(targetId: string) {
    if (!confirm("Sigurado ka bang gusto mong alisin ang anunsyong ito sa iyong inbox?")) return

    setIsDeleting(true)
    saveDismissedId(targetId)

    const remainingMessages = messages.filter((m) => m.id !== targetId)
    setMessages(remainingMessages)

    if (remainingMessages.length > 0) {
      const nextId = remainingMessages[0].id
      setSelectedMessageId(nextId)
      syncUrl(nextId)
    } else {
      setSelectedMessageId(null)
      syncUrl(null)
    }

    setIsDeleting(false)
  }

  async function handleClaimReward() {
    if (!selectedMessage || isClaiming) return

    setIsClaiming(true)

    try {
      const wonCoins = Math.floor(Math.random() * (500 - 200 + 1)) + 200

      const { error } = await supabase.rpc("claim_compensation_reward", {
        p_message_id: selectedMessage.id,
        p_reward_coins: wonCoins,
      })

      if (error) {
        if (error.message.includes("already claimed")) {
          alert("Naka-claim ka na ng reward para sa anunsyong ito!")
          setClaimedMessageIds((prev) => [...prev, selectedMessage.id])
          return
        }
        throw error
      }

      setClaimedMessageIds((prev) => [...prev, selectedMessage.id])
      setRewardModal({ open: true, coins: wonCoins })
    } catch (err: unknown) {
      console.error("Error claiming reward:", err)
      const errorMessage =
        err instanceof Error ? err.message : "Nagka-error sa pag-claim ng reward."
      alert(errorMessage)
    } finally {
      setIsClaiming(false)
    }
  }

  function formatTime(dateString: string) {
    return new Date(dateString).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  function renderMessageBody(text: string) {
    if (!text) return ""

    const personalizedText = text.replace(/\{\{name\}\}/g, userName)
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = personalizedText.split(urlRegex)

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-cyan-400 underline hover:text-cyan-300 break-all"
          >
            {part}
          </a>
        )
      }
      return part
    })
  }

  function getTitle(msg: UserMessage | null) {
    if (!msg) return "Select an Announcement"
    return msg.title || msg.subject || "Announcement"
  }

  function parseAttachments(msg: UserMessage): AttachmentItem[] {
    const list: AttachmentItem[] = []

    if (msg.attachments) {
      if (typeof msg.attachments === "string") {
        const rawStr: string = msg.attachments
        try {
          const parsed = JSON.parse(rawStr)
          if (Array.isArray(parsed)) {
            parsed.forEach((item) => {
              if (typeof item === "string") {
                list.push({ url: item, name: item.split("/").pop() })
              } else if (item && typeof item === "object") {
                list.push(item as AttachmentItem)
              }
            })
          }
        } catch {
          list.push({ url: rawStr, name: rawStr.split("/").pop() })
        }
      } else if (Array.isArray(msg.attachments)) {
        msg.attachments.forEach((item) => {
          if (typeof item === "string") {
            list.push({ url: item, name: item.split("/").pop() })
          } else if (item && typeof item === "object") {
            list.push(item as AttachmentItem)
          }
        })
      }
    }

    if (msg.attachment_url && !list.some((a) => a.url === msg.attachment_url)) {
      list.push({
        url: msg.attachment_url,
        name: msg.attachment_url.split("/").pop() || "Attachment",
      })
    }

    return list
  }

  return (
    <>
      <SiteHeader />

      <main className="relative min-h-screen overflow-x-hidden bg-[#0b1220] pt-24 text-white sm:pt-28">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.14),_transparent_22%),linear-gradient(180deg,_#020617_0%,_#081120_100%)]" />

        <div className="mx-auto w-full max-w-[1800px] px-4 pb-6 sm:px-6 sm:pb-8 lg:px-8">
          <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#0f172a] shadow-[0_24px_60px_rgba(0,0,0,0.38)] sm:rounded-[30px]">
            <div className="grid min-h-[calc(100vh-8rem)] grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
              {/* Sidebar List */}
              <aside
                className={`flex flex-col border-r border-white/10 bg-[#111827] ${
                  showMobileList ? "block" : "hidden lg:flex"
                }`}
              >
                <div className="border-b border-white/10 px-5 py-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-400">
                    INBOX
                  </div>
                  <h2 className="mt-2 flex items-center gap-2 text-2xl font-black text-white">
                    <span>Announcements</span>
                    {totalUnreadCount > 0 && (
                      <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-cyan-500 px-2 text-xs font-bold text-black shadow-lg shadow-cyan-950/40">
                        {totalUnreadCount}
                      </span>
                    )}
                  </h2>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto p-3">
                  {loading ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Loading announcements...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No announcements yet.
                    </div>
                  ) : (
                    messages.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openMessage(item.id)}
                        className={`flex w-full items-center gap-3 rounded-[20px] border px-3.5 py-3 text-left transition ${
                          item.id === selectedMessageId
                            ? "border-cyan-500 bg-[#1e293b]"
                            : "border-transparent hover:bg-white/5"
                        }`}
                      >
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                          <Megaphone size={18} />
                          {!item.is_read && (
                            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#111827] bg-cyan-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 truncate font-bold text-white">
                            <span className="truncate">{getTitle(item)}</span>
                            {item.has_reward && (
                              <Gift size={14} className="shrink-0 text-amber-400" />
                            )}
                          </div>
                          <div className="truncate text-xs text-slate-400">{item.body}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </aside>

              {/* Message Content View */}
              <section
                className={`flex min-h-[calc(100vh-8rem)] flex-col bg-[#0b1220] ${
                  !showMobileList ? "flex" : "hidden lg:flex"
                }`}
              >
                {/* Header Pane */}
                <div className="flex items-center justify-between border-b border-white/10 bg-[#0f172a] px-4 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowMobileList(true)}
                      className="rounded-lg bg-white/5 p-2 text-slate-300 hover:text-white lg:hidden"
                    >
                      <ArrowLeft size={18} />
                    </button>

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                      <Megaphone size={18} />
                    </div>
                    <div>
                      <h1 className="text-lg font-bold text-white">
                        {getTitle(selectedMessage)}
                      </h1>
                      <p className="text-xs text-cyan-200/70">Official Broadcast Channel</p>
                    </div>
                  </div>

                  {selectedMessage && (
                    <button
                      onClick={() => handleDeleteMessage(selectedMessage.id)}
                      disabled={isDeleting}
                      className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                      title="Alisin sa sarili mong inbox"
                    >
                      <Trash2 size={16} />
                      <span>{isDeleting ? "Removing..." : "Dismiss"}</span>
                    </button>
                  )}
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  {selectedMessage ? (
                    <div className="max-w-3xl space-y-4 rounded-[20px] border border-white/10 bg-[#1e293b] p-6 shadow-md">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <h2 className="text-xl font-black text-white">
                          {getTitle(selectedMessage)}
                        </h2>
                        <span className="text-xs text-slate-400">
                          {formatTime(selectedMessage.created_at)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                        {renderMessageBody(selectedMessage.body)}
                      </p>

                      {/* Reward Card */}
                      {selectedMessage.has_reward && (
                        <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/50 via-amber-900/30 to-yellow-950/40 p-5 shadow-xl sm:flex-row">
                          <div className="flex items-center gap-3.5">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20 text-amber-400">
                              <Gift size={24} />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-amber-200 sm:text-base">
                                Compensation Reward Available!
                              </h4>
                              <p className="text-xs text-amber-300/80">
                                {claimedMessageIds.includes(selectedMessage.id)
                                  ? "Nakuha mo na ang iyong coin compensation reward sa anunsyong ito."
                                  : "I-click ang button para makakuha ng random compensation coins (200-500 JB Coins)."}
                              </p>
                            </div>
                          </div>

                          {claimedMessageIds.includes(selectedMessage.id) ? (
                            <button
                              disabled
                              className="inline-flex w-full shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-6 py-3 text-xs font-black text-emerald-400 sm:w-auto"
                            >
                              <CheckCircle2 size={16} />
                              <span>Reward Claimed</span>
                            </button>
                          ) : (
                            <button
                              onClick={handleClaimReward}
                              disabled={isClaiming}
                              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-6 py-3 text-xs font-black text-black shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 sm:w-auto"
                            >
                              {isClaiming ? (
                                <>
                                  <Loader2 size={16} className="animate-spin" />
                                  <span>Claiming...</span>
                                </>
                              ) : (
                                <>
                                  <Gift size={16} />
                                  <span>Claim Reward Now</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Attachments */}
                      {(() => {
                        const attachmentsList = parseAttachments(selectedMessage)
                        if (!attachmentsList.length) return null

                        return (
                          <div className="mt-6 space-y-3 border-t border-white/10 pt-4">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              <Paperclip size={13} />
                              <span>Attachments ({attachmentsList.length})</span>
                            </div>

                            <div className="space-y-3">
                              {attachmentsList.map((file, idx) => {
                                const fileName =
                                  file.name || file.file_name || file.title || "Attachment"
                                const fileUrl = file.url || file.file_path || "#"
                                const isImg = isImageFile(fileUrl, fileName)

                                if (isImg) {
                                  return (
                                    <div
                                      key={file.id || idx}
                                      className="group relative overflow-hidden rounded-xl border border-white/10 bg-[#0f172a]"
                                    >
                                      <a
                                        href={fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block overflow-hidden"
                                      >
                                        <img
                                          src={fileUrl}
                                          alt={fileName}
                                          className="max-h-96 w-full rounded-t-xl bg-black/40 object-contain transition-transform duration-300 group-hover:scale-[1.01]"
                                        />
                                      </a>
                                      <div className="flex items-center justify-between border-t border-white/10 bg-[#0f172a] p-3 text-xs">
                                        <span className="truncate font-medium text-slate-300">
                                          {fileName}
                                        </span>
                                        <a
                                          href={fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="ml-2 flex shrink-0 items-center gap-1 font-bold text-cyan-400 hover:underline"
                                        >
                                          <Download size={14} />
                                          <span>Open Full</span>
                                        </a>
                                      </div>
                                    </div>
                                  )
                                }

                                return (
                                  <a
                                    key={file.id || idx}
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f172a] p-3 text-xs transition hover:border-cyan-500/50 hover:bg-[#111827]"
                                  >
                                    <div className="flex min-w-0 items-center gap-2.5">
                                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                                        <Paperclip size={16} />
                                      </div>
                                      <span className="truncate font-semibold text-slate-200">
                                        {fileName}
                                      </span>
                                    </div>
                                    <Download size={15} className="shrink-0 text-slate-400" />
                                  </a>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                      No announcement selected.
                    </div>
                  )}
                </div>

                {/* Footer Banner */}
                <div className="border-t border-white/10 bg-[#0f172a] p-4 text-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-400">
                    <Lock size={14} className="text-cyan-400" />
                    <span>Replies are disabled for this channel. Need help? Use </span>
                    <a href="/contact" className="text-cyan-400 underline hover:text-cyan-300">
                      Contact Us
                    </a>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>

        {/* Celebration Modal Animation */}
        {rewardModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-amber-400/60 bg-gradient-to-b from-[#1e1b4b] via-[#0f172a] to-[#020617] p-8 text-center shadow-[0_0_80px_rgba(245,158,11,0.35)] animate-in zoom-in-95 duration-300">
              <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-amber-500/30 blur-3xl" />

              <div className="relative mx-auto flex h-24 w-24 animate-bounce items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-yellow-600 text-black shadow-xl shadow-amber-500/40">
                <Gift size={48} className="drop-shadow-md" />
                <Sparkles className="absolute -top-2 -right-2 animate-spin text-yellow-200" size={24} />
              </div>

              <h2 className="mt-6 text-2xl font-black tracking-wide text-white">
                CONGRATULATIONS! 🎉
              </h2>

              <p className="mt-2 text-xs font-medium uppercase tracking-widest text-amber-200/80">
                Compensation Reward Received
              </p>

              <div className="my-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 py-4 shadow-inner">
                <span className="block text-xs font-bold text-amber-300/80">YOU WON</span>
                <span className="text-4xl font-black text-amber-400 drop-shadow-[0_2px_10px_rgba(245,158,11,0.5)]">
                  +{rewardModal.coins} JB COINS
                </span>
              </div>

              <p className="text-xs leading-relaxed text-slate-300">
                Awtomatikong naisama at naidagdag na sa iyong JB Wallet ang napanalunang coins!
              </p>

              <button
                onClick={() => {
                  setRewardModal({ open: false, coins: 0 })
                  window.location.reload()
                }}
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-3.5 text-sm font-black text-black shadow-lg shadow-amber-500/30 transition-all hover:scale-105 active:scale-95"
              >
                Collect & Continue
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-white">Loading Announcements...</div>}>
      <MessagesPageContent />
    </Suspense>
  )
}