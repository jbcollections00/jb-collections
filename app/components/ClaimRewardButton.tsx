"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Gift, CheckCircle2, Loader2, Sparkles, X } from "lucide-react"

type ClaimState = {
  isClaimed: boolean
  coinsGranted?: number
}

export function ClaimRewardButton({ messageId }: { messageId: string }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [claimState, setClaimState] = useState<ClaimState>({ isClaimed: false })
  const [showModal, setShowModal] = useState(false)
  const [modalData, setModalData] = useState<{ success: boolean; coins?: number; message: string } | null>(null)

  // 1. Suriin sa database kung na-claim na ng user ang message na ito
  useEffect(() => {
    async function checkClaimStatus() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setCheckingStatus(false)
        return
      }

      const { data } = await supabase
        .from("broadcast_claims")
        .select("coins_claimed")
        .eq("user_id", user.id)
        .eq("message_id", messageId)
        .maybeSingle()

      if (data) {
        setClaimState({ isClaimed: true, coinsGranted: data.coins_claimed })
      }
      setCheckingStatus(false)
    }

    checkClaimStatus()
  }, [messageId, supabase])

  // 2. I-trigger ang RPC function sa Supabase para sa random coin rollout
  async function handleClaim() {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc("claim_broadcast_reward", {
        p_message_id: messageId,
      })

      if (error) throw error

      if (data.success) {
        setClaimState({ isClaimed: true, coinsGranted: data.coins_granted })
        setModalData({
          success: true,
          coins: data.coins_granted,
          message: data.message,
        })
      } else {
        setModalData({
          success: false,
          message: data.message,
        })
      }
      setShowModal(true)
    } catch (err: any) {
      alert(err.message || "Nagka-error sa pag-claim ng compensation reward.")
    } finally {
      setLoading(false)
    }
  }

  if (checkingStatus) return null

  return (
    <>
      <div className="mt-4 pt-3 border-t border-white/10">
        {claimState.isClaimed ? (
          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-400">
            <CheckCircle2 size={16} />
            <span>Na-claim mo na ({claimState.coinsGranted} Coins)</span>
          </div>
        ) : (
          <button
            onClick={handleClaim}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-2.5 text-xs font-black text-black shadow-lg shadow-amber-500/20 hover:from-amber-300 hover:to-yellow-400 transition transform active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} />}
            <span>🎁 Claim Compensation Coins</span>
          </button>
        )}
      </div>

      {/* Reward Modal Popup */}
      {showModal && modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-sm rounded-3xl border border-amber-500/30 bg-[#0f172a] p-6 text-center shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>

            {modalData.success ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 ring-8 ring-amber-500/10">
                  <Sparkles size={36} className="animate-bounce" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white">🎉 Congratulations!</h3>
                  <p className="text-xs text-slate-300">{modalData.message}</p>
                </div>

                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <span className="block text-[11px] font-bold text-amber-300 uppercase tracking-widest">
                    Natanggap mong Reward
                  </span>
                  <span className="text-3xl font-black text-amber-400">
                    +{modalData.coins} COINS
                  </span>
                </div>

                <button
                  onClick={() => setShowModal(false)}
                  className="w-full rounded-xl bg-amber-400 py-3 text-xs font-extrabold text-black hover:bg-amber-300 transition"
                >
                  Salamat!
                </button>
              </>
            ) : (
              <div className="py-4 space-y-3">
                <p className="text-sm font-semibold text-slate-300">{modalData.message}</p>
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-xl bg-slate-800 px-6 py-2 text-xs font-bold text-white hover:bg-slate-700"
                >
                  Isara
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}