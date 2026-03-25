"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

export default function PresenceTracker() {
  useEffect(() => {
    const supabase = createClient()

    let stopped = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    async function touch() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user || stopped) return

        await supabase.rpc("touch_last_seen")
      } catch (error) {
        console.error("Presence update failed:", error)
      }
    }

    touch()
    intervalId = setInterval(touch, 60 * 1000)

    const handleFocus = () => touch()

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        touch()
      }
    }

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      stopped = true

      if (intervalId) clearInterval(intervalId)

      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  return null
}