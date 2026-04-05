"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import SiteHeader from "@/app/components/SiteHeader"
import AdSlot from "@/app/components/AdSlot"
import { IN_CONTENT_AD } from "@/app/lib/adCodes"

type CoinPackage = {
  id: string
  php: number
  baseCoins: number
  bonusCoins: number
  badge?: string
  badgeStyle?: string
  gradient: string
  border: string
}

const COINS_PER_PHP = 13

function formatCoins(value: number) {
  return `${value.toLocaleString()} JB Coins`
}

function StorePageContent() {
  useMemo(() => createClient(), [])
  const router = useRouter()

  const [selectedPackageId, setSelectedPackageId] = useState("php1000")
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)

  const packages: CoinPackage[] = [
    {
      id: "php20",
      php: 20,
      baseCoins: 20 * COINS_PER_PHP,
      bonusCoins: 10,
      badge: "BONUS",
      badgeStyle: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20",
      gradient: "from-emerald-500 via-teal-500 to-cyan-500",
      border: "border-emerald-400/30",
    },
    {
      id: "php50",
      php: 50,
      baseCoins: 50 * COINS_PER_PHP,
      bonusCoins: 40,
      badge: "POPULAR",
      badgeStyle: "bg-amber-500/15 text-amber-300 border border-amber-400/20",
      gradient: "from-amber-500 via-orange-500 to-red-500",
      border: "border-amber-400/30",
    },
    {
      id: "php100",
      php: 100,
      baseCoins: 100 * COINS_PER_PHP,
      bonusCoins: 120,
      badge: "BEST SELLER",
      badgeStyle: "bg-pink-500/15 text-pink-300 border border-pink-400/20",
      gradient: "from-pink-500 via-rose-500 to-red-500",
      border: "border-pink-400/30",
    },
    {
      id: "php200",
      php: 200,
      baseCoins: 200 * COINS_PER_PHP,
      bonusCoins: 350,
      badge: "GREAT VALUE",
      badgeStyle: "bg-violet-500/15 text-violet-300 border border-violet-400/20",
      gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
      border: "border-violet-400/30",
    },
    {
      id: "php500",
      php: 500,
      baseCoins: 500 * COINS_PER_PHP,
      bonusCoins: 1000,
      badge: "HOT DEAL",
      badgeStyle: "bg-yellow-500/15 text-yellow-300 border border-yellow-400/20",
      gradient: "from-yellow-500 via-amber-500 to-orange-500",
      border: "border-yellow-400/30",
    },
    {
      id: "php1000",
      php: 1000,
      baseCoins: 1000 * COINS_PER_PHP,
      bonusCoins: 2500,
      badge: "BEST OFFER",
      badgeStyle: "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-400/20",
      gradient: "from-fuchsia-500 via-purple-500 to-indigo-500",
      border: "border-fuchsia-400/40",
    },
  ]

  const selectedPackage =
    packages.find((item) => item.id === selectedPackageId) || packages[0]

  const totalCoins = selectedPackage.baseCoins + selectedPackage.bonusCoins

  function handleBuyClick(packageId: string) {
    setSelectedPackageId(packageId)
    setShowCheckoutModal(true)
  }

  function handleProceedToPayment() {
    const params = new URLSearchParams({
      amount: String(selectedPackage.php),
      coins: String(totalCoins),
      label: `₱${selectedPackage.php} Package`,
      method: "maya",
    })

    router.push(`/payment?${params.toString()}`)
  }

  return (
    <>
      <SiteHeader />

      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_45%,#111827_100%)] px-4 pb-10 pt-24 text-white">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-6 flex justify-center">
            <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-2xl backdrop-blur">
              <AdSlot code={IN_CONTENT_AD} />
            </div>
          </div>

          <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-slate-900/70 px-6 py-10 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur sm:px-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.10),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.08),transparent_24%)]" />
            <div className="relative flex items-center justify-center">
              <h1 className="text-center text-4xl font-black tracking-tight text-white sm:text-6xl">
                JB COIN STORE
              </h1>
            </div>
          </section>

          <section className="mt-8">
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {packages.map((item) => {
                const packageTotalCoins = item.baseCoins + item.bonusCoins

                return (
                  <article
                    key={item.id}
                    className={`relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/75 p-6 shadow-xl transition hover:border-white/20 ${item.border}`}
                  >
                    <div
                      className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.gradient}`}
                    />

                    {item.badge ? (
                      <div
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] ${item.badgeStyle}`}
                      >
                        {item.badge}
                      </div>
                    ) : null}

                    <h2 className="mt-4 text-3xl font-black text-white">₱{item.php}</h2>

                    <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/60 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                        Equivalent Coins
                      </p>

                      <div className="mt-3 text-2xl font-black text-white">
                        {formatCoins(item.baseCoins)}
                      </div>

                      {item.bonusCoins > 0 ? (
                        <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-300">
                          Bonus +{item.bonusCoins.toLocaleString()} Coins
                        </div>
                      ) : null}

                      <div className="mt-3 text-sm text-slate-300">
                        Total:{" "}
                        <span className="font-black text-white">
                          {formatCoins(packageTotalCoins)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => handleBuyClick(item.id)}
                        className={`inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r px-5 py-3 text-sm font-black text-white shadow-lg transition hover:opacity-95 ${item.gradient}`}
                      >
                        Buy ₱{item.php} Package
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <div className="mt-8 flex justify-center">
            <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-2xl backdrop-blur">
              <AdSlot code={IN_CONTENT_AD} />
            </div>
          </div>
        </div>
      </div>

      {showCheckoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-3 py-4 backdrop-blur-sm sm:px-4">
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,#081225_0%,#0b1730_100%)] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:p-6">
            <button
              type="button"
              onClick={() => setShowCheckoutModal(false)}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl text-white transition hover:bg-white/10"
              aria-label="Close"
            >
              ×
            </button>

            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
              Selected Package
            </p>

            <h3 className="mt-3 pr-12 text-3xl font-black text-white">
              ₱{selectedPackage.php} Package
            </h3>

            {selectedPackage.badge ? (
              <div
                className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] ${selectedPackage.badgeStyle}`}
              >
                {selectedPackage.badge}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4">
              <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  Base Coins
                </p>
                <p className="mt-2 text-2xl font-black text-white">
                  {formatCoins(selectedPackage.baseCoins)}
                </p>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  Bonus Coins
                </p>
                <p className="mt-2 text-2xl font-black text-emerald-300">
                  +{selectedPackage.bonusCoins.toLocaleString()} Coins
                </p>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  Total Receive
                </p>
                <p className="mt-2 text-2xl font-black text-white">
                  {formatCoins(totalCoins)}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-fuchsia-400/20 bg-fuchsia-500/10 p-4 text-sm font-bold text-fuchsia-200">
              13 JB Coins = ₱1
            </div>

            <button
              type="button"
              onClick={handleProceedToPayment}
              className={`mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r px-5 py-3 text-sm font-black text-white shadow-lg transition hover:opacity-95 ${selectedPackage.gradient}`}
            >
              Proceed to Buy ₱{selectedPackage.php}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default function UpgradePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
          <div className="rounded-2xl border border-white/10 bg-slate-900 px-6 py-4 font-bold">
            Loading JB COIN STORE...
          </div>
        </div>
      }
    >
      <StorePageContent />
    </Suspense>
  )
}