"use client"

import { useEffect, useState } from "react"
import {
  Megaphone,
  X,
  Paperclip,
  Send,
  Users,
  Search,
  CheckSquare,
  Square,
  Trash2,
  Loader2,
  FileText,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import SiteHeader from "@/app/components/SiteHeader"

type UserProfile = {
  id: string
  email: string
  full_name?: string | null
  name?: string | null
  username?: string | null
  role?: string | null
  membership?: string | null
  membership_tier?: string | null
}

type GroupedBroadcast = {
  id: string
  ids: string[]
  user_id: string | null
  title?: string | null
  body: string
  created_at: string
  recipientCount: number
  attachments?: any
}

export default function AdminMessagesPage() {
  const supabase = createClient()

  // Messages List State
  const [messages, setMessages] = useState<GroupedBroadcast[]>([])
  const [loadingMessages, setLoadingMessages] = useState(true)

  // Modal Controls & Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [sendToOption, setSendToOption] = useState<string>("all")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [isSending, setIsSending] = useState(false)

  // Specific User Directory & Selection State
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [userSearchQuery, setUserSearchQuery] = useState("")

  // File Upload State
  const [attachments, setAttachments] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)

  useEffect(() => {
    fetchBroadcasts()
  }, [])

  // Lazy-load directory when "Specific User(s)" option is chosen
  useEffect(() => {
    if (sendToOption === "specific" && users.length === 0) {
      fetchUserDirectory()
    }
  }, [sendToOption])

  async function fetchBroadcasts() {
    setLoadingMessages(true)
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })

      if (!error && data) {
        const groupedMap = new Map<string, GroupedBroadcast>()

        for (const msg of data) {
          // Group duplicate entries generated during a single broadcast
          const groupKey = `${msg.title || ""}_${msg.body}_${msg.created_at}`

          if (groupedMap.has(groupKey)) {
            const existing = groupedMap.get(groupKey)!
            existing.ids.push(msg.id)
            existing.recipientCount += 1
          } else {
            groupedMap.set(groupKey, {
              id: msg.id,
              ids: [msg.id],
              user_id: msg.user_id,
              title: msg.title,
              body: msg.body,
              created_at: msg.created_at,
              recipientCount: 1,
              attachments: msg.attachments,
            })
          }
        }

        setMessages(Array.from(groupedMap.values()))
      }
    } catch (err) {
      console.error("Error fetching broadcast messages:", err)
    } finally {
      setLoadingMessages(false)
    }
  }

  async function fetchUserDirectory() {
    setLoadingUsers(true)
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, name, username, role, membership, membership_tier")
        .order("created_at", { ascending: false })

      if (!error && data) {
        setUsers(data as UserProfile[])
      } else if (error) {
        console.error("Error loading user profiles:", error)
      }
    } catch (err) {
      console.error("Error loading user directory:", err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = userSearchQuery.toLowerCase()
    const emailMatch = u.email?.toLowerCase().includes(q)
    const fullNameMatch = u.full_name?.toLowerCase().includes(q)
    const nameMatch = u.name?.toLowerCase().includes(q)
    const usernameMatch = u.username?.toLowerCase().includes(q)
    return emailMatch || fullNameMatch || nameMatch || usernameMatch
  })

  function toggleUserSelection(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  function toggleSelectAllUsers() {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([])
    } else {
      setSelectedUserIds(filteredUsers.map((u) => u.id))
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setAttachments((prev) => [...prev, ...selectedFiles])
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSendBroadcast() {
    if (!body.trim()) {
      alert("Please enter a message broadcast body.")
      return
    }

    if (sendToOption === "specific" && selectedUserIds.length === 0) {
      alert("Please select at least one recipient user.")
      return
    }

    setIsSending(true)

    try {
      const uploadedAttachments: { name: string; url: string; file_path: string }[] = []
      if (attachments.length > 0) {
        setUploadingFiles(true)
        for (const file of attachments) {
          const fileExt = file.name.split(".").pop()
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
          const filePath = `broadcasts/${fileName}`

          const { error: uploadErr } = await supabase.storage
            .from("attachments")
            .upload(filePath, file)

          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage
              .from("attachments")
              .getPublicUrl(filePath)

            uploadedAttachments.push({
              name: file.name,
              url: publicUrlData.publicUrl,
              file_path: filePath,
            })
          }
        }
        setUploadingFiles(false)
      }

      let targetUserIds: (string | null)[] = []

      if (sendToOption === "all") {
        targetUserIds = [null]
      } else if (sendToOption === "specific") {
        targetUserIds = selectedUserIds
      } else {
        const { data: tieredUsers } = await supabase
          .from("profiles")
          .select("id")
          .or(`membership_tier.ilike.${sendToOption},membership.ilike.${sendToOption},role.ilike.${sendToOption}`)

        if (tieredUsers && tieredUsers.length > 0) {
          targetUserIds = tieredUsers.map((u) => u.id)
        } else {
          alert(`No users found matching tier category: ${sendToOption}`)
          setIsSending(false)
          return
        }
      }

      const insertPayload = targetUserIds.map((uid) => ({
        user_id: uid,
        title: title.trim() || null,
        body: body.trim(),
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : null,
        created_at: new Date().toISOString(),
      }))

      const { error } = await supabase.from("messages").insert(insertPayload)

      if (error) throw error

      setTitle("")
      setBody("")
      setAttachments([])
      setSelectedUserIds([])
      setSendToOption("all")
      setIsModalOpen(false)
      fetchBroadcasts()
    } catch (err: any) {
      console.error("Failed to send broadcast announcement:", err)
      alert(err.message || "An error occurred while sending the broadcast.")
    } finally {
      setIsSending(false)
    }
  }

  async function handleDeleteBroadcast(idsToDelete: string[]) {
    if (!confirm(`Are you sure you want to delete this broadcast? (${idsToDelete.length} message record(s))`)) return

    try {
      const { error } = await supabase.from("messages").delete().in("id", idsToDelete)
      if (!error) {
        setMessages((prev) => prev.filter((m) => !m.ids.some((id) => idsToDelete.includes(id))))
      }
    } catch (err) {
      console.error("Error deleting broadcast:", err)
    }
  }

  return (
    <>
      <SiteHeader />

      <main className="relative min-h-screen overflow-x-hidden bg-[#0b1220] pt-24 text-white sm:pt-28">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.14),_transparent_22%),linear-gradient(180deg,_#020617_0%,_#081120_100%)]" />

        <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          {/* Header Bar */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-6">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-cyan-400">
                ADMIN PANEL
              </div>
              <h1 className="mt-1 text-3xl font-black text-white">Broadcast Announcements</h1>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 font-bold text-black shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transition"
            >
              <Megaphone size={18} />
              <span>New Announcement</span>
            </button>
          </div>

          {/* Messages Table / List */}
          <div className="mt-8 space-y-4">
            {loadingMessages ? (
              <div className="flex items-center justify-center p-12 text-sm text-slate-400">
                <Loader2 className="animate-spin mr-2" size={18} /> Loading announcements...
              </div>
            ) : messages.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-12 text-center text-slate-400">
                No broadcast announcements sent yet.
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0f172a] p-5 shadow-md hover:border-white/20 transition"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                      <Megaphone size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white truncate">
                          {msg.title || "Broadcast Announcement"}
                        </span>
                        <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan-400 border border-cyan-500/20 shrink-0">
                          {!msg.user_id
                            ? "All Users"
                            : msg.recipientCount > 1
                            ? `${msg.recipientCount} Specific Users`
                            : "1 Specific User"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-300 line-clamp-2">{msg.body}</p>
                      <span className="mt-2 block text-[11px] text-slate-500">
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteBroadcast(msg.ids)}
                    className="self-end sm:self-center flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/20 transition"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* --- BROADCAST MODAL --- */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col overflow-hidden">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
                <div className="flex items-center gap-2.5">
                  <Megaphone className="text-cyan-400" size={20} />
                  <h2 className="text-xl font-black text-white">New Broadcast Announcement</h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Send To Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Send To
                  </label>
                  <div className="relative">
                    <select
                      value={sendToOption}
                      onChange={(e) => {
                        setSendToOption(e.target.value)
                        if (e.target.value !== "specific") setSelectedUserIds([])
                      }}
                      className="w-full rounded-xl border border-white/10 bg-[#1e293b] px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none appearance-none"
                    >
                      <option value="all">All Users</option>
                      <option value="standard">Standard Users</option>
                      <option value="premium">Premium Users</option>
                      <option value="platinum">Platinum Users</option>
                      <option value="specific">Specific User(s)</option>
                    </select>
                    <Users className="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>

                {/* Specific User Search & Multi-Select Container */}
                {sendToOption === "specific" && (
                  <div className="rounded-xl border border-white/10 bg-[#111827] p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-400">Select Target Users</span>
                      <button
                        type="button"
                        onClick={toggleSelectAllUsers}
                        className="text-[11px] font-semibold text-slate-400 hover:text-white transition"
                      >
                        {selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                      <input
                        type="text"
                        placeholder="Search users by name, username, or email..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-[#1e293b] pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    {/* Checkbox List */}
                    <div className="max-h-44 overflow-y-auto space-y-1 pr-1 border border-white/5 rounded-lg p-1 bg-[#0b1220]">
                      {loadingUsers ? (
                        <div className="flex items-center justify-center p-4 text-xs text-slate-400">
                          <Loader2 className="animate-spin mr-2" size={14} /> Loading directory...
                        </div>
                      ) : filteredUsers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          No users found.
                        </div>
                      ) : (
                        filteredUsers.map((user) => {
                          const isSelected = selectedUserIds.includes(user.id)
                          const displayName =
                            user.full_name || user.name || user.username || user.email
                          const subText =
                            user.email && displayName !== user.email
                              ? user.email
                              : user.membership_tier || user.membership || user.role || ""

                          return (
                            <div
                              key={user.id}
                              onClick={() => toggleUserSelection(user.id)}
                              className={`flex items-center justify-between rounded-md px-3 py-2 text-xs cursor-pointer transition ${
                                isSelected ? "bg-cyan-500/10 border border-cyan-500/30" : "hover:bg-white/5"
                              }`}
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <div className="truncate font-medium text-white">
                                  {displayName}
                                </div>
                                {subText && (
                                  <div className="truncate text-[10px] text-slate-400">{subText}</div>
                                )}
                              </div>
                              {isSelected ? (
                                <CheckSquare size={16} className="text-cyan-400 shrink-0" />
                              ) : (
                                <Square size={16} className="text-slate-500 shrink-0" />
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>Selected Count:</span>
                      <span className="font-bold text-cyan-400">{selectedUserIds.length} User(s)</span>
                    </div>
                  </div>
                )}

                {/* Optional Title Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Title (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Announcement Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#1e293b] px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                {/* Broadcast Body Textarea */}
                <div className="space-y-1.5">
                  <textarea
                    rows={4}
                    placeholder="Type your message broadcast here..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#1e293b] p-4 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none resize-none"
                  />
                </div>

                {/* Attachments Section */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Attachments
                  </label>

                  <div className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-[#1e293b] px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10 transition">
                      <Paperclip size={16} className="text-cyan-400" />
                      <span>Select Files</span>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    {attachments.length > 0 && (
                      <span className="text-xs text-slate-400">
                        {attachments.length} file(s) attached
                      </span>
                    )}
                  </div>

                  {attachments.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {attachments.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg bg-[#1e293b] px-3 py-2 text-xs text-slate-300"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText size={14} className="text-cyan-400 shrink-0" />
                            <span className="truncate">{file.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="text-slate-400 hover:text-red-400 transition"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSending}
                  className="rounded-xl px-5 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10 transition disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSendBroadcast}
                  disabled={isSending}
                  className="flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-xs font-bold text-black hover:bg-cyan-400 transition disabled:opacity-50"
                >
                  {isSending ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>{uploadingFiles ? "Uploading Files..." : "Sending..."}</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Send Broadcast</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}
      </main>
    </>
  )
}