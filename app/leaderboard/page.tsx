import { createClient } from "@/lib/supabase-server"
import Link from "next/link"

interface LeaderboardUser {
  user_id: string
  username?: string | null
  total_downloads?: number | null
  total_coins?: number | null
}

export default async function LeaderboardPage(props: {
  searchParams: Promise<{ tab?: string }>
}) {
  const searchParams = await props.searchParams
  const activeTab = searchParams?.tab === "coins" ? "coins" : "downloaders"

  const supabase = await createClient()

  // 1. Subukang i-fetch ang data mula sa RPC Function at View Fallback
  const [downloadersRes, coinEarnersRpcRes] = await Promise.all([
    supabase.from("weekly_top_downloaders").select("*").limit(10),
    supabase.rpc("get_weekly_top_coin_earners"),
  ])

  let rawCoinEarners = coinEarnersRpcRes.data

  // Fallback: Kung walang RPC o may issue, kunin mula sa view table
  if (!rawCoinEarners || rawCoinEarners.length === 0) {
    const viewRes = await supabase.from("weekly_top_coin_earners").select("*").limit(10)
    rawCoinEarners = viewRes.data
  }

  // 2. Format & Map data para tumugma sa LeaderboardUser interface
  const topDownloaders: LeaderboardUser[] = (downloadersRes.data || []).map((row: any) => ({
    user_id: row.user_id || row.id,
    username: row.username,
    total_downloads: Number(row.total_downloads || row.downloads_count || 0),
  }))

  const topCoinEarners: LeaderboardUser[] = (rawCoinEarners || []).map((row: any) => ({
    user_id: row.user_id || row.id,
    username: row.username,
    total_coins: Number(row.total_coins_earned || row.total_coins || row.coins || 0),
  }))

  const currentList: LeaderboardUser[] =
    activeTab === "downloaders" ? topDownloaders : topCoinEarners

  return (
    <div className="flex justify-center p-4 sm:p-6 min-h-screen bg-slate-950 text-white">
      <div className="w-full max-w-lg p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl h-fit">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
            🏆 Weekly Hall of Fame
          </h2>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-800/80 p-1 rounded-xl mb-5 border border-slate-700/50">
          <Link
            href="/leaderboard?tab=downloaders"
            className={`flex-1 py-2 text-center text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 ${
              activeTab === "downloaders"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📥 Top Downloaders
          </Link>
          <Link
            href="/leaderboard?tab=coins"
            className={`flex-1 py-2 text-center text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 ${
              activeTab === "coins"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🪙 Top Coin Earners
          </Link>
        </div>

        {/* Leaderboard List */}
        {currentList && currentList.length > 0 ? (
          <div className="space-y-2.5">
            {currentList.map((user: LeaderboardUser, index: number) => {
              const rank = index + 1
              const rankBadge =
                rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`

              const count =
                activeTab === "downloaders"
                  ? `${user.total_downloads || 0} downloads`
                  : `${user.total_coins || 0} coins`

              return (
                <div
                  key={user.user_id || index}
                  className="flex items-center justify-between p-3.5 bg-slate-800/40 border border-slate-700/40 rounded-xl hover:bg-slate-800/80 transition-all"
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className="w-7 text-center font-bold text-lg text-slate-400 shrink-0">
                      {rankBadge}
                    </span>
                    <span className="font-semibold text-slate-200 text-sm truncate">
                      {user.username || "Anonymous User"}
                    </span>
                  </div>

                  <span className="text-xs font-bold px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full shrink-0">
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
    </div>
  )
}