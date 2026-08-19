"use client"

import { useEffect, useState } from "react"
import { Megaphone, Plus, Trash2, Send, X, Users, Paperclip, FileText, Download } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Attachment = {
  name: string
  url: string
}

type UserMessage = {
  id: string
  user_id: string | null
  title: string
  body: string
  created_at: string
  attachments?: Attachment[] | null
}

// Helper component to make URLs in text clickable
function Linkify({ text }: { text: string }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)

  return (
    <>
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 underline decoration-cyan-400/30 underline-offset-2 hover:text-cyan-300 hover:decoration-cyan-300 transition-colors"
            >
              {part}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export default function AdminMessagesPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<UserMessage[]>([])
  const [selectedMessage, setSelectedMessage] = useState<UserMessage | null>(null)

  // Create Modal State
  const [showModal, setShowModal] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [targetAudience, setTargetAudience] = useState<"all" | "standard" | "premium" | "platinum">("all")
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    void fetchMessages()
  }, [])

  async function fetchMessages() {
    setLoading(true)
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching messages:", error)
      setLoading(false)
      return
    }

    const uniqueList: UserMessage[] = []
    const seen = new Set<string>()

    for (const item of (data as UserMessage[]) || []) {
      const key = `${item.title}-${item.body}`
      if (!seen.has(key)) {
        seen.add(key)
        uniqueList.push(item)
      }
    }

    setMessages(uniqueList)
    if (uniqueList.length > 0 && !selectedMessage) {
      setSelectedMessage(uniqueList[0])
    }
    setLoading(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setFiles((prev) => [...prev, ...selectedFiles])
    }
  }

  function removeFile(indexToRemove: number) {
    setFiles((prev) => prev.filter((_, index) => index !== indexToRemove))
  }

  function resetForm() {
    setTitle("")
    setBody("")
    setTargetAudience("all")
    setFiles([])
    setShowModal(false)
  }

  async function handleSendBroadcast(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return

    setIsSubmitting(true)

    try {
      // 1. Upload Attachments (if any)
      const uploadedAttachments: Attachment[] = []
      if (files.length > 0) {
        for (const file of files) {
          const fileExt = file.name.split('.').pop()
          const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
          const filePath = `${Date.now()}-${fileName}`

          const { error: uploadError } = await supabase.storage
            .from("message-attachments")
            .upload(filePath, file)

          if (uploadError) throw new Error(`File upload failed: ${uploadError.message}`)

          const { data: publicUrlData } = supabase.storage
            .from("message-attachments")
            .getPublicUrl(filePath)

          uploadedAttachments.push({
            name: file.name,
            url: publicUrlData.publicUrl,
          })
        }
      }

      // 2. Fetch Profiles for Database Constraints
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")

      if (profileError) throw profileError

      let targetProfiles = profiles || []

      if (targetAudience !== "all") {
        targetProfiles = targetProfiles.filter((user: Record<string, any>) =>
          Object.values(user).some(
            (val) => typeof val === "string" && val.toLowerCase().includes(targetAudience.toLowerCase())
          )
        )
      }

      if (targetProfiles.length === 0) {
        alert(`No users found matching tier "${targetAudience.toUpperCase()}".`)
        setIsSubmitting(false)
        return
      }

      // 3. Map Rows & Insert Message Records
      const attachmentData = uploadedAttachments.length > 0 ? uploadedAttachments : null
      
      const rowsToInsert = targetProfiles.map((p) => ({
        user_id: p.id,
        title: title.trim(),
        body: body.trim(),
        is_read: false,
        attachments: attachmentData
      }))

      const { error: insertError } = await supabase
        .from("messages")
        .insert(rowsToInsert)

      if (insertError) throw insertError

      resetForm()
      await fetchMessages()
    } catch (err: any) {
      alert("Failed to send broadcast: " + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteMessage(target: UserMessage) {
    if (!confirm(`Delete broadcast "${target.title}" for all users?`)) return

    try {
      // Wipes records matching title on the "messages" table
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("title", target.title)

      if (error) throw error

      // Remove from UI immediately
      const remaining = messages.filter((m) => m.title !== target.title)
      setMessages(remaining)
      setSelectedMessage(remaining.length > 0 ? remaining[0] : null)
      
    } catch (err: any) {
      alert("Failed to delete message: " + err.message)
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

  return (
    <main className="relative min-h-screen bg-[#0b1220] p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-[1800px]">
        <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#0f172a]">
          <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
            
            {/* Sidebar Header & Action */}
            <aside className="border-r border-white/10 bg-[#111827] flex flex-col">
              <div className="border-b border-white/10 p-5 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">
                    ADMIN INBOX
                  </div>
                  <h2 className="text-xl font-black text-white">Announcements</h2>
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-black hover:bg-cyan-400 transition"
                >
                  <Plus size={16} /> New
                </button>
              </div>

              {/* Announcement List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loading ? (
                  <div className="p-4 text-center text-xs text-slate-400">Loading broadcasts...</div>
                ) : messages.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No announcements broadcasted yet.
                  </div>
                ) : (
                  messages.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedMessage(item)}
                      className={`flex w-full items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left transition ${
                        selectedMessage?.title === item.title
                          ? "border-cyan-500 bg-[#1e293b]"
                          : "border-transparent hover:bg-white/5"
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                        <Megaphone size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <div className="truncate text-sm font-bold text-white">{item.title}</div>
                          {item.attachments && item.attachments.length > 0 && (
                            <Paperclip size={12} className="text-cyan-400 shrink-0" />
                          )}
                        </div>
                        <div className="truncate text-xs text-slate-400">{item.body}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </aside>

            {/* View & Delete Pane */}
            <section className="flex flex-col bg-[#0b1220]">
              {selectedMessage ? (
                <>
                  <div className="border-b border-white/10 bg-[#0f172a] px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-600">
                        <Megaphone size={18} />
                      </div>
                      <div>
                        <h1 className="text-lg font-bold text-white">{selectedMessage.title}</h1>
                        <p className="text-xs text-cyan-200/70">Official Broadcast</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteMessage(selectedMessage)}
                      className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-400 border border-red-500/20 hover:bg-red-500/20 transition"
                    >
                      <Trash2 size={16} /> Delete Broadcast
                    </button>
                  </div>

                  <div className="flex-1 p-6 overflow-y-auto">
                    <div className="max-w-3xl rounded-[20px] border border-white/10 bg-[#1e293b] p-6 shadow-md space-y-6">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <h2 className="text-xl font-black text-white">{selectedMessage.title}</h2>
                        <span className="text-xs text-slate-400">{formatTime(selectedMessage.created_at)}</span>
                      </div>
                      
                      {/* Using the Linkify component here to make links clickable */}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                        <Linkify text={selectedMessage.body} />
                      </p>

                      {/* Display Attachments */}
                      {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                        <div className="pt-4 border-t border-white/10">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                            Attachments ({selectedMessage.attachments.length})
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedMessage.attachments.map((file, idx) => (
                              <a
                                key={idx}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f172a] p-3 transition hover:border-cyan-500 hover:bg-white/5"
                              >
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                                    <FileText size={16} />
                                  </div>
                                  <span className="truncate text-sm font-medium text-slate-300">
                                    {file.name}
                                  </span>
                                </div>
                                <Download size={16} className="text-slate-500 shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Select an announcement to view or delete.
                </div>
              )}
            </section>
          </div>
        </section>
      </div>

      {/* New Announcement Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[24px] border border-white/10 bg-[#0f172a] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Megaphone size={18} className="text-cyan-400" /> New Broadcast Announcement
              </h3>
              <button onClick={resetForm} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="mt-4 space-y-4">
              {/* Target Audience Dropdown */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Send To
                </label>
                <div className="relative">
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value as any)}
                    className="w-full appearance-none rounded-xl border border-white/10 bg-[#1e293b] px-4 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="all">All Users</option>
                    <option value="standard">Standard Users</option>
                    <option value="premium">Premium Users</option>
                    <option value="platinum">Platinum Users</option>
                  </select>
                  <Users size={16} className="absolute right-3.5 top-3 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Telegram GC is ON."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#1e293b] px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Message Body
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Type your message broadcast here..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#1e293b] px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Attachments Upload */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Attachments
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-[#1e293b] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5">
                    <Paperclip size={16} className="text-cyan-400" />
                    <span>Select Files</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                  {files.length > 0 && (
                    <span className="text-xs text-slate-400">{files.length} file(s) selected</span>
                  )}
                </div>

                {/* Selected Files Preview */}
                {files.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {files.map((file, index) => (
                      <li key={index} className="flex items-center justify-between rounded-lg bg-[#1e293b] px-3 py-2 border border-white/5">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText size={14} className="text-cyan-400 shrink-0" />
                          <span className="truncate text-xs text-slate-300">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-slate-500 hover:text-red-400 transition"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-400 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2 text-xs font-bold text-black hover:bg-cyan-400 disabled:opacity-50 transition"
                >
                  <Send size={14} /> {isSubmitting ? "Sending..." : "Send Broadcast"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}