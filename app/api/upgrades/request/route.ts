import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Resend } from "resend"

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0)
}

function buildPaymentSubmittedEmail(params: {
  userName: string
  packageLabel: string
  amount: number
  coins: number
  paymentMethod: string
  referenceNumber: string
}) {
  const userName = escapeHtml(params.userName)
  const packageLabel = escapeHtml(params.packageLabel)
  const amount = escapeHtml(formatAmount(params.amount))
  const coins = escapeHtml(String(params.coins || 0))
  const paymentMethod = escapeHtml(params.paymentMethod)
  const referenceNumber = escapeHtml(params.referenceNumber)

  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#eef2ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="width:100%;padding:32px 12px;background:#eef2ff;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,0.12);">
        <div style="background:#081225;padding:30px 24px 24px;text-align:center;">
          <img
            src="https://jb-collections.com/jb-logo.png"
            alt="JB Collections"
            style="width:72px;height:auto;display:block;margin:0 auto 14px;"
          />
          <div style="font-size:28px;line-height:1.2;color:#ffffff;font-weight:800;letter-spacing:0.3px;">
            JB Collections
          </div>
          <div style="margin-top:8px;font-size:13px;line-height:1.7;color:#cbd5e1;">
            Payment request received
          </div>
        </div>

        <div style="padding:34px 30px 30px;">
          <div style="text-align:center;margin-bottom:18px;">
            <img
              src="https://jb-collections.com/jb-coin.png"
              alt="JB Coin"
              style="width:92px;height:auto;display:block;margin:0 auto;"
            />
            <div style="margin-top:10px;font-size:13px;line-height:1.6;color:#2563eb;font-weight:700;letter-spacing:0.2px;">
              JB Coin payment verification in progress
            </div>
          </div>

          <h1 style="margin:0 0 14px;font-size:30px;line-height:1.2;color:#0f172a;font-weight:800;text-align:center;">
            Payment Proof Submitted
          </h1>

          <p style="margin:0 0 16px;font-size:16px;line-height:1.8;color:#334155;text-align:center;">
            Hi ${userName}, we received your payment proof and sent it for admin review.
          </p>

          <p style="margin:0 0 26px;font-size:16px;line-height:1.8;color:#334155;text-align:center;">
            Your JB Coins will be credited after your payment is confirmed.
          </p>

          <div style="margin-top:24px;background:#f8fafc;border-radius:16px;padding:20px;border:1px solid #e2e8f0;">
            <div style="display:flex;justify-content:space-between;margin-bottom:10px;gap:12px;">
              <span style="color:#64748b;">Package</span>
              <span style="font-weight:700;text-align:right;">${packageLabel}</span>
            </div>

            <div style="display:flex;justify-content:space-between;margin-bottom:10px;gap:12px;">
              <span style="color:#64748b;">Amount</span>
              <span style="font-weight:700;text-align:right;">${amount}</span>
            </div>

            <div style="display:flex;justify-content:space-between;margin-bottom:10px;gap:12px;">
              <span style="color:#64748b;">Coins</span>
              <span style="font-weight:700;color:#2563eb;text-align:right;">${coins} JB Coins</span>
            </div>

            <div style="display:flex;justify-content:space-between;margin-bottom:10px;gap:12px;">
              <span style="color:#64748b;">Payment Method</span>
              <span style="font-weight:700;text-align:right;">${paymentMethod}</span>
            </div>

            <div style="display:flex;justify-content:space-between;margin-top:16px;border-top:1px solid #e2e8f0;padding-top:10px;gap:12px;">
              <span style="color:#64748b;">Reference Number</span>
              <span style="font-size:12px;font-weight:700;text-align:right;">${referenceNumber}</span>
            </div>
          </div>

          <div style="background:#0f172a;border-radius:18px;padding:16px 18px;margin:24px 0 0;text-align:center;">
            <div style="font-size:14px;line-height:1.7;color:#ffffff;font-weight:700;">
              What happens next?
            </div>
            <div style="margin-top:4px;font-size:13px;line-height:1.7;color:#cbd5e1;">
              Our admin will review your receipt and approve your payment. Once approved, your JB Coins will be added to your account.
            </div>
          </div>
        </div>

        <div style="border-top:1px solid #e2e8f0;background:#f8fafc;padding:18px 24px;text-align:center;">
          <div style="margin-bottom:10px;">
            <img
              src="https://jb-collections.com/jb-coin.png"
              alt="JB Coin"
              style="width:34px;height:auto;display:block;margin:0 auto;"
            />
          </div>
          <p style="margin:0;font-size:13px;line-height:1.7;color:#64748b;">
            © 2026 JB Collections. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>
`
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const coins = Number(formData.get("coins") || 0)
    const amount = Number(formData.get("amount") || 0)
    const label = String(
      formData.get("label") || formData.get("package_label") || ""
    ).trim()

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
        {
          error:
            "Invalid receipt file type. Please upload JPG, PNG, WEBP, or PDF.",
        },
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

    const recipientEmail = profile?.email || user.email || null
    const userName =
      profile?.full_name?.trim() || user.email?.split("@")[0] || "User"

    if (recipientEmail && process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)

        await resend.emails.send({
          from: "JB Collections <noreply@jb-collections.com>",
          to: recipientEmail,
          subject: "JB Collections - Payment Proof Received",
          html: buildPaymentSubmittedEmail({
            userName,
            packageLabel: label || defaultSubject,
            amount,
            coins,
            paymentMethod,
            referenceNumber,
          }),
        })
      } catch (emailError) {
        console.error("Payment submitted email error:", emailError)
      }
    } else if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY is missing. Skipping payment submitted email.")
    }

    return NextResponse.json({
      ok: true,
      message:
        "Payment proof submitted successfully. Please wait for admin confirmation.",
    })
  } catch (error) {
    console.error("Upgrade request error:", error)

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}