"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Message = {
  id: string
  sender_id: string | null
  name: string | null
  email: string | null
  subject: string | null
  body: string | null
  status: string | null
  created_at: string
}

type Reply = {
  id: string
  message_id: string
  sender: string
  body: string
  created_at: string
}

type MessageWithReplies = Message & {
  replies: Reply[]
}

export default function DashboardMessagesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [messages, setMessages] = useState<MessageWithReplies[]>([])
  const [selectedMessage, setSelectedMessage] = useState<MessageWithReplies | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    loadMessages()

    const interval = setInterval(() => {
      loadMessages(false)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  async function loadMessages(showLoader = true) {
    if (showLoader) setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      if (showLoader) setLoading(false)
      router.push("/login")
      return
    }

    const { data: messagesData, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false })

    if (messagesError) {
      console.error("Load user messages error:", messagesError)
      if (showLoader) setLoading(false)
      return
    }

    const messageList = (messagesData as Message[]) || []
    const messageIds = messageList.map((item) => item.id)

    let repliesData: Reply[] = []

    if (messageIds.length > 0) {
      const { data: replyRows, error: repliesError } = await supabase
        .from("message_replies")
        .select("*")
        .in("message_id", messageIds)
        .order("created_at", { ascending: true })

      if (repliesError) {
        console.error("Load message replies error:", repliesError)
      } else {
        repliesData = (replyRows as Reply[]) || []
      }
    }

    const combined: MessageWithReplies[] = messageList.map((message) => ({
      ...message,
      replies: repliesData.filter((reply) => reply.message_id === message.id),
    }))

    setMessages(combined)

    setSelectedMessage((current) => {
      if (!current) return combined[0] || null
      const updated = combined.find((item) => item.id === current.id)
      return updated || combined[0] || null
    })

    if (showLoader) setLoading(false)
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString()
  }

  const filteredMessages = useMemo(() => {
    const term = search.trim().toLowerCase()

    return messages.filter((msg) => {
      if (!term) return true

      return (
        (msg.subject || "").toLowerCase().includes(term) ||
        (msg.body || "").toLowerCase().includes(term) ||
        (msg.status || "").toLowerCase().includes(term) ||
        msg.replies.some((reply) => (reply.body || "").toLowerCase().includes(term))
      )
    })
  }, [messages, search])

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "24px",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "34px",
                fontWeight: 800,
                color: "#0f172a",
                margin: "0 0 6px",
              }}
            >
              My Messages
            </h1>
            <p
              style={{
                margin: 0,
                color: "#64748b",
                fontSize: "15px",
              }}
            >
              View your sent messages and admin replies.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link href="/dashboard" style={secondaryLink}>
              Back to Dashboard
            </Link>
            <Link href="/contact" style={primaryLink}>
              Message Admin
            </Link>
          </div>
        </div>

        <div
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            padding: "14px",
            marginBottom: "16px",
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your messages or replies"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              fontSize: "15px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "360px 1fr",
            gap: "16px",
            alignItems: "start",
          }}
        >
          <div
            style={{
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid #e2e8f0",
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              Sent Messages
            </div>

            <div style={{ maxHeight: "650px", overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: "18px 16px", color: "#64748b" }}>Loading messages...</div>
              ) : filteredMessages.length === 0 ? (
                <div style={{ padding: "18px 16px", color: "#64748b" }}>No messages yet.</div>
              ) : (
                filteredMessages.map((msg) => {
                  const active = selectedMessage?.id === msg.id
                  const hasReply = msg.replies.length > 0

                  return (
                    <button
                      key={msg.id}
                      onClick={() => setSelectedMessage(msg)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "14px 16px",
                        border: "none",
                        borderBottom: "1px solid #eef2f7",
                        background: active ? "#eff6ff" : "white",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "10px",
                          marginBottom: "6px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: 800,
                            color: "#0f172a",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {msg.subject || "No subject"}
                        </div>

                        <div
                          style={{
                            fontSize: "12px",
                            color: "#64748b",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {new Date(msg.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: "13px",
                          color: "#64748b",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          marginBottom: "8px",
                        }}
                      >
                        {msg.body || "No message"}
                      </div>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "4px 8px",
                            borderRadius: "999px",
                            background:
                              msg.status === "replied"
                                ? "#dcfce7"
                                : msg.status === "read"
                                  ? "#e0f2fe"
                                  : "#dbeafe",
                            color:
                              msg.status === "replied"
                                ? "#166534"
                                : msg.status === "read"
                                  ? "#0369a1"
                                  : "#1d4ed8",
                          }}
                        >
                          {msg.status || "open"}
                        </span>

                        {hasReply && (
                          <span
                            style={{
                              display: "inline-block",
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "4px 8px",
                              borderRadius: "999px",
                              background: "#fef3c7",
                              color: "#92400e",
                            }}
                          >
                            {msg.replies.length} repl{msg.replies.length > 1 ? "ies" : "y"}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div
            style={{
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "20px",
              minHeight: "420px",
            }}
          >
            {!selectedMessage ? (
              <div style={{ color: "#64748b" }}>Select a message to view details.</div>
            ) : (
              <>
                <h2
                  style={{
                    fontSize: "28px",
                    fontWeight: 800,
                    margin: "0 0 8px",
                    color: "#0f172a",
                  }}
                >
                  {selectedMessage.subject || "No subject"}
                </h2>

                <div
                  style={{
                    color: "#475569",
                    fontSize: "14px",
                    lineHeight: 1.7,
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <strong>Status:</strong> {selectedMessage.status || "open"}
                  </div>
                  <div>
                    <strong>Sent:</strong> {formatDate(selectedMessage.created_at)}
                  </div>
                </div>

                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "16px",
                    color: "#334155",
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    marginBottom: "18px",
                  }}
                >
                  {selectedMessage.body || "No message"}
                </div>

                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: 800,
                    color: "#0f172a",
                    margin: "0 0 12px",
                  }}
                >
                  Admin Replies
                </h3>

                {selectedMessage.replies.length === 0 ? (
                  <div
                    style={{
                      background: "#fff",
                      border: "1px dashed #cbd5e1",
                      borderRadius: "12px",
                      padding: "16px",
                      color: "#64748b",
                    }}
                  >
                    No reply yet.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "12px" }}>
                    {selectedMessage.replies.map((reply) => (
                      <div
                        key={reply.id}
                        style={{
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          borderRadius: "12px",
                          padding: "14px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#1d4ed8",
                            marginBottom: "8px",
                          }}
                        >
                          Admin • {formatDate(reply.created_at)}
                        </div>

                        <div
                          style={{
                            color: "#1e293b",
                            lineHeight: 1.7,
                            whiteSpace: "pre-wrap",
                            fontSize: "14px",
                          }}
                        >
                          {reply.body}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const primaryLink: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "10px",
  background: "#2563eb",
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
}

const secondaryLink: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "10px",
  background: "white",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 700,
  border: "1px solid #cbd5e1",
}