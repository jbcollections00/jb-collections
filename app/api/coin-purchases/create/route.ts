import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const VALID_PACKAGES = [
  { amount: 50, coins: 690 },
  { amount: 100, coins: 1400 },
  { amount: 200, coins: 2900 },
  { amount: 500, coins: 7500 },
  { amount: 1000, coins: 15500 },
  { amount: 20, coins: 270 },
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
    const coins = Number(formData.get("coins") || 0)

    const label = String(formData.get("label") || "").trim()

    const paymentMethod = String(
      formData.get("method") || formData.get("paymentMethod") || "maya"
    )
      .trim()
      .toLowerCase()

    const paymentReference = String(
      formData.get("referenceNumber") || formData.get("paymentReference") || ""
    ).trim()

    const proof = formData.get("receipt") || formData.get("proof")

    const isValidPackage = VALID_PACKAGES.some(
      (pkg) => pkg.amount === amountPhp && pkg.coins === coins
    )

    if (!isValidPackage) {
      return NextResponse.json(
        { error: "Invalid package configuration." },
        { status: 400 }
      )
    }

    if (!paymentReference) {
      return NextResponse.json(
        { error: "Payment reference is required." },
        { status: 400 }
      )
    }

    if (!(proof instanceof File) || proof.size <= 0) {
      return NextResponse.json(
        { error: "Payment proof is required." },
        { status: 400 }
      )
    }

    if (proof.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Proof image must be 10MB or below." },
        { status: 400 }
      )
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if (!allowedTypes.includes(proof.type)) {
      return NextResponse.json(
        { error: "Proof must be JPG, PNG, or WEBP." },
        { status: 400 }
      )
    }

    const ext = proof.name.split(".").pop()?.toLowerCase() || "jpg"
    const safeRef =
      paymentReference.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "proof"

    const path = `${user.id}/${Date.now()}-${safeRef}.${ext}`

    const { error: uploadError } = await admin.storage
      .from("payment-proofs")
      .upload(path, proof, { upsert: false })

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
        proof_url: proofUrl,
        status: "pending",
      })
      .select("id, status, created_at")
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message || "Failed to create order." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Payment submitted. Please wait for admin approval.",
      transaction: {
        id: order.id,
        status: order.status,
        createdAt: order.created_at,
      },
    })
  } catch (error) {
    console.error("Create coin purchase order error:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Something went wrong.",
      },
      { status: 500 }
    )
  }
}