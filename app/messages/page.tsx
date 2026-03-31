"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  User,
  MessageSquare,
  LogOut,
  Send,
  Paperclip,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Conversation = {
  id: string
  user_id: string
  subject: string | null
  status: string
  created_at: string
  updated_at: string
  user_deleted_at?: string | null
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
  const [deletingChat, setDeletingChat] = useState(false)
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
        .is("user_deleted_at", null)
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
      } else {
        setConversation(null)
        setMessages([])
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
      .is("user_deleted_at", null)
      .maybeSingle()

    if (conversationError) {
      console.error("Reload conversation error:", conversationError)
      return
    }

    if (!conversationData) {
      setConversation(null)
      setMessages([])
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

  async function deleteConversation() {
    try {
      if (!conversation?.id || !userId) {
        alert("No conversation found.")
        return
      }

      const ok = window.confirm(
        "Delete this conversation from your inbox? This will hide the whole thread from your side."
      )
      if (!ok) return

      setDeletingChat(true)
      setError("")
      setSuccess("")

      const timestamp = new Date().toISOString()

      const { error: conversationError } = await supabase
        .from("conversations")
        .update({
          user_deleted_at: timestamp,
        })
        .eq("id", conversation.id)
        .eq("user_id", userId)

      if (conversationError) {
        console.error("Delete conversation error:", conversationError)
        alert(`Failed to delete conversation: ${conversationError.message}`)
        return
      }

      const { error: messagesError } = await supabase
        .from("conversation_messages")
        .update({
          deleted_at: timestamp,
        })
        .eq("conversation_id", conversation.id)

      if (messagesError) {
        console.error("Delete conversation messages error:", messagesError)
      }

      setConversation(null)
      setMessages([])
      setSubject("")
      setMessage("")
      setAttachment(null)
      setSuccess("Conversation deleted.")
    } catch (err) {
      console.error("Delete conversation failed:", err)
      alert("Failed to delete conversation.")
    } finally {
      setDeletingChat(false)
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
            user_deleted_at: null,
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
          user_deleted_at: null,
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
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.18),_transparent_30%),linear-gradient(180deg,_#030712_0%,_#020617_45%,_#061229_100%)]" />

      <div className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/jb-logo.png"
              alt="JB Collections"
              width={42}
              height={42}
              priority
              className="h-[42px] w-[42px] rounded-full object-contain"
            />
            <div className="text-lg font-extrabold tracking-[0.14em] text-sky-400 sm:text-xl">
              JB COLLECTIONS
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.1]"
            >
              <LayoutDashboard size={18} />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>

            <Link
              href="/profile"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.1]"
            >
              <User size={18} />
              <span className="hidden sm:inline">Profile</span>
            </Link>

            <Link
              href="/messages"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-4 text-sm font-bold text-sky-300"
            >
              <MessageSquare size={18} />
              <span className="hidden sm:inline">Messages</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-red-500 px-4 text-sm font-bold text-white transition hover:bg-red-600"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] px-0 sm:px-4 lg:px-8">
        <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-5 lg:py-5">
          <aside className="hidden lg:flex lg:flex-col">
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="text-lg font-black text-white">Chats</div>
                <div className="mt-1 text-sm text-slate-300">
                  {conversation?.subject || "Admin Support"}
                </div>
              </div>

              <div className="p-3">
                <div className="flex items-center gap-3 rounded-[22px] border border-sky-400/20 bg-sky-500/10 px-4 py-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white shadow-lg shadow-blue-950/40">
                    <MessageSquare size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-white">Admin Support</div>
                    <div className="truncate text-xs text-slate-300">
                      {messages.length > 0
                        ? messages[messages.length - 1]?.body || "Attachment sent"
                        : "Start your conversation"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section className="flex min-h-[calc(100vh-73px)] flex-col overflow-hidden border-y border-white/10 bg-white/[0.03] shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md sm:rounded-[30px] sm:border">
            <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white shadow-lg shadow-blue-950/40">
                    <MessageSquare size={20} />
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-white sm:text-lg">
                      Admin Support
                    </h2>
                    <p className="truncate text-xs text-slate-300 sm:text-sm">
                      {hasMessages
                        ? "Your messages and admin replies appear here."
                        : "Start your conversation with the admin."}
                    </p>
                  </div>
                </div>

                {conversation && (
                  <button
                    type="button"
                    onClick={deleteConversation}
                    disabled={deletingChat}
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-red-400/20 bg-red-500/10 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingChat ? "Deleting..." : "Delete Chat"}
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
              {loading ? (
                <div className="mx-auto max-w-3xl rounded-[24px] border border-white/10 bg-white/[0.05] p-4 text-sm text-slate-300 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                  Loading conversation...
                </div>
              ) : messages.length === 0 ? (
                <div className="mx-auto mt-16 max-w-md rounded-[28px] border border-white/10 bg-white/[0.05] px-6 py-10 text-center shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/10 text-sky-300">
                    <MessageSquare size={28} />
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-white">Start a conversation</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Message the admin anytime. Replies will appear here in one continuous thread.
                  </p>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl space-y-3">
                  {messages.map((item) => {
                    const isUser = item.sender_role === "user"

                    return (
                      <div
                        key={item.id}
                        className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        {!isUser && (
                          <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white shadow-md">
                            <MessageSquare size={14} />
                          </div>
                        )}

                        <div className={`max-w-[85%] sm:max-w-[72%] ${isUser ? "order-1" : ""}`}>
                          <div
                            className={`rounded-3xl px-4 py-3 text-sm shadow-[0_10px_30px_rgba(0,0,0,0.18)] ${
                              isUser
                                ? "rounded-br-lg bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white"
                                : "rounded-bl-lg border border-white/10 bg-white/[0.07] text-slate-100"
                            }`}
                          >
                            {item.body && (
                              <div className="whitespace-pre-wrap break-words leading-6">
                                {item.body}
                              </div>
                            )}

                            {item.attachment_url && (
                              <div className={`${item.body ? "mt-3" : ""}`}>
                                <a
                                  href={item.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`inline-flex max-w-full items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold ${
                                    isUser
                                      ? "bg-white/15 text-white"
                                      : "bg-sky-500/10 text-sky-300"
                                  }`}
                                >
                                  <span className="shrink-0">📎</span>
                                  <span className="truncate">
                                    {getAttachmentName(item.attachment_url)}
                                  </span>
                                </a>
                              </div>
                            )}
                          </div>

                          <div
                            className={`mt-1 flex items-center gap-2 px-2 text-[11px] text-slate-400 ${
                              isUser ? "justify-end" : "justify-start"
                            }`}
                          >
                            <span>{formatTime(item.created_at)}</span>

                            {isUser && (
                              <button
                                type="button"
                                onClick={() => deleteMyMessage(item.id, item.sender_id || "")}
                                className="font-medium text-sky-300 hover:underline"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>

                        {isUser && (
                          <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-slate-200">
                            <User size={14} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <div className="border-t border-white/10 bg-white/[0.03] px-3 py-3 sm:px-5">
              <div className="mx-auto max-w-3xl">
                {(success || error) && (
                  <div
                    className={`mb-3 rounded-2xl border px-4 py-3 text-sm font-medium ${
                      success
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        : "border-red-500/20 bg-red-500/10 text-red-300"
                    }`}
                  >
                    {success || error}
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="space-y-3">
                  {!conversation && (
                    <div>
                      <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Subject of your first message..."
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white/[0.07] focus:ring-4 focus:ring-sky-500/10"
                      />
                    </div>
                  )}

                  <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-2 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                    <div className="flex items-end gap-2">
                      <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-sky-300 transition hover:bg-white/[0.08]">
                        <Paperclip size={20} />
                        <input
                          id="attachment-input"
                          type="file"
                          onChange={handleAttachmentChange}
                          className="hidden"
                        />
                      </label>

                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Write your message..."
                        rows={1}
                        className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-slate-400"
                      />

                      <button
                        type="submit"
                        disabled={sending || uploading}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        title="Send message"
                      >
                        <Send size={18} />
                      </button>
                    </div>

                    {attachment && (
                      <div className="mt-2 rounded-2xl bg-white/[0.06] px-3 py-2 text-xs font-medium text-slate-200">
                        Attached: {attachment.name}
                      </div>
                    )}
                  </div>

                  <div className="px-1 text-xs text-slate-400">
                    {uploading ? "Uploading attachment..." : "Messages stay in one continuous thread."}
                  </div>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}