"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Check,
  CornerDownLeft,
  Forward,
  MessageSquare,
  MoreHorizontal,
  Download,
  FileText,
  Maximize2,
  Paperclip,
  Pencil,
  Play,
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

type MessageReactionRow = {
  id?: string
  message_id: string
  user_id: string
  emoji: string
  created_at?: string
}

type ConversationListItem = {
  conversation: ConversationRow
  participants: ConversationParticipantRow[]
  otherUser: ProfileRow | null
  lastMessage: ConversationMessageRow | null
  myParticipant: ConversationParticipantRow | null
  otherParticipant: ConversationParticipantRow | null
  unreadCount: number
}

const MAX_FILE_SIZE = 25 * 1024 * 1024
const TYPING_STALE_MS = 6000
const PRESENCE_STALE_MS = 90000

const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "😡"]

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

function MessagesPageContent() {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messageActionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const actionMenuRef = useRef<HTMLDivElement | null>(null)
  const emojiPickerRef = useRef<HTMLDivElement | null>(null)
  const reactionPickerRef = useRef<HTMLDivElement | null>(null)
  const lastTapRef = useRef<{ messageId: string; at: number } | null>(null)
  const reactionBurstTimerRef = useRef<NodeJS.Timeout | null>(null)
  const notifiedMessageIdsRef = useRef<Set<string>>(new Set())
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

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
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [openReactionPickerMessageId, setOpenReactionPickerMessageId] = useState<string | null>(null)
  const [messageReactionsMap, setMessageReactionsMap] = useState<Record<string, MessageReactionRow[]>>({})
  const [reactionBurst, setReactionBurst] = useState<{ messageId: string; emoji: string; key: string } | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [showSharedMediaPanel, setShowSharedMediaPanel] = useState(false)
  const [sharedMediaTab, setSharedMediaTab] = useState<"photos" | "videos" | "audio" | "files">("photos")
  const [toastNotification, setToastNotification] = useState<{
    id: string
    conversationId: string
    senderName: string
    text: string
  } | null>(null)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [myCoins, setMyCoins] = useState(0)
  const [coinShake, setCoinShake] = useState(false)

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

  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0)
  }, [conversations])

  const conversationFromUrl = searchParams.get("conversation")

  const messageSendCost = editingMessageId ? 0 : attachment ? 10 : 5
  const canAffordCurrentMessage = editingMessageId ? true : myCoins >= messageSendCost

  useEffect(() => {
    initializePage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (loading) return
    if (!conversations.length) return
    if (!conversationFromUrl) return

    const exists = conversations.some((item) => item.conversation.id === conversationFromUrl)
    if (!exists) return
    if (selectedConversationId === conversationFromUrl) return

    setSelectedConversationId(conversationFromUrl)
    void loadMessages(conversationFromUrl, false)
    void loadMessageReactions(conversationFromUrl)
    setMobileChatsOpen(false)
    setOpenMessageMenuId(null)
  }, [conversationFromUrl, conversations, loading, selectedConversationId])

  useEffect(() => {
    if (!userId) return

    const showIncomingNotification = (payload: {
      id: string
      conversation_id: string
      sender_id: string | null
      body: string | null
      attachment_url: string | null
    }) => {
      if (!payload?.id || payload.sender_id === userId) return
      if (notifiedMessageIdsRef.current.has(payload.id)) return
      notifiedMessageIdsRef.current.add(payload.id)

      const conversationItem = conversations.find(
        (item) => item.conversation.id === payload.conversation_id
      )

      const senderName = getDisplayName(conversationItem?.otherUser || null)
      const previewText = payload.body?.trim()
        ? payload.body.trim()
        : payload.attachment_url
          ? `Sent ${getAttachmentKind(payload.attachment_url)}`
          : "New message"

      const shouldPopup =
        selectedConversationId !== payload.conversation_id || document.hidden

      if (!shouldPopup) return

      if (typeof window !== "undefined") {
        try {
          const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          if (AudioCtx) {
            if (!audioContextRef.current) {
              audioContextRef.current = new AudioCtx()
            }
            const context = audioContextRef.current
            if (context.state === "suspended") {
              void context.resume()
            }
            const oscillator = context.createOscillator()
            const gain = context.createGain()
            oscillator.type = "sine"
            oscillator.frequency.setValueAtTime(880, context.currentTime)
            oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.16)
            gain.gain.setValueAtTime(0.0001, context.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.06, context.currentTime + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24)
            oscillator.connect(gain)
            gain.connect(context.destination)
            oscillator.start()
            oscillator.stop(context.currentTime + 0.24)
          }
        } catch (soundError) {
          console.error("Notification sound error:", soundError)
        }

        if ("vibrate" in navigator) {
          navigator.vibrate([120, 70, 120])
        }
      }

      setToastNotification({
        id: payload.id,
        conversationId: payload.conversation_id,
        senderName,
        text: previewText,
      })

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }

      toastTimerRef.current = setTimeout(() => {
        setToastNotification((current) => (current?.id === payload.id ? null : current))
      }, 4500)

      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          const notification = new Notification(senderName, {
            body: previewText,
            icon: "/jb-logo.png",
          })

          notification.onclick = () => {
            window.focus()
            void openConversation(payload.conversation_id, "push")
            notification.close()
          }
        } else if (Notification.permission === "default") {
          void Notification.requestPermission()
        }
      }
    }

    const channel = supabase
      .channel(`messenger-user-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        async () => {
          await loadConversations(userId, false)
          if (selectedConversationId) {
            await loadMessages(selectedConversationId, false)
            await loadMessageReactions(selectedConversationId)
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
            await loadMessageReactions(selectedConversationId)
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages" },
        async (payload) => {
          showIncomingNotification(payload.new as {
            id: string
            conversation_id: string
            sender_id: string | null
            body: string | null
            attachment_url: string | null
          })

          await loadConversations(userId, false)
          if (selectedConversationId) {
            await loadMessages(selectedConversationId, false)
            await loadMessageReactions(selectedConversationId)
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_messages" },
        async () => {
          await loadConversations(userId, false)
          if (selectedConversationId) {
            await loadMessages(selectedConversationId, false)
            await loadMessageReactions(selectedConversationId)
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "conversation_messages" },
        async () => {
          await loadConversations(userId, false)
          if (selectedConversationId) {
            await loadMessages(selectedConversationId, false)
            await loadMessageReactions(selectedConversationId)
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_message_hidden" },
        async () => {
          await loadConversations(userId, false)
          if (selectedConversationId) {
            await loadMessages(selectedConversationId, false)
            await loadMessageReactions(selectedConversationId)
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_message_reactions" },
        async () => {
          if (selectedConversationId) {
            await loadMessageReactions(selectedConversationId)
          }
        }
      )
      .subscribe()

    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }
      supabase.removeChannel(channel)
    }
  }, [supabase, userId, selectedConversationId, conversations])

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

    const handleCoinsRefresh = () => {
      void refreshMyCoins(userId)
    }

    window.addEventListener("jb-coins-updated", handleCoinsRefresh)
    return () => {
      window.removeEventListener("jb-coins-updated", handleCoinsRefresh)
    }
  }, [userId])

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission === "default") {
      void Notification.requestPermission()
    }
  }, [])


  async function refreshMyCoins(activeUserId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("coins")
        .eq("id", activeUserId)
        .maybeSingle()

      if (error) throw error
      setMyCoins(Number(data?.coins || 0))
    } catch (err) {
      console.error("Refresh coins error:", err)
    }
  }

  function emitCoinPopup(amount: number, label: string) {
    if (typeof window === "undefined") return
    window.dispatchEvent(
      new CustomEvent("jb-coins-popup", {
        detail: { amount, label },
      })
    )
  }

  function triggerCoinShake(messageText: string) {
    setError(messageText)
    setCoinShake(true)
    window.setTimeout(() => setCoinShake(false), 550)
    emitCoinPopup(0, "Not enough coins")
  }


  function buildConversationUrl(conversationId: string | null) {
    const params = new URLSearchParams(searchParams.toString())

    if (conversationId) {
      params.set("conversation", conversationId)
    } else {
      params.delete("conversation")
    }

    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }

  function syncConversationUrl(conversationId: string | null, method: "push" | "replace" = "replace") {
    const nextUrl = buildConversationUrl(conversationId)
    const currentUrl = typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : null

    if (currentUrl === nextUrl) return

    if (method === "push") {
      router.push(nextUrl, { scroll: false })
      return
    }

    router.replace(nextUrl, { scroll: false })
  }

  async function openConversation(conversationId: string, method: "push" | "replace" = "replace") {
    syncConversationUrl(conversationId, method)
    setSelectedConversationId(conversationId)
    await loadMessages(conversationId, false)
    await loadMessageReactions(conversationId)
    setMobileChatsOpen(false)
    setToastNotification(null)
    setOpenMessageMenuId(null)
    setMenuPosition(null)
    setOpenReactionPickerMessageId(null)
  }

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
      if (reactionBurstTimerRef.current) {
        clearTimeout(reactionBurstTimerRef.current)
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
        setMenuPosition(null)
      }

      if (emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
        setShowEmojiPicker(false)
      }

      if (reactionPickerRef.current && !reactionPickerRef.current.contains(target)) {
        setOpenReactionPickerMessageId(null)
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
      await refreshMyCoins(user.id)

      const loadedConversations = await loadConversations(user.id, false)
      await loadPresenceForCurrentConversations()

      if (loadedConversations.length > 0) {
        const requestedConversationId = searchParams.get("conversation")
        const requestedConversationExists = requestedConversationId
          ? loadedConversations.some((item) => item.conversation.id === requestedConversationId)
          : false

        const initialConversationId = requestedConversationExists
          ? requestedConversationId
          : loadedConversations[0].conversation.id

        if (initialConversationId) {
          const conversationId = initialConversationId

          syncConversationUrl(conversationId, "replace")
          setSelectedConversationId(conversationId)
          await loadMessages(conversationId, false)
          await loadMessageReactions(conversationId)
        } else {
          syncConversationUrl(null, "replace")
          setSelectedConversationId(null)
          setMessages([])
          setMessageReactionsMap({})
        }
      } else {
        syncConversationUrl(null, "replace")
        setSelectedConversationId(null)
        setMessages([])
        setMessageReactionsMap({})
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

      const { data: hiddenRows, error: hiddenError } = await supabase
        .from("conversation_message_hidden")
        .select("message_id")
        .eq("user_id", activeUserId)

      if (hiddenError) {
        throw hiddenError
      }

      const hiddenMessageIds = new Set(
        ((hiddenRows as { message_id: string }[] | null) || []).map((item) => item.message_id)
      )

      const { data: messageRows, error: messagesError } = await supabase
        .from("conversation_messages")
        .select("*")
        .in("conversation_id", validConversationIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })

      if (messagesError) {
        throw messagesError
      }

      const allMessages = ((messageRows as ConversationMessageRow[]) || []).filter(
        (item) => !hiddenMessageIds.has(item.id)
      )

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

        const conversationMessages = allMessages.filter(
          (item) => item.conversation_id === conversation.id
        )

        const lastMessageForConversation =
          [...conversationMessages].sort(
            (a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ).at(-1) || null

        const myParticipant =
          participants.find((item) => item.user_id === activeUserId) || null

        const otherParticipant =
          participants.find((item) => item.user_id !== activeUserId) || null

        const otherUser = otherParticipant
          ? profileMap.get(otherParticipant.user_id) || null
          : null

        const lastReadAt = myParticipant?.last_read_at
          ? new Date(myParticipant.last_read_at).getTime()
          : 0

        const unreadCount = conversationMessages.filter((item) => {
          if (item.sender_id === activeUserId) return false
          return new Date(item.created_at).getTime() > lastReadAt
        }).length

        return {
          conversation,
          participants,
          otherUser,
          lastMessage: lastMessageForConversation,
          myParticipant,
          otherParticipant,
          unreadCount,
        }
      })

      setConversations(nextConversations)

      setSelectedConversationId((current) => {
        const requestedConversationId = searchParams.get("conversation")
        const requestedConversationExists = requestedConversationId
          ? nextConversations.some((item) => item.conversation.id === requestedConversationId)
          : false

        if (requestedConversationExists) {
          return requestedConversationId
        }

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

      let nextMessages = (data as ConversationMessageRow[]) || []

      if (userId) {
        const { data: hiddenRows, error: hiddenError } = await supabase
          .from("conversation_message_hidden")
          .select("message_id")
          .eq("user_id", userId)

        if (hiddenError) {
          throw hiddenError
        }

        const hiddenMessageIds = new Set(
          ((hiddenRows as { message_id: string }[] | null) || []).map((item) => item.message_id)
        )

        nextMessages = nextMessages.filter((item) => !hiddenMessageIds.has(item.id))
      }

      setMessages(nextMessages)
    } catch (err) {
      console.error("Load messages error:", err)
      setError(err instanceof Error ? err.message : "Failed to load messages.")
    } finally {
      if (withLoader) setLoading(false)
    }
  }

  async function loadMessageReactions(conversationId: string) {
    try {
      const { data: messageRows, error: messageError } = await supabase
        .from("conversation_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .is("deleted_at", null)

      if (messageError) throw messageError

      const messageIds = ((messageRows as { id: string }[] | null) || []).map((item) => item.id)

      if (messageIds.length === 0) {
        setMessageReactionsMap({})
        return
      }

      const { data, error } = await supabase
        .from("conversation_message_reactions")
        .select("id, message_id, user_id, emoji, created_at")
        .in("message_id", messageIds)

      if (error) {
        const message = String((error as { message?: string }).message || "")
        if (message.toLowerCase().includes("relation") || message.toLowerCase().includes("does not exist")) {
          setMessageReactionsMap({})
          return
        }
        throw error
      }

      const rows = (data as MessageReactionRow[]) || []
      const nextMap: Record<string, MessageReactionRow[]> = {}

      rows.forEach((row) => {
        if (!nextMap[row.message_id]) nextMap[row.message_id] = []
        nextMap[row.message_id].push(row)
      })

      setMessageReactionsMap(nextMap)
    } catch (err) {
      console.error("Load reactions error:", err)
      setMessageReactionsMap({})
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
      if (!userId) return

      setStartingChatUserId(otherUserId)
      setError("")
      setSuccess("")

      const { data: myParticipantRows, error: myParticipantsError } = await supabase
        .from("conversation_participants")
        .select("*")
        .eq("user_id", userId)

      if (myParticipantsError) {
        throw myParticipantsError
      }

      const myParticipants = (myParticipantRows as ConversationParticipantRow[]) || []
      const myConversationIds = myParticipants.map((item) => item.conversation_id)

      let conversationId: string | null = null

      if (myConversationIds.length > 0) {
        const { data: otherParticipantRows, error: otherParticipantsError } = await supabase
          .from("conversation_participants")
          .select("*")
          .in("conversation_id", myConversationIds)
          .eq("user_id", otherUserId)

        if (otherParticipantsError) {
          throw otherParticipantsError
        }

        const matchedOtherParticipant =
          ((otherParticipantRows as ConversationParticipantRow[]) || [])[0] || null

        if (matchedOtherParticipant) {
          conversationId = matchedOtherParticipant.conversation_id

          const myHiddenParticipant =
            myParticipants.find((item) => item.conversation_id === conversationId) || null

          if (myHiddenParticipant?.deleted_at) {
            const { error: unhideError } = await supabase
              .from("conversation_participants")
              .update({ deleted_at: null })
              .eq("conversation_id", conversationId)
              .eq("user_id", userId)

            if (unhideError) {
              throw unhideError
            }
          }
        }
      }

      if (!conversationId) {
        const { data, error } = await supabase.rpc("create_direct_conversation", {
          other_user_id: otherUserId,
        })

        if (error) {
          throw error
        }

        conversationId = String(data || "")
      }

      if (!conversationId) {
        throw new Error("Conversation was not created.")
      }

      await supabase
        .from("conversations")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId)

      const updated = await loadConversations(userId, false)
      await openConversation(conversationId, "push")
      await loadPresenceForCurrentConversations()
      await loadTypingStates()

      if (!updated.some((item) => item.conversation.id === conversationId)) {
        await loadConversations(userId, false)
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

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("jb-messages-unread-updated"))
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

    if (!editingMessageId && !canAffordCurrentMessage) {
      triggerCoinShake(`Not enough JB Coins. You need ${messageSendCost} coins to send this.`)
      return
    }

    try {
      setSending(true)
      setError("")
      setSuccess("")
      setOpenMessageMenuId(null)
      setMenuPosition(null)

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

      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          body: message.trim(),
          attachmentUrl,
          replyToMessageId: replyingTo?.id || null,
          forwardedFromMessageId: null,
          forwardedByUserId: null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data?.code === "INSUFFICIENT_COINS") {
          setMyCoins(Number(data?.current || 0))
          triggerCoinShake(`Not enough JB Coins. You need ${data?.required || messageSendCost} coins.`)
          return
        }

        throw new Error(data?.error || "Failed to send message.")
      }

      setMyCoins(Number(data?.remainingCoins || 0))

      if (Number(data?.cost || 0) > 0) {
        emitCoinPopup(-Number(data.cost), attachment ? "Attachment message sent" : "Message sent")
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("jb-coins-updated"))
        }
      }

      await stopTyping(selectedConversationId)

      setMessage("")
      setAttachment(null)
      setReplyingTo(null)
      setSuccess(`Message sent. -${Number(data?.cost || 0)} JB Coins`)
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
      setMenuPosition(null)

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

  async function deleteForMe(messageId: string) {
    try {
      if (!userId) {
        alert("You must be logged in.")
        return
      }

      const { error } = await supabase
        .from("conversation_message_hidden")
        .upsert(
          {
            message_id: messageId,
            user_id: userId,
          },
          { onConflict: "message_id,user_id" }
        )

      if (error) {
        throw error
      }

      if (editingMessageId === messageId) {
        cancelEditing()
      }

      if (replyingTo?.id === messageId) {
        setReplyingTo(null)
      }

      setOpenMessageMenuId(null)
      setMenuPosition(null)

      if (selectedConversationId) {
        await loadMessages(selectedConversationId, false)
      }

      await loadConversations(userId, false)
    } catch (err) {
      console.error("Delete for me error:", err)
      alert(err instanceof Error ? err.message : "Failed to hide message.")
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
        await openConversation(nextId, "replace")
      } else {
        syncConversationUrl(null, "replace")
        setSelectedConversationId(null)
        setMessages([])
        setMessageReactionsMap({})
        setMessageReactionsMap({})
      }

      cancelEditing()
      setReplyingTo(null)
      setOpenMessageMenuId(null)
      setMenuPosition(null)
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
    setMenuPosition(null)
    textareaRef.current?.focus()
  }

  function startEditing(messageRow: ConversationMessageRow) {
    if (messageRow.sender_id !== userId) return
    setReplyingTo(null)
    setEditingMessageId(messageRow.id)
    setAttachment(null)
    setMessage(messageRow.body || "")
    setOpenMessageMenuId(null)
    setMenuPosition(null)
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
    setMenuPosition(null)
  }

  function closeForwardModal() {
    setForwardingMessage(null)
    setForwardSearch("")
    setForwardUserSearch("")
    setForwardUserResults([])
    setForwardingToConversationId(null)
    setForwardingToUserId(null)
    setMenuPosition(null)
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

  function getReactionsForMessage(messageId: string) {
    return messageReactionsMap[messageId] || []
  }

  function getMyReaction(messageId: string) {
    if (!userId) return null
    return getReactionsForMessage(messageId).find((item) => item.user_id === userId) || null
  }

  function getReactionSummary(messageId: string) {
    const grouped = new Map<string, number>()

    getReactionsForMessage(messageId).forEach((reaction) => {
      grouped.set(reaction.emoji, (grouped.get(reaction.emoji) || 0) + 1)
    })

    return Array.from(grouped.entries())
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count)
  }

  function getReactionTooltipText(messageId: string, emoji: string) {
    const names = getReactionsForMessage(messageId)
      .filter((reaction) => reaction.emoji === emoji)
      .map((reaction) => {
        if (reaction.user_id === userId) return "You"

        if (selectedConversation?.otherParticipant?.user_id === reaction.user_id) {
          return getDisplayName(selectedConversation.otherUser)
        }

        return "Someone"
      })

    return names.join(", ") || "No reactions yet"
  }

  function triggerReactionBurst(messageId: string, emoji: string) {
    const key = `${messageId}-${emoji}-${Date.now()}`
    setReactionBurst({ messageId, emoji, key })

    if (reactionBurstTimerRef.current) {
      clearTimeout(reactionBurstTimerRef.current)
    }

    reactionBurstTimerRef.current = setTimeout(() => {
      setReactionBurst((current) => (current?.key === key ? null : current))
    }, 700)
  }

  function handleMessageDoubleTap(messageId: string) {
    const now = Date.now()
    const lastTap = lastTapRef.current

    if (lastTap && lastTap.messageId === messageId && now - lastTap.at < 300) {
      lastTapRef.current = null
      void toggleReaction(messageId, "❤️")
      return
    }

    lastTapRef.current = { messageId, at: now }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!userId) return

    const previousMap = messageReactionsMap

    try {
      setError("")
      setSuccess("")

      const current = previousMap[messageId] || []
      const existing = current.find((item) => item.user_id === userId) || null

      const optimistic = existing?.emoji === emoji
        ? current.filter((item) => item.user_id !== userId)
        : [
            ...current.filter((item) => item.user_id !== userId),
            {
              message_id: messageId,
              user_id: userId,
              emoji,
            },
          ]

      setMessageReactionsMap((prev) => ({
        ...prev,
        [messageId]: optimistic,
      }))

      triggerReactionBurst(messageId, emoji)

      if (existing?.emoji === emoji) {
        const { error } = await supabase
          .from("conversation_message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", userId)

        if (error) throw error
      } else {
        const { error: deleteError } = await supabase
          .from("conversation_message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", userId)

        if (deleteError) throw deleteError

        const { error: insertError } = await supabase
          .from("conversation_message_reactions")
          .insert({
            message_id: messageId,
            user_id: userId,
            emoji,
          })

        if (insertError) throw insertError
      }

      setOpenReactionPickerMessageId(null)
      if (selectedConversationId) {
        await loadMessageReactions(selectedConversationId)
      }
    } catch (err) {
      console.error("Toggle reaction error:", err)
      setMessageReactionsMap(previousMap)
      setError("Message reactions need a conversation_message_reactions table in Supabase.")
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

  function openMessageMenu(
    event: React.MouseEvent<HTMLButtonElement>,
    messageId: string,
    isMine: boolean
  ) {
    const rect = event.currentTarget.getBoundingClientRect()
    const menuWidth = 180
    const gap = 6

    let left = isMine ? rect.right - menuWidth : rect.left

    if (left + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - 10
    }
    if (left < 10) {
      left = 10
    }

    const top = rect.bottom + gap

    setMenuPosition({ top, left })
    setOpenMessageMenuId((prev) => (prev === messageId ? null : messageId))
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

  function getAttachmentKind(url: string) {
    const cleanUrl = url.split("?")[0].toLowerCase()

    if (/(\.png|\.jpe?g|\.gif|\.webp|\.bmp|\.svg|\.avif)$/.test(cleanUrl)) {
      return "image" as const
    }

    if (/(\.mp4|\.webm|\.mov|\.m4v|\.ogg)$/.test(cleanUrl)) {
      return "video" as const
    }

    if (/(\.mp3|\.wav|\.m4a|\.aac|\.oga|\.ogg|\.opus)$/.test(cleanUrl)) {
      return "audio" as const
    }

    return "file" as const
  }

  function renderAttachmentPreview(url: string, isMine: boolean) {
    const kind = getAttachmentKind(url)
    const fileName = getAttachmentName(url)

    if (kind === "image") {
      return (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setPreviewImageUrl(url)}
            className={`group relative block overflow-hidden rounded-[22px] border text-left transition hover:brightness-110 ${
              isMine
                ? "border-white/15 bg-white/10"
                : "border-white/10 bg-slate-950/30"
            }`}
          >
            <img
              src={url}
              alt={fileName}
              className="block max-h-[280px] w-full max-w-[240px] object-cover sm:max-w-[300px]"
              loading="lazy"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 via-black/20 to-transparent px-3 py-2">
              <span className="truncate pr-3 text-xs font-semibold text-white">{fileName}</span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white">
                <Maximize2 size={14} />
              </span>
            </div>
          </button>
        </div>
      )
    }

    if (kind === "video") {
      return (
        <div className="mt-3 overflow-hidden rounded-[22px] border border-white/10 bg-black/30">
          <video
            controls
            preload="metadata"
            className="block max-h-[320px] w-full max-w-[260px] bg-black sm:max-w-[340px]"
          >
            <source src={url} />
          </video>
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-200">
            <Play size={13} className="shrink-0" />
            <span className="truncate">{fileName}</span>
          </div>
        </div>
      )
    }

    if (kind === "audio") {
      return (
        <div className={`mt-3 w-full max-w-[300px] rounded-[22px] border px-3 py-3 ${
          isMine
            ? "border-white/15 bg-white/10"
            : "border-white/10 bg-slate-950/30"
        }`}>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
            <Play size={13} className="shrink-0" />
            <span className="truncate">Voice / Audio</span>
          </div>
          <audio controls className="w-full">
            <source src={url} />
          </audio>
          <div className="mt-2 truncate text-[11px] opacity-80">{fileName}</div>
        </div>
      )
    }

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-3 flex w-full max-w-[300px] items-center gap-3 rounded-[22px] border px-3 py-3 text-left text-xs font-semibold transition hover:brightness-110 ${
          isMine
            ? "border-white/15 bg-white/10 text-white"
            : "border-white/10 bg-slate-950/30 text-slate-100"
        }`}
      >
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
          isMine ? "bg-white/10" : "bg-white/5"
        }`}>
          <FileText size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{fileName}</span>
          <span className="mt-0.5 block text-[11px] opacity-70">Open or download file</span>
        </span>
        <Download size={16} className="shrink-0" />
      </a>
    )
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
    if (item.attachment_url) {
      const kind = getAttachmentKind(item.attachment_url)
      if (kind === "image") return "Photo"
      if (kind === "video") return "Video"
      if (kind === "audio") return "Voice message"
      return "Attachment"
    }
    return "Message"
  }

  const filteredConversations = useMemo(() => {
    return conversations
  }, [conversations])

  function openConversationFromNotification(conversationId: string) {
    void openConversation(conversationId, "push")
  }

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

  const sharedAttachments = useMemo(() => {
    return messages
      .filter((item) => item.attachment_url)
      .map((item) => {
        const url = item.attachment_url as string
        return {
          messageId: item.id,
          url,
          kind: getAttachmentKind(url),
          fileName: getAttachmentName(url),
          createdAt: item.created_at,
          isMine: item.sender_id === userId,
          senderName: item.sender_id === userId
            ? "You"
            : getDisplayName(selectedConversation?.otherUser || null),
        }
      })
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
  }, [messages, userId, selectedConversation])

  const sharedPhotos = useMemo(
    () => sharedAttachments.filter((item) => item.kind === "image"),
    [sharedAttachments]
  )

  const sharedVideos = useMemo(
    () => sharedAttachments.filter((item) => item.kind === "video"),
    [sharedAttachments]
  )

  const sharedAudio = useMemo(
    () => sharedAttachments.filter((item) => item.kind === "audio"),
    [sharedAttachments]
  )

  const sharedFiles = useMemo(
    () => sharedAttachments.filter((item) => item.kind === "file"),
    [sharedAttachments]
  )

  return (
    <>
      <SiteHeader />

      <main className="min-h-screen bg-[#020617] pt-24 text-white sm:pt-28">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.18),_transparent_30%),linear-gradient(180deg,_#030712_0%,_#020617_45%,_#061229_100%)]" />

        <div className="mx-auto w-full max-w-[1800px] px-4 pb-6 sm:px-6 sm:pb-8 lg:px-8">
          <section className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-md sm:rounded-[30px]">
            <div className="grid min-h-[calc(100vh-8rem)] grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
              <aside className="hidden border-r border-white/10 bg-[#0b1220]/80 lg:flex lg:flex-col">
                <div className="border-b border-white/10 px-5 py-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-300/80">
                    Messenger
                  </div>
                  <h2 className="mt-2 flex items-center gap-2 text-2xl font-black text-white">
                    <span>Chats</span>
                    {totalUnreadCount > 0 && (
                      <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white shadow-lg shadow-red-950/40">
                        {totalUnreadCount}
                      </span>
                    )}
                  </h2>
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
                              void openConversation(item.conversation.id, "push")
                            }}
                            className={`flex w-full items-center gap-3 rounded-[20px] border px-3.5 py-3 text-left transition ${
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

                            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-base font-bold text-white">
                                  {otherName}
                                </div>
                                <div className="mt-1 truncate text-sm text-slate-300">
                                  {subtitle}
                                </div>
                              </div>

                              {item.unreadCount > 0 && (
                                <span className="inline-flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white shadow-lg shadow-red-950/40">
                                  {item.unreadCount > 99 ? "99+" : item.unreadCount}
                                </span>
                              )}
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
                        className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sky-300 transition hover:bg-white/[0.1] lg:hidden"
                        aria-label="Open chats"
                      >
                        <MessageSquare size={18} />
                        {totalUnreadCount > 0 && (
                          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg shadow-red-950/40">
                            {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                          </span>
                        )}
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

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSharedMediaPanel(true)}
                        disabled={!selectedConversation}
                        className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Paperclip size={16} />
                        <span className="hidden sm:inline">Shared media</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 lg:hidden">
                    <div className="relative">
                      <Search
                        size={16}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search users to start a chat..."
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-3 pl-11 pr-14 text-sm text-white outline-none placeholder:text-slate-400 focus:border-sky-400"
                      />

                      <button
                        type="button"
                        onClick={() => setMobileChatsOpen(true)}
                        className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sky-300 transition hover:bg-white/[0.1]"
                        aria-label="Open chats list"
                        title="Open chats list"
                      >
                        <MessageSquare size={16} />
                      </button>
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
                </div>

                <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.01)_0%,rgba(255,255,255,0.00)_100%)] px-2 py-3 sm:px-4 sm:py-4">
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
                    <div className="mx-auto flex w-full max-w-4xl flex-col gap-1.5 sm:gap-2">
                      {messages.map((item, index) => {
                        const isMine = item.sender_id === userId
                        const previous = messages[index - 1]
                        const next = messages[index + 1]
                        const showAvatar = !next || next.sender_id !== item.sender_id
                        const showSenderLabel = !previous || previous.sender_id !== item.sender_id
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
                            className={`group flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"} ${previous?.sender_id === item.sender_id ? "mt-0.5" : "mt-3"}`}
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
                              className={`relative max-w-[84%] sm:max-w-[72%] ${isMine ? "order-1" : ""}`}
                              onMouseDown={() => startLongPressForMessage(item.id)}
                              onMouseUp={cancelLongPress}
                              onMouseLeave={cancelLongPress}
                              onTouchStart={() => startLongPressForMessage(item.id)}
                              onTouchEnd={cancelLongPress}
                              onTouchCancel={cancelLongPress}
                            >
                              {!isMine && showSenderLabel ? (
                                <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                                  {getDisplayName(selectedConversation.otherUser)}
                                </div>
                              ) : null}

                              <div className={`relative ${isMine ? "pr-10 sm:pr-12" : "pl-10 sm:pl-12"}`}>
                                <button
                                  type="button"
                                  onClick={(event) => openMessageMenu(event, item.id, isMine)}
                                  className={`absolute top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#091220]/90 text-slate-200 shadow-lg transition hover:bg-[#10203b] ${
                                    isMine
                                      ? "left-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                      : "right-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                  }`}
                                  aria-label="Open message actions"
                                >
                                  <MoreHorizontal size={16} />
                                </button>

                                {isMenuOpen && menuPosition && (
                                  <>
                                    <button
                                      type="button"
                                      className="fixed inset-0 z-[85] bg-transparent"
                                      onClick={() => {
                                        setOpenMessageMenuId(null)
                                        setMenuPosition(null)
                                      }}
                                      aria-label="Close message menu"
                                    />

                                    <div
                                      ref={actionMenuRef}
                                      className="fixed z-[90] w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#091220]/95 shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur-md"
                                      style={{
                                        top: Math.min(menuPosition.top, window.innerHeight - 220),
                                        left: menuPosition.left,
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenReactionPickerMessageId((current) =>
                                            current === item.id ? null : item.id
                                          )
                                          setOpenMessageMenuId(null)
                                          setMenuPosition(null)
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-white/[0.06]"
                                      >
                                        <Smile size={15} />
                                        React
                                      </button>

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

                                      <button
                                        type="button"
                                        onClick={() => deleteForMe(item.id)}
                                        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-white/[0.06]"
                                      >
                                        <Trash2 size={15} />
                                        Delete for me
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
                                  </>
                                )}

                                {openReactionPickerMessageId === item.id && (
                                  <div
                                    ref={reactionPickerRef}
                                    className={`absolute z-30 ${isMine ? "left-0" : "right-0"} -top-14 rounded-full border border-white/10 bg-[#091220]/95 px-2 py-2 shadow-[0_20px_40px_rgba(0,0,0,0.35)] backdrop-blur-md`}
                                  >
                                    <div className="flex items-center gap-1">
                                      {QUICK_REACTIONS.map((emoji) => {
                                        const activeReaction = getMyReaction(item.id)?.emoji === emoji
                                        return (
                                          <button
                                            key={`${item.id}-${emoji}`}
                                            type="button"
                                            onClick={() => void toggleReaction(item.id, emoji)}
                                            title={getReactionTooltipText(item.id, emoji)}
                                            className={`flex h-9 w-9 items-center justify-center rounded-full text-lg transition duration-150 hover:-translate-y-1 hover:scale-125 ${
                                              activeReaction ? "bg-sky-500/20 ring-1 ring-sky-400/40" : "hover:bg-white/[0.08]"
                                            }`}
                                          >
                                            {emoji}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}

                                {reactionBurst?.messageId === item.id && (
                                  <div className="pointer-events-none absolute inset-x-0 -top-12 z-20 flex justify-center">
                                    <div
                                      key={reactionBurst.key}
                                      className="select-none text-3xl drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)] animate-[bounce_0.7s_ease-out]"
                                    >
                                      {reactionBurst.emoji}
                                    </div>
                                  </div>
                                )}

                                <div
                                  className={`rounded-[22px] px-3.5 py-2.5 text-[14px] leading-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-all sm:px-4 sm:py-3 ${
                                    isMine
                                      ? "rounded-br-md bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 text-white"
                                      : "rounded-bl-md border border-white/10 bg-[#111b2e] text-slate-100"
                                  }`}
                                  onMouseEnter={() => setOpenReactionPickerMessageId(item.id)}
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
                                      <div className="whitespace-pre-wrap break-words leading-5">
                                        {item.body}
                                      </div>
                                    )}

                                    {item.attachment_url && renderAttachmentPreview(item.attachment_url, isMine)}
                                  </div>
                                </div>
                              </div>

                              {getReactionSummary(item.id).length > 0 && (
                                <div
                                  className={`mt-1.5 flex flex-wrap items-center gap-1.5 px-2 ${
                                    isMine ? "justify-end" : "justify-start"
                                  }`}
                                >
                                  {getReactionSummary(item.id).map((reaction) => {
                                    const activeReaction = getMyReaction(item.id)?.emoji === reaction.emoji
                                    return (
                                      <button
                                        key={`${item.id}-${reaction.emoji}`}
                                        type="button"
                                        title={getReactionTooltipText(item.id, reaction.emoji)}
                                        onClick={() => void toggleReaction(item.id, reaction.emoji)}
                                        className={`group relative inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold shadow-sm transition duration-150 hover:-translate-y-0.5 hover:scale-105 hover:brightness-110 ${
                                          activeReaction
                                            ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
                                            : "border-white/10 bg-white/[0.06] text-slate-200"
                                        }`}
                                      >
                                        <span>{reaction.emoji}</span>
                                        <span>{reaction.count}</span>
                                        <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[#08111f]/95 px-2.5 py-1 text-[10px] font-medium text-white shadow-[0_10px_24px_rgba(0,0,0,0.35)] group-hover:block">
                                          {getReactionTooltipText(item.id, reaction.emoji)}
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                              )}

                              <div
                                className={`mt-1 flex flex-wrap items-center gap-1.5 px-2 text-[11px] text-slate-400 ${
                                  isMine ? "justify-end" : "justify-start"
                                }`}
                              >
                                <span>{formatTime(item.created_at)}</span>

                                {item.edited_at && (
                                  <span className="font-medium text-slate-400">(edited)</span>
                                )}

                                {isMine && isMyLatest && isLastOfGroup && (
                                  lastSeenByOther ? (
                                    <span
                                      className="inline-flex items-center gap-1.5 font-medium text-slate-300"
                                      title={`Seen by ${getDisplayName(selectedConversation?.otherUser || null)}`}
                                    >
                                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/15 text-[9px] text-white">
                                        <User size={9} />
                                      </span>
                                      Seen
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 font-medium text-slate-400">
                                      <Check size={12} />
                                      Sent
                                    </span>
                                  )
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

                <div className="sticky bottom-0 border-t border-white/10 bg-[#0b1220]/95 px-2 py-2 backdrop-blur-xl sm:px-4">
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

                    <form onSubmit={handleSendMessage} className="space-y-2">
                      <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className={`rounded-full border px-3 py-1.5 text-xs font-bold ${coinShake ? "border-red-400/40 bg-red-500/15 text-red-200" : "border-amber-300/20 bg-amber-500/10 text-amber-200"}`}>
                            Wallet: {myCoins.toLocaleString()} 🪙
                          </div>
                          {!editingMessageId && (
                            <div className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-200">
                              Cost: {messageSendCost} 🪙
                            </div>
                          )}
                        </div>
                        {!editingMessageId && (
                          <div className="text-xs font-semibold text-slate-400">
                            Text message = 5 🪙 • With attachment = 10 🪙
                          </div>
                        )}
                      </div>

                      <div className={`relative rounded-[28px] border bg-[#0f172a]/95 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition sm:rounded-[30px] ${coinShake ? "border-red-400/40" : "border-white/10"}`}>
                        <div className="flex items-end gap-1.5 sm:gap-2">
                          <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-sky-300 transition hover:bg-white/[0.08] sm:h-11 sm:w-11">
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
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sky-300 transition hover:bg-white/[0.08] sm:h-11 sm:w-11"
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
                            className="min-h-[42px] max-h-[120px] flex-1 resize-none overflow-y-auto rounded-[24px] bg-transparent px-2 py-2.5 text-sm text-white outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[44px] sm:max-h-[140px] sm:py-3"
                          />

                          <button
                            type="submit"
                            disabled={sending || uploading || !selectedConversationId || (!editingMessageId && !canAffordCurrentMessage)}
                            className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-3.5 text-white transition sm:h-11 sm:px-4 ${
                              editingMessageId
                                ? "bg-emerald-500 hover:bg-emerald-400"
                                : canAffordCurrentMessage
                                  ? "bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 hover:brightness-110"
                                  : "bg-red-500/80"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                            title={editingMessageId ? "Save edit" : `Send message (${messageSendCost} JB Coins)`}
                          >
                            {editingMessageId ? <Check size={18} /> : <Send size={18} />}
                            <span className="inline text-xs font-bold sm:hidden">{editingMessageId ? "Save" : sending || uploading ? "..." : "Send"}</span>
                            <span className="hidden text-xs font-bold sm:inline">
                              {editingMessageId
                                ? "Save"
                                : sending || uploading
                                  ? "Sending..."
                                  : `Send (${messageSendCost} 🪙)`}
                            </span>
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
                    <h2 className="mt-2 flex items-center gap-2 text-2xl font-black text-white">
                    <span>Chats</span>
                    {totalUnreadCount > 0 && (
                      <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white shadow-lg shadow-red-950/40">
                        {totalUnreadCount}
                      </span>
                    )}
                  </h2>
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
                            void openConversation(item.conversation.id, "push")
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

        {showSharedMediaPanel && (
          <div className="fixed inset-0 z-[95] flex items-center justify-end bg-slate-950/70 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setShowSharedMediaPanel(false)}
              className="absolute inset-0"
              aria-label="Close shared media panel"
            />

            <div className="relative z-10 h-full w-full max-w-2xl border-l border-white/10 bg-[#071122] shadow-[-20px_0_60px_rgba(0,0,0,0.35)]">
              <div className="flex h-full flex-col">
                <div className="border-b border-white/10 px-5 py-5 sm:px-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-300/80">
                        Messenger
                      </div>
                      <h3 className="mt-2 text-2xl font-black text-white">Shared media & files</h3>
                      <p className="mt-1 text-sm text-slate-300">
                        {selectedConversation
                          ? `Everything shared with ${getDisplayName(selectedConversation.otherUser)}`
                          : "Open a conversation to see shared media."}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowSharedMediaPanel(false)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {[
                      { key: "photos", label: "Photos", count: sharedPhotos.length },
                      { key: "videos", label: "Videos", count: sharedVideos.length },
                      { key: "audio", label: "Audio", count: sharedAudio.length },
                      { key: "files", label: "Files", count: sharedFiles.length },
                    ].map((tab) => {
                      const active = sharedMediaTab === tab.key
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() =>
                            setSharedMediaTab(tab.key as "photos" | "videos" | "audio" | "files")
                          }
                          className={`rounded-2xl border px-3 py-3 text-left transition ${
                            active
                              ? "border-sky-400/30 bg-sky-500/15 text-white"
                              : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                          }`}
                        >
                          <div className="text-sm font-bold">{tab.label}</div>
                          <div className="mt-1 text-xs opacity-80">{tab.count} item{tab.count === 1 ? "" : "s"}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                  {!selectedConversation ? (
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-10 text-center text-slate-300">
                      Open a conversation first.
                    </div>
                  ) : sharedMediaTab === "photos" ? (
                    sharedPhotos.length === 0 ? (
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-10 text-center text-slate-300">
                        No photos shared yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {sharedPhotos.map((item) => (
                          <button
                            key={item.messageId}
                            type="button"
                            onClick={() => setPreviewImageUrl(item.url)}
                            className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] text-left transition hover:scale-[1.02] hover:border-sky-400/20"
                          >
                            <img
                              src={item.url}
                              alt={item.fileName}
                              className="h-40 w-full object-cover"
                              loading="lazy"
                            />
                            <div className="px-3 py-3">
                              <div className="truncate text-sm font-semibold text-white">{item.fileName}</div>
                              <div className="mt-1 text-xs text-slate-400">{item.senderName} • {formatTime(item.createdAt)}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )
                  ) : sharedMediaTab === "videos" ? (
                    sharedVideos.length === 0 ? (
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-10 text-center text-slate-300">
                        No videos shared yet.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {sharedVideos.map((item) => (
                          <div
                            key={item.messageId}
                            className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04]"
                          >
                            <video
                              controls
                              preload="metadata"
                              className="block max-h-[320px] w-full bg-black"
                            >
                              <source src={item.url} />
                            </video>
                            <div className="flex items-center justify-between gap-3 px-4 py-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white">{item.fileName}</div>
                                <div className="mt-1 text-xs text-slate-400">{item.senderName} • {formatTime(item.createdAt)}</div>
                              </div>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]"
                              >
                                <Download size={16} />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : sharedMediaTab === "audio" ? (
                    sharedAudio.length === 0 ? (
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-10 text-center text-slate-300">
                        No audio shared yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sharedAudio.map((item) => (
                          <div
                            key={item.messageId}
                            className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"
                          >
                            <div className="mb-3 flex items-center gap-3">
                              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-sky-300">
                                <Play size={16} />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white">{item.fileName}</div>
                                <div className="mt-1 text-xs text-slate-400">{item.senderName} • {formatTime(item.createdAt)}</div>
                              </div>
                            </div>
                            <audio controls className="w-full">
                              <source src={item.url} />
                            </audio>
                          </div>
                        ))}
                      </div>
                    )
                  ) : sharedFiles.length === 0 ? (
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-10 text-center text-slate-300">
                      No files shared yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sharedFiles.map((item) => (
                        <a
                          key={item.messageId}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-4 transition hover:border-sky-400/20 hover:bg-white/[0.06]"
                        >
                          <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.08] text-sky-300">
                            <FileText size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-white">{item.fileName}</div>
                            <div className="mt-1 text-xs text-slate-400">{item.senderName} • {formatTime(item.createdAt)}</div>
                          </div>
                          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-slate-200">
                            <Download size={16} />
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {previewImageUrl && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute inset-0"
              aria-label="Close image preview"
            />

            <div className="relative z-10 max-h-[90vh] max-w-[92vw] overflow-hidden rounded-[28px] border border-white/10 bg-[#020617] shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/65"
                aria-label="Close preview"
              >
                <X size={18} />
              </button>

              <img
                src={previewImageUrl}
                alt="Attachment preview"
                className="block max-h-[90vh] w-auto max-w-[92vw] object-contain"
              />
            </div>
          </div>
        )}
      </main>
    </>
  )
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <>
          <SiteHeader />
          <main className="min-h-screen bg-[#020617] pt-24 text-white sm:pt-28">
            <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.18),_transparent_30%),linear-gradient(180deg,_#030712_0%,_#020617_45%,_#061229_100%)]" />
            <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-[1800px] items-center justify-center px-4 pb-6 sm:px-6 sm:pb-8 lg:px-8">
              <div className="w-full max-w-xl rounded-[30px] border border-white/10 bg-white/[0.04] px-6 py-14 text-center shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-md">
                <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-300/80">Messenger</div>
                <h2 className="mt-3 text-2xl font-black text-white">Loading messages...</h2>
                <p className="mt-2 text-sm text-slate-300">Please wait while we open your conversations.</p>
              </div>
            </div>
          </main>
        </>
      }
    >
      <MessagesPageContent />
    </Suspense>
  )
}
