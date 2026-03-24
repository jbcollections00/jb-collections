"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  User,
  Inbox,
  LogOut,
  Send,
  Paperclip,
  MessageSquare,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Conversation = {
  id: string
  user_id: string
  subject: string | null
  status: string
  created_at: string
  updated_at: string
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

const MAX_FILE_SIZE = 25 * 1024 * 1024

export default function MessagesPage() {
  const supabase = createClient()
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])

  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [attachment, setAttachment] = useState<File | null>(null)

  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    initializePage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!conversation?.id) return

    const interval = setInterval(() => {
      loadConversation(conversation.id)
    }, 4000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  async function initializePage() {
    try {
      setLoading(true)
      setError("")

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      setUserId(user.id)

      const { data: existingConversation, error: conversationError } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (conversationError) {
        console.error("Load conversation error:", conversationError)
        setError(conversationError.message)
        return
      }

      if (existingConversation) {
        setConversation(existingConversation as Conversation)
        await loadConversation(existingConversation.id)
      }
    } catch (err) {
      console.error(err)
      setError("Failed to load messages.")
    } finally {
      setLoading(false)
    }
  }

  async function loadConversation(conversationId: string) {
    const { data: conversationData, error: conversationError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle()

    if (conversationError) {
      console.error("Reload conversation error:", conversationError)
      return
    }

    const { data: messagesData, error: messagesError } = await supabase
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })

    if (messagesError) {
      console.error("Load conversation messages error:", messagesError)
      return
    }

    setConversation((conversationData as Conversation) || null)
    setMessages((messagesData as ConversationMessage[]) || [])
  }

  async function deleteMyMessage(messageId: string, senderId: string) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        alert("You must be logged in.")
        return
      }

      if (user.id !== senderId) {
        alert("You can only delete your own message.")
        return
      }

      const ok = window.confirm("Delete this message?")
      if (!ok) return

      const { data, error } = await supabase
        .from("conversation_messages")
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq("id", messageId)
        .eq("sender_id", user.id)
        .select("id, deleted_at")

      if (error) {
        console.error("Delete message error:", error)
        alert(`Failed to delete message: ${error.message}`)
        return
      }

      if (!data || data.length === 0) {
        alert("Message was not updated. Check your Supabase RLS policy.")
        return
      }

      if (conversation?.id) {
        await loadConversation(conversation.id)
      }
    } catch (err) {
      console.error("Delete message failed:", err)
      alert("Failed to delete message.")
    }
  }

  async function uploadAttachment(file: File) {
    const safeName = file.name.replace(/\s+/g, "-")
    const fileName = `conversation-${Date.now()}-${safeName}`

    const { data, error } = await supabase.storage
      .from("message-attachments")
      .upload(fileName, file, { upsert: false })

    if (error) {
      throw new Error(`Attachment upload failed: ${error.message}`)
    }

    const { data: publicUrlData } = supabase.storage
      .from("message-attachments")
      .getPublicUrl(data.path)

    return publicUrlData.publicUrl
  }

  function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null

    if (!file) {
      setAttachment(null)
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setAttachment(null)
      setError("Attachment must be 25MB or below.")
      return
    }

    setError("")
    setAttachment(file)
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()

    if (!userId) {
      setError("You must be logged in.")
      return
    }

    if (!message.trim() && !attachment) {
      setError("Please write a message or attach a file.")
      return
    }

    if (!conversation && !subject.trim()) {
      setError("Please enter a subject for your first message.")
      return
    }

    try {
      setSending(true)
      setError("")
      setSuccess("")

      let activeConversationId: string | null = conversation?.id ?? null
      let attachmentUrl: string | null = null

      if (attachment) {
        try {
          setUploading(true)
          attachmentUrl = await uploadAttachment(attachment)
        } finally {
          setUploading(false)
        }
      }

      if (!activeConversationId) {
        const { data: newConversation, error: createConversationError } = await supabase
          .from("conversations")
          .insert({
            user_id: userId,
            subject: subject.trim(),
            status: "open",
          })
          .select()
          .single()

        if (createConversationError) {
          throw new Error(createConversationError.message)
        }

        activeConversationId = newConversation.id
      }

      if (!activeConversationId) {
        throw new Error("Conversation ID is missing.")
      }

      const { error: messageError } = await supabase
        .from("conversation_messages")
        .insert({
          conversation_id: activeConversationId,
          sender_id: userId,
          sender_role: "user",
          body: message.trim() || null,
          attachment_url: attachmentUrl,
        })

      if (messageError) {
        throw new Error(messageError.message)
      }

      await supabase
        .from("conversations")
        .update({
          updated_at: new Date().toISOString(),
          status: "open",
        })
        .eq("id", activeConversationId)

      setMessage("")
      setAttachment(null)
      setSuccess("Message sent.")

      const fileInput = document.getElementById("attachment-input") as HTMLInputElement | null
      if (fileInput) fileInput.value = ""

      await loadConversation(activeConversationId)
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : "Something went wrong while sending your message."
      setError(messageText)
      setSuccess("")
    } finally {
      setSending(false)
      setUploading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
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

  const hasMessages = useMemo(() => messages.length > 0, [messages])

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-[36px] bg-gradient-to-r from-cyan-600 via-sky-500 to-violet-600 p-6 shadow-2xl shadow-slate-300/40 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.45em] text-white/90 sm:text-[15px]">
                J B Collections
              </p>

              <h1 className="mt-4 text-4xl font-extrabold leading-tight text-white sm:text-5xl">
                Messages
              </h1>

              <p className="mt-4 max-w-xl text-base leading-7 text-white/90 sm:text-lg">
                Chat with the admin in one continuous conversation, just like a messenger thread.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <Link
                href="/dashboard"
                className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[22px] bg-gradient-to-b from-blue-600 to-blue-700 px-6 text-sm font-bold text-white shadow-lg"
              >
                <LayoutDashboard size={18} />
                Dashboard
              </Link>

              <Link
                href="/profile"
                className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[22px] bg-gradient-to-b from-blue-600 to-blue-700 px-6 text-sm font-bold text-white shadow-lg"
              >
                <User size={18} />
                Profile
              </Link>

              <Link
                href="/dashboard/inbox"
                className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[22px] bg-gradient-to-b from-blue-600 to-blue-700 px-6 text-sm font-bold text-white shadow-lg"
              >
                <Inbox size={18} />
                Inbox
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[22px] bg-gradient-to-b from-red-500 to-red-600 px-6 text-sm font-bold text-white shadow-lg"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <section className="rounded-[30px] border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur">
            <div className="rounded-[26px] bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 p-6 text-white">
              <div className="inline-flex items-center rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur">
                Support Chat
              </div>

              <h2 className="mt-5 text-3xl font-extrabold">Your Conversation</h2>

              <p className="mt-3 text-sm leading-7 text-white/85">
                Keep all your concerns, questions, and admin replies in one thread.
              </p>

              <div className="mt-6 rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/70">
                  Status
                </p>
                <p className="mt-2 text-lg font-bold capitalize">
                  {conversation?.status || "No conversation yet"}
                </p>
              </div>

              <div className="mt-4 rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/70">
                  Subject
                </p>
                <p className="mt-2 text-sm font-semibold text-white/90">
                  {conversation?.subject || "Start your first conversation"}
                </p>
              </div>
            </div>
          </section>

          <section className="flex min-h-[720px] flex-col overflow-hidden rounded-[30px] border border-white/60 bg-white/80 shadow-2xl backdrop-blur">
            <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                  <MessageSquare size={22} />
                </div>

                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900">
                    {conversation?.subject || "New Conversation"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {hasMessages
                      ? "Your messages and admin replies appear here."
                      : "Send your first message to start chatting with the admin."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50/70 px-4 py-6 sm:px-6">
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                  Loading conversation...
                </div>
              ) : messages.length === 0 ? (
                <div className="mx-auto max-w-xl rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <MessageSquare size={28} />
                  </div>
                  <h3 className="mt-4 text-xl font-extrabold text-slate-900">
                    No messages yet
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    Start the conversation below. The admin’s replies will appear here in the same thread.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((item) => {
                    const isUser = item.sender_role === "user"

                    return (
                      <div
                        key={item.id}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-[24px] px-4 py-3 shadow-sm sm:max-w-[72%] ${
                            isUser
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                              : "border border-slate-200 bg-white text-slate-900"
                          }`}
                        >
                          <div className="mb-1 text-xs font-bold uppercase tracking-wide opacity-80">
                            {isUser ? "You" : "Admin"}
                          </div>

                          {item.body && (
                            <div className="whitespace-pre-wrap text-sm leading-7">
                              {item.body}
                            </div>
                          )}

                          {item.attachment_url && (
                            <div className={`${item.body ? "mt-3" : ""}`}>
                              <a
                                href={item.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${
                                  isUser
                                    ? "bg-white/15 text-white"
                                    : "border border-blue-200 bg-blue-50 text-blue-700"
                                }`}
                              >
                                📎 {getAttachmentName(item.attachment_url)}
                              </a>
                            </div>
                          )}

                          <div
                            className={`mt-2 text-[11px] ${
                              isUser ? "text-white/75" : "text-slate-500"
                            }`}
                          >
                            {formatTime(item.created_at)}
                          </div>

                          {isUser && (
                            <div className="mt-2 text-right">
                              <button
                                type="button"
                                onClick={() => deleteMyMessage(item.id, item.sender_id || "")}
                                className="text-[11px] text-white/85 hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
              {(success || error) && (
                <div
                  className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
                    success
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {success || error}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="space-y-4">
                {!conversation && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Subject
                    </label>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="What is this conversation about?"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your message here..."
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Attachment (optional)
                  </label>

                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 transition hover:border-blue-400 hover:bg-blue-50">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-slate-100 p-2">
                        <Paperclip size={18} className="text-slate-700" />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {attachment ? attachment.name : "Choose a file"}
                        </p>
                        <p className="text-xs text-slate-500">Max file size: 25MB</p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white">
                      Browse
                    </div>

                    <input
                      id="attachment-input"
                      type="file"
                      onChange={handleAttachmentChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {uploading ? "Uploading attachment..." : "Your messages stay in one thread."}
                  </div>

                  <button
                    type="submit"
                    disabled={sending || uploading}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send size={18} />
                    {sending || uploading ? "Sending..." : "Send Message"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}