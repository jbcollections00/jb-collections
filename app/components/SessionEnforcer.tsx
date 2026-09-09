// app/components/SessionEnforcer.tsx
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function SessionEnforcer() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let channel: BroadcastChannel | null = null

    const enforceSingleTab = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) return

      // Kunin ang profile para ma-check ang role
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, role")
        .eq("id", session.user.id)
        .maybeSingle()

      // 🛡️ ADMIN BYPASS: Kung admin siya, ihinto agad ang anti-farm logic para pwede siya sa multiple tabs
      if (profile?.is_admin === true || profile?.role === "admin") {
        return
      }

      // Gumawa ng unique ID para sa tab na ito
      const tabId = Math.random().toString(36).substring(7)
      channel = new BroadcastChannel("jb_anti_farm_channel")

      // Setup ang listener bago mag-broadcast
      channel.onmessage = (event) => {
        if (
          event.data.type === "NEW_TAB_OPENED" && 
          event.data.userId === session.user.id &&
          event.data.tabId !== tabId // Siguraduhing galing sa IBANG tab ang message
        ) {
          alert("⚠️ Na-detect ang multiple tabs/windows.\n\nInilipat ang session mo sa bagong tab. Bawal ang sabay-sabay na session upang maiwasan ang ad farming.")
          router.push("/login?kicked=true")
        }
      }

      // Lagyan ng maliit na delay para sigurado na naka-listen na ang ibang tabs
      setTimeout(() => {
        channel?.postMessage({ 
          type: "NEW_TAB_OPENED", 
          userId: session.user.id,
          tabId: tabId
        })
      }, 500)
    }

    enforceSingleTab()

    return () => {
      if (channel) channel.close()
    }
  }, [router])

  return null
}