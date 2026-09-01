"use client"

import { useEffect } from "react"

// Declare Telegram types for TypeScript window object
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void
        expand: () => void
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
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp

      // I-notify ang Telegram na ready na ang Mini App
      tg.ready()

      // I-expand para maging full screen sa mobile view
      tg.expand()

      const tgUser = tg.initDataUnsafe?.user

      if (tgUser) {
        console.log("Telegram User detected:", tgUser)
      }
    }
  }, [])

  return null
}