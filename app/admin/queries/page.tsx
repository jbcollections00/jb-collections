"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type SupportQuery = {
  id: string
  user_id: string
  user_email: string
  message: string
  is_resolved: boolean
  created_at: string
}

export default function AdminQueriesPage() {
  const [queries, setQueries] = useState<SupportQuery[]>([])
  const [loading, setLoading] = useState(true)
  
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [replyStatus, setReplyStatus] = useState<"idle" | "sending" | "error">("idle")
  const [replyErrorMessage, setReplyErrorMessage] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchQueries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchQueries() {
    setLoading(true)
    const { data, error } = await supabase
      .from("support_queries")
      .select("*")
      .order("is_resolved", { ascending: true })
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching queries:", error)
    } else {
      setQueries(data || [])
    }
    setLoading(false)
  }

  async function handleSendReply(query: SupportQuery) {
    if (!replyText.trim()) return

    setReplyStatus("sending")
    setReplyErrorMessage(null)

    try {
      const { error: messageError } = await supabase
        .from("user_messages")
        .insert({
          user_id: query.user_id,
          title: "Reply from Support",
          body: replyText.trim(),
          is_read: false,
        })

      if (messageError) throw messageError

      const { error: updateError } = await supabase
        .from("support_queries")
        .update({ is_resolved: true })
        .eq("id", query.id)

      if (updateError) throw updateError

      setQueries((prev) =>
        prev.map((q) => (q.id === query.id ? { ...q, is_resolved: true } : q))
      )
      
      setReplyingTo(null)
      setReplyText("")
      setReplyStatus("idle")

    } catch (error: any) {
      console.error("Failed to send reply:", error)
      setReplyStatus("error")
      setReplyErrorMessage(error.message || JSON.stringify(error))
    }
  }

  async function markAsResolved(queryId: string) {
    const { error } = await supabase
      .from("support_queries")
      .update({ is_resolved: true })
      .eq("id", queryId)

    if (!error) {
      setQueries((prev) =>
        prev.map((q) => (q.id === queryId ? { ...q, is_resolved: true } : q))
      )
    }
  }

  async function handleDelete(queryId: string) {
    const confirmed = window.confirm("Are you sure you want to permanently delete this query?")
    if (!confirmed) return

    const { error } = await supabase
      .from("support_queries")
      .delete()
      .eq("id", queryId)

    if (error) {
      alert(`Failed to delete: ${error.message}`)
    } else {
      setQueries((prev) => prev.filter((q) => q.id !== queryId))
    }
  }

  // NEW: Automatically delete all resolved queries at once
  async function handleClearResolved() {
    const confirmed = window.confirm("Are you sure you want to delete ALL resolved queries? This cannot be undone.")
    if (!confirmed) return

    const { error } = await supabase
      .from("support_queries")
      .delete()
      .eq("is_resolved", true)

    if (error) {
      alert(`Failed to clear resolved queries: ${error.message}`)
    } else {
      // Remove all resolved queries from the screen automatically
      setQueries((prev) => prev.filter((q) => !q.is_resolved))
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] p-6 text-slate-100 sm:p-10">
      <div className="mx-auto max-w-5xl">
        
        {/* Header section updated with Clear All button */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white">Support Inbox</h1>
            <p className="mt-2 text-slate-400">Manage, reply to, and delete user queries.</p>
          </div>
          
          {queries.some((q) => q.is_resolved) && (
            <button
              onClick={handleClearResolved}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-500 transition hover:bg-red-500/20 hover:text-red-400"
            >
              🗑️ Clear All Resolved
            </button>
          )}
        </div>

        {loading ? (
          <div className="mt-10 text-center font-bold text-slate-500">Loading queries...</div>
        ) : queries.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-slate-800 bg-slate-900/50 p-10 text-center text-slate-500">
            No queries found. You are all caught up!
          </div>
        ) : (
          <div className="mt-8 grid gap-4">
            {queries.map((query) => (
              <div
                key={query.id}
                className={`rounded-[24px] border p-6 transition ${
                  query.is_resolved
                    ? "border-slate-800 bg-slate-900/30 opacity-70"
                    : "border-blue-500/30 bg-slate-900 shadow-lg"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">{query.user_email}</span>
                      {query.is_resolved ? (
                        <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-400">
                          Resolved
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
                          Pending
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      User ID: {query.user_id} • {new Date(query.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {!query.is_resolved && (
                      <button
                        onClick={() => markAsResolved(query.id)}
                        className="text-xs font-bold text-slate-400 hover:text-white"
                      >
                        Dismiss (Mark Resolved)
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(query.id)}
                      className="text-xs font-bold text-red-500 hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-slate-950 p-4 text-sm text-slate-300">
                  {query.message}
                </div>

                {!query.is_resolved && replyingTo !== query.id && (
                  <button
                    onClick={() => setReplyingTo(query.id)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                  >
                    💬 Reply to User
                  </button>
                )}

                {replyingTo === query.id && (
                  <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply here. This will be sent directly to their messages..."
                      className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={() => handleSendReply(query)}
                        disabled={replyStatus === "sending" || !replyText.trim()}
                        className="inline-flex rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                      >
                        {replyStatus === "sending" ? "Sending..." : "Send Reply"}
                      </button>
                      <button
                        onClick={() => {
                          setReplyingTo(null)
                          setReplyText("")
                          setReplyErrorMessage(null)
                        }}
                        className="text-sm font-bold text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                    {replyStatus === "error" && (
                      <div className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm font-bold text-red-400">
                        Error sending reply: {replyErrorMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}