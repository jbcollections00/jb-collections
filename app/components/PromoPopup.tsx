"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function PromoPopup() {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if the user has already seen the promo to avoid spamming them
    const hasSeenPromo = localStorage.getItem("hasSeenPlatinumPromo")
    
    if (!hasSeenPromo) {
      // 1.5 second delay so it pops up smoothly after they land on the page
      const timer = setTimeout(() => {
        setIsOpen(true)
      }, 1500)
      
      return () => clearTimeout(timer)
    }
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    // Save to localStorage so they don't see it again during this session
    localStorage.setItem("hasSeenPlatinumPromo", "true")
  }

  const handleAction = () => {
    setIsOpen(false)
    localStorage.setItem("hasSeenPlatinumPromo", "true")
    // Redirect to the offerwall page
    router.push("/earn-coins")
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Dark blurred backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-300 overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/90 shadow-[0_0_50px_rgba(14,165,233,0.3)] p-6 text-center">
        
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>

        {/* Promo Icon/Badge */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-400/20 to-blue-600/20 border border-sky-400/30">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-400">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
          </svg>
        </div>

        {/* Text Content */}
        <h2 className="text-2xl font-black text-white">
          Free Platinum Upgrade!
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Be one of the first <strong className="text-sky-400">100 members</strong> to successfully complete a survey or task and instantly unlock a <strong>1-Month Platinum Account Upgrade</strong>!
        </p>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-3">
          <button 
            onClick={handleAction}
            className="w-full rounded-xl bg-gradient-to-r from-sky-400 to-blue-600 py-3 font-bold text-white shadow-lg shadow-sky-500/25 transition-all hover:scale-[1.02] hover:shadow-sky-500/40"
          >
            Claim Offer Now
          </button>
          <button 
            onClick={handleClose}
            className="w-full rounded-xl py-3 font-semibold text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            Maybe Later
          </button>
        </div>

      </div>
    </div>
  )
}