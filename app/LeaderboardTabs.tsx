"use client"

import { useState } from "react"

type LeaderboardEntry = {
  user_id: string
  username?: string | null
  avatar_url?: string | null
  total_downloads?: number
  total_coins?: number
}

type Props = {
  topDownloaders: LeaderboardEntry[]
  topCoinEarners: LeaderboardEntry[]
}

export default function LeaderboardTabs({ topDownloaders, topCoinEarners }: Props) {
  const [activeTab, setActiveTab] = useState<"downloaders" | "coins">("downloaders")

  const currentList = activeTab === "downloaders" ? topDownloaders : topCoinEarners

  return (
    <div className="w-full max-w-lg p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
          🏆 Weekly Hall of Fame
        </h2>
      </div>

      {/* Tab Controls */}
      <div className="flex bg-slate-800/80 p-1 rounded-xl mb-5 border border-slate-700/50">
        <button
          onClick={() => setActiveTab("downloaders")}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
            activeTab === "downloaders"
              ? "bg-amber-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          📥 Top Downloaders
        </button>
        <button
          onClick={() => setActiveTab("coins")}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
            activeTab === "coins"
              ? "bg-amber-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          🪙 Top Coin Earners
        </button>
      </div>

      {/* Leaderboard List */}
      {currentList && currentList.length > 0 ? (
        <div className="space-y-2.5">
          {currentList.map((user, index) => {
            const rank = index + 1
            const rankBadge =
              rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`

            const count =
              activeTab === "downloaders"
                ? `${user.total_downloads || 0} downloads`
                : `${user.total_coins || 0} coins`

            return (
              <div
                key={user.user_id}
                className="flex items-center justify-between p-3.5 bg-slate-800/40 border border-slate-700/40 rounded-xl hover:bg-slate-800/80 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 text-center font-bold text-lg text-slate-400">
                    {rankBadge}
                  </span>
                  <span className="font-semibold text-slate-200">
                    {user.username || "Anonymous"}
                  </span>
                </div>

                <span className="text-xs font-bold px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-center py-8 text-slate-400 text-sm">
          Wala pang records ngayong linggo.
        </p>
      )}
    </div>
  )
}