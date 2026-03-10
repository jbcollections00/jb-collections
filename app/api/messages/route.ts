import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const name = String(formData.get("name") || "").trim()
    const email = String(formData.get("email") || "").trim()
    const subject = String(formData.get("subject") || "").trim()
    const message = String(formData.get("message") || "").trim()

    if (!message) {
      return NextResponse.redirect(
        new URL("/contact?error=Message is required", req.url)
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

    const { error } = await supabase.from("messages").insert({
      sender_id: user?.id ?? null,
      name: name || null,
      email: email || null,
      subject: subject || null,
      body: message,
      status: "open",
    })

    if (error) {
      return NextResponse.redirect(
        new URL(`/contact?error=${encodeURIComponent(error.message)}`, req.url)
      )
    }

    return NextResponse.redirect(
      new URL("/contact?success=Your message has been sent", req.url)
    )
  } catch {
    return NextResponse.redirect(
      new URL("/contact?error=Something went wrong", req.url)
    )
  }
}