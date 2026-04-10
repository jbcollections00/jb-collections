"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  CornerDownLeft,
  Forward,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Reply,
  Search,
  Send,
  Smile,
  Trash2,
  User,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import SiteHeader from "@/app/components/SiteHeader"

type ConversationRow = {
  id: string
  created_by: string | null
  subject: string | null
  is_group: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type ConversationParticipantRow = {
  id: string
  conversation_id: string
  user_id: string
  joined_at: string
  last_read_at: string | null
  deleted_at: string | null
}

type ConversationMessageRow = {
  id: string
  conversation_id: string
  sender_id: string | null
  sender_role?: string | null
  body: string | null
  attachment_url: string | null
  created_at: string
  read_at: string | null
  deleted_at?: string | null
  edited_at?: string | null
  reply_to_message_id?: string | null
  forwarded_from_message_id?: string | null
  forwarded_by_user_id?: string | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  email: string | null
  username: string | null
  name: string | null
  role?: string | null
}

type PresenceRow = {
  user_id: string
  is_online: boolean
  last_seen_at: string | null
  updated_at: string
}

type TypingRow = {
  conversation_id: string
  user_id: string
  is_typing: boolean
  updated_at: string
}

type ConversationListItem = {
  conversation: ConversationRow
  participants: ConversationParticipantRow[]
  otherUser: ProfileRow | null
  lastMessage: ConversationMessageRow | null
  myParticipant: ConversationParticipantRow | null
  otherParticipant: ConversationParticipantRow | null
}

const MAX_FILE_SIZE = 25 * 1024 * 1024
const TYPING_STALE_MS = 6000
const PRESENCE_STALE_MS = 90000

const EMOJIS = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "🥰",
  "😘",
  "😎",
  "🙂",
  "😉",
  "🤗",
  "🤔",
  "😴",
  "😭",
  "😡",
  "👍",
  "👎",
  "👏",
  "🙌",
  "🙏",
  "💙",
  "❤️",
  "🔥",
  "🎉",
  "✨",
  "💯",
  "🤝",
  "👀",
  "😅",
]

