import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export const runtime = "nodejs"

type ProfileRow = {
  id: string
  role?: string | null
  membership?: string | null
  is_premium?: boolean | null
  coins?: number | null
}

type ParticipantRow = {
  id: string
  conversation_id: string
  user_id: string
  deleted_at?: string | null
}

type ConversationMessageRow = {
  id: string
  conversation_id: string
  sender_id: string | null
  body: string | null
  attachment_url: string | null
  deleted_at?: string | null
}

type SendMessageBody = {
  conversationId?: string
  body?: string
  attachmentUrl?: string | null
  replyToMessageId?: string | null
  forwardedFromMessageId?: string | null
  forwardedByUserId?: string | null
}

function normalizeMembership(profile?: ProfileRow | null) {
  const role = String(profile?.role || "").trim().toLowerCase()
  const membership = String(profile?.membership || "").trim().toLowerCase()

  if (role === "admin") return "admin"
  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  if (profile?.is_premium) return "premium"
  return "standard"
}

function getMessageCost(hasAttachment: boolean) {
  return hasAttachment ? 10 : 5
}

function getMessageDescription(hasAttachment: boolean) {
  return hasAttachment ? "Messenger message with attachment" : "Messenger message"
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json()) as SendMessageBody

    const conversationId = String(body.conversationId || "").trim()
    const messageBody = String(body.body || "").trim()
    const attachmentUrl = String(body.attachmentUrl || "").trim() || null
    const replyToMessageId = String(body.replyToMessageId || "").trim() || null
    const forwardedFromMessageId = String(body.forwardedFromMessageId || "").trim() || null
    const forwardedByUserId = String(body.forwardedByUserId || "").trim() || null

    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 })
    }

    if (!messageBody && !attachmentUrl) {
      return NextResponse.json(
        { error: "Please write a message or attach a file." },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server is missing Supabase service role configuration." },
        { status: 500 }
      )
    }

    const adminDb = createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: participantData, error: participantError } = await adminDb
      .from("conversation_participants")
      .select("id, conversation_id, user_id, deleted_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (participantError) {
      return NextResponse.json(
        { error: participantError.message || "Failed to verify conversation access." },
        { status: 500 }
      )
    }

    if (!participantData) {
      return NextResponse.json(
        { error: "You are not allowed to send messages in this conversation." },
        { status: 403 }
      )
    }

    if (replyToMessageId) {
      const { data: replyMessage, error: replyError } = await adminDb
        .from("conversation_messages")
        .select("id, conversation_id, deleted_at")
        .eq("id", replyToMessageId)
        .maybeSingle()

      if (replyError) {
        return NextResponse.json(
          { error: replyError.message || "Failed to validate reply message." },
          { status: 500 }
        )
      }

      if (!replyMessage || replyMessage.conversation_id !== conversationId || replyMessage.deleted_at) {
        return NextResponse.json(
          { error: "Reply target is invalid." },
          { status: 400 }
        )
      }
    }

    if (forwardedFromMessageId) {
      const { data: forwardedMessage, error: forwardedError } = await adminDb
        .from("conversation_messages")
        .select("id, deleted_at")
        .eq("id", forwardedFromMessageId)
        .maybeSingle()

      if (forwardedError) {
        return NextResponse.json(
          { error: forwardedError.message || "Failed to validate forwarded message." },
          { status: 500 }
        )
      }

      if (!forwardedMessage || forwardedMessage.deleted_at) {
        return NextResponse.json(
          { error: "Forwarded source message is invalid." },
          { status: 400 }
        )
      }
    }

    const { data: profileData, error: profileError } = await adminDb
      .from("profiles")
      .select("id, role, membership, is_premium, coins")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message || "Failed to load profile." },
        { status: 500 }
      )
    }

    const profile = profileData as ProfileRow | null
    const membershipLevel = normalizeMembership(profile)
    const hasAttachment = Boolean(attachmentUrl)
    const cost = membershipLevel === "admin" ? 0 : getMessageCost(hasAttachment)
    const currentCoins = Number(profile?.coins || 0)

    if (cost > 0 && currentCoins < cost) {
      return NextResponse.json(
        {
          error: "Not enough JB Coins.",
          code: "INSUFFICIENT_COINS",
          required: cost,
          current: currentCoins,
        },
        { status: 400 }
      )
    }

    if (cost > 0) {
      const newCoins = currentCoins - cost

      const { error: debitError } = await adminDb
        .from("profiles")
        .update({ coins: newCoins })
        .eq("id", user.id)

      if (debitError) {
        return NextResponse.json(
          { error: debitError.message || "Failed to deduct JB Coins." },
          { status: 500 }
        )
      }

      const { error: historyError } = await adminDb.from("coin_history").insert({
        user_id: user.id,
        amount: -cost,
        type: "spend_message",
        description: getMessageDescription(hasAttachment),
      })

      if (historyError) {
        console.error("Coin history insert error:", historyError)
      }
    }

    const insertPayload = {
      conversation_id: conversationId,
      sender_id: user.id,
      sender_role: "user",
      body: messageBody || null,
      attachment_url: attachmentUrl,
      reply_to_message_id: replyToMessageId,
      forwarded_from_message_id: forwardedFromMessageId,
      forwarded_by_user_id: forwardedByUserId,
    }

    const { data: insertedRows, error: insertError } = await adminDb
      .from("conversation_messages")
      .insert(insertPayload)
      .select("id, conversation_id, sender_id, body, attachment_url, deleted_at")
      .limit(1)

    if (insertError) {
      if (cost > 0) {
        const refundCoins = currentCoins

        const { error: refundProfileError } = await adminDb
          .from("profiles")
          .update({ coins: refundCoins })
          .eq("id", user.id)

        if (refundProfileError) {
          console.error("Coin refund profile update error:", refundProfileError)
        }

        const { error: refundHistoryError } = await adminDb.from("coin_history").insert({
          user_id: user.id,
          amount: cost,
          type: "message_refund",
          description: "Refund for failed messenger send",
        })

        if (refundHistoryError) {
          console.error("Coin refund history insert error:", refundHistoryError)
        }
      }

      return NextResponse.json(
        { error: insertError.message || "Failed to send message." },
        { status: 500 }
      )
    }

    await adminDb
      .from("conversations")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId)

    const insertedMessage =
      ((insertedRows as ConversationMessageRow[] | null) || [])[0] || null

    return NextResponse.json({
      success: true,
      message: "Message sent.",
      cost,
      remainingCoins: cost > 0 ? currentCoins - cost : currentCoins,
      row: insertedMessage,
    })
  } catch (error) {
    console.error("Secure message send route error:", error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Something went wrong.",
      },
      { status: 500 }
    )
  }
}