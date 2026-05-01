"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

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

  useEffect(() => {
    if (!isExternalAdAllowed(pathname)) return

    const src = process.env.NEXT_PUBLIC_ADSTERRA_SOCIAL_BAR_SRC || ""

    if (!src || window.__jbSocialBarLoaded) return

    const script = document.createElement("script")
    script.src = src
    script.async = true

    document.body.appendChild(script)
    window.__jbSocialBarLoaded = true
  }, [pathname])

  return null
}