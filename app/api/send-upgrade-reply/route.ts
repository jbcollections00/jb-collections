import { NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const PREMIUM_PRICE = "₱300 / year"
const GCASH_NAME = "JONATHAN BARRUGA"
const GCASH_NUMBER = "09685289257"
const GCASH_QR_URL = `${process.env.NEXT_PUBLIC_SITE_URL}/gcash-qr.jpg`

export async function POST(req: Request) {
  try {
    const { email, name } = await req.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; color: #0f172a; line-height: 1.7;">
        <h2>Hello ${name || "there"},</h2>

        <p>Your premium upgrade request has been received.</p>

        <p><strong>Premium Plan:</strong> ${PREMIUM_PRICE}</p>

        <h3>Payment via GCash</h3>

        <p><strong>Name:</strong> ${GCASH_NAME}</p>
        <p><strong>Number:</strong> ${GCASH_NUMBER}</p>

        <p>Please send your payment screenshot after paying so your premium access can be processed.</p>

        <div style="margin: 20px 0;">
          <img src="${GCASH_QR_URL}" alt="GCash QR" style="max-width: 260px; width: 100%; border-radius: 12px; border: 1px solid #e2e8f0;" />
        </div>

        <p>Thank you!</p>
      </div>
    `

    await resend.emails.send({
      from: "JB Collections <noreply@yourdomain.com>",
      to: email,
      subject: "Premium Upgrade Payment Details",
      html,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Send upgrade reply error:", error)
    return NextResponse.json({ error: "Email failed" }, { status: 500 })
  }
}