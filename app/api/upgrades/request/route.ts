import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"
import crypto from "crypto"

export const runtime = "nodejs"

type CoinPurchaseOrderRow = {
  id: string
  user_id: string
  amount_php: number
  coins: number
  label: string | null
  payment_method: "gcash" | "maya"
  payment_reference: string | null
  proof_url: string | null
  status: "pending" | "approved" | "rejected"
  admin_note: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_at: string | null
  created_at: string
  updated_at: string
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

async function createSupabaseUserClient() {
  const cookieStore = await cookies()

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })
}

function createSupabaseAdminClient() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")

  return createSupabaseAdmin(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function toNumber(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : ""
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-")
}

function sha256(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex")
}

async function pickReceiptBucket(adminDb: ReturnType<typeof createSupabaseAdminClient>) {
  const preferred = process.env.SUPABASE_UPGRADE_RECEIPTS_BUCKET?.trim()
  if (preferred) {
    return preferred
  }

  const { data, error } = await adminDb.storage.listBuckets()
  if (error) {
    console.error("Bucket lookup error:", error)
    return null
  }

  const names = (data || []).map((bucket) => bucket.name)
  const common = ["upgrade-receipts", "receipts", "payment-receipts", "uploads"]

  for (const candidate of common) {
    if (names.includes(candidate)) {
      return candidate
    }
  }

  return null
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseUserClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const formData = await request.formData()

    const amount = toNumber(formData.get("amount"))
    const coins = toNumber(formData.get("coins"))
    const bonus = toNumber(formData.get("bonus"))
    const base = toNumber(formData.get("base"))
    const label = toText(formData.get("label")) || "JB Coin Package"
    const methodRaw = toText(formData.get("method")).toLowerCase()
    const method: "gcash" | "maya" = methodRaw === "gcash" ? "gcash" : "maya"
    const payerName = toText(formData.get("payer_name"))
    const referenceNumber = toText(formData.get("reference_number"))
    const normalizedReference = referenceNumber.replace(/\s+/g, "").toUpperCase()
    const notes = toText(formData.get("notes"))
    const receipt = formData.get("receipt")

    if (!payerName) {
      return NextResponse.json(
        { ok: false, error: "Please enter the payer name." },
        { status: 400 }
      )
    }

    if (!referenceNumber) {
      return NextResponse.json(
        { ok: false, error: "Please enter the payment reference number." },
        { status: 400 }
      )
    }

    if (!(receipt instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Please upload your payment receipt." },
        { status: 400 }
      )
    }

    if (amount <= 0 || coins <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid payment package." },
        { status: 400 }
      )
    }

    if (receipt.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: "Receipt file is too large. Max size is 10MB." },
        { status: 400 }
      )
    }

    const adminDb = createSupabaseAdminClient()

    const { data: existingReference, error: existingReferenceError } = await adminDb
      .from("coin_purchase_orders")
      .select("id, status, user_id")
      .eq("payment_reference", normalizedReference)
      .limit(1)
      .maybeSingle()

    if (existingReferenceError) {
      console.error("Reference duplicate check error:", existingReferenceError)
      return NextResponse.json(
        { ok: false, error: "Failed to validate payment reference." },
        { status: 500 }
      )
    }

    if (existingReference) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This payment reference number was already submitted. Please double-check your receipt or contact admin.",
        },
        { status: 409 }
      )
    }

    const fileBuffer = Buffer.from(await receipt.arrayBuffer())
    const fileHash = sha256(fileBuffer)
    const shortHash = fileHash.slice(0, 24)

    const { data: existingReceiptHash, error: existingReceiptHashError } = await adminDb
      .from("coin_purchase_orders")
      .select("id, status, proof_url")
      .like("proof_url", `%${shortHash}%`)
      .limit(1)
      .maybeSingle()

    if (existingReceiptHashError) {
      console.error("Receipt duplicate check error:", existingReceiptHashError)
      return NextResponse.json(
        { ok: false, error: "Failed to validate receipt file." },
        { status: 500 }
      )
    }

    if (existingReceiptHash) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This receipt image appears to have been submitted already. Please upload the correct receipt or contact admin.",
        },
        { status: 409 }
      )
    }

    const bucketName = await pickReceiptBucket(adminDb)
    if (!bucketName) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No receipt storage bucket found. Create a bucket named upgrade-receipts, receipts, payment-receipts, or set SUPABASE_UPGRADE_RECEIPTS_BUCKET.",
        },
        { status: 500 }
      )
    }

    const extension =
      receipt.name.includes(".") ? receipt.name.split(".").pop() || "jpg" : "jpg"
    const safeFileName = sanitizeFilename(receipt.name || `receipt.${extension}`)
    const filePath = `coin-purchase-orders/${user.id}/${shortHash}-${Date.now()}-${safeFileName}`

    const { error: uploadError } = await adminDb.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType: receipt.type || "application/octet-stream",
        upsert: false,
      })

    if (uploadError) {
      console.error("Receipt upload error:", uploadError)
      return NextResponse.json(
        { ok: false, error: "Failed to upload receipt proof." },
        { status: 500 }
      )
    }

    const { data: publicUrlData } = adminDb.storage
      .from(bucketName)
      .getPublicUrl(filePath)

    const receiptUrl = publicUrlData?.publicUrl || null

    const { data: inserted, error: insertError } = await adminDb
      .from("coin_purchase_orders")
      .insert({
        user_id: user.id,
        amount_php: amount,
        coins,
        label,
        payment_method: method,
        payment_reference: normalizedReference,
        proof_url: receiptUrl,
        status: "pending",
        admin_note: notes || null,
      })
      .select(
        "id, user_id, amount_php, coins, label, payment_method, payment_reference, proof_url, status, admin_note, approved_by, approved_at, rejected_at, created_at, updated_at"
      )
      .single()

    if (insertError || !inserted) {
      console.error("Coin purchase order insert error:", insertError)
      return NextResponse.json(
        { ok: false, error: "Failed to save payment request." },
        { status: 500 }
      )
    }

    const order = inserted as CoinPurchaseOrderRow

    return NextResponse.json(
      {
        ok: true,
        transaction_id: order.id,
        transaction: {
          id: order.id,
          label: order.label || label,
          amount: Number(order.amount_php || amount),
          coins: Number(order.coins || coins),
          bonus,
          base,
          method: order.payment_method || method,
          payerName,
          referenceNumber: order.payment_reference || normalizedReference,
          notes: order.admin_note || notes,
          status: order.status || "pending",
          createdAt: order.created_at || new Date().toISOString(),
          receiptName: receipt.name,
          receiptUrl: order.proof_url || receiptUrl,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Coin purchase request POST route error:", error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to submit payment proof.",
      },
      { status: 500 }
    )
  }
}
