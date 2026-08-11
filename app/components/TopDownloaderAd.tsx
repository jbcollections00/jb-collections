"use client"

import Link from "next/link"

type TopDownloaderAdProps = {
  imageUrl?: string | null
  targetUrl?: string
  title?: string
  description?: string
  badgeText?: string
}

export default function TopDownloaderAd({
  imageUrl,
  targetUrl = "/weekly-leaderboard",
  title = "🏆 Become the Top Downloader!",
  description = "Download your favorite files daily, climb the leaderboard, and claim exclusive perks & bonus JB Coins!",
  badgeText = "WEEKLY REWARDS",
}: TopDownloaderAdProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-xl sm:p-6">
      {/* Ad Tag Badge */}
      <div className="absolute top-3 right-3 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 backdrop-blur-md">
        Sponsored / Promo
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left Side: Image / Custom Graphic Icon */}
        <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-2xl sm:w-36">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Top Downloader Leaderboard Promo"
              className="h-full w-full object-cover transition duration-300 hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 via-sky-500/10 to-transparent text-center">
              <span className="text-3xl">🚀</span>
              <span className="mt-1 text-[10px] font-black uppercase tracking-widest text-indigo-300">
                TOP #1 SPOT
              </span>
            </div>
          )}
        </div>

        {/* Middle Side: Title and Details */}
        <div className="flex-1 space-y-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-amber-300">
            ⚡ {badgeText}
          </span>
          <h3 className="text-base font-black tracking-tight text-white sm:text-lg">
            {title}
          </h3>
          <p className="max-w-md text-xs leading-relaxed text-slate-300">
            {description}
          </p>
        </div>

        {/* Right Side: CTA Button */}
        <div className="shrink-0 pt-2 sm:pt-0">
          <Link
            href={targetUrl}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-5 py-3 text-xs font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:scale-[1.02] hover:from-amber-300 hover:to-amber-500 sm:w-auto"
          >
            <span>Climb Leaderboard</span>
            <span>🔥</span>
          </Link>
        </div>
      </div>
    </div>
  )
}