import { createClient } from "@/lib/supabase-server"
import Link from "next/link"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface LeaderboardUser {
  user_id: string
  username?: string | null
  total_downloads?: number | null
  total_coins?: number | null
}

function aggregateData(data: any[], type: "coins" | "downloads"): LeaderboardUser[] {
  if (!data || data.length === 0) return []

  const totals: Record<string, { user_id: string; username: string; total: number }> = {}

  data.forEach((row) => {
    const userId = row.user_id
    if (!userId) return

    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const username = profile?.username || "Anonymous"
    
    const amount = type === "coins" ? Number(row.amount || 0) : 1

    if (!totals[userId]) {
      totals[userId] = { user_id: userId, username, total: 0 }
    }
    totals[userId].total += amount
  })

  return Object.values(totals)
    .sort((a, b) => b.total - a.total)
    .map((item) => ({
      user_id: item.user_id,
      username: item.username,
      total_coins: type === "coins" ? item.total : null,
      total_downloads: type === "downloads" ? item.total : null,
    }))
}

export default async function LeaderboardPage(props: {
  searchParams: Promise<{ tab?: string }>
}) {
  const searchParams = await props.searchParams
  const activeTab = searchParams?.tab === "coins" ? "coins" : "downloaders"

  const supabase = await createClient()

  const now = new Date()
  const manilaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }))
  
  const dayOfWeek = manilaNow.getDay()
  const diffToCurrentMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  
  const startOfCurrentWeek = new Date(manilaNow)
  startOfCurrentWeek.setDate(manilaNow.getDate() - diffToCurrentMonday)
  startOfCurrentWeek.setHours(0, 0, 0, 0)
  
  const startOfLastWeek = new Date(startOfCurrentWeek)
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

  const formatISO = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const date = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${date}T00:00:00+08:00`
  }

  const currentStartIso = new Date(formatISO(startOfCurrentWeek)).toISOString()
  const lastStartIso = new Date(formatISO(startOfLastWeek)).toISOString()

  let currentList: LeaderboardUser[] = []
  let lastWeekList: LeaderboardUser[] = []
  let debugError: string | null = null // Dito natin isasave ang error

  if (activeTab === "coins") {
    const [currentRes, lastRes] = await Promise.all([
      supabase
        .from("coin_history")
        .select("user_id, amount, profiles(username)")
        .gte("created_at", currentStartIso)
        .gt("amount", 0)
        .neq("type", "weekly_reward"),
      supabase
        .from("coin_history")
        .select("user_id, amount, profiles(username)")
        .gte("created_at", lastStartIso)
        .lt("created_at", currentStartIso)
        .gt("amount", 0)
        .neq("type", "weekly_reward")
    ])
    
    // Kunin ang error kung mayroon man
    if (currentRes.error) debugError = `Current Week Error: ${currentRes.error.message}`
    if (lastRes.error) debugError = `Last Week Error: ${lastRes.error.message}`

    currentList = aggregateData(currentRes.data || [], "coins").slice(0, 10)
    lastWeekList = aggregateData(lastRes.data || [], "coins").slice(0, 3)
    
  } else {
    const [currentRes, lastRes] = await Promise.all([
      supabase
        .from("download_logs")
        .select("user_id, profiles(username)")
        .gte("created_at", currentStartIso),
      supabase
        .from("download_logs")
        .select("user_id, profiles(username)")
        .gte("created_at", lastStartIso)
        .lt("created_at", currentStartIso)
    ])
    
    if (currentRes.error) debugError = `Current Week Error: ${currentRes.error.message}`
    if (lastRes.error) debugError = `Last Week Error: ${lastRes.error.message}`

    currentList = aggregateData(currentRes.data || [], "downloads").slice(0, 10)
    lastWeekList = aggregateData(lastRes.data || [], "downloads").slice(0, 3)
  }

  const top1 = lastWeekList[0]
  const top2 = lastWeekList[1]
  const top3 = lastWeekList[2]

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

        {/* 🚨 ERROR DEBUG BOX 🚨 */}
        {debugError && (
          <div className="mb-6 p-4 bg-red-900/40 border border-red-500/50 rounded-xl text-red-200 text-sm font-mono break-words">
            <span className="font-bold text-red-400 block mb-1">Database Error:</span>
            {debugError}
          </div>
        )}

        {/* 🎉 CONGRATULATIONS TOP 3 WINNERS PODIUM (LAST WEEK) */}
        {lastWeekList && lastWeekList.length > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-b from-amber-500/20 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl text-center shadow-inner">
            <h3 className="text-xs font-extrabold text-amber-300 uppercase tracking-widest mb-4 flex items-center justify-center gap-1.5">
              🎉 Last Week's Champions 🎉
            </h3>

            <div className="grid grid-cols-3 gap-2 items-end">
              {/* 🥈 Rank 2 (Silver) */}
              {top2 ? (
                <div className="flex flex-col items-center p-2.5 bg-slate-800/90 border border-slate-400/40 rounded-xl relative shadow-md">
                  <span className="text-xl mb-1">🥈</span>
                  <span className="text-xs font-bold text-slate-200 truncate w-full">
                    {top2.username || "Anonymous"}
                  </span>
                  <span className="text-[10px] font-extrabold text-amber-400 mt-1">
                    {activeTab === "downloaders"
                      ? `${top2.total_downloads} DLs`
                      : `${top2.total_coins} Coins`}
                  </span>
                  <span className="mt-1.5 px-2 py-0.5 bg-slate-700 text-[9px] font-bold text-slate-300 rounded-full border border-slate-600">
                    Premium (1 Wk)
                  </span>
                </div>
              ) : (
                <div />
              )}

              {/* 🥇 Rank 1 (Gold - Middle & Elevated) */}
              {top1 ? (
                <div className="flex flex-col items-center p-3 bg-slate-800 border-2 border-amber-400 rounded-xl relative -mt-3 shadow-xl shadow-amber-500/20">
                  <span className="absolute -top-3 text-base">👑</span>
                  <span className="text-2xl mb-1 mt-0.5">🥇</span>
                  <span className="text-xs font-black text-amber-300 truncate w-full">
                    {top1.username || "Anonymous"}
                  </span>
                  <span className="text-[11px] font-black text-amber-400 mt-1">
                    {activeTab === "downloaders"
                      ? `${top1.total_downloads} DLs`
                      : `${top1.total_coins} Coins`}
                  </span>
                  <span className="mt-1.5 px-2 py-0.5 bg-amber-500 text-slate-950 text-[9px] font-black rounded-full shadow-sm">
                    Platinum (1 Wk)
                  </span>
                </div>
              ) : (
                <div />
              )}

              {/* 🥉 Rank 3 (Bronze) */}
              {top3 ? (
                <div className="flex flex-col items-center p-2.5 bg-slate-800/90 border border-amber-700/40 rounded-xl relative shadow-md">
                  <span className="text-xl mb-1">🥉</span>
                  <span className="text-xs font-bold text-slate-200 truncate w-full">
                    {top3.username || "Anonymous"}
                  </span>
                  <span className="text-[10px] font-extrabold text-amber-400 mt-1">
                    {activeTab === "downloaders"
                      ? `${top3.total_downloads} DLs`
                      : `${top3.total_coins} Coins`}
                  </span>
                  <span className="mt-1.5 px-2 py-0.5 bg-slate-700 text-[9px] font-bold text-slate-300 rounded-full border border-slate-600">
                    Premium (1 Wk)
                  </span>
                </div>
              ) : (
                <div />
              )}
            </div>
          </div>
        )}

        {/* 🏆 CURRENT LEADERBOARD LIST (THIS WEEK) */}
        <h3 className="text-sm font-semibold text-slate-300 mb-3 px-1">🔥 Current Live Standings</h3>

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
                  className={`flex items-center justify-between p-3.5 border rounded-xl transition-all ${
                    rank <= 3
                      ? "bg-slate-800/80 border-slate-700/80"
                      : "bg-slate-800/40 border-slate-700/40 hover:bg-slate-800/70"
                  }`}
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