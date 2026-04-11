import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

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

    const formData = await req.formData()

    const amountPhp = Number(formData.get("amountPhp") || 0)
    const coins = Number(formData.get("coins") || 0)
    const label = String(formData.get("label") || "").trim()
    const paymentMethod = String(formData.get("paymentMethod") || "maya").trim().toLowerCase()
    const paymentReference = String(formData.get("paymentReference") || "").trim()
    const proof = formData.get("proof")

    if (!amountPhp || amountPhp <= 0) {
      return NextResponse.json({ error: "Invalid amount." }, { status: 400 })
    }

    if (!coins || coins <= 0) {
      return NextResponse.json({ error: "Invalid coin amount." }, { status: 400 })
    }

    if (!paymentReference) {
      return NextResponse.json({ error: "Payment reference is required." }, { status: 400 })
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

    const ext = proof.name.split(".").pop()?.toLowerCase() || "jpg"
    const safeRef = paymentReference.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "proof"
    const path = `${user.id}/${Date.now()}-${safeRef}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(path, proof, { upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || "Failed to upload proof." }, { status: 500 })
    }

    const { data: publicUrlData } = supabase.storage
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
      return NextResponse.json({ error: insertError.message || "Failed to create order." }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Payment submitted. Please wait for admin approval.",
      order,
    })
  } catch (error) {
    console.error("Create coin purchase order error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong." },
      { status: 500 }
    )
  }
}
