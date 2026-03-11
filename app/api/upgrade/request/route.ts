import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export const runtime = "nodejs"

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const subject = String(formData.get("subject") || "Premium Upgrade Request").trim()
    const message = String(formData.get("message") || "").trim()
    const receipt = formData.get("receipt") as File | null

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 })
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

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("full_name, name, email")
      .eq("id", user.id)
      .single()

    let receiptUrl: string | null = null

    if (receipt) {
      const ext = receipt.name.split(".").pop()?.toLowerCase() || "jpg"
      const safeBase = receipt.name
        .replace(/\.[^/.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

      const filePath = `${user.id}/${Date.now()}-${safeBase}.${ext}`

      const bytes = await receipt.arrayBuffer()
      const buffer = Buffer.from(bytes)

      const { error: uploadError } = await adminSupabase.storage
        .from("upgrade-receipts")
        .upload(filePath, buffer, {
          contentType: receipt.type || "application/octet-stream",
          upsert: false,
        })

      if (uploadError) {
        return NextResponse.json(
          { error: uploadError.message || "Failed to upload receipt." },
          { status: 500 }
        )
      }

      const { data: publicData } = adminSupabase.storage
        .from("upgrade-receipts")
        .getPublicUrl(filePath)

      receiptUrl = publicData.publicUrl
    }

    const { error: insertError } = await adminSupabase.from("upgrade_requests").insert({
      sender_id: user.id,
      email: profile?.email || user.email || null,
      name: profile?.full_name || profile?.name || user.email || "User",
      plan: "premium",
      subject,
      body: message,
      status: "pending",
      receipt_url: receiptUrl,
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Upgrade request error:", error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Something went wrong",
      },
      { status: 500 }
    )
  }
}