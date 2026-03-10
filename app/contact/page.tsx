"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  Mail,
  MessageSquare,
  Send,
  User,
  FileText,
  LayoutDashboard,
  Paperclip,
  LogOut,
  Inbox,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

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

  const [conversation, setConversation] = useState<Conversation | null>(null)

  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [loadingUser, setLoadingUser] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    loadUserDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadUserDetails() {
    try {
      setLoadingUser(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoadingUser(false)
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

      const { data: existingConversation, error: conversationError } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (conversationError) {
        console.error("Failed to load conversation:", conversationError)
      } else {
        setConversation((existingConversation as Conversation) || null)
        if (existingConversation?.subject) {
          setSubject(existingConversation.subject)
        }
      }
    } catch (err) {
      console.error("Failed to load user details:", err)
    } finally {
      setLoadingUser(false)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!fullName.trim() || !email.trim()) {
      setError("Please complete your name and email.")
      setSuccess("")
      return
    }

    if (!conversation && !subject.trim()) {
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
        throw new Error("You must be logged in to send a message.")
      }

      let activeConversationId = conversation?.id ?? null
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

      if (!activeConversationId) {
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

        activeConversationId = newConversation.id
        setConversation(newConversation as Conversation)
      }

      const { error: insertError } = await supabase.from("conversation_messages").insert({
        conversation_id: activeConversationId,
        sender_id: user.id,
        sender_role: "user",
        body: message.trim() || null,
        attachment_url: attachmentUrl,
      })

      if (insertError) {
        throw new Error(`Message send failed: ${insertError.message}`)
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

      const fileInput = document.getElementById("attachment-input") as HTMLInputElement | null
      if (fileInput) fileInput.value = ""

      if (uploadWarning) {
        setSuccess("Your message was sent, but the attachment could not be uploaded.")
        setError("")
      } else {
        setSuccess("Your message has been sent successfully.")
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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="absolute left-[-80px] top-[-80px] h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="absolute bottom-[-80px] right-[-80px] h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl" />

      <div className="relative mx-auto max-w-7xl">
        {/* HERO */}
        <div className="mb-6 overflow-hidden rounded-[24px] bg-gradient-to-r from-cyan-600 via-sky-500 to-violet-600 p-5 shadow-2xl shadow-slate-300/40 sm:rounded-[30px] sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/90 sm:text-sm sm:tracking-[0.45em]">
              JB Collections
            </p>

            {/* DESKTOP NAV */}
            <div className="hidden items-center gap-3 lg:flex">
              <Link
                href="/dashboard"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[20px] bg-gradient-to-b from-blue-600 to-blue-700 px-5 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <LayoutDashboard size={18} />
                Dashboard
              </Link>

              <Link
                href="/profile"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[20px] bg-gradient-to-b from-blue-600 to-blue-700 px-5 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <User size={18} />
                Profile
              </Link>

              <Link
                href="/dashboard/inbox"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[20px] bg-gradient-to-b from-blue-600 to-blue-700 px-5 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <Inbox size={18} />
                Inbox
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[20px] bg-gradient-to-b from-red-500 to-red-600 px-5 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>

            {/* MOBILE HAMBURGER */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-xl text-white backdrop-blur lg:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>

          {/* MOBILE MENU */}
          {mobileMenuOpen && (
            <div className="mt-4 grid grid-cols-1 gap-3 lg:hidden">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-bold text-white shadow-lg shadow-blue-900/20"
              >
                <LayoutDashboard size={18} />
                Dashboard
              </Link>

              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-bold text-white shadow-lg shadow-blue-900/20"
              >
                <User size={18} />
                Profile
              </Link>

              <Link
                href="/dashboard/inbox"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-700 px-4 text-sm font-bold text-white shadow-lg shadow-blue-900/20"
              >
                <Inbox size={18} />
                Inbox
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-red-500 to-red-600 px-4 text-sm font-bold text-white shadow-lg shadow-red-900/20"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-md">
              <h1 className="text-3xl font-extrabold leading-tight text-white sm:text-5xl lg:text-[56px]">
                Message Admin
              </h1>

              <p className="mt-4 max-w-sm text-sm leading-7 text-white/90 sm:text-base lg:text-lg">
                Send your concern, request, or question to the admin in one place.
              </p>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="grid overflow-hidden rounded-[24px] border border-white/60 bg-white/75 shadow-2xl shadow-slate-200/50 backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr] lg:rounded-[32px]">
          {/* LEFT PANEL */}
          <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 p-6 text-white sm:p-10 lg:p-12">
            <div className="inline-flex items-center rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur">
              Contact Support
            </div>

            <h2 className="mt-6 text-3xl font-extrabold leading-tight sm:text-5xl">
              Message Admin
            </h2>

            <p className="mt-4 max-w-md text-sm leading-7 text-white/85 sm:text-base">
              Send your concern, request, or question to the admin. Your messages are now saved in one continuous conversation thread.
            </p>

            <div className="mt-8 space-y-4 sm:mt-10">
              <div className="flex items-start gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur">
                <div className="rounded-xl bg-white/15 p-3">
                  <Mail size={20} />
                </div>
                <div>
                  <p className="font-semibold">Fast communication</p>
                  <p className="mt-1 text-sm text-white/80">
                    Send concerns, requests, and questions in one place.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur">
                <div className="rounded-xl bg-white/15 p-3">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <p className="font-semibold">Messenger-style thread</p>
                  <p className="mt-1 text-sm text-white/80">
                    Your messages and admin replies now stay in one conversation.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur">
                <div className="rounded-xl bg-white/15 p-3">
                  <Send size={20} />
                </div>
                <div>
                  <p className="font-semibold">Simple and direct</p>
                  <p className="mt-1 text-sm text-white/80">
                    No extra steps — just fill in the form and send.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="p-5 sm:p-8 lg:p-12">
            <div className="mx-auto max-w-xl">
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {conversation ? "Continue Conversation" : "Start a Conversation"}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                {conversation
                  ? "Send another message to continue your existing thread with the admin."
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

                {!conversation && (
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
                )}

                {conversation && (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    <span className="font-bold">Current subject:</span>{" "}
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
                    className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send size={18} />
                    {sending || uploading
                      ? "Sending..."
                      : conversation
                        ? "Send to Conversation"
                        : "Start Conversation"}
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
    </main>
  )
}