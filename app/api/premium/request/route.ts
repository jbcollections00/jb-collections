import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const email = String(formData.get("email") || "")
    const name = String(formData.get("name") || "")
    const message = String(formData.get("message") || "")
    const receipt = formData.get("receipt") as File | null

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    if (!receipt) {
      return NextResponse.json({ error: "Receipt is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const ext = receipt.name.split(".").pop() || "jpg"
    const fileName = `${user.id}/${Date.now()}.${ext}`

    const arrayBuffer = await receipt.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(fileName, buffer, {
        contentType: receipt.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: "Failed to upload receipt." }, { status: 500 })
    }

    const { error: insertError } = await supabase.from("premium_requests").insert({
      user_id: user.id,
      email,
      name,
      message,
      receipt_url: uploadData.path,
      status: "pending",
    })

    if (insertError) {
      return NextResponse.json({ error: "Failed to save request." }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Premium request error:", error)
    return NextResponse.json({ error: "Request failed" }, { status: 500 })
  }
}