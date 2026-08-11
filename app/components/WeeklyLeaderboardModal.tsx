"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function WeeklyLeaderboardModal() {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Tinitiyak na lalabas lang ang popup kung hindi pa ito naisara ng user ngayong session
    const hasSeenModal = sessionStorage.getItem("hasSeenLeaderboardModal")
    if (!hasSeenModal) {
      setIsOpen(true)
    }
  }, [])

  const handleClose = () => {
    sessionStorage.setItem("hasSeenLeaderboardModal", "true")
    setIsOpen(false)
  }

  const handleAction = () => {
    handleClose()
    router.push("/leaderboard") // I-redirect sa Leaderboard page
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Modal Container */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-[#0b1329] p-6 text-white shadow-[0_0_50px_rgba(37,99,235,0.25)] sm:p-8">
        
        {/* Close Button (X) */}
        <button
          onClick={handleClose}
          className="absolute right-5 top-5 text-slate-400 transition hover:text-white"
          aria-label="Close modal"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Top Icon Circle */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-blue-500/30 bg-gradient-to-b from-blue-600/30 to-slate-900 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
          <span className="text-4xl">🏆</span>
        </div>

        {/* Main Title */}
        <h2 className="mt-5 text-center text-2xl font-black tracking-tight text-white sm:text-3xl">
          Weekly Race is Live!
        </h2>

        {/* Inset Content Box (Kagaya ng sa SS) */}
        <div className="mt-6 rounded-2xl border border-slate-800 bg-[#070d1e] p-5 text-left text-sm text-slate-300 shadow-inner">
          <h3 className="font-bold text-sky-400">How to Win Weekly JB Coins:</h3>
          
          <ol className="mt-3 space-y-2.5 text-xs sm:text-sm text-slate-300">
            <li className="flex items-start gap-2">
              <span className="font-bold text-sky-400">1.</span>
              <span>Earn coins through daily check-ins, tasks, and activities.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-sky-400">2.</span>
              <span>The race runs every <b>Monday 12:00 AM</b> until <b>Sunday 11:59 PM</b>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-sky-400">3.</span>
              <span>Top 3 earner members win automatic rewards every week:</span>
            </li>
          </ol>

          {/* Prizes Breakdown */}
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-900/80 p-3 text-center border border-slate-800">
            <div>
              <p className="text-xs text-amber-400 font-bold">🥇 1st Place</p>
              <p className="text-sm font-black text-white">+500 JB</p>
            </div>
            <div>
              <p className="text-xs text-slate-300 font-bold">🥈 2nd Place</p>
              <p className="text-sm font-black text-white">+300 JB</p>
            </div>
            <div>
              <p className="text-xs text-amber-600 font-bold">🥉 3rd Place</p>
              <p className="text-sm font-black text-white">+200 JB</p>
            </div>
          </div>
        </div>

        {/* Highlight Sub-Bar */}
        <div className="mt-4 rounded-xl bg-slate-900/60 py-2.5 text-center text-xs font-bold text-sky-400 border border-slate-800">
          🔥 1,000 JB Coins Prize Pool Every Week!
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          <button
            onClick={handleAction}
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 via-sky-500 to-blue-600 py-3.5 text-base font-bold text-white shadow-[0_4px_20px_rgba(37,99,235,0.4)] transition hover:scale-[1.02] active:scale-[0.98]"
          >
            View Leaderboard Now
          </button>

          <button
            onClick={handleClose}
            className="w-full text-center text-sm font-semibold text-slate-400 transition hover:text-white"
          >
            Maybe Later
          </button>
        </div>

      </div>
    </div>
  )
}