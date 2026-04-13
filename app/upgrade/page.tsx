"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ShieldCheck,
  Sparkles,
  Star,
  WalletCards,
  BadgeCheck,
  ArrowRight,
  CheckCircle2,
  Crown,
  Gem,
  Lock,
  Zap,
  Receipt,
  Rocket,
  Layers3,
  Flame,
  Diamond,
} from "lucide-react"
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
  featured?: boolean
  description: string
}

type PlanFeature = {
  label: string
  free: string
  premium: string
  platinum: string
}

const COINS_PER_PHP = 13

function formatCoins(value: number) {
  return `${new Intl.NumberFormat("en-PH").format(value)} JB Coins`
}

function formatPeso(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value)
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
      badge: "STARTER",
      badgeStyle: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/20",
      gradient: "from-emerald-500 via-teal-500 to-cyan-500",
      border: "border-emerald-400/30",
      description: "Quick top-up for light usage.",
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
      description: "A balanced package for regular users.",
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
      description: "Best for users who want a strong value jump.",
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
      description: "A smart upgrade for active members.",
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
      description: "High-value package with a strong bonus boost.",
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
      featured: true,
      description: "Best for power users who want the highest bonus coins.",
    },
  ]

  const testimonials = [
    {
      name: "Verified Buyer",
      role: "Premium Member",
      text: "Smooth payment process. My JB Coins were credited after review and everything felt secure.",
    },
    {
      name: "Repeat Customer",
      role: "Store User",
      text: "The package details are clear, the bonus coins are easy to compare, and the checkout looks premium.",
    },
    {
      name: "Trusted Buyer",
      role: "Active Collector",
      text: "I liked seeing the official wallet details clearly before uploading my receipt.",
    },
  ]

  const trustItems = [
    { icon: ShieldCheck, label: "Secure payment proof submission" },
    { icon: BadgeCheck, label: "Verified GCash and Maya wallet details" },
    { icon: WalletCards, label: "Fast admin review after receipt upload" },
    { icon: Lock, label: "Coins credited only after approval" },
  ]

  const planFeatures: PlanFeature[] = [
    {
      label: "Downloads",
      free: "Limited",
      premium: "More access",
      platinum: "Everything unlocked",
    },
    {
      label: "Ads",
      free: "Standard ads",
      premium: "Reduced ads",
      platinum: "Best experience",
    },
    {
      label: "Access",
      free: "Basic",
      premium: "Priority access",
      platinum: "VIP access",
    },
    {
      label: "Exclusive Content",
      free: "No",
      premium: "Some",
      platinum: "Full access",
    },
  ]

  const premiumBenefits = [
    {
      icon: Zap,
      title: "Faster experience",
      text: "Smoother access to the files and features your users care about most.",
    },
    {
      icon: Crown,
      title: "Premium identity",
      text: "Make upgrading feel like a status move, not just a payment.",
    },
    {
      icon: Rocket,
      title: "More value",
      text: "Users instantly see the difference between Free, Premium, and Platinum.",
    },
    {
      icon: Receipt,
      title: "Trust & receipts",
      text: "Clear receipts, verified payments, and secure proof submission build confidence.",
    },
  ]

  const secureSignals = [
    { icon: ShieldCheck, label: "Secure Payment" },
    { icon: Receipt, label: "Receipt Proof" },
    { icon: BadgeCheck, label: "Verified Wallets" },
    { icon: Layers3, label: "Clear Package Details" },
  ]

  const selectedPackage = packages.find((item) => item.id === selectedPackageId) || packages[0]
  const totalCoins = selectedPackage.baseCoins + selectedPackage.bonusCoins
  const bonusPercent = Math.round((selectedPackage.bonusCoins / selectedPackage.baseCoins) * 100)

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
      bonus: String(selectedPackage.bonusCoins),
      base: String(selectedPackage.baseCoins),
      featured: selectedPackage.featured ? "1" : "0",
    })

    router.push(`/payment?${params.toString()}`)
  }

  return (
    <>
      <SiteHeader />

      <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_24%),linear-gradient(180deg,#020617_0%,#0f172a_45%,#111827_100%)] px-4 pb-10 pt-24 text-white">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-6 flex justify-center">
            <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-2xl backdrop-blur">
              <AdSlot code={IN_CONTENT_AD} />
            </div>
          </div>

          <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-slate-900/70 px-6 py-10 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur sm:px-8 lg:px-10 lg:py-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.10),transparent_24%)]" />
            <div className="absolute -left-16 top-10 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl animate-pulse" />
            <div className="absolute -right-10 bottom-0 h-44 w-44 rounded-full bg-sky-500/20 blur-3xl animate-pulse" />
            <div className="absolute left-1/2 top-0 h-28 w-72 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-amber-200 shadow-[0_0_25px_rgba(251,191,36,0.18)]">
                  <Sparkles size={14} className="animate-pulse" /> Premium JB Store
                </div>

                <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Upgrade your experience.
                  <span className="block bg-gradient-to-r from-amber-200 via-white to-fuchsia-200 bg-clip-text text-transparent">
                    Not just your coins.
                  </span>
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  Make users want to upgrade with stronger value, premium identity, secure checkout, and clearer plan differences between Free, Premium, and Platinum.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {trustItems.map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/10 hover:shadow-[0_15px_35px_rgba(255,255,255,0.06)]"
                    >
                      <div className="rounded-xl bg-white/10 p-2 text-sky-200 transition duration-300 group-hover:scale-110 group-hover:bg-sky-400/10">
                        <Icon size={16} />
                      </div>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleBuyClick("php1000")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 px-5 py-3 text-sm font-black text-white shadow-[0_10px_35px_rgba(249,115,22,0.35)] transition duration-300 hover:scale-[1.03] hover:shadow-[0_16px_45px_rgba(249,115,22,0.45)]"
                  >
                    Upgrade Now <ArrowRight size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBuyClick("php500")}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-100 transition duration-300 hover:scale-[1.03] hover:bg-white/10"
                  >
                    View Premium Offers
                  </button>
                </div>

                <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2">More Access</div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Premium Feel</div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Secure Checkout</div>
                </div>
              </div>

              <div className="group relative rounded-[30px] border border-fuchsia-400/20 bg-[linear-gradient(135deg,rgba(168,85,247,0.24),rgba(59,130,246,0.14),rgba(15,23,42,0.95))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(168,85,247,0.28)]">
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-fuchsia-500/20 blur-3xl transition duration-300 group-hover:bg-fuchsia-500/30" />
                <div className="absolute -bottom-10 left-0 h-28 w-28 rounded-full bg-sky-500/15 blur-3xl" />

                <div className="relative inline-flex items-center gap-2 rounded-full border border-fuchsia-300/20 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-200 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
                  <Crown size={13} className="animate-pulse" /> Most chosen by power users
                </div>

                <h2 className="mt-4 text-3xl font-black text-white">₱1000 Package</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Best for power users who want the highest bonus coins, strongest value, and premium-level checkout confidence.
                </p>

                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Total Receive</div>
                    <div className="mt-2 text-3xl font-black text-white">{formatCoins(1000 * COINS_PER_PHP + 2500)}</div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Bonus Coins</div>
                      <div className="mt-2 text-xl font-black text-emerald-300">+2,500</div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Best Deal</div>
                      <div className="mt-2 text-xl font-black text-amber-300">+19% Value</div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleBuyClick("php1000")}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 px-5 py-3 text-sm font-black text-white shadow-[0_10px_35px_rgba(168,85,247,0.30)] transition duration-300 hover:scale-[1.02] hover:opacity-95 hover:shadow-[0_18px_45px_rgba(168,85,247,0.38)]"
                >
                  Choose Best Offer <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-[32px] border border-white/10 bg-slate-900/70 p-6 shadow-xl backdrop-blur sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">Membership Comparison</p>
                <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Make upgrading feel worth it.</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">
                  Show users exactly why Free, Premium, and Platinum are different.
                </p>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-amber-200 shadow-[0_0_25px_rgba(251,191,36,0.16)]">
                <Crown size={14} /> Most Popular: Premium
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-3">
              <article className="rounded-[28px] border border-white/10 bg-white/5 p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07]">
                <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                  Free
                </div>
                <h3 className="mt-4 text-2xl font-black text-white">Free Plan</h3>
                <p className="mt-2 text-sm text-slate-400">For casual users who just want basic access.</p>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">Limited downloads</div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">Ads enabled</div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">Basic access only</div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">No exclusive content</div>
                </div>
              </article>

              <article className="relative rounded-[28px] border border-amber-400/40 bg-[linear-gradient(180deg,rgba(251,191,36,0.16),rgba(15,23,42,0.78))] p-6 shadow-[0_20px_60px_rgba(251,191,36,0.14)] ring-2 ring-amber-400/20 transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(251,191,36,0.18)]">
                <div className="absolute -top-4 right-4 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-950 shadow-[0_10px_30px_rgba(251,191,36,0.35)]">
                  Most Popular
                </div>

                <div className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">
                  Premium
                </div>
                <h3 className="mt-4 text-2xl font-black text-white">Premium Plan</h3>
                <p className="mt-2 text-sm text-slate-300">The best balance of value, status, and stronger features.</p>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-amber-400/20 bg-black/20 px-4 py-3 text-sm text-slate-100">More downloads</div>
                  <div className="rounded-2xl border border-amber-400/20 bg-black/20 px-4 py-3 text-sm text-slate-100">Reduced ads</div>
                  <div className="rounded-2xl border border-amber-400/20 bg-black/20 px-4 py-3 text-sm text-slate-100">Priority access</div>
                  <div className="rounded-2xl border border-amber-400/20 bg-black/20 px-4 py-3 text-sm text-slate-100">Extra premium value</div>
                </div>
              </article>

              <article className="relative rounded-[28px] border border-fuchsia-400/30 bg-[linear-gradient(180deg,rgba(168,85,247,0.16),rgba(15,23,42,0.78))] p-6 shadow-[0_20px_60px_rgba(168,85,247,0.14)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(168,85,247,0.22)]">
                <div className="absolute right-4 top-4 rounded-full border border-fuchsia-300/20 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-200">
                  Elite
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-200">
                  <Crown size={12} /> Platinum
                </div>
                <h3 className="mt-4 text-2xl font-black text-white">Platinum Plan</h3>
                <p className="mt-2 text-sm text-slate-300">For users who want everything unlocked and the best experience.</p>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-fuchsia-400/20 bg-black/20 px-4 py-3 text-sm text-slate-100">Everything unlocked</div>
                  <div className="rounded-2xl border border-fuchsia-400/20 bg-black/20 px-4 py-3 text-sm text-slate-100">Best experience</div>
                  <div className="rounded-2xl border border-fuchsia-400/20 bg-black/20 px-4 py-3 text-sm text-slate-100">VIP priority</div>
                  <div className="rounded-2xl border border-fuchsia-400/20 bg-black/20 px-4 py-3 text-sm text-slate-100">Full exclusive access</div>
                </div>
              </article>
            </div>

            <div className="mt-6 overflow-hidden rounded-[28px] border border-white/10">
              <div className="grid grid-cols-4 bg-white/5 text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                <div className="px-4 py-4">Feature</div>
                <div className="px-4 py-4 text-center">Free</div>
                <div className="px-4 py-4 text-center text-amber-200">Premium</div>
                <div className="px-4 py-4 text-center text-fuchsia-200">Platinum</div>
              </div>

              {planFeatures.map((feature, index) => (
                <div
                  key={feature.label}
                  className={`grid grid-cols-4 text-sm transition duration-200 hover:bg-white/[0.05] ${
                    index % 2 === 0 ? "bg-slate-950/40" : "bg-white/[0.03]"
                  }`}
                >
                  <div className="border-t border-white/10 px-4 py-4 font-semibold text-white">{feature.label}</div>
                  <div className="border-t border-white/10 px-4 py-4 text-center text-slate-300">{feature.free}</div>
                  <div className="border-t border-white/10 px-4 py-4 text-center font-bold text-amber-200">{feature.premium}</div>
                  <div className="border-t border-white/10 px-4 py-4 text-center font-bold text-fuchsia-200">{feature.platinum}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-200">Why Upgrade</p>
                <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Benefits that make users want more.</h2>
              </div>
              <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right text-sm text-slate-300 md:block">
                Premium feel, more trust, better conversion.
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {premiumBenefits.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="group rounded-[28px] border border-white/10 bg-slate-900/75 p-5 shadow-xl transition duration-300 hover:-translate-y-1.5 hover:border-white/20 hover:shadow-[0_20px_45px_rgba(255,255,255,0.06)]"
                >
                  <div className="inline-flex rounded-2xl bg-white/10 p-3 text-sky-200 transition duration-300 group-hover:scale-110 group-hover:bg-sky-400/10 group-hover:shadow-[0_0_30px_rgba(56,189,248,0.14)]">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-4 text-lg font-black text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-200">Coin Packages</p>
                <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Choose the package that fits you.</h2>
              </div>
              <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right text-sm text-slate-300 md:block">
                Secure checkout, clear bonuses, trusted wallet details.
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {packages.map((item) => {
                const packageTotalCoins = item.baseCoins + item.bonusCoins
                const isFeatured = item.featured === true
                const savePercent = Math.round((item.bonusCoins / item.baseCoins) * 100)

                return (
                  <article
                    key={item.id}
                    className={`group relative overflow-hidden rounded-[32px] border bg-slate-900/75 p-6 shadow-xl transition duration-300 hover:-translate-y-2 hover:border-white/20 ${item.border} ${
                      isFeatured
                        ? "scale-[1.015] ring-2 ring-fuchsia-400/40 shadow-[0_20px_60px_rgba(168,85,247,0.18)] hover:shadow-[0_28px_75px_rgba(168,85,247,0.26)]"
                        : "border-white/10 hover:shadow-[0_20px_45px_rgba(255,255,255,0.06)]"
                    }`}
                  >
                    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.gradient}`} />
                    <div className={`absolute -top-10 right-0 h-24 w-24 rounded-full bg-white/5 blur-2xl transition duration-300 ${isFeatured ? "group-hover:bg-fuchsia-400/20" : "group-hover:bg-white/10"}`} />

                    {isFeatured ? (
                      <div className="absolute right-4 top-4 rounded-full border border-fuchsia-300/20 bg-fuchsia-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-200 shadow-[0_0_25px_rgba(168,85,247,0.14)]">
                        Most Popular
                      </div>
                    ) : null}

                    {item.badge ? (
                      <div className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] ${item.badgeStyle}`}>
                        {item.badge}
                      </div>
                    ) : null}

                    <h3 className="mt-4 text-3xl font-black text-white">₱{item.php}</h3>
                    <p className="mt-2 text-sm text-slate-300">{item.description}</p>

                    <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/60 p-5 backdrop-blur">
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Equivalent Coins</p>

                      <div className={`${isFeatured ? "text-3xl" : "text-2xl"} mt-3 font-black text-white`}>
                        {formatCoins(item.baseCoins)}
                      </div>

                      {item.bonusCoins > 0 ? (
                        <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-300">
                          Bonus +{item.bonusCoins.toLocaleString()} Coins
                        </div>
                      ) : null}

                      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-300">
                        <span>Total Receive</span>
                        <span className="font-black text-white">{formatCoins(packageTotalCoins)}</span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-300">
                        <span>Bonus Value</span>
                        <span className="font-black text-amber-300">+{savePercent}%</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleBuyClick(item.id)}
                      className={`mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r px-5 py-3 text-sm font-black text-white shadow-lg transition duration-300 hover:scale-[1.02] hover:opacity-95 ${item.gradient}`}
                    >
                      Buy {formatPeso(item.php)} Package
                    </button>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="mt-8 rounded-[30px] border border-white/10 bg-slate-900/75 p-6 shadow-xl backdrop-blur">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {secureSignals.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-200 transition duration-300 hover:scale-[1.03] hover:bg-white/10"
                >
                  <Icon size={14} className="text-emerald-300" />
                  {label}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-[30px] border border-white/10 bg-slate-900/75 p-6 shadow-xl backdrop-blur transition duration-300 hover:shadow-[0_24px_55px_rgba(255,255,255,0.05)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-sky-200">
                <ShieldCheck size={13} /> Security & Trust
              </div>
              <h3 className="mt-4 text-2xl font-black text-white">Why buyers feel safer here</h3>
              <div className="mt-5 grid gap-3">
                {[
                  "Secure receipt upload before verification",
                  "Official payment account details shown clearly",
                  "High-bonus packages with transparent totals",
                  "Manual review helps prevent fake credits and abuse",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200 transition duration-300 hover:border-white/20 hover:bg-white/[0.06]">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-slate-900/75 p-6 shadow-xl backdrop-blur transition duration-300 hover:shadow-[0_24px_55px_rgba(255,255,255,0.05)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200">
                <Star size={13} /> Testimonials
              </div>
              <h3 className="mt-4 text-2xl font-black text-white">What users say</h3>
              <div className="mt-5 grid gap-4">
                {testimonials.map((item) => (
                  <div
                    key={item.name + item.role}
                    className="rounded-[24px] border border-white/10 bg-black/20 p-4 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-white">{item.name}</div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.role}</div>
                      </div>
                      <div className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
                        Verified
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">“{item.text}”</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-8 overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(168,85,247,0.12),rgba(15,23,42,0.8))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur sm:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white">
                <Flame size={13} className="text-orange-300" /> Final Upgrade Push
              </div>
              <h3 className="mt-4 text-2xl font-black text-white sm:text-3xl">
                Users should feel they’re missing out by staying free.
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                This page now sells status, value, trust, and premium identity together. That is what turns a normal store page into a real upgrade page.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleBuyClick("php1000")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 px-6 py-3 text-sm font-black text-white shadow-[0_12px_40px_rgba(168,85,247,0.30)] transition duration-300 hover:scale-[1.03]"
                >
                  <Diamond size={16} />
                  Go Premium Now
                </button>

                <button
                  type="button"
                  onClick={() => handleBuyClick("php500")}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-black text-white transition duration-300 hover:scale-[1.03] hover:bg-white/15"
                >
                  Start with a Strong Value Pack
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {showCheckoutModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-3 py-3 backdrop-blur-sm sm:px-4">
          <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/10 bg-slate-900 shadow-[0_35px_120px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-fuchsia-500 to-amber-400" />
            <div className="absolute -top-8 right-8 h-24 w-24 rounded-full bg-fuchsia-500/15 blur-3xl" />
            <div className="absolute bottom-0 left-8 h-20 w-20 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="relative p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">
                    <Gem size={13} /> Ready to checkout
                  </div>
                  <h3 className="mt-3 text-2xl font-black text-white">Confirm your JB Coin package</h3>
                  <p className="mt-2 text-sm text-slate-300">Review your package details before moving to the payment page.</p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-200 transition duration-300 hover:bg-white/10"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div
                  className={`rounded-[24px] border bg-gradient-to-br p-4 ${
                    selectedPackage.border
                  } ${
                    selectedPackage.featured
                      ? "from-fuchsia-500/18 via-purple-500/10 to-slate-950 shadow-[0_18px_50px_rgba(168,85,247,0.12)]"
                      : "from-white/5 to-slate-950"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedPackage.badge ? (
                      <div className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] ${selectedPackage.badgeStyle}`}>
                        {selectedPackage.badge}
                      </div>
                    ) : null}
                    {selectedPackage.featured ? (
                      <div className="inline-flex items-center rounded-full border border-fuchsia-300/20 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-200">
                        Best deal
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 text-3xl font-black text-white">{formatPeso(selectedPackage.php)}</div>
                  <p className="mt-2 text-sm text-slate-300">{selectedPackage.description}</p>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Base Coins</div>
                      <div className="mt-1 text-lg font-black text-white">{formatCoins(selectedPackage.baseCoins)}</div>
                    </div>
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200">Bonus Coins</div>
                      <div className="mt-1 text-lg font-black text-emerald-300">+{selectedPackage.bonusCoins.toLocaleString()} Coins</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Total Receive</div>
                      <div className="mt-1 text-xl font-black text-white">{formatCoins(totalCoins)}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-sky-200">Checkout confidence</div>
                  <div className="mt-4 grid gap-3">
                    {[
                      "Official GCash and Maya wallet details",
                      "Receipt upload for secure verification",
                      "Manual review before coin crediting",
                      "Premium support flow with clear package totals",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                    You save more with this package through an extra <span className="font-black">+{bonusPercent}%</span> bonus value.
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleProceedToPayment}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-5 py-3.5 text-sm font-black text-white shadow-[0_10px_35px_rgba(59,130,246,0.28)] transition duration-300 hover:scale-[1.02] hover:opacity-95"
                >
                  Continue to Secure Payment <ArrowRight size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-black text-slate-200 transition duration-300 hover:bg-white/10"
                >
                  Keep Browsing
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default function JBStorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-300">
          Loading JB Store...
        </div>
      }
    >
      <StorePageContent />
    </Suspense>
  )
}