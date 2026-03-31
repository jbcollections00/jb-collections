"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Archive,
  CheckCheck,
  ChevronLeft,
  Mail,
  MessageCircle,
  Search,
  Send,
  Shield,
  Trash2,
  User2,
  X,
} from "lucide-react"
import AdminHeader from "@/app/components/AdminHeader"
import { createClient } from "@/lib/supabase/client"

type Conversation = {
  id: string
  user_id: string
  subject: string | null
  status: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  email: string | null
}

type ConversationMessage = {
  id: string
  conversation_id: string
  sender_id: string | null
  sender_role: "user" | "admin"
  body: string | null
  attachment_url: string | null
  created_at: string
  read_at: string | null
  deleted_at?: string | null
}

type ConversationWithMeta = Conversation & {
  profile: ProfileRow | null
  messages: ConversationMessage[]
}

export default function AdminMessagesPage() {
  const supabase = createClient()
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([])
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationWithMeta | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  const [replyBody, setReplyBody] = useState("")
  const [sending, setSending] = useState(false)
  const [markingRead, setMarkingRead] = useState(false)
  const [error, setError] = useState("")
  const [showMobileList, setShowMobileList] = useState(false)

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    async function init() {
      const ok = await checkAdmin()
      if (!ok) return

      await loadAll(true)

      interval = setInterval(() => {
        loadAll(false)
      }, 4000)
    }

    init()

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [selectedConversation?.messages.length])

  useEffect(() => {
    if (selectedConversation) {
      setShowMobileList(false)
    }
  }, [selectedConversation?.id])

  async function checkAdmin() {
    try {
      setCheckingAdmin(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace("/secure-admin-portal-7X9")
        return false
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profileError || profile?.role !== "admin") {
        router.replace("/secure-admin-portal-7X9")
        return false
      }

      return true
    } catch (err) {
      console.error("Admin messages auth check failed:", err)
      router.replace("/secure-admin-portal-7X9")
      return false
    } finally {
      setCheckingAdmin(false)
    }
  }

  async function loadAll(showLoader = false) {
    if (showLoader) setLoading(true)

    try {
      setError("")

      const { data: conversationRows, error: conversationError } = await supabase
        .from("conversations")
        .select("*")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })

      if (conversationError) {
        throw conversationError
      }

      const conversationList = (conversationRows as Conversation[]) || []
      const userIds = [
        ...new Set(conversationList.map((item) => item.user_id).filter(Boolean)),
      ]
      const conversationIds = conversationList.map((item) => item.id)

      let profiles: ProfileRow[] = []
      let messages: ConversationMessage[] = []

      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds)

        if (profileError) {
          console.error("Load profiles error:", profileError)
        } else {
          profiles = (profileRows as ProfileRow[]) || []
        }
      }

      if (conversationIds.length > 0) {
        const { data: messageRows, error: messageError } = await supabase
          .from("conversation_messages")
          .select("*")
          .in("conversation_id", conversationIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })

        if (messageError) {
          console.error("Load conversation messages error:", messageError)
        } else {
          messages = (messageRows as ConversationMessage[]) || []
        }
      }

      const combined: ConversationWithMeta[] = conversationList.map(
        (conversation) => ({
          ...conversation,
          profile:
            profiles.find((profile) => profile.id === conversation.user_id) ||
            null,
          messages: messages.filter(
            (message) => message.conversation_id === conversation.id
          ),
        })
      )

      setConversations(combined)

      setSelectedConversation((current) => {
        if (!current) return combined[0] || null
        const updated = combined.find((item) => item.id === current.id)
        return updated || combined[0] || null
      })
    } catch (err) {
      console.error("Load admin conversations error:", err)
      setError(
        err instanceof Error ? err.message : "Failed to load conversations."
      )
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  async function sendReply() {
    if (!selectedConversation || !replyBody.trim()) return

    try {
      setSending(true)
      setError("")

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error: insertError } = await supabase
        .from("conversation_messages")
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: user?.id ?? null,
          sender_role: "admin",
          body: replyBody.trim(),
          attachment_url: null,
        })

      if (insertError) {
        throw insertError
      }

      const { error: updateError } = await supabase
        .from("conversations")
        .update({
          updated_at: new Date().toISOString(),
          status: "replied",
        })
        .eq("id", selectedConversation.id)

      if (updateError) {
        throw updateError
      }

      setReplyBody("")
      await loadAll(false)
    } catch (err) {
      console.error("Send admin reply error:", err)
      setError(err instanceof Error ? err.message : "Failed to send reply.")
    } finally {
      setSending(false)
    }
  }

  async function markConversationRead(conversationId: string) {
    try {
      setMarkingRead(true)
      setError("")

      const { error } = await supabase
        .from("conversations")
        .update({
          status: "read",
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId)

      if (error) {
        throw error
      }

      await loadAll(false)
    } catch (err) {
      console.error("Mark conversation read error:", err)
      setError(
        err instanceof Error
          ? err.message
          : "Failed to mark conversation as read."
      )
    } finally {
      setMarkingRead(false)
    }
  }

  async function closeConversation(conversationId: string) {
    const ok = window.confirm("Close this conversation?")
    if (!ok) return

    try {
      setError("")

      const { error } = await supabase
        .from("conversations")
        .update({
          status: "closed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId)

      if (error) {
        throw error
      }

      await loadAll(false)
    } catch (err) {
      console.error("Close conversation error:", err)
      setError(
        err instanceof Error ? err.message : "Failed to close conversation."
      )
    }
  }

  async function softDeleteMessage(messageId: string) {
    const ok = window.confirm("Delete this message?")
    if (!ok) return

    try {
      setError("")

      const { error } = await supabase
        .from("conversation_messages")
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq("id", messageId)

      if (error) {
        throw error
      }

      await loadAll(false)
    } catch (err) {
      console.error("Soft delete message error:", err)
      setError(err instanceof Error ? err.message : "Failed to delete message.")
    }
  }

  async function hardDeleteMessage(messageId: string) {
    const ok = window.confirm("Permanently delete this message?")
    if (!ok) return

    try {
      setError("")

      const { error } = await supabase
        .from("conversation_messages")
        .delete()
        .eq("id", messageId)

      if (error) {
        throw error
      }

      await loadAll(false)
    } catch (err) {
      console.error("Hard delete message error:", err)
      setError(
        err instanceof Error
          ? err.message
          : "Failed to permanently delete message."
      )
    }
  }

  async function softDeleteConversation(conversationId: string) {
    const ok = window.confirm("Delete this conversation?")
    if (!ok) return

    try {
      setError("")

      const now = new Date().toISOString()

      const { error: conversationError } = await supabase
        .from("conversations")
        .update({
          deleted_at: now,
          updated_at: now,
        })
        .eq("id", conversationId)

      if (conversationError) {
        throw conversationError
      }

      const { error: messagesError } = await supabase
        .from("conversation_messages")
        .update({
          deleted_at: now,
        })
        .eq("conversation_id", conversationId)

      if (messagesError) {
        throw messagesError
      }

      setSelectedConversation(null)
      await loadAll(false)
    } catch (err) {
      console.error("Soft delete conversation error:", err)
      setError(
        err instanceof Error ? err.message : "Failed to delete conversation."
      )
    }
  }

  async function hardDeleteConversation(conversationId: string) {
    const ok = window.confirm(
      "Permanently delete this conversation and all messages?"
    )
    if (!ok) return

    try {
      setError("")

      const { error: messagesError } = await supabase
        .from("conversation_messages")
        .delete()
        .eq("conversation_id", conversationId)

      if (messagesError) {
        throw messagesError
      }

      const { error: conversationError } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId)

      if (conversationError) {
        throw conversationError
      }

      setSelectedConversation(null)
      await loadAll(false)
    } catch (err) {
      console.error("Hard delete conversation error:", err)
      setError(
        err instanceof Error
          ? err.message
          : "Failed to permanently delete conversation."
      )
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

  function getAttachmentName(url: string) {
    try {
      return decodeURIComponent(url.split("/").pop() || "attachment")
    } catch {
      return "attachment"
    }
  }

  function getDisplayName(item: ConversationWithMeta) {
    return item.profile?.full_name || item.profile?.email || "Unknown user"
  }

  function getPreview(item: ConversationWithMeta) {
    if (item.messages.length === 0) return "No messages yet"
    const last = item.messages[item.messages.length - 1]
    if (last.body?.trim()) return last.body
    if (last.attachment_url) return "Attachment sent"
    return "No content"
  }

  function getStatusClasses(status: string) {
    if (status === "closed") {
      return "bg-red-500/15 text-red-300 ring-1 ring-red-500/25"
    }
    if (status === "replied") {
      return "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/25"
    }
    if (status === "read") {
      return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25"
    }
    return "bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/25"
  }

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase()

    return conversations.filter((item) => {
      if (!term) return true

      return (
        getDisplayName(item).toLowerCase().includes(term) ||
        (item.profile?.email || "").toLowerCase().includes(term) ||
        (item.subject || "").toLowerCase().includes(term) ||
        item.messages.some(
          (message) =>
            (message.body || "").toLowerCase().includes(term) ||
            (message.attachment_url || "").toLowerCase().includes(term)
        )
      )
    })
  }, [conversations, search])

  const stats = useMemo(() => {
    return {
      total: conversations.length,
      open: conversations.filter(
        (item) => item.status === "open" || item.status === "unread"
      ).length,
      replied: conversations.filter((item) => item.status === "replied").length,
      closed: conversations.filter((item) => item.status === "closed").length,
    }
  }, [conversations])

  if (checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1120] px-4">
        <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/5 px-8 py-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-300">
            <Shield size={26} />
          </div>
          <p className="text-xl font-extrabold text-white">
            Checking admin access...
          </p>
          <p className="mt-2 text-sm text-slate-300">Please wait.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
        <AdminHeader />

        <section className="mt-4 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#111827] via-[#0f172a] to-[#1d4ed8] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 px-5 py-6 sm:px-7 sm:py-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">
                <MessageCircle size={14} />
                Level 2 Admin Messenger
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-[44px]">
                Conversation Inbox
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100/90 sm:text-base">
                Dark premium messenger layout with mobile-ready conversation list,
                cleaner stats, sticky reply box, and stronger moderation controls.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-100/70">
                  Total
                </div>
                <div className="mt-2 text-2xl font-black">{stats.total}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-100/70">
                  Open
                </div>
                <div className="mt-2 text-2xl font-black text-sky-200">
                  {stats.open}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-100/70">
                  Replied
                </div>
                <div className="mt-2 text-2xl font-black text-violet-200">
                  {stats.replied}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-100/70">
                  Closed
                </div>
                <div className="mt-2 text-2xl font-black text-red-200">
                  {stats.closed}
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
            {error}
          </div>
        )}

        <div className="mt-4 flex min-h-0 flex-1 gap-4">
          <aside
            className={`fixed inset-y-0 left-0 z-40 w-[88%] max-w-[360px] transform border-r border-white/10 bg-[#0f172a] shadow-2xl transition duration-300 lg:static lg:z-auto lg:w-[360px] lg:max-w-none lg:translate-x-0 lg:overflow-hidden lg:rounded-[28px] lg:border lg:bg-[#0f172a]/95 ${
              showMobileList ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex h-full flex-col lg:min-h-[760px]">
              <div className="border-b border-white/10 px-4 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-lg font-extrabold text-white">
                      Conversations
                    </div>
                    <div className="text-xs text-slate-400">
                      Messenger-style inbox
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowMobileList(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 lg:hidden"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search user, email, subject..."
                    className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-400 focus:border-blue-400"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-5 text-sm text-slate-400">
                    Loading conversations...
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="px-4 py-5 text-sm text-slate-400">
                    No conversations found.
                  </div>
                ) : (
                  filteredConversations.map((item) => {
                    const active = selectedConversation?.id === item.id
                    const lastMessage =
                      item.messages[item.messages.length - 1] || null

                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedConversation(item)}
                        className={`w-full border-b border-white/5 px-4 py-4 text-left transition ${
                          active
                            ? "bg-blue-500/15"
                            : "bg-transparent hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-blue-200">
                            <User2 size={18} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="truncate text-sm font-extrabold text-white">
                                {getDisplayName(item)}
                              </div>
                              <div className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">
                                {lastMessage
                                  ? formatTime(lastMessage.created_at)
                                  : formatTime(item.created_at)}
                              </div>
                            </div>

                            <div className="mt-1 truncate text-sm font-semibold text-slate-200">
                              {item.subject || "No subject"}
                            </div>

                            <div className="mt-1 truncate text-xs text-slate-400">
                              {getPreview(item)}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${getStatusClasses(
                                  item.status
                                )}`}
                              >
                                {item.status || "unknown"}
                              </span>

                              {item.messages.some(
                                (message) => !!message.attachment_url
                              ) && (
                                <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-200 ring-1 ring-amber-500/25">
                                  attachment
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </aside>

          {showMobileList && (
            <button
              type="button"
              aria-label="Close conversation list overlay"
              onClick={() => setShowMobileList(false)}
              className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            />
          )}

          <section className="flex min-h-[720px] min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0f172a]/95 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            {!selectedConversation ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <div className="max-w-md text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-500/15 text-blue-300">
                    <MessageCircle size={28} />
                  </div>
                  <h2 className="mt-4 text-2xl font-black text-white">
                    Select a conversation
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-400">
                    Choose a conversation from the left to view and reply.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowMobileList(true)}
                    className="mt-4 inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 lg:hidden"
                  >
                    Open Conversations
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 flex items-center gap-2 lg:hidden">
                        <button
                          type="button"
                          onClick={() => setShowMobileList(true)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <span className="text-sm font-bold text-slate-300">
                          Conversations
                        </span>
                      </div>

                      <h2 className="truncate text-2xl font-black text-white sm:text-[30px]">
                        {selectedConversation.subject || "No subject"}
                      </h2>

                      <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                        <div className="inline-flex items-center gap-2">
                          <User2 size={15} className="text-slate-400" />
                          <span className="truncate">
                            {getDisplayName(selectedConversation)}
                          </span>
                        </div>
                        <div className="inline-flex items-center gap-2">
                          <Mail size={15} className="text-slate-400" />
                          <span className="truncate">
                            {selectedConversation.profile?.email || "No email"}
                          </span>
                        </div>
                        <div className="inline-flex items-center gap-2">
                          <MessageCircle size={15} className="text-slate-400" />
                          <span>{selectedConversation.messages.length} message(s)</span>
                        </div>
                        <div className="inline-flex items-center gap-2">
                          <Archive size={15} className="text-slate-400" />
                          <span>Started {formatTime(selectedConversation.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-2 text-xs font-bold capitalize ${getStatusClasses(
                          selectedConversation.status
                        )}`}
                      >
                        {selectedConversation.status}
                      </span>

                      {(selectedConversation.status === "open" ||
                        selectedConversation.status === "unread") && (
                        <button
                          onClick={() => markConversationRead(selectedConversation.id)}
                          disabled={markingRead}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <CheckCheck size={16} />
                          {markingRead ? "Updating..." : "Mark Read"}
                        </button>
                      )}

                      {selectedConversation.status !== "closed" && (
                        <button
                          onClick={() => closeConversation(selectedConversation.id)}
                          className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-600"
                        >
                          Close
                        </button>
                      )}

                      <button
                        onClick={() => softDeleteConversation(selectedConversation.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-200 transition hover:bg-red-500/20"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>

                      <button
                        onClick={() =>
                          hardDeleteConversation(selectedConversation.id)
                        }
                        className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-800"
                      >
                        Delete Permanently
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-[#0b1220] px-3 py-4 sm:px-5 sm:py-5">
                  {selectedConversation.messages.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                      No messages in this conversation yet.
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {selectedConversation.messages.map((message) => {
                        const isAdmin = message.sender_role === "admin"

                        return (
                          <div
                            key={message.id}
                            className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[94%] rounded-[24px] px-4 py-3 shadow-lg sm:max-w-[82%] lg:max-w-[72%] ${
                                isAdmin
                                  ? "bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white"
                                  : "border border-white/10 bg-white/5 text-white backdrop-blur"
                              }`}
                            >
                              <div
                                className={`mb-2 text-[11px] font-extrabold uppercase tracking-[0.1em] ${
                                  isAdmin ? "text-blue-100" : "text-slate-400"
                                }`}
                              >
                                {isAdmin ? "Admin" : "User"}
                              </div>

                              {message.body && (
                                <div className="whitespace-pre-wrap text-sm leading-7">
                                  {message.body}
                                </div>
                              )}

                              {message.attachment_url && (
                                <div className={`${message.body ? "mt-3" : ""}`}>
                                  <a
                                    href={message.attachment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${
                                      isAdmin
                                        ? "border border-white/20 bg-white/15 text-white"
                                        : "border border-blue-400/20 bg-blue-500/10 text-blue-200"
                                    }`}
                                  >
                                    📎 {getAttachmentName(message.attachment_url)}
                                  </a>
                                </div>
                              )}

                              <div
                                className={`mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] ${
                                  isAdmin ? "text-blue-100/90" : "text-slate-400"
                                }`}
                              >
                                <span>{formatTime(message.created_at)}</span>

                                <div className="flex gap-3">
                                  <button
                                    onClick={() => softDeleteMessage(message.id)}
                                    className={`font-bold hover:underline ${
                                      isAdmin ? "text-white" : "text-red-300"
                                    }`}
                                  >
                                    Delete
                                  </button>

                                  <button
                                    onClick={() => hardDeleteMessage(message.id)}
                                    className={`font-bold hover:underline ${
                                      isAdmin ? "text-white" : "text-red-200"
                                    }`}
                                  >
                                    Delete Permanently
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 bg-[#0f172a] px-4 py-4 sm:px-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-black text-white">Send Reply</div>
                      <div className="text-xs text-slate-400">
                        Replies stay in the same conversation thread.
                      </div>
                    </div>

                    {selectedConversation.status === "closed" && (
                      <span className="rounded-full bg-red-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-red-200 ring-1 ring-red-500/25">
                        Closed conversation
                      </span>
                    )}
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-3">
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Write your reply here..."
                      rows={4}
                      className="w-full resize-y rounded-2xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400"
                    />

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs text-slate-400 sm:text-sm">
                        Keep replies clear and professional.
                      </div>

                      <button
                        onClick={sendReply}
                        disabled={
                          sending ||
                          !replyBody.trim() ||
                          selectedConversation.status === "closed"
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Send size={16} />
                        {sending ? "Sending..." : "Send Reply"}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}