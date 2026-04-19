import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

// ✅ VALID PACKAGES
const VALID_PACKAGES = [
  { amount: 50, coins: 690 },
  { amount: 100, coins: 1400 },
  { amount: 200, coins: 2900 },
  { amount: 500, coins: 7500 },
  { amount: 1000, coins: 16000 },
  { amount: 20, coins: 260 },
]

// 🔐 USER CLIENT (AUTH)
async function createUserClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  )
}

// 🔥 ADMIN CLIENT (BYPASS RLS)
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

    // 🔐 AUTH
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()

    const amountPhp = Number(formData.get("amount") || formData.get("amountPhp") || 0)
    const coins = Number(formData.get("coins") || 0)

    const label = String(formData.get("label") || "").trim()

    const paymentMethod = String(
      formData.get("method") || formData.get("paymentMethod") || "maya"
    ).toLowerCase()

    const paymentReference = String(
      formData.get("referenceNumber") || formData.get("paymentReference") || ""
    ).trim()

    const proof = formData.get("receipt") || formData.get("proof")

    // ✅ VALIDATE
    const isValidPackage = VALID_PACKAGES.some(
      (p) => p.amount === amountPhp && p.coins === coins
    )

    if (!isValidPackage) {
      return NextResponse.json({ error: "Invalid package." }, { status: 400 })
    }

    if (!paymentReference) {
      return NextResponse.json({ error: "Reference required." }, { status: 400 })
    }

    if (!(proof instanceof File) || proof.size <= 0) {
      return NextResponse.json({ error: "Proof required." }, { status: 400 })
    }

    // 🔥 UPLOAD (ADMIN FIX)
    const ext = proof.name.split(".").pop() || "jpg"
    const path = `${user.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await admin.storage
      .from("payment-proofs")
      .upload(path, proof, { upsert: false })

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      )
    }

    const { data: urlData } = admin.storage
      .from("payment-proofs")
      .getPublicUrl(path)

    // 🧾 INSERT ORDER
    const { data: order, error: insertError } = await supabase
      .from("coin_purchase_orders")
      .insert({
        user_id: user.id,
        amount_php: amountPhp,
        coins,
        label: label || `₱${amountPhp} Package`,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        proof_url: urlData.publicUrl,
        status: "pending",
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Payment submitted successfully",
      transaction: order,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}