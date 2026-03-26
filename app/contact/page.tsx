"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Mail, Send, User, FileText, Paperclip } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import SiteHeader from "@/app/components/SiteHeader"

type Conversation = {
  id: string
  user_id: string
  subject: string | null
  status: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
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

type UpgradeReply = {
  id: string
  upgrade_id: string
  sender: "admin" | "user"
  sender_id?: string | null
  body: string
  created_at: string
  updated_at?: string | null
  deleted_at?: string | null
}

type UpgradeRequest = {
  id: string
  sender_id: string | null
  name: string | null
  email: string | null
  plan: string | null
  subject: string | null
  body: string | null
  status: string | null
  admin_reply: string | null
  receipt_url?: string | null
  receipt_path?: string | null
  payment_proof_url?: string | null
  payment_note?: string | null
  created_at: string
}

type InboxConversationItem = {
  id: string
  kind: "message"
  title: string
  preview: string
  status: string
  created_at: string
  conversation: Conversation
  messages: ConversationMessage[]
}

type InboxUpgradeItem = {
  id: string
  kind: "upgrade"
  title: string
  preview: string
  status: string
  created_at: string
  upgrade: UpgradeRequest
  replies: UpgradeReply[]
}

type InboxItem = InboxConversationItem | InboxUpgradeItem
type FilterType = "all" | "messages" | "upgrades"

const MAX_FILE_SIZE = 25 * 1024 * 1024

export default function ContactPage() {
  const supabase = createClient()
  const router = useRouter()

  const [items, setItems] = useState<InboxItem[]>([])
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [loading, setLoading] = useState(true)

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [attachment, setAttachment] = useState<File | null>(null)

  const [replyBody, setReplyBody] = useState("")
  const [sendingReply, setSendingReply] = useState(false)
  const [sendingNewMessage, setSendingNewMessage] = useState(false)
  const [uploadingNewMessage, setUploadingNewMessage] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [loadingUser, setLoadingUser] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [showComposeForm, setShowComposeForm] = useState(false)

  useEffect(() => {
    loadPage(true)

    const interval = setInterval(() => {
      loadInbox(false)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setReplyBody("")
  }, [selectedItem?.id])

  async function loadPage(showLoader = false) {
    if (showLoader) {
      setCheckingAuth(true)
      setLoading(true)
      setLoadingUser(true)
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace("/login")
        return
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", user.id)
        .single()

      const displayName =
        (profileData as { full_name?: string | null } | null)?.full_name ||
        user.email?.split("@")[0] ||
        ""
      const displayEmail =
        (profileData as { email?: string | null } | null)?.email || user.email || ""

      setFullName(displayName)
      setEmail(displayEmail)

      await loadInbox(showLoader)
    } catch (err) {
      console.error("Failed to load page:", err)
      router.replace("/login")
    } finally {
      if (showLoader) {
        setLoadingUser(false)
        setCheckingAuth(false)
      }
    }
  }

  async function loadInbox(showLoader = false) {
    if (showLoader) setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      if (showLoader) setLoading(false)
      router.push("/login")
      return
    }

    const [
      { data: conversationsData, error: conversationsError },
      { data: upgradesData, error: upgradesError },
    ] = await Promise.all([
      supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false }),
      supabase
        .from("upgrades")
        .select("*")
        .eq("sender_id", user.id)
        .order("created_at", { ascending: false }),
    ])

    if (conversationsError) console.error("Load conversations error:", conversationsError)
    if (upgradesError) console.error("Load upgrades error:", upgradesError)

    const conversations = (conversationsData as Conversation[]) || []
    const upgrades = (upgradesData as UpgradeRequest[]) || []

    const conversationIds = conversations.map((c) => c.id)
    const upgradeIds = upgrades.map((u) => u.id)

    let conversationMessages: ConversationMessage[] = []
    let upgradeReplies: UpgradeReply[] = []

    if (conversationIds.length > 0) {
      const { data, error } = await supabase
        .from("conversation_messages")
        .select("*")
        .in("conversation_id", conversationIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })

      if (error) {
        console.error("Load conversation messages error:", error)
      } else {
        conversationMessages = (data as ConversationMessage[]) || []
      }
    }

    if (upgradeIds.length > 0) {
      const { data, error } = await supabase
        .from("upgrade_replies")
        .select("*")
        .in("upgrade_id", upgradeIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })

      if (error) {
        console.error("Load upgrade replies error:", error)
      } else {
        upgradeReplies = ((data as UpgradeReply[]) || []).map((r) => ({
          ...r,
          sender: r.sender as "admin" | "user",
        }))
      }
    }

    const conversationItems: InboxConversationItem[] = conversations.map((conversation) => {
      const threadMessages = conversationMessages.filter(
        (msg) => msg.conversation_id === conversation.id
      )
      const lastMessage = threadMessages[threadMessages.length - 1]

      return {
        id: `conversation-${conversation.id}`,
        kind: "message",
        title: conversation.subject || "No subject",
        preview:
          lastMessage?.body ||
          (lastMessage?.attachment_url ? "Attachment sent" : "No messages yet"),
        status: conversation.status || "open",
        created_at: conversation.updated_at || conversation.created_at,
        conversation,
        messages: threadMessages,
      }
    })

    const upgradeItems: InboxUpgradeItem[] = upgrades.map((upg) => {
      const replies = upgradeReplies.filter((r) => r.upgrade_id === upg.id)

      return {
        id: `upgrade-${upg.id}`,
        kind: "upgrade",
        title: upg.subject || "Premium upgrade request",
        preview:
          replies.length > 0
            ? replies[replies.length - 1].body
            : upg.admin_reply || upg.body || "No details",
        status: upg.status || "pending",
        created_at: upg.created_at,
        upgrade: upg,
        replies,
      }
    })

    const combined: InboxItem[] = [...conversationItems, ...upgradeItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    setItems(combined)

    setSelectedItem((current) => {
      if (!current) return combined[0] || null
      const updated = combined.find((item) => item.id === current.id)
      return updated || combined[0] || null
    })

    if (showLoader) setLoading(false)
  }

  async function uploadAttachment(file: File) {
    const safeName = file.name.replace(/\s+/g, "-")
    const fileName = `conversation-${Date.now()}-${safeName}`

    const { data, error } = await supabase.storage
      .from("message-attachments")
      .upload(fileName, file, {
        upsert: false,
      })

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
      setSuccess("")
      return
    }

    setError("")
    setAttachment(file)
  }

  function startNewConversation() {
    setShowComposeForm(true)
    setSelectedItem(null)
    setSubject("")
    setMessage("")
    setAttachment(null)
    setError("")
    setSuccess("")
    const fileInput = document.getElementById("attachment-input") as HTMLInputElement | null
    if (fileInput) fileInput.value = ""
  }

  async function handleSubmitNewMessage(e: React.FormEvent) {
    e.preventDefault()

    if (!fullName.trim() || !email.trim()) {
      setError("Please complete your name and email.")
      setSuccess("")
      return
    }

    if (!subject.trim()) {
      setError("Please enter a subject.")
      setSuccess("")
      return
    }

    if (!message.trim() && !attachment) {
      setError("Please write a message or attach a file.")
      setSuccess("")
      return
    }

    try {
      setSendingNewMessage(true)
      setUploadingNewMessage(false)
      setError("")
      setSuccess("")

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace("/login")
        return
      }

      let attachmentUrl: string | null = null
      let uploadWarning = ""

      if (attachment) {
        try {
          setUploadingNewMessage(true)
          attachmentUrl = await uploadAttachment(attachment)
        } catch (uploadErr) {
          uploadWarning =
            uploadErr instanceof Error
              ? uploadErr.message
              : "Attachment upload failed."
        } finally {
          setUploadingNewMessage(false)
        }
      }

      const { data: newConversation, error: createConversationError } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          subject: subject.trim(),
          status: "open",
        })
        .select()
        .single()

      if (createConversationError) {
        throw new Error(`Conversation creation failed: ${createConversationError.message}`)
      }

      const conversation = newConversation as Conversation

      const { error: insertError } = await supabase.from("conversation_messages").insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        sender_role: "user",
        body: message.trim() || null,
        attachment_url: attachmentUrl,
      })

      if (insertError) {
        throw new Error(`Message send failed: ${insertError.message}`)
      }

      setSubject("")
      setMessage("")
      setAttachment(null)
      setShowComposeForm(false)

      const fileInput = document.getElementById("attachment-input") as HTMLInputElement | null
      if (fileInput) fileInput.value = ""

      await loadInbox(false)

      if (uploadWarning) {
        setSuccess("Your message was sent, but the attachment could not be uploaded.")
      } else {
        setSuccess("Your message has been sent successfully.")
      }
      setError("")
    } catch (err) {
      const messageText =
        err instanceof Error
          ? err.message
          : "Something went wrong while sending your message."

      setError(messageText)
      setSuccess("")
    } finally {
      setSendingNewMessage(false)
      setUploadingNewMessage(false)
    }
  }

  async function deleteConversationMessage(messageId: string, senderId: string | null) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      alert("Please log in again.")
      return
    }

    if (senderId !== user.id) {
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
      console.error("Delete conversation message error:", error)
      alert(error.message)
      return
    }

    if (!data || data.length === 0) {
      alert("Message was not updated. Check your RLS policy.")
      return
    }

    await loadInbox(false)
  }

  async function deleteConversationThread(conversationId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      alert("Please log in again.")
      return
    }

    const ok = window.confirm("Delete this conversation?")
    if (!ok) return

    const now = new Date().toISOString()

    const { data: conversationUpdated, error: conversationError } = await supabase
      .from("conversations")
      .update({
        deleted_at: now,
        updated_at: now,
      })
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .select("id, deleted_at")

    if (conversationError) {
      console.error("Delete conversation error:", conversationError)
      alert(conversationError.message)
      return
    }

    if (!conversationUpdated || conversationUpdated.length === 0) {
      alert("Conversation was not updated. Check your RLS policy.")
      return
    }

    const { error: messagesError } = await supabase
      .from("conversation_messages")
      .update({
        deleted_at: now,
      })
      .eq("conversation_id", conversationId)
      .eq("sender_id", user.id)

    if (messagesError) {
      console.error("Delete conversation messages error:", messagesError)
      alert(messagesError.message)
      return
    }

    await loadInbox(false)
  }

  async function sendReply() {
    if (!selectedItem) return

    const trimmed = replyBody.trim()
    if (!trimmed) return

    setSendingReply(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSendingReply(false)
      alert("Please log in again.")
      return
    }

    if (selectedItem.kind === "message") {
      const { error } = await supabase.from("conversation_messages").insert({
        conversation_id: selectedItem.conversation.id,
        sender_id: user.id,
        sender_role: "user",
        body: trimmed,
        attachment_url: null,
      })

      if (error) {
        console.error("Send conversation reply error:", error)
        setSendingReply(false)
        alert(error.message)
        return
      }

      await supabase
        .from("conversations")
        .update({
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedItem.conversation.id)
    } else {
      const { error } = await supabase.from("upgrade_replies").insert({
        upgrade_id: selectedItem.upgrade.id,
        sender: "user",
        sender_id: user.id,
        body: trimmed,
      })

      if (error) {
        console.error("Send upgrade reply error:", error)
        setSendingReply(false)
        alert(error.message)
        return
      }
    }

    setReplyBody("")
    setSendingReply(false)
    await loadInbox(false)
  }

  function getStatusClasses(status: string) {
    if (status === "approved") return "bg-emerald-100 text-emerald-700"
    if (status === "rejected") return "bg-red-100 text-red-700"
    if (status === "awaiting_payment") return "bg-blue-100 text-blue-700"
    if (status === "payment_submitted") return "bg-sky-100 text-sky-700"
    if (status === "replied") return "bg-violet-100 text-violet-700"
    if (status === "closed") return "bg-rose-100 text-rose-700"
    return "bg-amber-100 text-amber-700"
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()

    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()

    if (sameDay) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    }

    return date.toLocaleDateString()
  }

  function getInitial(item: InboxItem) {
    const source =
      item.kind === "message"
        ? item.title
        : item.upgrade.name || item.upgrade.email || item.title

    return (source || "U").trim().charAt(0).toUpperCase()
  }

  function getAttachmentName(url: string) {
    try {
      return decodeURIComponent(url.split("/").pop() || "attachment")
    } catch {
      return "attachment"
    }
  }

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()

    return items.filter((item) => {
      const matchesSearch =
        !term ||
        item.title.toLowerCase().includes(term) ||
        item.preview.toLowerCase().includes(term) ||
        item.status.toLowerCase().includes(term)

      const matchesFilter =
        filter === "all"
          ? true
          : filter === "messages"
            ? item.kind === "message"
            : item.kind === "upgrade"

      return matchesSearch && matchesFilter
    })
  }, [items, search, filter])

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-lg font-bold text-slate-800">Checking your account...</p>
          <p className="mt-2 text-sm text-slate-500">Please wait.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <SiteHeader />

      <main className="min-h-screen bg-slate-50 pt-20 sm:pt-24">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          {(success || error) && (
            <div
              className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-medium ${
                success
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {success || error}
            </div>
          )}

          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 lg:max-w-md"
              />

              <div className="flex flex-wrap gap-2">
                {(["all", "messages", "upgrades"] as FilterType[]).map((item) => {
                  const active = filter === item

                  return (
                    <button
                      key={item}
                      onClick={() => setFilter(item)}
                      className={`rounded-xl px-4 py-3 text-sm font-bold capitalize transition ${
                        active
                          ? "border border-blue-600 bg-blue-600 text-white"
                          : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      {item}
                    </button>
                  )
                })}

                <button
                  type="button"
                  onClick={startNewConversation}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  New Message
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-4 font-extrabold text-slate-900">
                Message List
              </div>

              <div className="max-h-[650px] overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-5 text-slate-500">Loading messages...</div>
                ) : filteredItems.length === 0 ? (
                  <div className="px-4 py-5 text-slate-500">No items found.</div>
                ) : (
                  filteredItems.map((item) => {
                    const active = selectedItem?.id === item.id

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedItem(item)
                          setShowComposeForm(false)
                          setSuccess("")
                          setError("")
                        }}
                        className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-4 text-left transition ${
                          active ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                            item.kind === "message"
                              ? "bg-violet-100 text-violet-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {getInitial(item)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-start justify-between gap-3">
                            <div className="truncate text-sm font-extrabold text-slate-900 sm:text-[15px]">
                              {item.title}
                            </div>

                            <div className="shrink-0 whitespace-nowrap text-xs text-slate-500">
                              {formatDate(item.created_at)}
                            </div>
                          </div>

                          <div className="mb-2 truncate text-xs text-slate-500 sm:text-[13px]">
                            {item.preview}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${getStatusClasses(
                                item.status
                              )}`}
                            >
                              {item.status.replace("_", " ")}
                            </span>

                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${
                                item.kind === "message"
                                  ? "bg-violet-100 text-violet-700"
                                  : "bg-sky-100 text-sky-700"
                              }`}
                            >
                              {item.kind}
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
              {showComposeForm ? (
                <div className="mx-auto max-w-xl">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                        Start a Conversation
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-slate-600 sm:text-base">
                        Fill out the form below to start a conversation with the admin.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowComposeForm(false)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>

                  <form onSubmit={handleSubmitNewMessage} className="mt-8 space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Full Name
                      </label>
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">
                        <User size={18} className="text-slate-400" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder={loadingUser ? "Loading your name..." : "Your full name"}
                          className="h-14 w-full rounded-2xl bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Email
                      </label>
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">
                        <Mail size={18} className="text-slate-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={loadingUser ? "Loading your email..." : "you@example.com"}
                          className="h-14 w-full rounded-2xl bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Subject
                      </label>
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">
                        <FileText size={18} className="text-slate-400" />
                        <input
                          type="text"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="Enter subject"
                          className="h-14 w-full rounded-2xl bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Message
                      </label>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Write your message here..."
                          rows={7}
                          className="w-full resize-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Attachment (optional)
                      </label>

                      <label className="flex cursor-pointer flex-col items-start justify-between gap-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 transition hover:border-blue-400 hover:bg-blue-50 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-slate-100 p-2">
                            <Paperclip size={18} className="text-slate-700" />
                          </div>

                          <div>
                            <p className="break-all text-sm font-semibold text-slate-800">
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

                      {attachment && (
                        <p className="mt-2 break-all text-xs text-slate-500">
                          Selected file: {attachment.name}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="submit"
                        disabled={sendingNewMessage || uploadingNewMessage}
                        className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Send size={18} />
                        {sendingNewMessage || uploadingNewMessage
                          ? "Sending..."
                          : "Send Message"}
                      </button>
                    </div>
                  </form>
                </div>
              ) : !selectedItem ? (
                <div className="text-slate-500">Select an item to view details, or start a new message.</div>
              ) : selectedItem.kind === "message" ? (
                <>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-extrabold text-slate-900 sm:text-[28px]">
                        {selectedItem.conversation.subject || "No subject"}
                      </h2>

                      <div className="mt-2 text-sm leading-7 text-slate-600">
                        <div>
                          <strong>Status:</strong> {selectedItem.status.replace("_", " ")}
                        </div>
                        <div>
                          <strong>Date:</strong>{" "}
                          {new Date(selectedItem.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowComposeForm(true)
                          setSelectedItem(null)
                        }}
                        className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                      >
                        New Message
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteConversationThread(selectedItem.conversation.id)}
                        className="inline-flex items-center justify-center rounded-xl border border-red-300 bg-white px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <h3 className="mb-3 text-lg font-extrabold text-slate-900">Conversation</h3>

                  {selectedItem.messages.length === 0 ? (
                    <div className="mb-4 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-slate-500">
                      No messages yet.
                    </div>
                  ) : (
                    <div className="mb-5 grid gap-3">
                      {selectedItem.messages.map((message) => {
                        const isUser = message.sender_role === "user"

                        return (
                          <div
                            key={message.id}
                            className={`rounded-xl border p-4 ${
                              isUser
                                ? "border-slate-200 bg-slate-50"
                                : "border-blue-200 bg-blue-50"
                            }`}
                          >
                            <div
                              className={`mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold ${
                                isUser ? "text-slate-600" : "text-blue-700"
                              }`}
                            >
                              <span>
                                {isUser ? "You" : "Admin"} •{" "}
                                {new Date(message.created_at).toLocaleString()}
                              </span>

                              {isUser && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteConversationMessage(message.id, message.sender_id)
                                  }
                                  className="text-red-500 hover:underline"
                                >
                                  Delete
                                </button>
                              )}
                            </div>

                            {message.body && (
                              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                                {message.body}
                              </div>
                            )}

                            {message.attachment_url && (
                              <a
                                href={message.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-600"
                              >
                                📎 {getAttachmentName(message.attachment_url)}
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="mt-5 border-t border-slate-200 pt-5">
                    <h3 className="mb-3 text-lg font-extrabold text-slate-900">Reply</h3>

                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Write your reply here..."
                      rows={5}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />

                    <div className="mt-4">
                      <button
                        onClick={sendReply}
                        disabled={sendingReply || !replyBody.trim()}
                        className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                      >
                        {sendingReply ? "Sending..." : "Send Reply"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-2xl font-extrabold text-slate-900 sm:text-[28px]">
                        {selectedItem.upgrade.subject || "Premium upgrade request"}
                      </h2>

                      <div className="mt-2 text-sm leading-7 text-slate-600">
                        <div>
                          <strong>Status:</strong> {selectedItem.status.replace("_", " ")}
                        </div>
                        <div>
                          <strong>Date:</strong>{" "}
                          {new Date(selectedItem.upgrade.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-5 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                    {selectedItem.upgrade.body || "No message"}
                  </div>

                  <h3 className="mb-3 text-lg font-extrabold text-slate-900">Conversation</h3>

                  {selectedItem.replies.length === 0 && selectedItem.upgrade.admin_reply ? (
                    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <div className="mb-2 text-xs font-bold text-blue-700">Admin</div>
                      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                        {selectedItem.upgrade.admin_reply}
                      </div>
                    </div>
                  ) : selectedItem.replies.length === 0 ? (
                    <div className="mb-4 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-slate-500">
                      No replies yet.
                    </div>
                  ) : (
                    <div className="mb-5 grid gap-3">
                      {selectedItem.replies.map((reply) => {
                        const isUser = reply.sender === "user"

                        return (
                          <div
                            key={reply.id}
                            className={`rounded-xl border p-4 ${
                              isUser
                                ? "border-slate-200 bg-slate-50"
                                : "border-blue-200 bg-blue-50"
                            }`}
                          >
                            <div
                              className={`mb-2 text-xs font-bold ${
                                isUser ? "text-slate-600" : "text-blue-700"
                              }`}
                            >
                              {isUser ? "You" : "Admin"} •{" "}
                              {new Date(reply.created_at).toLocaleString()}
                            </div>

                            <div className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                              {reply.body}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {(selectedItem.status === "awaiting_payment" ||
                    selectedItem.status === "approved") && (
                    <PaymentProofUploader
                      upgrade={selectedItem.upgrade}
                      onUploaded={() => loadInbox(false)}
                    />
                  )}

                  <div className="mt-5 border-t border-slate-200 pt-5">
                    <h3 className="mb-3 text-lg font-extrabold text-slate-900">Reply</h3>

                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Write your reply here..."
                      rows={5}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />

                    <div className="mt-4">
                      <button
                        onClick={sendReply}
                        disabled={sendingReply || !replyBody.trim()}
                        className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                      >
                        {sendingReply ? "Sending..." : "Send Reply"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

function PaymentProofUploader({
  upgrade,
  onUploaded,
}: {
  upgrade: UpgradeRequest
  onUploaded: () => void
}) {
  const supabase = createClient()

  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState("")
  const [uploading, setUploading] = useState(false)

  async function uploadProof() {
    if (!file) {
      alert("Select screenshot first.")
      return
    }

    try {
      setUploading(true)

      const extension = file.name.split(".").pop() || "png"
      const fileName = `${upgrade.id}-${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(fileName, file)

      if (uploadError) {
        console.error(uploadError)
        alert("Upload failed.")
        return
      }

      const { data } = supabase.storage.from("payment-proofs").getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from("upgrades")
        .update({
          payment_proof_url: data.publicUrl,
          payment_note: note,
          status: "payment_submitted",
        })
        .eq("id", upgrade.id)

      if (updateError) {
        console.error(updateError)
        alert("Save failed.")
        return
      }

      alert("Proof sent to admin!")
      setFile(null)
      setNote("")
      onUploaded()
    } catch (err) {
      console.error(err)
      alert("Something went wrong.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <h3 className="mb-3 text-lg font-extrabold text-slate-900">
        Send Proof of Payment
      </h3>

      <p className="mb-4 text-sm leading-7 text-slate-600">
        Upload your GCash payment screenshot so the admin can verify your payment.
      </p>

      <input
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
      />

      <textarea
        placeholder="Optional note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-3 min-h-[100px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
      />

      <button
        onClick={uploadProof}
        disabled={uploading}
        className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
      >
        {uploading ? "Uploading..." : "Send Proof"}
      </button>
    </div>
  )
}