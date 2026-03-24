"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
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
    const ok = window.confirm("Permanently delete this conversation and all messages?")
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#eef4ff] via-[#f8fbff] to-white px-4">
        <div className="rounded-[24px] border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-lg font-bold text-slate-800">
            Checking admin access...
          </p>
          <p className="mt-2 text-sm text-slate-500">Please wait.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef4ff] via-[#f8fbff] to-white px-4 py-4 text-slate-900 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <AdminHeader />

        <div className="mb-5 rounded-[24px] bg-gradient-to-br from-slate-900 via-blue-900 to-blue-600 px-5 py-6 text-white shadow-[0_20px_45px_rgba(37,99,235,0.18)] sm:rounded-[28px] sm:px-7 sm:py-8">
          <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-white/90 sm:text-sm">
            ADMIN MESSENGER
          </div>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl lg:text-[42px]">
            Conversation Inbox
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-100 sm:text-base lg:text-[17px]">
            Reply to users in one continuous thread, messenger-style.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 text-xs font-bold text-slate-500 sm:text-sm">
              Total
            </div>
            <div className="text-3xl font-extrabold text-slate-900 sm:text-[34px]">
              {stats.total}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 text-xs font-bold text-slate-500 sm:text-sm">
              Open
            </div>
            <div className="text-3xl font-extrabold text-blue-600 sm:text-[34px]">
              {stats.open}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 text-xs font-bold text-slate-500 sm:text-sm">
              Replied
            </div>
            <div className="text-3xl font-extrabold text-violet-600 sm:text-[34px]">
              {stats.replied}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 text-xs font-bold text-slate-500 sm:text-sm">
              Closed
            </div>
            <div className="text-3xl font-extrabold text-red-500 sm:text-[34px]">
              {stats.closed}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-4">
              <div className="mb-3 font-extrabold text-slate-900">
                Conversations
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search user, email, subject..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
              />
            </div>

            <div className="max-h-[760px] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-5 text-sm text-slate-500">
                  Loading conversations...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="px-4 py-5 text-sm text-slate-500">
                  No conversations found.
                </div>
              ) : (
                filteredConversations.map((item) => {
                  const active = selectedConversation?.id === item.id

                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedConversation(item)}
                      className={`w-full border-b border-slate-100 px-4 py-4 text-left transition ${
                        active ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-extrabold text-slate-900">
                          {getDisplayName(item)}
                        </div>

                        <div className="shrink-0 whitespace-nowrap text-xs text-slate-500">
                          {item.messages.length > 0
                            ? formatTime(item.messages[item.messages.length - 1].created_at)
                            : formatTime(item.created_at)}
                        </div>
                      </div>

                      <div className="mb-1 truncate text-sm font-bold text-slate-800">
                        {item.subject || "No subject"}
                      </div>

                      <div className="mb-3 truncate text-xs text-slate-500 sm:text-sm">
                        {getPreview(item)}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            item.status === "closed"
                              ? "bg-red-100 text-red-700"
                              : item.status === "replied"
                                ? "bg-violet-100 text-violet-700"
                                : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {item.status || "unknown"}
                        </span>

                        {item.messages.some((message) => !!message.attachment_url) && (
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                            attachment
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="flex min-h-[680px] flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm xl:min-h-[760px]">
            {!selectedConversation ? (
              <div className="p-6 text-sm text-slate-500">
                Select a conversation to view the chat.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:px-5 sm:py-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 sm:text-[28px]">
                      {selectedConversation.subject || "No subject"}
                    </h2>

                    <div className="mt-2 text-sm leading-7 text-slate-600">
                      <div>
                        <strong>User:</strong> {getDisplayName(selectedConversation)}
                      </div>
                      <div>
                        <strong>Email:</strong>{" "}
                        {selectedConversation.profile?.email || "No email"}
                      </div>
                      <div>
                        <strong>Started:</strong>{" "}
                        {formatTime(selectedConversation.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-2 text-xs font-bold ${
                        selectedConversation.status === "closed"
                          ? "bg-red-100 text-red-700"
                          : selectedConversation.status === "replied"
                            ? "bg-violet-100 text-violet-700"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {selectedConversation.status}
                    </span>

                    {(selectedConversation.status === "open" ||
                      selectedConversation.status === "unread") && (
                      <button
                        onClick={() => markConversationRead(selectedConversation.id)}
                        disabled={markingRead}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {markingRead ? "Updating..." : "Mark Read"}
                      </button>
                    )}

                    {selectedConversation.status !== "closed" && (
                      <button
                        onClick={() => closeConversation(selectedConversation.id)}
                        className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-600"
                      >
                        Close
                      </button>
                    )}

                    <button
                      onClick={() => softDeleteConversation(selectedConversation.id)}
                      className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>

                    <button
                      onClick={() => hardDeleteConversation(selectedConversation.id)}
                      className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-800"
                    >
                      Delete Permanently
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50 px-3 py-4 sm:px-5 sm:py-5">
                  {selectedConversation.messages.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
                      No messages in this conversation yet.
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:gap-4">
                      {selectedConversation.messages.map((message) => {
                        const isAdmin = message.sender_role === "admin"

                        return (
                          <div
                            key={message.id}
                            className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[92%] rounded-[22px] px-4 py-3 shadow-sm sm:max-w-[80%] lg:max-w-[72%] ${
                                isAdmin
                                  ? "border-0 bg-gradient-to-br from-blue-600 to-indigo-600 text-white"
                                  : "border border-slate-200 bg-white text-slate-900"
                              }`}
                            >
                              <div
                                className={`mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] ${
                                  isAdmin ? "text-white/85" : "text-slate-500"
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
                                        : "border border-blue-200 bg-blue-50 text-blue-600"
                                    }`}
                                  >
                                    📎 {getAttachmentName(message.attachment_url)}
                                  </a>
                                </div>
                              )}

                              <div
                                className={`mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] ${
                                  isAdmin ? "text-white/75" : "text-slate-500"
                                }`}
                              >
                                <span>{formatTime(message.created_at)}</span>

                                <div className="flex gap-3">
                                  <button
                                    onClick={() => softDeleteMessage(message.id)}
                                    className={`font-bold hover:underline ${
                                      isAdmin ? "text-white/90" : "text-red-500"
                                    }`}
                                  >
                                    Delete
                                  </button>

                                  <button
                                    onClick={() => hardDeleteMessage(message.id)}
                                    className={`font-bold hover:underline ${
                                      isAdmin ? "text-white" : "text-red-700"
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

                <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-5">
                  <div className="mb-3 text-lg font-extrabold text-slate-900">
                    Send Reply
                  </div>

                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write your reply here..."
                    rows={4}
                    className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                  />

                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-slate-500 sm:text-sm">
                      Replies are added to the same conversation thread.
                    </div>

                    <button
                      onClick={sendReply}
                      disabled={
                        sending ||
                        !replyBody.trim() ||
                        selectedConversation.status === "closed"
                      }
                      className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {sending ? "Sending..." : "Send Reply"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}