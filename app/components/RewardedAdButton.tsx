"use client"

import { useState } from "react"

declare global {
  interface Window {
    show_11699030?: () => Promise<void>
  }
}

export default function RewardedAdButton() {
  const [loading, setLoading] = useState(false)

  const handleWatchAd = async () => {
    setLoading(true)

    if (typeof window !== "undefined" && typeof window.show_11699030 === "function") {
      try {
        await window.show_11699030()
        alert("🎉 Salamat sa pagpanood! Nakuha mo na ang iyong reward.")
        // TODO: Dito mo itatawag ang backend API mo para magdagdag ng JB Coins
      } catch (error) {
        console.error("Ad error o isinaradya ng user:", error)
        alert("Hindi natapos ang ad o nagkaroon ng problema.")
      } finally {
        setLoading(false)
      }
    } else {
      setLoading(false)
      alert("Inihahanda pa ang ad. Paki-ulit pagkaraan ng ilang segundo.")
    }
  }

  return (
    <button
      onClick={handleWatchAd}
      disabled={loading}
      className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-900 font-bold py-3 px-6 rounded-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-50"
    >
      {loading ? "Naglo-load ng Ad..." : "🎬 Manood ng Ad (+JB Coins)"}
    </button>
  )
}