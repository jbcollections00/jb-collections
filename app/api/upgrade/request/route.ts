import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const subject = String(formData.get("subject") || "").trim()
    const message = String(formData.get("message") || "").trim()

    if (!message) {
      return NextResponse.json(
        { error: "Upgrade reason is required" },
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
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single()

    const { error } = await supabase.from("upgrades").insert({
      sender_id: user.id,
      name: profile?.full_name || null,
      email: profile?.email || user.email || null,
      plan: "premium",
      subject: subject || "Premium upgrade request",
      body: message,
      status: "pending",
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Upgrade request error:", error)
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
7D