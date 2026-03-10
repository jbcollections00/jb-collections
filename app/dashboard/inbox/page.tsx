"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
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

export default function DashboardInboxPage() {
  const supabase = createClient()
  const router = useRouter()

  const [items, setItems] = useState<InboxItem[]>([])
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [loading, setLoading] = useState(true)
  const [replyBody, setReplyBody] = useState("")
  const [sendingReply, setSendingReply] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    loadInbox(true)

    const interval = setInterval(() => {
      loadInbox(false)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setReplyBody("")
  }, [selectedItem?.id])

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
        (message) => message.conversation_id === conversation.id
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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        {/* HEADER */}
        <div className="mb-6 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm sm:mb-8 sm:rounded-[30px]">
          <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 px-4 py-5 text-white sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-white blur-3xl" />
              <div className="absolute right-0 top-6 h-48 w-48 rounded-full bg-white blur-3xl" />
            </div>

            <div className="relative">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/80 sm:text-sm">
                    JB Collections
                  </p>
                </div>

                <div className="hidden items-center gap-3 lg:flex">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    🏠 Dashboard
                  </Link>

                  <Link
                    href="/profile"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    👤 Profile
                  </Link>

                  <Link
                    href="/contact"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    💬 Message Admin
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600"
                  >
                    🚪 Logout
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-xl text-white backdrop-blur lg:hidden"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? "✕" : "☰"}
                </button>
              </div>

              {mobileMenuOpen && (
                <div className="mt-4 grid grid-cols-1 gap-3 lg:hidden">
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    🏠 Dashboard
                  </Link>

                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    👤 Profile
                  </Link>

                  <Link
                    href="/contact"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    💬 Message Admin
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  >
                    🚪 Logout
                  </button>
                </div>
              )}

              <div className="mt-6">
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  My Inbox
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-white/90 sm:text-base">
                  Messages and upgrade updates in one place.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH / FILTER */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search inbox"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
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
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          {/* LIST */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-4 font-extrabold text-slate-900">
              Inbox
            </div>

            <div className="max-h-[650px] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-5 text-slate-500">Loading inbox...</div>
              ) : filteredItems.length === 0 ? (
                <div className="px-4 py-5 text-slate-500">No items found.</div>
              ) : (
                filteredItems.map((item) => {
                  const active = selectedItem?.id === item.id

                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
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

          {/* DETAILS */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
            {!selectedItem ? (
              <div className="text-slate-500">Select an item to view details.</div>
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

                  <Link
                    href="/contact"
                    className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                  >
                    Open Chat
                  </Link>
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
                            className={`mb-2 text-xs font-bold ${
                              isUser ? "text-slate-600" : "text-blue-700"
                            }`}
                          >
                            {isUser ? "You" : "Admin"} •{" "}
                            {new Date(message.created_at).toLocaleString()}
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
    </div>
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

      const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(fileName, file)

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