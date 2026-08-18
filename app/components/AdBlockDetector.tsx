"use client"

import { useEffect, useState } from "react"
import { ShieldAlert } from "lucide-react" // Make sure lucide-react is installed

export default function AdBlockDetector() {
  const [isAdBlockEnabled, setIsAdBlockEnabled] = useState(false)

  useEffect(() => {
    // Run detection after a short delay so adblockers have time to execute
    const timer = setTimeout(async () => {
      let blocked = false

      // METHOD 1: Inject a "bait" element
      const bait = document.createElement("div")
      // Ad blockers actively target these class names
      bait.className = "ad-banner adsbox doubleclick sponsor ad-container"
      bait.style.position = "absolute"
      bait.style.left = "-9999px"
      bait.style.height = "10px"
      bait.style.width = "10px"
      document.body.appendChild(bait)

      // METHOD 2: Check if network requests to known ad networks fail
      try {
        await fetch(
          "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
          { method: "HEAD", mode: "no-cors", cache: "no-store" }
        )
      } catch (e) {
        // If the fetch throws a network error, the ad blocker killed the request
        blocked = true
      }

      // Verify if the bait element was hidden by the ad blocker
      const baitStyle = window.getComputedStyle(bait)
      if (
        baitStyle.display === "none" ||
        baitStyle.visibility === "hidden" ||
        bait.offsetHeight === 0 ||
        bait.offsetWidth === 0
      ) {
        blocked = true
      }

      // Clean up the bait element
      document.body.removeChild(bait)

      // Update state
      if (blocked) {
        setIsAdBlockEnabled(true)
        
        // Optional: Disable scrolling when the modal is active
        document.body.style.overflow = "hidden"
      }
    }, 800) // 800ms gives the adblocker enough time to inject its CSS

    return () => clearTimeout(timer)
  }, [])

  if (!isAdBlockEnabled) return null

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-md">
      <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-red-500/20 bg-[#0f172a] p-8 text-center shadow-[0_24px_60px_rgba(239,68,68,0.15)]">
        
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 text-red-500 ring-1 ring-red-500/20">
          <ShieldAlert size={40} />
        </div>
        
        <h2 className="mb-3 text-2xl font-black tracking-tight text-white">
          Ad Blocker Detected
        </h2>
        
        <p className="mb-8 text-sm leading-relaxed text-slate-300">
          It looks like you're using an ad blocker. <strong className="text-white">JB Collections</strong> relies on ads to keep our premium hub running and to reward our users. 
          <br /><br />
          Please whitelist our site or disable your ad blocker to continue using the platform.
        </p>
        
        <button
          onClick={() => window.location.reload()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-red-500/25 transition hover:scale-[1.02] hover:shadow-red-500/40 active:scale-95"
        >
          <span>I have disabled it, Refresh Page</span>
        </button>

      </div>
    </div>
  )
}