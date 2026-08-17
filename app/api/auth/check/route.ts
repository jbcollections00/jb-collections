import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server" // Siguraduhing tama ang path ng iyong supabase client

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Kunin ang active session mula sa Supabase
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      // Kung walang session o may error, ibig sabihin hindi naka-login
      return NextResponse.json({ isLoggedIn: false }, { status: 401 })
    }

    // Kung may session, ibalik ang user data
    return NextResponse.json({ 
      isLoggedIn: true, 
      user: session.user 
    }, { status: 200 })

  } catch (error) {
    console.error("Auth Check API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}