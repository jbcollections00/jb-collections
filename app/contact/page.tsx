"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Mail, Send, User, FileText, Paperclip } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import SiteHeader from "@/app/components/SiteHeader"

type Profile = {
  id: string
  full_name: string | null
  email: string | null
}

type Conversation = {
  id: string
  user_id: string
  subject: string | null
  status: string
  created_at: string
  updated_at: string
}

const MAX_FILE_SIZE = 25 * 1024 * 1024

export default function ContactPage() {
  const supabase = createClient()
  const router = useRouter()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [attachment, setAttachment] = useState<File | null>(null)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)

  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [loadingUser, setLoadingUser] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    loadUserDetails()
  }, [])

  async function loadUserDetails() {
    try {
      setLoadingUser(true)
      setCheckingAuth(true)

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
        .single<Profile>()

      const displayName = profileData?.full_name || user.email?.split("@")[0] || ""
      const displayEmail = profileData?.email || user.email || ""

      setFullName(displayName)
      setEmail(displayEmail)

      const { data: existingConversations, error: conversationError } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })

      if (conversationError) {
        console.error("Failed to load conversations:", conversationError)
      } else {
        const rows = (existingConversations as Conversation[]) || []
        setConversations(rows)
        const latest = rows[0] || null
        setConversation(latest)
        setSubject(latest?.subject || "")
      }
    } catch (err) {
      console.error("Failed to load user details:", err)
      router.replace("/login")
    } finally {
      setLoadingUser(false)
      setCheckingAuth(false)
    }
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
    setConversation(null)
    setSubject("")
    setMessage("")
    setAttachment(null)
    setError("")
    setSuccess("")
    const fileInput = document.getElementById("attachment-input") as HTMLInputElement | null
    if (fileInput) fileInput.value = ""
  }

  function selectConversation(item: Conversation) {
    setConversation(item)
    setSubject(item.subject || "")
    setSuccess("")
    setError("")
  }

  const normalizedSubject = subject.trim().toLowerCase()

  const matchingConversation =
    !normalizedSubject
      ? null
      : conversations.find(
          (item) => (item.subject || "").trim().toLowerCase() === normalizedSubject
        ) || null

  async function handleSubmit(e: React.FormEvent) {
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
      setSending(true)
      setUploading(false)
      setError("")
      setSuccess("")

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace("/login")
        return
      }

      let activeConversation: Conversation | null = null
      let attachmentUrl: string | null = null
      let uploadWarning = ""

      if (attachment) {
        try {
          setUploading(true)
          attachmentUrl = await uploadAttachment(attachment)
        } catch (uploadErr) {
          uploadWarning =
            uploadErr instanceof Error
              ? uploadErr.message
              : "Attachment upload failed."
        } finally {
          setUploading(false)
        }
      }

      if (matchingConversation) {
        activeConversation = matchingConversation
      } else {
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

        activeConversation = newConversation as Conversation
      }

      if (!activeConversation) {
        throw new Error("Conversation ID is missing.")
      }

      const { error: insertError } = await supabase.from("conversation_messages").insert({
        conversation_id: activeConversation.id,
        sender_id: user.id,
        sender_role: "user",
        body: message.trim() || null,
        attachment_url: attachmentUrl,
      })

      if (insertError) {
        throw new Error(`Message send failed: ${insertError.message}`)
      }

      const { data: updatedConversation, error: updateConversationError } = await supabase
        .from("conversations")
        .update({
          updated_at: new Date().toISOString(),
          status: "open",
          subject: subject.trim(),
        })
        .eq("id", activeConversation.id)
        .select()
        .single()

      if (updateConversationError) {
        throw new Error(`Conversation update failed: ${updateConversationError.message}`)
      }

      setConversation(updatedConversation as Conversation)
      setMessage("")
      setAttachment(null)

      const fileInput = document.getElementById("attachment-input") as HTMLInputElement | null
      if (fileInput) fileInput.value = ""

      await loadUserDetails()

      if (uploadWarning) {
        setSuccess("Your message was sent, but the attachment could not be uploaded.")
        setError("")
      } else {
        setSuccess(
          matchingConversation
            ? "Your message was added to the matching conversation."
            : "Your message has been sent successfully."
        )
        setError("")
      }
    } catch (err) {
      const messageText =
        err instanceof Error
          ? err.message
          : "Something went wrong while sending your message."

      setError(messageText)
      setSuccess("")
    } finally {
      setSending(false)
      setUploading(false)
    }
  }

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
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Message Admin
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              Send your concern, request, or question to the admin in one place.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-extrabold text-slate-900">Conversations</h3>
                  <button
                    type="button"
                    onClick={startNewConversation}
                    className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
                  >
                    New
                  </button>
                </div>
              </div>

              <div className="max-h-[700px] overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-slate-500">
                    No conversations yet.
                  </div>
                ) : (
                  conversations.map((item) => {
                    const isActive = conversation?.id === item.id

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectConversation(item)}
                        className={`w-full border-b border-slate-100 px-5 py-4 text-left transition ${
                          isActive ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="truncate text-sm font-extrabold text-slate-900">
                          {item.subject || "No subject"}
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                          <span className="capitalize">{item.status || "open"}</span>
                          <span>
                            {new Date(item.updated_at || item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="p-5 sm:p-8 lg:p-12">
                <div className="mx-auto max-w-xl">
                  <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                    {conversation ? "Continue or Edit Conversation" : "Start a Conversation"}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                    {conversation
                      ? "Edit the subject or send another message. If the subject is different, a new conversation will be created automatically."
                      : "Fill out the form below to start a conversation with the admin."}
                  </p>

                  {(success || error) && (
                    <div
                      className={`mt-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
                        success
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      }`}
                    >
                      {success || error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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

                    {conversation && (
                      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                        <span className="font-bold">Selected conversation:</span>{" "}
                        {conversation.subject || "No subject"}
                      </div>
                    )}

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
                        disabled={sending || uploading}
                        className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Send size={18} />
                        {sending || uploading
                          ? "Sending..."
                          : matchingConversation
                            ? "Send to Matching Conversation"
                            : "Start New Conversation"}
                      </button>

                      <Link
                        href="/dashboard/inbox"
                        className="inline-flex h-14 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        Open Chat
                      </Link>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}