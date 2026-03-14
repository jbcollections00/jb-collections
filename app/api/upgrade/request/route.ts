import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const subject = String(formData.get("subject") || "").trim()
    const message = String(formData.get("message") || "").trim()
    const receipt = formData.get("receipt") as File | null

    if (!message) {
      return NextResponse.redirect(new URL("/upgrade?error=missing-message", req.url))
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
      return NextResponse.redirect(new URL("/login", req.url))
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle()

    let receiptUrl: string | null = null
    let receiptPath: string | null = null

    if (receipt && receipt.size > 0) {
      const fileExt = receipt.name.split(".").pop() || "jpg"
      const fileName = `${user.id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(fileName, receipt, {
          cacheControl: "3600",
          upsert: false,
          contentType: receipt.type || "application/octet-stream",
        })

      if (uploadError) {
        console.error("Receipt upload error:", uploadError)
        return NextResponse.redirect(new URL("/upgrade?error=upload-failed", req.url))
      }

      const { data: publicUrlData } = supabase.storage
        .from("receipts")
        .getPublicUrl(fileName)

      receiptUrl = publicUrlData.publicUrl
      receiptPath = fileName
    }

    const payload = {
      sender_id: user.id,
      name: profile?.full_name || null,
      email: profile?.email || user.email || null,
      plan: "premium",
      subject: subject || "Premium upgrade request",
      body: message,
      status: "pending",
      admin_reply: null,
      receipt_url: receiptUrl,
      receipt_path: receiptPath,
    }

    const { error: insertError } = await supabase.from("upgrades").insert(payload)

    if (insertError) {
      console.error("Insert upgrade error:", insertError)
      return NextResponse.redirect(new URL("/upgrade?error=insert-failed", req.url))
    }

    return NextResponse.redirect(new URL("/upgrade?success=1", req.url))
  } catch (error) {
    console.error("Upgrade request error:", error)
    return NextResponse.redirect(new URL("/upgrade?error=unexpected", req.url))
  }
}