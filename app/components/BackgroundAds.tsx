"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import Script from "next/script"

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
  const allowed = isExternalAdAllowed(pathname)

  useEffect(() => {
    if (!allowed) return

    const src = process.env.NEXT_PUBLIC_ADSTERRA_SOCIAL_BAR_SRC || ""

    if (!src || window.__jbSocialBarLoaded) return

    const script = document.createElement("script")
    script.src = src
    script.async = true

    document.body.appendChild(script)
    window.__jbSocialBarLoaded = true
  }, [pathname, allowed])

  // Don't inject popunder on auth pages
  if (!allowed) return null

  return (
    <>
      {/* 🟢 Global Adsterra Popunder Script */}
      <Script
        id="adsterra-popunder-global"
        strategy="afterInteractive"
        src="https://pl28932734.effectivecpmnetwork.com/c2/ff/ba/c2ffba00507c2aa8f81f4682763f669e.js"
      />
    </>
  )
}