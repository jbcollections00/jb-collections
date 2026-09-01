"use client"

import { useEffect } from "react"

export default function TelegramAutoAuth() {
  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      tg.ready() // Ipapaalam sa Telegram na ready na ang Mini App

      const tgUser = tg.initDataUnsafe?.user

      if (tgUser) {
        console.log("Telegram User detected:", tgUser)
        
        // Pwede mong itawag ang backend API mo dito para i-check/gawan ng account sa Supabase:
        /*
        fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramId: tgUser.id,
            firstName: tgUser.first_name,
            username: tgUser.username,
          }),
        })
        */
      }
    }
  }, [])

  return null
}