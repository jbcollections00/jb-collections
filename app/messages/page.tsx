"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Lock, Megaphone, ArrowLeft, Trash2, Paperclip, Download } from "lucide-react"
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
    markAsRead(messageId)
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
      const filteredList = loadedList.filter((msg) => !dismissed.includes(msg.id))

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
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, is_read: true } : msg))
    )

    void supabase
      .from("messages")
      .update({ is_read: true })
      .eq("id", messageId)
  }

  async function handleDeleteMessage(targetId: string) {
    if (!confirm("Are you sure you want to delete this announcement?")) return

    setIsDeleting(true)

    saveDismissedId(targetId)

    await supabase.from("messages").delete().eq("id", targetId)
    await supabase.from("user_messages").delete().eq("id", targetId)

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

  function formatTime(dateString: string) {
    return new Date(dateString).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  function renderMessageBody(text: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = text.split(urlRegex)

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 font-bold underline hover:text-cyan-300 break-all"
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
                className={`border-r border-white/10 bg-[#111827] flex flex-col ${
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

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {loading ? (
                    <div className="p-4 text-center text-xs text-slate-400">Loading announcements...</div>
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
                          <div className="truncate font-bold text-white">{getTitle(item)}</div>
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
                <div className="border-b border-white/10 bg-[#0f172a] px-4 py-4 sm:px-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowMobileList(true)}
                      className="lg:hidden p-2 rounded-lg bg-white/5 text-slate-300 hover:text-white"
                    >
                      <ArrowLeft size={18} />
                    </button>

                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white shrink-0">
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
                      className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-400 border border-red-500/20 hover:bg-red-500/20 transition disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      <span>{isDeleting ? "Deleting..." : "Delete"}</span>
                    </button>
                  )}
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  {selectedMessage ? (
                    <div className="max-w-3xl rounded-[20px] border border-white/10 bg-[#1e293b] p-6 shadow-md space-y-4">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <h2 className="text-xl font-black text-white">{getTitle(selectedMessage)}</h2>
                        <span className="text-xs text-slate-400">{formatTime(selectedMessage.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                        {renderMessageBody(selectedMessage.body)}
                      </p>

                      {/* Attachment List / Image Previews */}
                      {(() => {
                        const attachmentsList = parseAttachments(selectedMessage)
                        if (!attachmentsList.length) return null

                        return (
                          <div className="mt-6 border-t border-white/10 pt-4 space-y-3">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <Paperclip size={13} />
                              <span>Attachments ({attachmentsList.length})</span>
                            </div>

                            <div className="space-y-3">
                              {attachmentsList.map((file, idx) => {
                                const fileName = file.name || file.file_name || file.title || "Attachment"
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
                                          className="max-h-96 w-full object-contain rounded-t-xl bg-black/40 transition-transform duration-300 group-hover:scale-[1.01]"
                                        />
                                      </a>
                                      <div className="flex items-center justify-between p-3 text-xs bg-[#0f172a] border-t border-white/10">
                                        <span className="truncate font-medium text-slate-300">{fileName}</span>
                                        <a
                                          href={fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-cyan-400 font-bold hover:underline shrink-0 ml-2"
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
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                                        <Paperclip size={16} />
                                      </div>
                                      <span className="truncate font-semibold text-slate-200">{fileName}</span>
                                    </div>
                                    <Download size={15} className="text-slate-400 shrink-0" />
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
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 bg-white/5 px-4 py-2 rounded-full border border-white/10">
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