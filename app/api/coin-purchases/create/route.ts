import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const VALID_PACKAGES = [
  { amount: 20, coins: 270 },
  { amount: 50, coins: 690 },
  { amount: 100, coins: 1400 },
  { amount: 200, coins: 2900 },
  { amount: 500, coins: 7500 },
  { amount: 1000, coins: 15500 },
]

async function createUserClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )
}

function createAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

async function sendTelegramPaymentAlert(params: {
  orderId: string
  payerName: string
  amountPhp: number
  coins: number
  label: string
  paymentMethod: string
  paymentReference: string
  proofUrl: string
  notes: string
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) return

  const caption = `
💰 <b>New JB Coin Payment</b>

🧾 <b>Order:</b> ${escapeHtml(params.orderId)}
👤 <b>Payer:</b> ${escapeHtml(params.payerName)}
💵 <b>Amount:</b> ₱${params.amountPhp}
🪙 <b>Coins:</b> ${params.coins}
📦 <b>Package:</b> ${escapeHtml(params.label)}
📱 <b>Method:</b> ${escapeHtml(params.paymentMethod.toUpperCase())}
🔢 <b>Reference:</b> ${escapeHtml(params.paymentReference)}
${params.notes ? `📝 <b>Notes:</b> ${escapeHtml(params.notes)}` : ""}

Check the receipt image before approving.
`.trim()

  await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      photo: params.proofUrl,
      caption,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Approve",
              callback_data: `approve:${params.orderId}`,
            },
            {
              text: "❌ Reject",
              callback_data: `reject:${params.orderId}`,
            },
          ],
        ],
      },
    }),
  })
}

export async function POST(req: Request) {
  try {
    const supabase = await createUserClient()
    const admin = createAdmin()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()

    const amountPhp = Number(formData.get("amount") || formData.get("amountPhp") || 0)

    const selectedPackage = VALID_PACKAGES.find((pkg) => pkg.amount === amountPhp)

    if (!selectedPackage) {
      return NextResponse.json({ error: "Invalid package configuration." }, { status: 400 })
    }

    const coins = selectedPackage.coins
    const label = String(formData.get("label") || `₱${amountPhp} Package`).trim()

    const paymentMethod = String(
      formData.get("method") || formData.get("paymentMethod") || "maya"
    )
      .trim()
      .toLowerCase()

    if (paymentMethod !== "gcash" && paymentMethod !== "maya") {
      return NextResponse.json({ error: "Invalid payment method." }, { status: 400 })
    }

    const payerName = String(formData.get("payer_name") || formData.get("payerName") || "")
      .trim()
      .slice(0, 120)

    const paymentReference = String(
      formData.get("referenceNumber") || formData.get("paymentReference") || ""
    ).trim()

    const notes = String(formData.get("notes") || "").trim().slice(0, 500)

    const proof = formData.get("receipt") || formData.get("proof")

    if (!payerName) {
      return NextResponse.json({ error: "Payer name is required." }, { status: 400 })
    }

    if (!paymentReference) {
      return NextResponse.json({ error: "Payment reference is required." }, { status: 400 })
    }

    if (paymentReference.length < 5) {
      return NextResponse.json({ error: "Payment reference is too short." }, { status: 400 })
    }

    if (!(proof instanceof File) || proof.size <= 0) {
      return NextResponse.json({ error: "Payment proof is required." }, { status: 400 })
    }

    if (proof.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Proof image must be 10MB or below." }, { status: 400 })
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"]

    if (!allowedTypes.includes(proof.type)) {
      return NextResponse.json({ error: "Proof must be JPG, PNG, or WEBP." }, { status: 400 })
    }

    const { data: existingReference, error: existingReferenceError } = await supabase
      .from("coin_purchase_orders")
      .select("id")
      .eq("payment_reference", paymentReference)
      .maybeSingle()

    if (existingReferenceError) {
      return NextResponse.json(
        { error: existingReferenceError.message || "Failed to check payment reference." },
        { status: 500 }
      )
    }

    if (existingReference) {
      return NextResponse.json(
        { error: "This reference number was already used." },
        { status: 400 }
      )
    }

    const ext = proof.name.split(".").pop()?.toLowerCase() || "jpg"
    const safeRef =
      paymentReference.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "proof"

    const path = `${user.id}/${Date.now()}-${safeRef}.${ext}`

    const { error: uploadError } = await admin.storage
      .from("payment-proofs")
      .upload(path, proof, {
        upsert: false,
        contentType: proof.type,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || "Failed to upload proof." },
        { status: 500 }
      )
    }

    const { data: publicUrlData } = admin.storage
      .from("payment-proofs")
      .getPublicUrl(path)

    const proofUrl = publicUrlData.publicUrl

    const { data: order, error: insertError } = await supabase
      .from("coin_purchase_orders")
      .insert({
        user_id: user.id,
        amount_php: amountPhp,
        coins,
        label: label || `₱${amountPhp} Package`,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        payer_name: payerName,
        notes,
        proof_url: proofUrl,
        status: "pending",
      })
      .select("id, status, created_at, amount_php, coins, label, payment_method, payment_reference")
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message || "Failed to create order." },
        { status: 500 }
      )
    }

    await sendTelegramPaymentAlert({
      orderId: order.id,
      payerName,
      amountPhp: order.amount_php,
      coins: order.coins,
      label: order.label,
      paymentMethod: order.payment_method,
      paymentReference: order.payment_reference,
      proofUrl,
      notes,
    })

    return NextResponse.json({
      success: true,
      message: "Payment submitted. Please wait for admin approval.",
      transaction: {
        id: order.id,
        label: order.label,
        amount: order.amount_php,
        coins: order.coins,
        bonus: 0,
        base: coins,
        method: order.payment_method,
        payerName,
        referenceNumber: order.payment_reference,
        notes,
        status: order.status,
        createdAt: order.created_at,
        receiptName: proof.name,
      },
    })
  } catch (error) {
    console.error("Create coin purchase order error:", error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Something went wrong.",
      },
      { status: 500 }
    )
  }
}