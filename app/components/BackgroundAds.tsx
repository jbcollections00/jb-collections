"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

/* =========================
   🔥 MULTI-AD ROTATION
========================= */

const AD_LINKS = [
  "https://www.profitablecpmratenetwork.com/ek44eeb04?key=99f05c43be188cef9d877a7519d8166a",
  // 👉 Add more links here for higher earnings
]

function getRandomAd() {
  return AD_LINKS[Math.floor(Math.random() * AD_LINKS.length)]
}

/* =========================
   🛡️ CONTROL SETTINGS
========================= */

const SESSION_POPUNDER_KEY = "jb_background_popunder_opened"
const LAST_INTERSTITIAL_KEY = "jb_last_interstitial_ad_at"
const INTERSTITIAL_COOLDOWN_MS = 6 * 60 * 1000

declare global {
  interface Window {
    __jbSocialBarLoaded?: boolean
  }
}

function isAuthPage(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/forgot-password")
  )
}

function isExternalAdAllowed(pathname: string) {
  return !isAuthPage(pathname)
}

export default function BackgroundAds() {
  const pathname = usePathname() || ""
  const [showInterstitial, setShowInterstitial] = useState(false)
  const popunderTriggeredRef = useRef(false)

  /* =========================
     📊 SOCIAL BAR
  ========================= */
  useEffect(() => {
    if (!isExternalAdAllowed(pathname)) return

    const src =
      process.env.NEXT_PUBLIC_ADSTERRA_SOCIAL_BAR_SRC || ""

    if (!src || window.__jbSocialBarLoaded) return

    const script = document.createElement("script")
    script.src = src
    script.async = true

    document.body.appendChild(script)
    window.__jbSocialBarLoaded = true
  }, [pathname])

  /* =========================
     ⚡ POPUNDER
  ========================= */
  useEffect(() => {
    if (!isExternalAdAllowed(pathname)) return

    function triggerPopunderOnce() {
      if (popunderTriggeredRef.current) return
      if (sessionStorage.getItem(SESSION_POPUNDER_KEY)) return

      popunderTriggeredRef.current = true
      sessionStorage.setItem(SESSION_POPUNDER_KEY, "1")

      const ad = getRandomAd()
      const w = window.open(ad, "_blank")

      if (w) window.focus()
    }

    window.addEventListener("click", triggerPopunderOnce, { once: true })

    return () => {
      window.removeEventListener("click", triggerPopunderOnce)
    }
  }, [pathname])

  /* =========================
     💥 INTERSTITIAL
  ========================= */
  useEffect(() => {
    if (!isExternalAdAllowed(pathname)) return

    const last = Number(localStorage.getItem(LAST_INTERSTITIAL_KEY) || 0)
    const now = Date.now()

    if (now - last < INTERSTITIAL_COOLDOWN_MS) return

    const t = setTimeout(() => {
      setShowInterstitial(true)
      localStorage.setItem(LAST_INTERSTITIAL_KEY, String(Date.now()))
    }, 30000)

    return () => clearTimeout(t)
  }, [pathname])

  const openAd = () => {
    const ad = getRandomAd()
    window.location.href = ad
  }

  if (!isExternalAdAllowed(pathname)) return null

  return (
    <>
      {showInterstitial && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70">
          <div className="bg-[#081226] p-6 rounded-2xl text-center max-w-sm w-full">
            <h2 className="text-white text-xl font-bold">
              Support the platform
            </h2>

            <p className="text-gray-300 mt-2 text-sm">
              Open sponsor to continue earning coins
            </p>

            <button
              onClick={openAd}
              className="mt-4 w-full bg-yellow-400 text-black py-2 rounded-xl font-bold"
            >
              Continue
            </button>

            <button
              onClick={() => setShowInterstitial(false)}
              className="mt-2 w-full bg-gray-700 text-white py-2 rounded-xl"
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </>
  )
}
