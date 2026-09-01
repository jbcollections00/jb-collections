"use client"

import { useEffect } from "react"

// Declare complete & safe Telegram WebApp interface
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void
        expand: () => void
        version?: string
        isVersionAtLeast?: (version: string) => boolean
        initDataUnsafe?: {
          user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
            language_code?: string
          }
        }
      }
    }
  }
}

export default function TelegramAutoAuth() {
  useEffect(() => {
    // Tiyaking nasa client-side at available ang Telegram WebApp SDK
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp

      try {
        // I-notify ang Telegram client na loaded na ang app
        if (typeof tg.ready === "function") {
          tg.ready()
        }

        // I-expand sa full screen display
        if (typeof tg.expand === "function") {
          tg.expand()
        }

        const tgUser = tg.initDataUnsafe?.user

        if (tgUser) {
          console.log("Telegram User detected:", tgUser)
          // TODO: Dito mo pwedeng i-trigger ang auto-login/sync sa Supabase account
        }
      } catch (err) {
        console.warn("Telegram WebApp initialization fallback:", err)
      }
    }
  }, [])

  return null
}