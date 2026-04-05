import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]

function normalizePlan(value: FormDataEntryValue | null) {
  const plan = String(value || "").trim().toLowerCase()
  return plan === "platinum" ? "platinum" : "premium"
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const coins = Number(formData.get("coins") || 0)
    const amount = Number(formData.get("amount") || 0)
    const label = String(formData.get("label") || "").trim()

    const requestedPlan = normalizePlan(formData.get("plan"))
    const subject = String(formData.get("subject") || "").trim()
    const message = String(formData.get("message") || "").trim()
    const paymentName = String(formData.get("payment_name") || "").trim()
    const paymentMethod = String(formData.get("payment_method") || "").trim()
    const paymentNumber = String(formData.get("payment_number") || "").trim()
    const referenceNumber = String(formData.get("reference_number") || "").trim()
    const receipt = formData.get("receipt")

    if (!message) {
      return NextResponse.json(
        { error: "Please enter your message." },
        { status: 400 }
      )
    }

    if (!paymentName) {
      return NextResponse.json(
        { error: "Please enter the account name used for payment." },
        { status: 400 }
      )
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Please select a payment method." },
        { status: 400 }
      )
    }

    if (!referenceNumber) {
      return NextResponse.json(
        { error: "Please enter the payment reference number." },
        { status: 400 }
      )
    }

    if (!(receipt instanceof File) || receipt.size === 0) {
      return NextResponse.json(
        { error: "Please upload your payment receipt." },
        { status: 400 }
      )
    }

    if (receipt.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Receipt file is too large. Maximum size is 10MB." },
        { status: 400 }
      )
    }

    const mimeType = receipt.type || "application/octet-stream"

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Invalid receipt file type. Please upload JPG, PNG, WEBP, or PDF." },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()

    const supabase = createServerClient(
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("Profile fetch error:", profileError)
    }

    const rawExt = receipt.name.split(".").pop()?.toLowerCase() || ""
    const safeExt =
      rawExt && /^[a-z0-9]+$/.test(rawExt)
        ? rawExt
        : mimeType === "application/pdf"
          ? "pdf"
          : "jpg"

    const fileName = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${safeExt}`

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(fileName, receipt, {
        cacheControl: "3600",
        upsert: false,
        contentType: mimeType,
      })

    if (uploadError) {
      console.error("Receipt upload error:", uploadError)
      return NextResponse.json(
        { error: "Receipt upload failed. Please try again." },
        { status: 500 }
      )
    }

    const { data: publicUrlData } = supabase.storage
      .from("receipts")
      .getPublicUrl(fileName)

    const receiptUrl = publicUrlData.publicUrl
    const receiptPath = fileName

    const defaultSubject = subject || "JB Coin Payment Request"

    const finalBody = [
      message,
      "",
      `Package Label: ${label || "N/A"}`,
      `Amount: ${amount || 0}`,
      `Coins: ${coins || 0}`,
      `Payment Method: ${paymentMethod || "N/A"}`,
      `Reference Number: ${referenceNumber || "N/A"}`,
    ].join("\n")

    const payload = {
      sender_id: user.id,
      name: profile?.full_name || null,
      email: profile?.email || user.email || null,
      plan: requestedPlan,
      subject: defaultSubject,
      body: finalBody,
      status: "pending",
      admin_reply: null,
      receipt_url: receiptUrl,
      receipt_path: receiptPath,
      payment_name: paymentName,
      payment_method: paymentMethod,
      payment_number: paymentNumber || null,
      reference_number: referenceNumber,
    }

    const { error: insertError } = await supabase
      .from("upgrades")
      .insert(payload)

    if (insertError) {
      console.error("Insert upgrade error:", insertError)
      return NextResponse.json(
        { error: insertError.message || "Failed to save your request." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: "Payment proof submitted successfully. Please wait for admin confirmation.",
    })
  } catch (error) {
    console.error("Upgrade request error:", error)

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}