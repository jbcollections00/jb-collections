import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

function createAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function answerCallbackQuery(callbackQueryId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return

  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: true,
    }),
  })
}

async function editTelegramCaption(params: {
  chatId: number
  messageId: number
  caption: string
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return

  await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: params.chatId,
      message_id: params.messageId,
      caption: params.caption,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [],
      },
    }),
  })
}

async function approveOrder(orderId: string) {
  const admin = createAdmin()

  const { data: order, error: orderError } = await admin
    .from("coin_purchase_orders")
    .select("*")
    .eq("id", orderId)
    .single()

  if (orderError || !order) {
    throw new Error("Order not found.")
  }

  const status = String(order.status || "").toLowerCase()

  if (status === "credited" || status === "approved") {
    throw new Error("Order already approved.")
  }

  if (status === "rejected" || status === "removed") {
    throw new Error("Order already rejected or removed.")
  }

  const coins = Number(order.coins || 0)

  if (!coins || coins <= 0) {
    throw new Error("Invalid coin amount.")
  }

  const { error: coinError } = await admin.rpc("handle_coin_change", {
    p_user_id: order.user_id,
    p_amount: coins,
    p_type: "purchase_credit",
    p_description: `Telegram approval for ${order.label || order.id}`,
  })

  if (coinError) {
    throw new Error(coinError.message || "Failed to credit coins.")
  }

  const { error: updateError } = await admin
    .from("coin_purchase_orders")
    .update({
      status: "credited",
      approved_at: new Date().toISOString(),
      credited_at: new Date().toISOString(),
      status_note: "Approved from Telegram",
    })
    .eq("id", orderId)

  if (updateError) {
    throw new Error(updateError.message || "Failed to update order.")
  }

  return order
}

async function rejectOrder(orderId: string) {
  const admin = createAdmin()

  const { data: order, error: orderError } = await admin
    .from("coin_purchase_orders")
    .select("*")
    .eq("id", orderId)
    .single()

  if (orderError || !order) {
    throw new Error("Order not found.")
  }

  const status = String(order.status || "").toLowerCase()

  if (status === "credited" || status === "approved") {
    throw new Error("Approved orders cannot be rejected.")
  }

  if (status === "rejected") {
    throw new Error("Order already rejected.")
  }

  const { error: updateError } = await admin
    .from("coin_purchase_orders")
    .update({
      status: "rejected",
      status_note: "Rejected from Telegram",
    })
    .eq("id", orderId)

  if (updateError) {
    throw new Error(updateError.message || "Failed to reject order.")
  }

  return order
}

export async function POST(req: Request) {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    const receivedSecret = req.headers.get("x-telegram-bot-api-secret-token")

    if (secret && receivedSecret !== secret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const update = await req.json()
    const callback = update?.callback_query

    if (!callback) {
      return NextResponse.json({ ok: true })
    }

    const callbackId = callback.id
    const data = String(callback.data || "")
    const chatId = callback.message?.chat?.id
    const messageId = callback.message?.message_id

    const [action, orderId] = data.split(":")

    if (!callbackId || !chatId || !messageId || !action || !orderId) {
      return NextResponse.json({ ok: true })
    }

    if (action === "approve") {
      const order = await approveOrder(orderId)

      await answerCallbackQuery(callbackId, "Approved. Coins credited.")

      await editTelegramCaption({
        chatId,
        messageId,
        caption: `
✅ <b>PAYMENT APPROVED</b>

🧾 <b>Order:</b> ${order.id}
👤 <b>Payer:</b> ${order.payer_name || "Unknown"}
💵 <b>Amount:</b> ₱${order.amount_php || order.amount || 0}
🪙 <b>Coins Credited:</b> ${order.coins || 0}
📱 <b>Method:</b> ${String(order.payment_method || "").toUpperCase()}
🔢 <b>Reference:</b> ${order.payment_reference || order.reference_number || ""}

Approved from Telegram.
        `.trim(),
      })

      return NextResponse.json({ ok: true })
    }

    if (action === "reject") {
      const order = await rejectOrder(orderId)

      await answerCallbackQuery(callbackId, "Rejected.")

      await editTelegramCaption({
        chatId,
        messageId,
        caption: `
❌ <b>PAYMENT REJECTED</b>

🧾 <b>Order:</b> ${order.id}
👤 <b>Payer:</b> ${order.payer_name || "Unknown"}
💵 <b>Amount:</b> ₱${order.amount_php || order.amount || 0}
🪙 <b>Coins:</b> ${order.coins || 0}
📱 <b>Method:</b> ${String(order.payment_method || "").toUpperCase()}
🔢 <b>Reference:</b> ${order.payment_reference || order.reference_number || ""}

Rejected from Telegram.
        `.trim(),
      })

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Telegram webhook error:", error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Something went wrong.",
      },
      { status: 500 }
    )
  }
}