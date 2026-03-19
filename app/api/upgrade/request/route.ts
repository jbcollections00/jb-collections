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

    const requestedPlan = normalizePlan(formData.get("plan"))
    const subject = String(formData.get("subject") || "").trim()
    const message = String(formData.get("message") || "").trim()
    const receipt = formData.get("receipt")

    if (!message) {
      return NextResponse.redirect(
        new URL(`/upgrade?plan=${requestedPlan}&error=missing-message`, req.url),
        { status: 303 }
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
      return NextResponse.redirect(new URL("/login", req.url), {
        status: 303,
      })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.error("Profile fetch error:", profileError)
    }

    let receiptUrl: string | null = null
    let receiptPath: string | null = null

    if (receipt instanceof File && receipt.size > 0) {
      if (receipt.size > MAX_FILE_SIZE) {
        return NextResponse.redirect(
          new URL(`/upgrade?plan=${requestedPlan}&error=file-too-large`, req.url),
          { status: 303 }
        )
      }

      const mimeType = receipt.type || "application/octet-stream"

      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        return NextResponse.redirect(
          new URL(`/upgrade?plan=${requestedPlan}&error=invalid-file-type`, req.url),
          { status: 303 }
        )
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
        return NextResponse.redirect(
          new URL(`/upgrade?plan=${requestedPlan}&error=upload-failed`, req.url),
          { status: 303 }
        )
      }

      const { data: publicUrlData } = supabase.storage
        .from("receipts")
        .getPublicUrl(fileName)

      receiptUrl = publicUrlData.publicUrl
      receiptPath = fileName
    }

    const defaultSubject =
      requestedPlan === "platinum"
        ? "Platinum upgrade request"
        : "Premium upgrade request"

    const payload = {
      sender_id: user.id,
      name: profile?.full_name || null,
      email: profile?.email || user.email || null,
      plan: requestedPlan,
      subject: subject || defaultSubject,
      body: message,
      status: "pending",
      admin_reply: null,
      receipt_url: receiptUrl,
      receipt_path: receiptPath,
    }

    const { error: insertError } = await supabase
      .from("upgrades")
      .insert(payload)

    if (insertError) {
      console.error("Insert upgrade error:", insertError)
      return NextResponse.redirect(
        new URL(`/upgrade?plan=${requestedPlan}&error=insert-failed`, req.url),
        { status: 303 }
      )
    }

    return NextResponse.redirect(
      new URL(`/upgrade?plan=${requestedPlan}&success=1`, req.url),
      { status: 303 }
    )
  } catch (error) {
    console.error("Upgrade request error:", error)

    return NextResponse.redirect(
      new URL("/upgrade?error=unexpected", req.url),
      { status: 303 }
    )
  }
}