export default function MessagesPage() {
  const supabase = createClient()
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messageActionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const actionMenuRef = useRef<HTMLDivElement | null>(null)
  const emojiPickerRef = useRef<HTMLDivElement | null>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessageRow[]>([])

  const [message, setMessage] = useState("")
  const [attachment, setAttachment] = useState<File | null>(null)

  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingChat, setDeletingChat] = useState(false)
  const [mobileChatsOpen, setMobileChatsOpen] = useState(false)

  const [userSearch, setUserSearch] = useState("")
  const [userResults, setUserResults] = useState<ProfileRow[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [startingChatUserId, setStartingChatUserId] = useState<string | null>(null)

  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceRow>>({})
  const [typingMap, setTypingMap] = useState<Record<string, TypingRow[]>>({})

  const [replyingTo, setReplyingTo] = useState<ConversationMessageRow | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [forwardingMessage, setForwardingMessage] = useState<ConversationMessageRow | null>(null)
  const [forwardSearch, setForwardSearch] = useState("")
  const [forwardUserSearch, setForwardUserSearch] = useState("")
  const [forwardUserResults, setForwardUserResults] = useState<ProfileRow[]>([])
  const [searchingForwardUsers, setSearchingForwardUsers] = useState(false)
  const [forwardingToConversationId, setForwardingToConversationId] = useState<string | null>(
    null
  )
  const [forwardingToUserId, setForwardingToUserId] = useState<string | null>(null)

  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const selectedConversation = useMemo(() => {
    return conversations.find((item) => item.conversation.id === selectedConversationId) || null
  }, [conversations, selectedConversationId])

  const messageMap = useMemo(() => {
    const next = new Map<string, ConversationMessageRow>()
    messages.forEach((item) => {
      next.set(item.id, item)
    })
    return next
  }, [messages])

  useEffect(() => {
    initializePage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`messenger-user-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        async () => {
          await loadConversations(userId, false)
          if (selectedConversationId) {
            await loadMessages(selectedConversationId, false)
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_participants" },
        async () => {
          await loadConversations(userId, false)
          if (selectedConversationId) {
            await loadMessages(selectedConversationId, false)
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_messages" },
        async () => {
          await loadConversations(userId, false)
          if (selectedConversationId) {
            await loadMessages(selectedConversationId, false)
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        async () => {
          await loadPresenceForCurrentConversations()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_typing" },
        async () => {
          await loadTypingStates()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId, selectedConversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    autoResizeTextarea()
  }, [message])

  useEffect(() => {
    if (!userId) return

    const term = userSearch.trim()

    if (!term) {
      setUserResults([])
      return
    }

    const timer = setTimeout(() => {
      void searchUsers(term)
    }, 250)

    return () => clearTimeout(timer)
  }, [userSearch, userId])

  useEffect(() => {
    if (!userId || !forwardingMessage) return

    const term = forwardUserSearch.trim()

    if (!term) {
      setForwardUserResults([])
      return
    }

    const timer = setTimeout(() => {
      void searchForwardUsers(term)
    }, 250)

    return () => clearTimeout(timer)
  }, [forwardUserSearch, userId, forwardingMessage])

  useEffect(() => {
    if (!selectedConversationId) return
    void markSelectedConversationRead(selectedConversationId)
  }, [selectedConversationId])

  useEffect(() => {
    if (!userId) return

    void supabase.rpc("set_my_presence", { p_is_online: true })

    const handleVisible = () => {
      void supabase.rpc("set_my_presence", { p_is_online: !document.hidden })
    }

    const handleBeforeUnload = () => {
      navigator.sendBeacon?.("")
    }

    document.addEventListener("visibilitychange", handleVisible)
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      document.removeEventListener("visibilitychange", handleVisible)
      window.removeEventListener("beforeunload", handleBeforeUnload)
      void supabase.rpc("set_my_presence", { p_is_online: false })
    }
  }, [supabase, userId])

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (messageActionTimerRef.current) {
        clearTimeout(messageActionTimerRef.current)
      }
      if (selectedConversationId) {
        void stopTyping(selectedConversationId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node

      if (actionMenuRef.current && !actionMenuRef.current.contains(target)) {
        setOpenMessageMenuId(null)
      }

      if (emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
        setShowEmojiPicker(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

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

      const loadedConversations = await loadConversations(user.id, false)
      await loadPresenceForCurrentConversations()

      if (loadedConversations.length > 0) {
        setSelectedConversationId(loadedConversations[0].conversation.id)
        await loadMessages(loadedConversations[0].conversation.id, false)
      } else {
        setSelectedConversationId(null)
        setMessages([])
      }

      await loadTypingStates()
    } catch (err) {
      console.error(err)
      setError("Failed to load messenger.")
    } finally {
      setLoading(false)
    }
  }

  async function loadConversations(activeUserId: string, withLoader = false) {
    if (withLoader) setLoading(true)

    try {
      const { data: myParticipantRows, error: myParticipantsError } = await supabase
        .from("conversation_participants")
        .select("*")
        .eq("user_id", activeUserId)
        .is("deleted_at", null)

      if (myParticipantsError) {
        throw myParticipantsError
      }

      const myParticipants = (myParticipantRows as ConversationParticipantRow[]) || []
      const conversationIds = myParticipants.map((item) => item.conversation_id)

      if (conversationIds.length === 0) {
        setConversations([])
        return []
      }

      const { data: conversationRows, error: conversationsError } = await supabase
        .from("conversations")
        .select("*")
        .in("id", conversationIds)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })

      if (conversationsError) {
        throw conversationsError
      }

      const conversationList = (conversationRows as ConversationRow[]) || []
      const validConversationIds = conversationList.map((item) => item.id)

      if (validConversationIds.length === 0) {
        setConversations([])
        return []
      }

      const { data: participantRows, error: participantsError } = await supabase
        .from("conversation_participants")
        .select("*")
        .in("conversation_id", validConversationIds)
        .is("deleted_at", null)

      if (participantsError) {
        throw participantsError
      }

      const allParticipants = (participantRows as ConversationParticipantRow[]) || []

      const { data: messageRows, error: messagesError } = await supabase
        .from("conversation_messages")
        .select("*")
        .in("conversation_id", validConversationIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })

      if (messagesError) {
        throw messagesError
      }

      const allMessages = (messageRows as ConversationMessageRow[]) || []

      const otherUserIds = Array.from(
        new Set(
          allParticipants
            .filter((item) => item.user_id !== activeUserId)
            .map((item) => item.user_id)
        )
      )

      let profileMap = new Map<string, ProfileRow>()

      if (otherUserIds.length > 0) {
        const { data: profileRows, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email, username, name, role")
          .in("id", otherUserIds)

        if (profilesError) {
          throw profilesError
        }

        const profiles = (profileRows as ProfileRow[]) || []
        profileMap = new Map(profiles.map((item) => [item.id, item]))
      }

      const nextConversations: ConversationListItem[] = conversationList.map((conversation) => {
        const participants = allParticipants.filter(
          (item) => item.conversation_id === conversation.id
        )

        const lastMessageForConversation =
          [...allMessages]
            .filter((item) => item.conversation_id === conversation.id)
            .sort(
              (a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )
            .at(-1) || null

        const myParticipant =
          participants.find((item) => item.user_id === activeUserId) || null

        const otherParticipant =
          participants.find((item) => item.user_id !== activeUserId) || null

        const otherUser = otherParticipant
          ? profileMap.get(otherParticipant.user_id) || null
          : null

        return {
          conversation,
          participants,
          otherUser,
          lastMessage: lastMessageForConversation,
          myParticipant,
          otherParticipant,
        }
      })

      setConversations(nextConversations)

      setSelectedConversationId((current) => {
        if (!current) return nextConversations[0]?.conversation.id || null
        const exists = nextConversations.some((item) => item.conversation.id === current)
        return exists ? current : nextConversations[0]?.conversation.id || null
      })

      return nextConversations
    } catch (err) {
      console.error("Load conversations error:", err)
      setError(err instanceof Error ? err.message : "Failed to load conversations.")
      return []
    } finally {
      if (withLoader) setLoading(false)
    }
  }

  async function loadMessages(conversationId: string, withLoader = false) {
    if (withLoader) setLoading(true)

    try {
      const { data, error } = await supabase
        .from("conversation_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })

      if (error) {
        throw error
      }

      setMessages((data as ConversationMessageRow[]) || [])
    } catch (err) {
      console.error("Load messages error:", err)
      setError(err instanceof Error ? err.message : "Failed to load messages.")
    } finally {
      if (withLoader) setLoading(false)
    }
  }

  async function loadPresenceForCurrentConversations() {
    try {
      const otherUserIds = Array.from(
        new Set(
          conversations
            .map((item) => item.otherParticipant?.user_id)
            .filter(Boolean)
        )
      ) as string[]

      if (otherUserIds.length === 0 && selectedConversation?.otherParticipant?.user_id) {
        otherUserIds.push(selectedConversation.otherParticipant.user_id)
      }

      if (otherUserIds.length === 0) {
        setPresenceMap({})
        return
      }

      const { data, error } = await supabase
        .from("user_presence")
        .select("*")
        .in("user_id", otherUserIds)

      if (error) {
        throw error
      }

      const rows = (data as PresenceRow[]) || []
      const nextMap: Record<string, PresenceRow> = {}

      rows.forEach((row) => {
        nextMap[row.user_id] = row
      })

      setPresenceMap(nextMap)
    } catch (err) {
      console.error("Load presence error:", err)
    }
  }

  async function loadTypingStates() {
    try {
      const conversationIds = conversations.map((item) => item.conversation.id)
      if (selectedConversationId && !conversationIds.includes(selectedConversationId)) {
        conversationIds.push(selectedConversationId)
      }

      if (conversationIds.length === 0) {
        setTypingMap({})
        return
      }

      const { data, error } = await supabase
        .from("conversation_typing")
        .select("*")
        .in("conversation_id", conversationIds)

      if (error) {
        throw error
      }

      const rows = ((data as TypingRow[]) || []).filter((row) => {
        if (!row.is_typing) return false
        return Date.now() - new Date(row.updated_at).getTime() < TYPING_STALE_MS
      })

      const nextMap: Record<string, TypingRow[]> = {}

      rows.forEach((row) => {
        if (!nextMap[row.conversation_id]) {
          nextMap[row.conversation_id] = []
        }
        nextMap[row.conversation_id].push(row)
      })

      setTypingMap(nextMap)
    } catch (err) {
      console.error("Load typing states error:", err)
    }
  }

  async function searchUsers(term: string) {
    try {
      setSearchingUsers(true)

      const safeTerm = term.trim()
      if (!safeTerm || !userId) {
        setUserResults([])
        return
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, username, name, role")
        .neq("id", userId)
        .or(
          `full_name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%,username.ilike.%${safeTerm}%,name.ilike.%${safeTerm}%`
        )
        .limit(12)

      if (error) {
        throw error
      }

      setUserResults((data as ProfileRow[]) || [])
    } catch (err) {
      console.error("Search users error:", err)
    } finally {
      setSearchingUsers(false)
    }
  }

  async function searchForwardUsers(term: string) {
    try {
      setSearchingForwardUsers(true)

      const safeTerm = term.trim()
      if (!safeTerm || !userId) {
        setForwardUserResults([])
        return
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, username, name, role")
        .neq("id", userId)
        .or(
          `full_name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%,username.ilike.%${safeTerm}%,name.ilike.%${safeTerm}%`
        )
        .limit(12)

      if (error) {
        throw error
      }

      setForwardUserResults((data as ProfileRow[]) || [])
    } catch (err) {
      console.error("Search forward users error:", err)
    } finally {
      setSearchingForwardUsers(false)
    }
  }

  async function startConversationWithUser(otherUserId: string) {
    try {
      setStartingChatUserId(otherUserId)
      setError("")
      setSuccess("")

      const { data, error } = await supabase.rpc("create_direct_conversation", {
        other_user_id: otherUserId,
      })

      if (error) {
        throw error
      }

      const newConversationId = String(data || "")
      if (!newConversationId) {
        throw new Error("Conversation was not created.")
      }

      const updated = await loadConversations(userId || "", false)
      setSelectedConversationId(newConversationId)
      await loadMessages(newConversationId, false)
      await loadPresenceForCurrentConversations()
      await loadTypingStates()

      if (!updated.some((item) => item.conversation.id === newConversationId)) {
        await loadConversations(userId || "", false)
      }

      setUserSearch("")
      setUserResults([])
      setMobileChatsOpen(false)
      setSuccess("Conversation ready.")
    } catch (err) {
      console.error("Start conversation error:", err)
      setError(err instanceof Error ? err.message : "Failed to start conversation.")
    } finally {
      setStartingChatUserId(null)
    }
  }

  async function markSelectedConversationRead(conversationId: string) {
    try {
      await supabase.rpc("mark_conversation_read", {
        p_conversation_id: conversationId,
      })

      if (userId) {
        await loadConversations(userId, false)
      }
    } catch (err) {
      console.error("Mark read error:", err)
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

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault()

    if (!userId) {
      setError("You must be logged in.")
      return
    }

    if (!selectedConversationId) {
      setError("Please select or start a conversation first.")
      return
    }

    if (!message.trim() && !attachment && !editingMessageId) {
      setError("Please write a message or attach a file.")
      return
    }

    try {
      setSending(true)
      setError("")
      setSuccess("")
      setOpenMessageMenuId(null)

      if (editingMessageId) {
        const trimmed = message.trim()

        if (!trimmed) {
          setError("Edited message cannot be empty.")
          return
        }

        const { error: editError } = await supabase
          .from("conversation_messages")
          .update({
            body: trimmed,
            edited_at: new Date().toISOString(),
          })
          .eq("id", editingMessageId)
          .eq("sender_id", userId)

        if (editError) {
          throw editError
        }

        await supabase
          .from("conversations")
          .update({
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedConversationId)

        setMessage("")
        setAttachment(null)
        setEditingMessageId(null)
        setReplyingTo(null)
        setSuccess("Message edited.")
        await loadMessages(selectedConversationId, false)
        await loadConversations(userId, false)
        return
      }

      let attachmentUrl: string | null = null

      if (attachment) {
        try {
          setUploading(true)
          attachmentUrl = await uploadAttachment(attachment)
        } finally {
          setUploading(false)
        }
      }

      const { error: messageError } = await supabase
        .from("conversation_messages")
        .insert({
          conversation_id: selectedConversationId,
          sender_id: userId,
          sender_role: "user",
          body: message.trim() || null,
          attachment_url: attachmentUrl,
          reply_to_message_id: replyingTo?.id || null,
          forwarded_from_message_id: null,
          forwarded_by_user_id: null,
        })

      if (messageError) {
        throw messageError
      }

      await supabase
        .from("conversations")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedConversationId)

      await stopTyping(selectedConversationId)

      setMessage("")
      setAttachment(null)
      setReplyingTo(null)
      setSuccess("Message sent.")
      setMobileChatsOpen(false)

      const fileInput = document.getElementById("attachment-input") as HTMLInputElement | null
      if (fileInput) fileInput.value = ""

      await loadMessages(selectedConversationId, false)
      if (userId) {
        await loadConversations(userId, false)
      }
    } catch (err) {
      console.error("Send message error:", err)
      setError(err instanceof Error ? err.message : "Failed to send message.")
      setSuccess("")
    } finally {
      setSending(false)
      setUploading(false)
    }
  }

  async function deleteMyMessage(messageId: string, senderId: string | null) {
    try {
      if (!userId || userId !== senderId) {
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
        .eq("sender_id", userId)
        .select("id")

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        alert("Message was not updated. Check your RLS policy.")
        return
      }

      if (editingMessageId === messageId) {
        cancelEditing()
      }

      if (replyingTo?.id === messageId) {
        setReplyingTo(null)
      }

      setOpenMessageMenuId(null)

      if (selectedConversationId) {
        await loadMessages(selectedConversationId, false)
      }

      if (userId) {
        await loadConversations(userId, false)
      }
    } catch (err) {
      console.error("Delete message error:", err)
      alert(err instanceof Error ? err.message : "Failed to delete message.")
    }
  }

  async function deleteConversationForMe() {
    try {
      if (!selectedConversationId || !userId) {
        alert("No conversation found.")
        return
      }

      const ok = window.confirm(
        "Hide this conversation from your inbox? The other user will still keep their copy."
      )
      if (!ok) return

      setDeletingChat(true)
      setError("")
      setSuccess("")

      const { error } = await supabase
        .from("conversation_participants")
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq("conversation_id", selectedConversationId)
        .eq("user_id", userId)

      if (error) {
        throw error
      }

      const updated = await loadConversations(userId, false)
      await loadPresenceForCurrentConversations()
      await loadTypingStates()

      if (updated.length > 0) {
        const nextId = updated[0].conversation.id
        setSelectedConversationId(nextId)
        await loadMessages(nextId, false)
      } else {
        setSelectedConversationId(null)
        setMessages([])
      }

      cancelEditing()
      setReplyingTo(null)
      setOpenMessageMenuId(null)
      setSuccess("Conversation removed from your inbox.")
      setMobileChatsOpen(false)
    } catch (err) {
      console.error("Delete conversation error:", err)
      setError(err instanceof Error ? err.message : "Failed to remove conversation.")
    } finally {
      setDeletingChat(false)
    }
  }

  async function startTyping(conversationId: string) {
    try {
      await supabase.rpc("set_typing_state", {
        p_conversation_id: conversationId,
        p_is_typing: true,
      })
    } catch (err) {
      console.error("Start typing error:", err)
    }
  }

  async function stopTyping(conversationId: string) {
    try {
      await supabase.rpc("set_typing_state", {
        p_conversation_id: conversationId,
        p_is_typing: false,
      })
    } catch (err) {
      console.error("Stop typing error:", err)
    }
  }

  function autoResizeTextarea() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!sending && !uploading) {
        void handleSendMessage()
      }
    }
  }

  function handleMessageChange(value: string) {
    setMessage(value)

    if (!selectedConversationId) return

    void startTyping(selectedConversationId)

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      void stopTyping(selectedConversationId)
    }, 1800)
  }

  function startReply(messageRow: ConversationMessageRow) {
    setEditingMessageId(null)
    setReplyingTo(messageRow)
    setMessage("")
    setAttachment(null)
    setOpenMessageMenuId(null)
    textareaRef.current?.focus()
  }

  function startEditing(messageRow: ConversationMessageRow) {
    if (messageRow.sender_id !== userId) return
    setReplyingTo(null)
    setEditingMessageId(messageRow.id)
    setAttachment(null)
    setMessage(messageRow.body || "")
    setOpenMessageMenuId(null)
    textareaRef.current?.focus()
  }

  function cancelEditing() {
    setEditingMessageId(null)
    setMessage("")
  }

  function openForwardModal(messageRow: ConversationMessageRow) {
    setForwardingMessage(messageRow)
    setForwardSearch("")
    setForwardUserSearch("")
    setForwardUserResults([])
    setOpenMessageMenuId(null)
  }

  function closeForwardModal() {
    setForwardingMessage(null)
    setForwardSearch("")
    setForwardUserSearch("")
    setForwardUserResults([])
    setForwardingToConversationId(null)
    setForwardingToUserId(null)
  }

  async function forwardToConversation(targetConversationId: string) {
    try {
      if (!userId || !forwardingMessage) return

      setForwardingToConversationId(targetConversationId)
      setError("")
      setSuccess("")

      const { error: insertError } = await supabase
        .from("conversation_messages")
        .insert({
          conversation_id: targetConversationId,
          sender_id: userId,
          sender_role: "user",
          body: forwardingMessage.body || null,
          attachment_url: forwardingMessage.attachment_url || null,
          forwarded_from_message_id: forwardingMessage.id,
          forwarded_by_user_id: userId,
          reply_to_message_id: null,
        })

      if (insertError) {
        throw insertError
      }

      await supabase
        .from("conversations")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetConversationId)

      await loadConversations(userId, false)

      if (selectedConversationId === targetConversationId) {
        await loadMessages(targetConversationId, false)
      }

      closeForwardModal()
      setSuccess("Message forwarded.")
    } catch (err) {
      console.error("Forward to conversation error:", err)
      setError(err instanceof Error ? err.message : "Failed to forward message.")
    } finally {
      setForwardingToConversationId(null)
    }
  }

  async function forwardToUser(targetUserId: string) {
    try {
      if (!userId || !forwardingMessage) return

      setForwardingToUserId(targetUserId)
      setError("")
      setSuccess("")

      const { data, error } = await supabase.rpc("create_direct_conversation", {
        other_user_id: targetUserId,
      })

      if (error) {
        throw error
      }

      const targetConversationId = String(data || "")
      if (!targetConversationId) {
        throw new Error("Conversation was not created.")
      }

      const { error: insertError } = await supabase
        .from("conversation_messages")
        .insert({
          conversation_id: targetConversationId,
          sender_id: userId,
          sender_role: "user",
          body: forwardingMessage.body || null,
          attachment_url: forwardingMessage.attachment_url || null,
          forwarded_from_message_id: forwardingMessage.id,
          forwarded_by_user_id: userId,
          reply_to_message_id: null,
        })

      if (insertError) {
        throw insertError
      }

      await supabase
        .from("conversations")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetConversationId)

      await loadConversations(userId, false)

      closeForwardModal()
      setSuccess("Message forwarded.")
    } catch (err) {
      console.error("Forward to user error:", err)
      setError(err instanceof Error ? err.message : "Failed to forward message.")
    } finally {
      setForwardingToUserId(null)
    }
  }

  function startLongPressForMessage(messageId: string) {
    if (messageActionTimerRef.current) {
      clearTimeout(messageActionTimerRef.current)
    }

    messageActionTimerRef.current = setTimeout(() => {
      setOpenMessageMenuId(messageId)
    }, 450)
  }

  function cancelLongPress() {
    if (messageActionTimerRef.current) {
      clearTimeout(messageActionTimerRef.current)
      messageActionTimerRef.current = null
    }
  }

  function appendEmoji(emoji: string) {
    setMessage((prev) => `${prev}${emoji}`)
    setShowEmojiPicker(false)
    textareaRef.current?.focus()
  }

  function formatTime(dateString: string) {
    return new Date(dateString).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  function formatLastSeen(dateString: string | null) {
    if (!dateString) return "Offline"

    const diff = Date.now() - new Date(dateString).getTime()
    const mins = Math.floor(diff / 60000)

    if (mins < 1) return "Last seen just now"
    if (mins < 60) return `Last seen ${mins} min ago`

    const hours = Math.floor(mins / 60)
    if (hours < 24) return `Last seen ${hours}h ago`

    const days = Math.floor(hours / 24)
    return `Last seen ${days}d ago`
  }

  function getAttachmentName(url: string) {
    try {
      return decodeURIComponent(url.split("/").pop() || "attachment")
    } catch {
      return "attachment"
    }
  }

  function getDisplayName(profile: ProfileRow | null) {
    if (!profile) return "Unknown user"
    return profile.full_name || profile.name || profile.username || profile.email || "Unknown user"
  }

  function getSubtitle(profile: ProfileRow | null) {
    if (!profile) return "Messenger user"
    return profile.username || profile.email || "Messenger user"
  }

  function isOnline(userIdToCheck: string | null | undefined) {
    if (!userIdToCheck) return false
    const presence = presenceMap[userIdToCheck]
    if (!presence) return false
    if (!presence.is_online) return false
    return Date.now() - new Date(presence.updated_at).getTime() < PRESENCE_STALE_MS
  }

  function getPresenceText(userIdToCheck: string | null | undefined) {
    if (!userIdToCheck) return "Offline"
    const presence = presenceMap[userIdToCheck]
    if (!presence) return "Offline"
    if (isOnline(userIdToCheck)) return "Active now"
    return formatLastSeen(presence.last_seen_at)
  }

  function getMessagePreviewText(item: ConversationMessageRow | null) {
    if (!item) return "Message"

    if (item.body?.trim()) return item.body
    if (item.attachment_url) return "Attachment"
    return "Message"
  }

  const filteredConversations = useMemo(() => {
    return conversations
  }, [conversations])

  const filteredForwardConversations = useMemo(() => {
    const term = forwardSearch.trim().toLowerCase()

    return conversations.filter((item) => {
      if (item.conversation.id === selectedConversationId) return false
      if (!term) return true

      const name = getDisplayName(item.otherUser).toLowerCase()
      const subtitle = getSubtitle(item.otherUser).toLowerCase()
      return name.includes(term) || subtitle.includes(term)
    })
  }, [conversations, forwardSearch, selectedConversationId])

  const lastMyMessage = useMemo(() => {
    if (!userId) return null
    const mine = messages.filter((item) => item.sender_id === userId)
    return mine.length > 0 ? mine[mine.length - 1] : null
  }, [messages, userId])

  const lastSeenByOther = useMemo(() => {
    if (!selectedConversation?.otherParticipant?.last_read_at || !lastMyMessage) return false

    return (
      new Date(selectedConversation.otherParticipant.last_read_at).getTime() >=
      new Date(lastMyMessage.created_at).getTime()
    )
  }, [selectedConversation, lastMyMessage])

  const otherTyping = useMemo(() => {
    if (!selectedConversationId || !userId) return false
    const rows = typingMap[selectedConversationId] || []
    return rows.some(
      (row) =>
        row.user_id !== userId &&
        row.is_typing &&
        Date.now() - new Date(row.updated_at).getTime() < TYPING_STALE_MS
    )
  }, [typingMap, selectedConversationId, userId])

  return (
    <>
      <SiteHeader />

      <main className="min-h-screen bg-[#020617] pt-24 text-white sm:pt-28">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.18),_transparent_30%),linear-gradient(180deg,_#030712_0%,_#020617_45%,_#061229_100%)]" />

        <div className="mx-auto w-full max-w-[1800px] px-4 pb-6 sm:px-6 sm:pb-8 lg:px-8">
          <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04] shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <div className="grid min-h-[calc(100vh-8rem)] grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
              <aside className="hidden border-r border-white/10 bg-[#0b1220]/80 lg:flex lg:flex-col">
                <div className="border-b border-white/10 px-5 py-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-300/80">
                    Messenger
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white">Chats</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Find users and message them directly
                  </p>
                </div>

                <div className="border-b border-white/10 p-4">
                  <div className="relative">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search users to start a chat..."
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-400 focus:border-sky-400"
                    />
                  </div>

                  {(userSearch.trim() || searchingUsers || userResults.length > 0) && (
                    <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.04]">
                      {searchingUsers ? (
                        <div className="px-4 py-3 text-sm text-slate-300">Searching users...</div>
                      ) : userResults.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-300">No users found.</div>
                      ) : (
                        userResults.map((profile) => (
                          <button
                            key={profile.id}
                            type="button"
                            onClick={() => void startConversationWithUser(profile.id)}
                            disabled={startingChatUserId === profile.id}
                            className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/[0.05] disabled:opacity-60"
                          >
                            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-slate-200">
                              <User size={16} />
                              {isOnline(profile.id) && (
                                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0b1220] bg-emerald-400" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-bold text-white">
                                {getDisplayName(profile)}
                              </div>
                              <div className="truncate text-xs text-slate-400">
                                {isOnline(profile.id) ? "Active now" : getSubtitle(profile)}
                              </div>
                            </div>

                            <div className="text-xs font-semibold text-sky-300">
                              {startingChatUserId === profile.id ? "Opening..." : "Message"}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  {loading ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-300">
                      Loading conversations...
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-slate-300">
                      No conversations yet. Search a user above to start chatting.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredConversations.map((item) => {
                        const active = item.conversation.id === selectedConversationId
                        const otherName = getDisplayName(item.otherUser)
                        const otherId = item.otherParticipant?.user_id || null
                        const subtitle = (() => {
                          const typingRows = typingMap[item.conversation.id] || []
                          const isTyping = typingRows.some(
                            (row) =>
                              row.user_id !== userId &&
                              row.is_typing &&
                              Date.now() - new Date(row.updated_at).getTime() < TYPING_STALE_MS
                          )

                          if (isTyping) return "Typing..."
                          if (item.lastMessage?.forwarded_from_message_id) {
                            return `Forwarded: ${getMessagePreviewText(item.lastMessage)}`
                          }
                          if (item.lastMessage?.body?.trim()) return item.lastMessage.body
                          if (item.lastMessage?.attachment_url) return "Attachment sent"
                          return "Start a conversation"
                        })()

                        return (
                          <button
                            key={item.conversation.id}
                            type="button"
                            onClick={() => {
                              setSelectedConversationId(item.conversation.id)
                              void loadMessages(item.conversation.id, false)
                              setMobileChatsOpen(false)
                              setOpenMessageMenuId(null)
                            }}
                            className={`flex w-full items-center gap-3 rounded-[24px] border px-4 py-4 text-left transition ${
                              active
                                ? "border-sky-400/20 bg-sky-500/10"
                                : "border-transparent bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.05]"
                            }`}
                          >
                            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white shadow-lg shadow-blue-950/40">
                              <User size={18} />
                              {isOnline(otherId) && (
                                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#0b1220] bg-emerald-400" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="truncate text-base font-bold text-white">
                                {otherName}
                              </div>
                              <div className="mt-1 truncate text-sm text-slate-300">
                                {subtitle}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </aside>

              <section className="flex min-h-[calc(100vh-8rem)] flex-col">
                <div className="border-b border-white/10 bg-[#0b1220]/70 px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setMobileChatsOpen(true)}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sky-300 transition hover:bg-white/[0.1] lg:hidden"
                        aria-label="Open chats"
                      >
                        <MessageSquare size={18} />
                      </button>

                      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white shadow-lg shadow-blue-950/40">
                        {selectedConversation ? <User size={20} /> : <MessageSquare size={20} />}
                        {selectedConversation?.otherParticipant?.user_id &&
                          isOnline(selectedConversation.otherParticipant.user_id) && (
                            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#0b1220] bg-emerald-400" />
                          )}
                      </div>

                      <div className="min-w-0">
                        <h1 className="truncate text-xl font-black text-white sm:text-2xl">
                          {selectedConversation
                            ? getDisplayName(selectedConversation.otherUser)
                            : "Messenger"}
                        </h1>
                        <p className="truncate text-sm text-emerald-300">
                          {selectedConversation?.otherParticipant?.user_id
                            ? getPresenceText(selectedConversation.otherParticipant.user_id)
                            : "Search a user to start a chat"}
                        </p>
                      </div>
                    </div>

                    {selectedConversation && (
                      <button
                        type="button"
                        onClick={() => void deleteConversationForMe()}
                        disabled={deletingChat}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-red-400/20 bg-red-500/10 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 size={16} />
                        <span className="hidden sm:inline">
                          {deletingChat ? "Removing..." : "Hide Chat"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.01)_0%,rgba(255,255,255,0.00)_100%)] px-3 py-4 sm:px-5">
                  {loading ? (
                    <div className="mx-auto max-w-3xl rounded-[24px] border border-white/10 bg-white/[0.05] p-4 text-sm text-slate-300 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                      Loading messenger...
                    </div>
                  ) : !selectedConversation ? (
                    <div className="mx-auto mt-14 max-w-xl rounded-[30px] border border-white/10 bg-white/[0.05] px-6 py-12 text-center shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sky-500/10 text-sky-300">
                        <MessageSquare size={34} />
                      </div>
                      <h3 className="mt-5 text-3xl font-black text-white">Start messaging</h3>
                      <p className="mx-auto mt-3 max-w-md text-base leading-7 text-slate-300">
                        Search a user from the left side and start a real-time conversation.
                      </p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="mx-auto mt-14 max-w-xl rounded-[30px] border border-white/10 bg-white/[0.05] px-6 py-12 text-center shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sky-500/10 text-sky-300">
                        <User size={34} />
                      </div>
                      <h3 className="mt-5 text-3xl font-black text-white">
                        Message {getDisplayName(selectedConversation.otherUser)}
                      </h3>
                      <p className="mx-auto mt-3 max-w-md text-base leading-7 text-slate-300">
                        This conversation is empty. Say hello and start chatting.
                      </p>
                    </div>
                  ) : (
                    <div className="mx-auto max-w-4xl space-y-4">
                      {messages.map((item, index) => {
                        const isMine = item.sender_id === userId
                        const previous = messages[index - 1]
                        const next = messages[index + 1]
                        const showAvatar = !previous || previous.sender_id !== item.sender_id
                        const isLastOfGroup = !next || next.sender_id !== item.sender_id
                        const isMyLatest = !!lastMyMessage && isMine && item.id === lastMyMessage.id
                        const repliedMessage = item.reply_to_message_id
                          ? messageMap.get(item.reply_to_message_id) || null
                          : null
                        const forwardedMessage = item.forwarded_from_message_id
                          ? messageMap.get(item.forwarded_from_message_id) || null
                          : null
                        const isEditingThis = editingMessageId === item.id
                        const isMenuOpen = openMessageMenuId === item.id

                        return (
                          <div
                            key={item.id}
                            className={`group flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}
                          >
                            {!isMine && (
                              <div className="w-8 shrink-0">
                                {showAvatar ? (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white shadow-md">
                                    <CornerDownLeft size={14} />
                                  </div>
                                ) : null}
                              </div>
                            )}

                            <div
                              className={`relative max-w-[92%] sm:max-w-[78%] ${isMine ? "order-1" : ""}`}
                              onMouseDown={() => startLongPressForMessage(item.id)}
                              onMouseUp={cancelLongPress}
                              onMouseLeave={cancelLongPress}
                              onTouchStart={() => startLongPressForMessage(item.id)}
                              onTouchEnd={cancelLongPress}
                              onTouchCancel={cancelLongPress}
                            >
                              {!isMine && showAvatar ? (
                                <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                  {getDisplayName(selectedConversation.otherUser)}
                                </div>
                              ) : null}

                              <div className={`relative ${isMine ? "pr-12" : "pl-12"}`}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenMessageMenuId((current) =>
                                      current === item.id ? null : item.id
                                    )
                                  }
                                  className={`absolute top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#091220]/90 text-slate-200 shadow-lg transition hover:bg-[#10203b] ${
                                    isMine
                                      ? "left-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                      : "right-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                  }`}
                                  aria-label="Open message actions"
                                >
                                  <MoreHorizontal size={16} />
                                </button>

                                {isMenuOpen && (
                                  <div
                                    ref={actionMenuRef}
                                    className={`absolute top-12 z-30 w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#091220]/95 shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur-md ${
                                      isMine ? "left-0" : "right-0"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => startReply(item)}
                                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-white/[0.06]"
                                    >
                                      <Reply size={15} />
                                      Reply
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => openForwardModal(item)}
                                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-white/[0.06]"
                                    >
                                      <Forward size={15} />
                                      Forward
                                    </button>

                                    {isMine && (
                                      <button
                                        type="button"
                                        onClick={() => startEditing(item)}
                                        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-white/[0.06]"
                                      >
                                        <Pencil size={15} />
                                        {isEditingThis ? "Editing" : "Edit"}
                                      </button>
                                    )}

                                    {isMine && (
                                      <button
                                        type="button"
                                        onClick={() => void deleteMyMessage(item.id, item.sender_id)}
                                        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-300 transition hover:bg-red-500/10"
                                      >
                                        <Trash2 size={15} />
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                )}

                                <div
                                  className={`rounded-3xl px-4 py-3 text-sm shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-all ${
                                    isMine
                                      ? "rounded-br-lg bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white"
                                      : "rounded-bl-lg border border-white/10 bg-white/[0.07] text-slate-100"
                                  }`}
                                >
                                  {item.forwarded_from_message_id && (
                                    <div
                                      className={`mb-3 rounded-2xl border px-3 py-2 text-xs font-semibold ${
                                        isMine
                                          ? "border-white/20 bg-white/10 text-white/90"
                                          : "border-sky-400/30 bg-sky-500/10 text-sky-200"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1">
                                        <Forward size={12} />
                                        <span>Forwarded message</span>
                                      </div>
                                      {forwardedMessage && (
                                        <div className="mt-1 line-clamp-2 opacity-90">
                                          {getMessagePreviewText(forwardedMessage)}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {repliedMessage && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const el = document.getElementById(`msg-${repliedMessage.id}`)
                                        el?.scrollIntoView({ behavior: "smooth", block: "center" })
                                      }}
                                      className={`mb-3 block w-full rounded-2xl border px-3 py-2.5 text-left text-xs shadow-inner transition ${
                                        isMine
                                          ? "border-cyan-200/30 bg-gradient-to-r from-white/20 to-cyan-300/10 text-white"
                                          : "border-sky-400/35 bg-gradient-to-r from-sky-500/18 to-cyan-400/10 text-sky-100"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1 font-bold">
                                        <Reply size={12} />
                                        <span>Replying to</span>
                                      </div>
                                      <div className="mt-1.5 line-clamp-2 font-medium opacity-95">
                                        {getMessagePreviewText(repliedMessage)}
                                      </div>
                                    </button>
                                  )}

                                  <div id={`msg-${item.id}`}>
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
                                            isMine
                                              ? "bg-white/15 text-white"
                                              : "bg-sky-500/10 text-sky-300"
                                          }`}
                                        >
                                          <Paperclip size={14} className="shrink-0" />
                                          <span className="truncate">
                                            {getAttachmentName(item.attachment_url)}
                                          </span>
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div
                                className={`mt-1 flex flex-wrap items-center gap-2 px-2 text-[11px] text-slate-400 ${
                                  isMine ? "justify-end" : "justify-start"
                                }`}
                              >
                                <span>{formatTime(item.created_at)}</span>

                                {item.edited_at && (
                                  <span className="font-medium text-slate-400">(edited)</span>
                                )}

                                {isMine && isMyLatest && isLastOfGroup && (
                                  <span className="font-medium text-slate-400">
                                    {lastSeenByOther ? "Seen" : "Sent"}
                                  </span>
                                )}
                              </div>
                            </div>

                            {isMine && (
                              <div className="w-8 shrink-0">
                                {showAvatar ? (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-slate-200">
                                    <User size={14} />
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {otherTyping && (
                        <div className="flex items-end gap-2 justify-start">
                          <div className="w-8 shrink-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white shadow-md">
                              <CornerDownLeft size={14} />
                            </div>
                          </div>

                          <div className="rounded-3xl rounded-bl-lg border border-white/10 bg-white/[0.07] px-4 py-3 text-sm text-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
                            <div className="flex items-center gap-1">
                              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.3s]" />
                              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.15s]" />
                              <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-300" />
                            </div>
                          </div>
                        </div>
                      )}

                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 bg-[#0b1220]/70 px-3 py-3 sm:px-5">
                  <div className="mx-auto max-w-4xl">
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

                    {(replyingTo || editingMessageId) && (
                      <div className="mb-3 rounded-[24px] border border-sky-400/30 bg-gradient-to-r from-sky-500/12 to-cyan-400/10 px-4 py-3 shadow-[0_0_0_1px_rgba(56,189,248,0.12)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-bold uppercase tracking-[0.16em] text-sky-300">
                              {editingMessageId ? "Editing message" : "Replying to message"}
                            </div>
                            <div className="mt-1 line-clamp-2 text-sm font-medium text-slate-100">
                              {editingMessageId
                                ? getMessagePreviewText(messageMap.get(editingMessageId) || null)
                                : getMessagePreviewText(replyingTo)}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo(null)
                              cancelEditing()
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-white/[0.08]"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleSendMessage} className="space-y-3">
                      <div className="relative rounded-[30px] border border-white/10 bg-white/[0.05] p-2 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                        <div className="flex items-end gap-2">
                          <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-sky-300 transition hover:bg-white/[0.08]">
                            <Paperclip size={20} />
                            <input
                              id="attachment-input"
                              type="file"
                              onChange={handleAttachmentChange}
                              className="hidden"
                              disabled={!selectedConversationId || !!editingMessageId}
                            />
                          </label>

                          <div className="relative" ref={emojiPickerRef}>
                            <button
                              type="button"
                              onClick={() => setShowEmojiPicker((prev) => !prev)}
                              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sky-300 transition hover:bg-white/[0.08]"
                              title="Open emoji picker"
                            >
                              <Smile size={20} />
                            </button>

                            {showEmojiPicker && (
                              <div className="absolute bottom-14 left-0 z-30 w-72 rounded-[24px] border border-white/10 bg-[#091220]/95 p-3 shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur-md">
                                <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-sky-300">
                                  Emoticons
                                </div>
                                <div className="grid grid-cols-6 gap-2">
                                  {EMOJIS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => appendEmoji(emoji)}
                                      className="flex h-10 w-10 items-center justify-center rounded-2xl text-xl transition hover:bg-white/[0.08]"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <textarea
                            ref={textareaRef}
                            value={message}
                            onChange={(e) => handleMessageChange(e.target.value)}
                            onKeyDown={handleTextareaKeyDown}
                            placeholder={
                              editingMessageId
                                ? "Edit your message..."
                                : selectedConversationId
                                  ? `Message ${getDisplayName(selectedConversation?.otherUser || null)}...`
                                  : "Select or start a conversation first..."
                            }
                            rows={1}
                            disabled={!selectedConversationId}
                            className="min-h-[44px] max-h-[140px] flex-1 resize-none overflow-y-auto bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                          />

                          <button
                            type="submit"
                            disabled={sending || uploading || !selectedConversationId}
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                            title={editingMessageId ? "Save edit" : "Send message"}
                          >
                            {editingMessageId ? <Check size={18} /> : <Send size={18} />}
                          </button>
                        </div>

                        {attachment && !editingMessageId && (
                          <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-white/[0.06] px-3 py-2 text-xs font-medium text-slate-200">
                            <span className="truncate">Attached: {attachment.name}</span>
                            <button
                              type="button"
                              onClick={() => setAttachment(null)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-300 hover:bg-white/[0.08]"
                              aria-label="Remove attachment"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="px-1 text-xs text-slate-400">
                        {uploading
                          ? "Uploading attachment..."
                          : editingMessageId
                            ? "Edit mode is active. Press the check button or Enter to save."
                            : otherTyping
                              ? `${getDisplayName(selectedConversation?.otherUser || null)} is typing...`
                              : "Press Enter to send. Press Shift + Enter for new line. Long-press or use the 3-dot button on messages for actions."}
                      </div>
                    </form>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>

        {mobileChatsOpen && (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <button
              type="button"
              onClick={() => setMobileChatsOpen(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              aria-label="Close chats"
            />

            <div className="absolute left-0 top-0 h-full w-[88%] max-w-sm border-r border-white/10 bg-[#020617] shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
              <div className="border-b border-white/10 px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-300/80">
                      Messenger
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">Chats</h2>
                    <p className="mt-1 text-sm text-slate-300">
                      Find users and message them directly
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMobileChatsOpen(false)}
                    className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="border-b border-white/10 p-4">
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-400 focus:border-sky-400"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {userResults.length > 0 && (
                  <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                    {userResults.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => void startConversationWithUser(profile.id)}
                        disabled={startingChatUserId === profile.id}
                        className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/[0.05] disabled:opacity-60"
                      >
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-slate-200">
                          <User size={16} />
                          {isOnline(profile.id) && (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#020617] bg-emerald-400" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-white">
                            {getDisplayName(profile)}
                          </div>
                          <div className="truncate text-xs text-slate-400">
                            {isOnline(profile.id) ? "Active now" : getSubtitle(profile)}
                          </div>
                        </div>

                        <div className="text-xs font-semibold text-sky-300">
                          {startingChatUserId === profile.id ? "Opening..." : "Message"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {filteredConversations.length === 0 ? (
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.05] px-4 py-5 text-sm text-slate-300">
                    No conversations yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredConversations.map((item) => {
                      const otherId = item.otherParticipant?.user_id || null
                      const typingRows = typingMap[item.conversation.id] || []
                      const isTyping = typingRows.some(
                        (row) =>
                          row.user_id !== userId &&
                          row.is_typing &&
                          Date.now() - new Date(row.updated_at).getTime() < TYPING_STALE_MS
                      )

                      return (
                        <button
                          key={item.conversation.id}
                          type="button"
                          onClick={() => {
                            setSelectedConversationId(item.conversation.id)
                            void loadMessages(item.conversation.id, false)
                            setMobileChatsOpen(false)
                            setOpenMessageMenuId(null)
                          }}
                          className="flex w-full items-center gap-3 rounded-[24px] border border-sky-400/20 bg-sky-500/10 px-4 py-4 text-left transition hover:bg-sky-500/15"
                        >
                          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white shadow-lg shadow-blue-950/40">
                            <User size={18} />
                            {isOnline(otherId) && (
                              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#020617] bg-emerald-400" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-lg font-bold text-white">
                              {getDisplayName(item.otherUser)}
                            </div>
                            <div className="mt-1 truncate text-sm text-slate-300">
                              {isTyping ? "Typing..." : item.lastMessage?.body || "Open chat"}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {forwardingMessage && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[30px] border border-white/10 bg-[#071122] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-300/80">
                    Messenger
                  </div>
                  <h3 className="mt-2 text-2xl font-black text-white">Forward message</h3>
                  <p className="mt-1 text-sm text-slate-300">
                    Choose an existing conversation or search a user to forward this message.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeForwardModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-sky-300">
                  Message preview
                </div>
                <div className="mt-2 text-sm text-slate-200">
                  {getMessagePreviewText(forwardingMessage)}
                </div>
                {forwardingMessage.attachment_url && (
                  <div className="mt-2 text-xs text-slate-400">
                    Attachment: {getAttachmentName(forwardingMessage.attachment_url)}
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-sm font-bold text-white">Forward to existing chat</div>
                  <div className="relative">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={forwardSearch}
                      onChange={(e) => setForwardSearch(e.target.value)}
                      placeholder="Search chats..."
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-400 focus:border-sky-400"
                    />
                  </div>

                  <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.04]">
                    {filteredForwardConversations.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-slate-300">
                        No other conversations found.
                      </div>
                    ) : (
                      filteredForwardConversations.map((item) => (
                        <button
                          key={item.conversation.id}
                          type="button"
                          onClick={() => void forwardToConversation(item.conversation.id)}
                          disabled={forwardingToConversationId === item.conversation.id}
                          className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left hover:bg-white/[0.05] disabled:opacity-60"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white">
                            <User size={16} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-white">
                              {getDisplayName(item.otherUser)}
                            </div>
                            <div className="truncate text-xs text-slate-400">
                              {getSubtitle(item.otherUser)}
                            </div>
                          </div>

                          <div className="text-xs font-semibold text-sky-300">
                            {forwardingToConversationId === item.conversation.id
                              ? "Forwarding..."
                              : "Send"}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-sm font-bold text-white">Forward to another user</div>
                  <div className="relative">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={forwardUserSearch}
                      onChange={(e) => setForwardUserSearch(e.target.value)}
                      placeholder="Search users..."
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-400 focus:border-sky-400"
                    />
                  </div>

                  <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.04]">
                    {searchingForwardUsers ? (
                      <div className="px-4 py-4 text-sm text-slate-300">Searching users...</div>
                    ) : forwardUserSearch.trim() && forwardUserResults.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-slate-300">No users found.</div>
                    ) : !forwardUserSearch.trim() ? (
                      <div className="px-4 py-4 text-sm text-slate-300">
                        Type a user name or email.
                      </div>
                    ) : (
                      forwardUserResults.map((profile) => (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => void forwardToUser(profile.id)}
                          disabled={forwardingToUserId === profile.id}
                          className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left hover:bg-white/[0.05] disabled:opacity-60"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-slate-200">
                            <User size={16} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-white">
                              {getDisplayName(profile)}
                            </div>
                            <div className="truncate text-xs text-slate-400">
                              {getSubtitle(profile)}
                            </div>
                          </div>

                          <div className="text-xs font-semibold text-sky-300">
                            {forwardingToUserId === profile.id ? "Forwarding..." : "Send"}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}