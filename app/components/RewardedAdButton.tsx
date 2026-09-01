"use client"

import { useState, useEffect } from "react"

declare global {
  interface Window {
    show_11699030?: () => Promise<void>
  }
}

export default function RewardedAdButton() {
  const [loading, setLoading] = useState(false)
  const [adReady, setAdReady] = useState(false)

  // 🔄 Hanapin kung ready na ang Monetag Script sa background
  useEffect(() => {
    const checkAdSDK = () => {
      if (typeof window !== "undefined" && typeof window.show_11699030 === "function") {
        setAdReady(true)
      }
    }

    checkAdSDK()
    const interval = setInterval(checkAdSDK, 1000) // Mag-check bawat 1 segundo
    return () => clearInterval(interval)
  }, [])

  const handleWatchAd = async () => {
    if (!adReady || typeof window.show_11699030 !== "function") {
      alert("Inihahanda pa ang ad. Paki-ulit pagkaraan ng ilang segundo.")
      return
    }

    setLoading(true)

    try {
      // 1. Ipanood ang Ad
      await window.show_11699030()

      // 2. Dagdagan ng Coins sa Database (i-update ayon sa totoong API route mo)
      const res = await fetch("/api/user/claim-ad-reward", {
        method: "POST",
      })

      if (res.ok) {
        alert("🎉 Salamat sa pagpanood! Nakuha mo na ang iyong JB Coins reward.")
      } else {
        alert("🎉 Natapos ang ad! I-refresh ang page para makita ang reward.")
      }
    } catch (error) {
      console.error("Ad error o isinaradya ng user:", error)
      alert("Hindi natapos ang ad o nagkaroon ng problema.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleWatchAd}
      disabled={loading || !adReady}
      className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-900 font-bold py-3 px-6 rounded-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading
        ? "Naglo-load ng Ad..."
        : !adReady
        ? "⏳ Inihahanda ang Ad..."
        : "🎬 Manood ng Ad (+JB Coins)"}
    </button>
  )
}