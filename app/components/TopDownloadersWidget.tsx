'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client'; // Siguraduhing tama ang path ng supabase client mo
import Image from 'next/image';

interface LeaderboardUser {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  total_downloads: number;
}

export default function WeeklyLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function getLeaderboard() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('weekly_top_downloaders')
          .select('*')
          .limit(10); // Kunin ang Top 10

        if (error) throw error;
        if (data) setLeaderboard(data);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setLoading(false);
      }
    }

    getLeaderboard();
  }, [supabase]);

  // Hatiin ang Top 3 at ang natitirang rank (4th-10th)
  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];
  const restOfUsers = leaderboard.slice(3);

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 text-center text-gray-400">
        <p className="animate-pulse">Loading Leaderboard...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-8">
      {/* Header Banner */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500">
          🏆 Top Downloaders of the Week
        </h2>
        <p className="text-sm text-gray-400">
          Nagre-reset tuwing **Lunes (12:00 AM)**. Mag-download pa ng maraming unique files para manguna!
        </p>
      </div>

      {/* Rewards Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs sm:text-sm">
        <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border border-amber-500/30 p-3 rounded-xl text-center">
          <span className="text-lg">🥇 1st Place</span>
          <p className="font-bold text-amber-400 mt-1">+500 JB Coins</p>
          <p className="text-gray-300 text-[11px]">7 Days Free VIP Platinum</p>
        </div>
        <div className="bg-gradient-to-br from-slate-400/10 to-gray-400/10 border border-slate-400/30 p-3 rounded-xl text-center">
          <span className="text-lg">🥈 2nd Place</span>
          <p className="font-bold text-slate-300 mt-1">+300 JB Coins</p>
          <p className="text-gray-300 text-[11px]">Premium Status</p>
        </div>
        <div className="bg-gradient-to-br from-amber-700/10 to-orange-700/10 border border-amber-700/30 p-3 rounded-xl text-center">
          <span className="text-lg">🥉 3rd Place</span>
          <p className="font-bold text-amber-600 mt-1">+200 JB Coins</p>
          <p className="text-gray-300 text-[11px]">Bonus Reward</p>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end pt-6">
        {/* 2nd Place (Silver) */}
        <div className="flex flex-col items-center">
          <div className="relative mb-2">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-slate-400 overflow-hidden relative shadow-lg">
              <Image
                src={top2?.avatar_url || '/default-avatar.png'}
                alt={top2?.username || 'User'}
                fill
                className="object-cover"
              />
            </div>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-400 text-black font-extrabold text-xs px-2 py-0.5 rounded-full">
              #2
            </span>
          </div>
          <p className="font-semibold text-sm truncate max-w-[100px] text-center mt-2">
            {top2 ? top2.username || top2.full_name : '---'}
          </p>
          <span className="text-xs text-slate-400">
            {top2 ? `${top2.total_downloads} downloads` : '0 downloads'}
          </span>
          <div className="w-full bg-slate-800 h-24 sm:h-28 rounded-t-xl mt-3 flex items-center justify-center border-t-2 border-slate-400">
            <span className="text-2xl">🥈</span>
          </div>
        </div>

        {/* 1st Place (Gold) */}
        <div className="flex flex-col items-center -mt-6">
          <div className="relative mb-2">
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl animate-bounce">
              👑
            </span>
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-amber-400 overflow-hidden relative shadow-amber-500/50 shadow-lg">
              <Image
                src={top1?.avatar_url || '/default-avatar.png'}
                alt={top1?.username || 'User'}
                fill
                className="object-cover"
              />
            </div>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-400 text-black font-extrabold text-xs px-2 py-0.5 rounded-full">
              #1
            </span>
          </div>
          <p className="font-bold text-base text-amber-300 truncate max-w-[120px] text-center mt-2">
            {top1 ? top1.username || top1.full_name : '---'}
          </p>
          <span className="text-xs text-amber-400/80 font-medium">
            {top1 ? `${top1.total_downloads} downloads` : '0 downloads'}
          </span>
          <div className="w-full bg-amber-950/40 h-32 sm:h-36 rounded-t-xl mt-3 flex items-center justify-center border-t-2 border-amber-400">
            <span className="text-3xl">🥇</span>
          </div>
        </div>

        {/* 3rd Place (Bronze) */}
        <div className="flex flex-col items-center">
          <div className="relative mb-2">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-amber-700 overflow-hidden relative shadow-lg">
              <Image
                src={top3?.avatar_url || '/default-avatar.png'}
                alt={top3?.username || 'User'}
                fill
                className="object-cover"
              />
            </div>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-700 text-white font-extrabold text-xs px-2 py-0.5 rounded-full">
              #3
            </span>
          </div>
          <p className="font-semibold text-sm truncate max-w-[100px] text-center mt-2">
            {top3 ? top3.username || top3.full_name : '---'}
          </p>
          <span className="text-xs text-amber-600">
            {top3 ? `${top3.total_downloads} downloads` : '0 downloads'}
          </span>
          <div className="w-full bg-slate-800 h-20 sm:h-24 rounded-t-xl mt-3 flex items-center justify-center border-t-2 border-amber-700">
            <span className="text-2xl">🥉</span>
          </div>
        </div>
      </div>

      {/* Rank 4 to 10 Table/List */}
      {restOfUsers.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-800 text-xs font-semibold text-gray-400 uppercase tracking-wider flex justify-between">
            <span>Rank & User</span>
            <span>Unique Downloads</span>
          </div>
          <div className="divide-y divide-slate-800/60">
            {restOfUsers.map((user, index) => (
              <div
                key={user.user_id}
                className="px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span className="w-6 text-center font-bold text-gray-400 text-sm">
                    #{index + 4}
                  </span>
                  <div className="w-9 h-9 rounded-full overflow-hidden relative bg-slate-700">
                    <Image
                      src={user.avatar_url || '/default-avatar.png'}
                      alt={user.username || 'User'}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-200">
                      {user.username || user.full_name || 'Anonymous User'}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                  {user.total_downloads} files
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}