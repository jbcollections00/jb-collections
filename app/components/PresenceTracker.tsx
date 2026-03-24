"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

export default function PresenceTracker() {
  useEffect(() => {
    const supabase = createClient()

    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    async function touch() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user || cancelled) return

        await supabase.rpc("touch_last_seen")
      } catch (error) {
        console.error("Presence update failed:", error)
      }
    }

    touch()
    intervalId = setInterval(touch, 60 * 1000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        touch()
      }
    }

    window.addEventListener("focus", touch)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
      window.removeEventListener("focus", touch)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  return null
}