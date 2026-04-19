"use client"

import Link from "next/link"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coins,
  CreditCard,
  FileCheck2,
  FileImage,
  Gem,
  History,
  Lock,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  WalletCards,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import SiteHeader from "@/app/components/SiteHeader"

function formatPeso(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCoins(value: number) {
  return `${new Intl.NumberFormat("en-PH").format(value)} JB Coins`
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value)
}

type PaymentMethod = "gcash" | "maya"
type TransactionStatus = "pending" | "approved" | "credited" | "rejected"

type TransactionItem = {
  id: string
  label: string
  amount: number
  coins: number
  bonus: number
  base: number
  method: PaymentMethod
  payerName: string
  referenceNumber: string
  notes: string
  status: TransactionStatus
  createdAt: string
  receiptName: string
}

type WalletSummary = {
  balance: number
  pendingCoins: number
  lifetimePurchased: number
}

const VALID_PACKAGES = [
  { amount: 50, coins: 690, base: 650, bonus: 40 },
  { amount: 100, coins: 1400, base: 1300, bonus: 100 },
  { amount: 200, coins: 2900, base: 2600, bonus: 300 },
  { amount: 500, coins: 7500, base: 6500, bonus: 1000 },
  { amount: 1000, coins: 16000, base: 13000, bonus: 3000 },
] as const

function toSafeNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function normalizeWalletSummary(input: unknown): WalletSummary {
  if (!input || typeof input !== "object") {
    return {
      balance: 0,
      pendingCoins: 0,
      lifetimePurchased: 0,
    }
  }

  const item = input as Record<string, unknown>

  return {
    balance: toSafeNumber(
      item.balance ?? item.walletBalance ?? item.availableBalance ?? item.coins,
      0
    ),
    pendingCoins: toSafeNumber(
      item.pendingCoins ?? item.pending ?? item.pending_coins,
      0
    ),
    lifetimePurchased: toSafeNumber(
      item.lifetimePurchased ??
        item.lifetime_purchased ??
        item.totalPurchased ??
        item.totalPurchasedCoins ??
        item.total_purchased_coins,
      0
    ),
  }
}

function normalizeTransaction(input: unknown): TransactionItem | null {
  if (!input || typeof input !== "object") return null

  const item = input as Partial<TransactionItem>

  if (
    typeof item.id !== "string" ||
    typeof item.label !== "string" ||
    typeof item.amount !== "number" ||
    typeof item.coins !== "number" ||
    typeof item.method !== "string" ||
    typeof item.referenceNumber !== "string" ||
    typeof item.status !== "string" ||
    typeof item.createdAt !== "string"
  ) {
    return null
  }

  const validMethod: PaymentMethod =
    item.method === "gcash" ? "gcash" : "maya"

  const validStatus: TransactionStatus =
    item.status === "approved" ||
    item.status === "credited" ||
    item.status === "rejected"
      ? item.status
      : "pending"

  return {
    id: item.id,
    label: item.label,
    amount: item.amount,
    coins: item.coins,
    bonus: typeof item.bonus === "number" ? item.bonus : 0,
    base:
      typeof item.base === "number"
        ? item.base
        : Math.max(item.coins - (typeof item.bonus === "number" ? item.bonus : 0), 0),
    method: validMethod,
    payerName: typeof item.payerName === "string" ? item.payerName : "",
    referenceNumber: item.referenceNumber,
    notes: typeof item.notes === "string" ? item.notes : "",
    status: validStatus,
    createdAt: item.createdAt,
    receiptName:
      typeof item.receiptName === "string" ? item.receiptName : "receipt-image",
  }
}

function getStatusConfig(status: TransactionStatus) {
  switch (status) {
    case "pending":
      return {
        label: "Pending Review",
        dot: "bg-amber-400",
        chip: "border-amber-400/20 bg-amber-400/10 text-amber-200",
        icon: Clock3,
      }
    case "approved":
      return {
        label: "Approved",
        dot: "bg-sky-400",
        chip: "border-sky-400/20 bg-sky-400/10 text-sky-200",
        icon: BadgeCheck,
      }
    case "credited":
      return {
        label: "Coins Credited",
        dot: "bg-emerald-400",
        chip: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
        icon: CheckCircle2,
      }
    case "rejected":
      return {
        label: "Needs Review",
        dot: "bg-rose-400",
        chip: "border-rose-400/20 bg-rose-400/10 text-rose-200",
        icon: X,
      }
  }
}

function decodeLabel(value: string | null) {
  if (!value) return "JB Coin Package"
  try {
    return decodeURIComponent(value.replace(/\+/g, " "))
  } catch {
    return value.replace(/\+/g, " ")
  }
}

function PaymentPageContent() {
  useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const amount = Number(searchParams.get("amount") || 0)
  const coins = Number(searchParams.get("coins") || 0)
  const bonus = Number(searchParams.get("bonus") || 0)
  const base = Number(searchParams.get("base") || Math.max(coins - bonus, 0))
  const label = decodeLabel(searchParams.get("label"))
  const initialMethod = (searchParams.get("method") || "maya").toLowerCase()
  const featured = searchParams.get("featured") === "1"

  const isValidPackage = useMemo(() => {
    if (
      !Number.isFinite(amount) ||
      !Number.isFinite(coins) ||
      !Number.isFinite(base) ||
      !Number.isFinite(bonus)
    ) {
      return false
    }

    return VALID_PACKAGES.some(
      (pkg) =>
        pkg.amount === amount &&
        pkg.coins === coins &&
        pkg.base === base &&
        pkg.bonus === bonus
    )
  }, [amount, coins, base, bonus])

  const [method, setMethod] = useState<PaymentMethod>(
    initialMethod === "gcash" ? "gcash" : "maya"
  )
  const [payerName, setPayerName] = useState("")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [showSuccess, setShowSuccess] = useState(false)
  const [showCoinBurst, setShowCoinBurst] = useState(false)

  const [walletSummary, setWalletSummary] = useState<WalletSummary>({
    balance: 0,
    pendingCoins: 0,
    lifetimePurchased: 0,
  })
  const [isWalletSummaryLoading, setIsWalletSummaryLoading] = useState(true)
  const [walletSummaryError, setWalletSummaryError] = useState("")

  const [latestTransaction, setLatestTransaction] = useState<TransactionItem | null>(
    null
  )
  const [transactions, setTransactions] = useState<TransactionItem[]>([])
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true)
  const [transactionsError, setTransactionsError] = useState("")

  const walletDetails = {
    gcash: {
      name: "JB Collections",
      number: "09695289257",
      qr: "/gcash-qr.jpg",
      accent: "border-sky-400/30 bg-sky-500/10 text-sky-200",
      ring: "shadow-[0_0_0_1px_rgba(56,189,248,0.22),0_18px_50px_rgba(14,165,233,0.18)]",
    },
    maya: {
      name: "JB Collections",
      number: "09685289257",
      qr: "/maya-qr.jpg",
      accent: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
      ring: "shadow-[0_0_0_1px_rgba(52,211,153,0.22),0_18px_50px_rgba(16,185,129,0.18)]",
    },
  } as const

  const activeWallet = walletDetails[method]

  const statusCounts = useMemo(() => {
    return transactions.reduce(
      (acc, item) => {
        acc[item.status] += 1
        return acc
      },
      {
        pending: 0,
        approved: 0,
        credited: 0,
        rejected: 0,
      } as Record<TransactionStatus, number>
    )
  }, [transactions])

  const activeTimelineStatus: TransactionStatus = latestTransaction?.status || "pending"

  async function loadWalletSummary() {
    try {
      setIsWalletSummaryLoading(true)
      setWalletSummaryError("")

      const res = await fetch("/api/wallet/summary", {
        method: "GET",
        cache: "no-store",
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load wallet summary.")
      }

      const summarySource =
        data?.summary && typeof data.summary === "object" ? data.summary : data

      setWalletSummary(normalizeWalletSummary(summarySource))
    } catch (error) {
      setWalletSummaryError(
        error instanceof Error ? error.message : "Failed to load wallet summary."
      )
    } finally {
      setIsWalletSummaryLoading(false)
    }
  }

  async function loadTransactions() {
    try {
      setIsTransactionsLoading(true)
      setTransactionsError("")

      const res = await fetch("/api/wallet/transactions", {
        method: "GET",
        cache: "no-store",
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load transaction history.")
      }

      const rawTransactions: unknown[] = Array.isArray(data?.transactions)
        ? (data.transactions as unknown[])
        : []

      const normalizedTransactions: TransactionItem[] = rawTransactions
        .map(normalizeTransaction)
        .filter(
          (item: TransactionItem | null): item is TransactionItem => item !== null
        )

      setTransactions(normalizedTransactions)
      setLatestTransaction(normalizedTransactions[0] || null)
    } catch (error) {
      setTransactionsError(
        error instanceof Error ? error.message : "Failed to load transaction history."
      )
    } finally {
      setIsTransactionsLoading(false)
    }
  }

  useEffect(() => {
    void Promise.all([loadWalletSummary(), loadTransactions()])
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (!showCoinBurst) return

    const timer = window.setTimeout(() => {
      setShowCoinBurst(false)
    }, 2200)

    return () => window.clearTimeout(timer)
  }, [showCoinBurst])

  function handleReceiptChange(file: File | null) {
    if (!file) return

    setReceiptFile(file)
    setSubmitError("")

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  function clearReceipt() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setReceiptFile(null)
    setPreviewUrl("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function createTransactionId() {
    const now = new Date()
    const y = now.getFullYear()
    const m = `${now.getMonth() + 1}`.padStart(2, "0")
    const d = `${now.getDate()}`.padStart(2, "0")
    const random = Math.floor(1000 + Math.random() * 9000)
    return `TXN-${y}${m}${d}-${random}`
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitError("")

    if (!isValidPackage) {
      setSubmitError("Invalid amount.")
      return
    }

    if (!payerName.trim()) {
      setSubmitError("Please enter the payer name.")
      return
    }

    if (!referenceNumber.trim()) {
      setSubmitError("Please enter the payment reference number.")
      return
    }

    if (!receiptFile) {
      setSubmitError("Please upload your payment receipt.")
      return
    }

    try {
      setIsSubmitting(true)

      const formData = new FormData()
      formData.append("amount", String(amount))
      formData.append("coins", String(coins))
      formData.append("bonus", String(bonus))
      formData.append("base", String(base))
      formData.append("label", label)
      formData.append("method", method)
      formData.append("payer_name", payerName)
      formData.append("referenceNumber", referenceNumber)
      formData.append("notes", notes)
      formData.append("receipt", receiptFile)

      const res = await fetch("/api/coin-purchases/create", {
        method: "POST",
        body: formData,
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || "Failed to submit payment proof.")
      }

      const returnedTransaction = normalizeTransaction(data?.transaction)

      const newTransaction: TransactionItem =
        returnedTransaction || {
          id: data?.transaction_id || createTransactionId(),
          label,
          amount,
          coins,
          bonus,
          base,
          method,
          payerName: payerName.trim(),
          referenceNumber: referenceNumber.trim(),
          notes: notes.trim(),
          status: "pending",
          createdAt: String(data?.transaction?.createdAt || ""),
          receiptName: receiptFile.name,
        }

      setTransactions((prev) => [newTransaction, ...prev])
      setLatestTransaction(newTransaction)
      setWalletSummary((prev) => ({
        ...prev,
        pendingCoins: prev.pendingCoins + coins,
        lifetimePurchased: prev.lifetimePurchased + coins,
      }))
      setShowSuccess(true)
      setShowCoinBurst(true)

      setPayerName("")
      setReferenceNumber("")
      setNotes("")
      clearReceipt()
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Something went wrong."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCloseSuccess() {
    setShowSuccess(false)
  }

  const timelineSteps = [
    {
      key: "submitted",
      label: "Payment Submitted",
      description: "Receipt and reference number logged successfully.",
      active: true,
      completed: true,
    },
    {
      key: "review",
      label: "Receipt Under Review",
      description: "Team checks the proof and verifies wallet details.",
      active:
        activeTimelineStatus === "pending" ||
        activeTimelineStatus === "approved" ||
        activeTimelineStatus === "credited",
      completed:
        activeTimelineStatus === "approved" || activeTimelineStatus === "credited",
    },
    {
      key: "approved",
      label: "Approved",
      description: "Payment validated and ready for coin release.",
      active:
        activeTimelineStatus === "approved" || activeTimelineStatus === "credited",
      completed:
        activeTimelineStatus === "approved" || activeTimelineStatus === "credited",
    },
    {
      key: "credited",
      label: "Coins Credited",
      description: "JB Coins are added to your wallet balance.",
      active: activeTimelineStatus === "credited",
      completed: activeTimelineStatus === "credited",
    },
  ]

  const walletBalance = walletSummary.balance
  const pendingCoins = walletSummary.pendingCoins
  const lifetimePurchased = walletSummary.lifetimePurchased

  return (
    <>
      <SiteHeader />

      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_20%),radial-gradient(circle_at_right,rgba(16,185,129,0.10),transparent_20%),linear-gradient(180deg,#020617_0%,#071124_48%,#0f172a_100%)] px-3 pb-12 pt-24 text-white sm:px-4 lg:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/upgrade"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <ArrowLeft size={16} />
              Back to JB Store
            </Link>

            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-200">
              <WalletCards size={14} />
              Real Wallet Checkout
            </div>
          </div>

          <section className="rounded-[30px] border border-white/10 bg-slate-900/70 p-4 shadow-[0_25px_70px_rgba(0,0,0,0.35)] backdrop-blur sm:p-6 lg:p-8">
            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-amber-200">
                  <Sparkles size={14} />
                  Premium Checkout
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Complete Your JB Coin Payment
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  Pay with GCash or Maya, upload your receipt, and track your request
                  from submission to approval to coin crediting with a real wallet
                  activity flow.
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200">
                    <ShieldCheck size={16} className="text-sky-200" />
                    Verified wallet details
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200">
                    <History size={16} className="text-fuchsia-200" />
                    Transaction history
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200">
                    <Coins size={16} className="text-amber-200" />
                    Coin credit tracking
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Package
                  </div>
                  <div className="mt-2 text-xl font-black text-white">{label}</div>
                  <div className="mt-2 text-sm text-slate-400">
                    {formatCoins(coins)} total wallet credit
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Total Payment
                  </div>
                  <div className="mt-2 text-xl font-black text-amber-300">
                    {formatPeso(amount)}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    Exact amount required for verification
                  </div>
                </div>
              </div>
            </div>
          </section>

          {!isValidPackage ? (
            <div className="mt-5 rounded-[24px] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              Invalid amount. This package does not match the allowed JB Coin Store packages.
            </div>
          ) : null}

          {walletSummaryError ? (
            <div className="mt-5 rounded-[24px] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {walletSummaryError}
            </div>
          ) : null}

          <section className="mt-5 grid gap-4 xl:grid-cols-4">
            <div className="rounded-[26px] border border-white/10 bg-slate-900/70 p-4 shadow-xl backdrop-blur">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                <WalletCards size={14} />
                Wallet Balance
              </div>
              <div className="mt-3 text-3xl font-black text-white">
                {isWalletSummaryLoading ? "Loading..." : formatCoins(walletBalance)}
              </div>
              <div className="mt-2 text-sm text-slate-400">
                Available balance ready to use
              </div>
            </div>

            <div className="rounded-[26px] border border-amber-400/20 bg-amber-400/10 p-4 shadow-xl backdrop-blur">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">
                <Clock3 size={14} />
                Pending Coins
              </div>
              <div className="mt-3 text-3xl font-black text-white">
                {isWalletSummaryLoading ? "Loading..." : formatCoins(pendingCoins)}
              </div>
              <div className="mt-2 text-sm text-amber-100/80">
                Waiting for approval before crediting
              </div>
            </div>

            <div className="rounded-[26px] border border-emerald-400/20 bg-emerald-400/10 p-4 shadow-xl backdrop-blur">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200">
                <Gem size={14} />
                Lifetime Purchased
              </div>
              <div className="mt-3 text-3xl font-black text-white">
                {isWalletSummaryLoading ? "Loading..." : formatCoins(lifetimePurchased)}
              </div>
              <div className="mt-2 text-sm text-emerald-100/80">
                Total coins purchased from the JB Store
              </div>
            </div>

            <div className="rounded-[26px] border border-fuchsia-400/20 bg-fuchsia-400/10 p-4 shadow-xl backdrop-blur">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-fuchsia-200">
                <ReceiptText size={14} />
                Activity Status
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-white">
                  {statusCounts.pending} Pending
                </span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-white">
                  {statusCounts.approved} Approved
                </span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-white">
                  {statusCounts.credited} Credited
                </span>
              </div>
              <div className="mt-2 text-sm text-fuchsia-100/80">
                Real-time wallet activity view
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-xl backdrop-blur sm:p-5 lg:p-6">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setMethod("gcash")}
                    className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
                      method === "gcash"
                        ? "bg-sky-500 text-white shadow-lg"
                        : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    GCash
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethod("maya")}
                    className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
                      method === "maya"
                        ? "bg-emerald-500 text-white shadow-lg"
                        : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    Maya
                  </button>
                </div>

                <div className="mt-5 rounded-[26px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(8,15,30,0.96))] p-4 sm:p-5">
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
                    <QrCode size={16} />
                    Selected Payment
                  </div>

                  <div
                    className={`mt-4 rounded-[24px] border p-4 ${activeWallet.accent} ${activeWallet.ring}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                        {method === "gcash" ? "GCash" : "Maya"}
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                        Official Wallet
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                        Verified Receiving Account
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                      <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black/20">
                        <img
                          src={activeWallet.qr}
                          alt={`${method} QR code`}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="flex flex-col justify-between rounded-[22px] border border-white/10 bg-black/20 p-4">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
                            Account Name
                          </div>
                          <div className="mt-2 text-lg font-black text-white">
                            {activeWallet.name}
                          </div>

                          <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
                            Wallet Number
                          </div>
                          <div className="mt-2 text-lg font-black text-white">
                            {activeWallet.number}
                          </div>
                        </div>

                        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                          Send the exact amount:
                          <span className="ml-2 font-black text-amber-300">
                            {formatPeso(amount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-sm font-black text-white">
                        <ReceiptText size={16} />
                        Step 1
                      </div>
                      <p className="mt-2 text-sm text-slate-300">
                        Pay the exact amount using the official wallet above.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-sm font-black text-white">
                        <FileImage size={16} />
                        Step 2
                      </div>
                      <p className="mt-2 text-sm text-slate-300">
                        Upload a readable receipt screenshot with reference number.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-sm font-black text-white">
                        <Coins size={16} />
                        Step 3
                      </div>
                      <p className="mt-2 text-sm text-slate-300">
                        Track status until your coins are credited to your wallet.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div
                id="transaction-history"
                className="rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-xl backdrop-blur sm:p-5 lg:p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
                      <History size={16} />
                      Transaction History
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      Every payment request is logged with status, receipt record, and
                      wallet credit progress.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void Promise.all([loadWalletSummary(), loadTransactions()])}
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/10"
                  >
                    Refresh
                  </button>
                </div>

                {transactionsError ? (
                  <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {transactionsError}
                  </div>
                ) : null}

                <div className="mt-5 space-y-3">
                  {isTransactionsLoading ? (
                    <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-300">
                      Loading transaction history...
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5 text-sm text-slate-300">
                      No wallet activity yet. Your first payment request will appear
                      here.
                    </div>
                  ) : (
                    transactions.map((item) => {
                      const status = getStatusConfig(item.status)
                      const StatusIcon = status.icon

                      return (
                        <div
                          key={item.id}
                          className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4 transition hover:bg-slate-950/80"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-black text-white">
                                  {item.label}
                                </div>
                                <div
                                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${status.chip}`}
                                >
                                  <StatusIcon size={12} />
                                  {status.label}
                                </div>
                              </div>

                              <div className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                                {item.id}
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div>
                                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                    Amount
                                  </div>
                                  <div className="mt-1 text-sm font-black text-amber-300">
                                    {formatPeso(item.amount)}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                    Coins
                                  </div>
                                  <div className="mt-1 text-sm font-black text-white">
                                    {formatCoins(item.coins)}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                    Method
                                  </div>
                                  <div className="mt-1 text-sm font-black capitalize text-white">
                                    {item.method}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                    Submitted
                                  </div>
                                  <div className="mt-1 text-sm font-black text-white">
                                    {item.createdAt
                                      ? formatDateTime(new Date(item.createdAt))
                                      : "—"}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                                  Reference:
                                  <span className="ml-2 font-black text-white">
                                    {item.referenceNumber}
                                  </span>
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                                  Receipt:
                                  <span className="ml-2 font-black text-white">
                                    {item.receiptName}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="w-full max-w-full rounded-[22px] border border-white/10 bg-white/5 p-4 lg:w-[260px]">
                              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                                <Clock3 size={13} />
                                Status Progress
                              </div>

                              <div className="mt-4 space-y-3">
                                {[
                                  { name: "Submitted", done: true },
                                  {
                                    name: "Review",
                                    done:
                                      item.status === "approved" ||
                                      item.status === "credited",
                                  },
                                  {
                                    name: "Approved",
                                    done:
                                      item.status === "approved" ||
                                      item.status === "credited",
                                  },
                                  {
                                    name: "Credited",
                                    done: item.status === "credited",
                                  },
                                ].map((step) => (
                                  <div
                                    key={step.name}
                                    className="flex items-center gap-3"
                                  >
                                    <div
                                      className={`h-2.5 w-2.5 rounded-full ${
                                        step.done ? status.dot : "bg-white/15"
                                      }`}
                                    />
                                    <div
                                      className={`text-sm font-semibold ${
                                        step.done ? "text-white" : "text-slate-500"
                                      }`}
                                    >
                                      {step.name}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-xs leading-6 text-slate-300">
                                Your payment is logged as an official wallet activity
                                record and remains traceable until final coin crediting.
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-xl backdrop-blur sm:p-5 lg:p-6">
                <div className="rounded-[24px] border border-fuchsia-400/20 bg-fuchsia-500/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-fuchsia-200">
                    <Gem size={16} />
                    Order Summary
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-4 text-sm text-slate-200">
                      <span>Package</span>
                      <span className="font-black text-white">{label}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-sm text-slate-200">
                      <span>Base Coins</span>
                      <span className="font-black text-white">{formatCoins(base)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-sm text-slate-200">
                      <span>Bonus Coins</span>
                      <span className="font-black text-emerald-300">
                        +{bonus.toLocaleString()} Coins
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-sm text-slate-200">
                      <span>Total Receive</span>
                      <span className="font-black text-white">{formatCoins(coins)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3 text-sm text-slate-200">
                      <span>Total Payment</span>
                      <span className="text-lg font-black text-amber-300">
                        {formatPeso(amount)}
                      </span>
                    </div>
                  </div>
                </div>

                {featured ? (
                  <div className="mt-4 rounded-[24px] border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                    This package includes stronger bonus value and ranks among the
                    best wallet top-up deals in the JB Store.
                  </div>
                ) : null}

                <div className="mt-4 rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
                    <Clock3 size={16} />
                    Wallet Status Tracker
                  </div>

                  <div className="mt-5 space-y-4">
                    {timelineSteps.map((step, index) => (
                      <div key={step.key} className="relative flex gap-3">
                        {index !== timelineSteps.length - 1 ? (
                          <div className="absolute left-[10px] top-6 h-[calc(100%+8px)] w-px bg-white/10" />
                        ) : null}

                        <div
                          className={`relative z-10 mt-1 h-5 w-5 rounded-full border ${
                            step.completed
                              ? "border-emerald-400 bg-emerald-400"
                              : step.active
                              ? "border-sky-400 bg-sky-400"
                              : "border-white/15 bg-slate-900"
                          }`}
                        />

                        <div className="min-w-0 flex-1 pb-3">
                          <div
                            className={`text-sm font-black ${
                              step.active || step.completed
                                ? "text-white"
                                : "text-slate-500"
                            }`}
                          >
                            {step.label}
                          </div>
                          <div
                            className={`mt-1 text-sm leading-6 ${
                              step.active || step.completed
                                ? "text-slate-300"
                                : "text-slate-500"
                            }`}
                          >
                            {step.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-white">
                      Payer Name
                    </label>
                    <input
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      placeholder="Enter sender name"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-white">
                      Reference Number
                    </label>
                    <input
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="Enter payment reference number"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-white">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional message for the review team"
                      rows={4}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-white">
                      Upload Receipt
                    </label>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-white/15 bg-slate-950/60 px-4 py-6 text-center transition hover:border-sky-400/30 hover:bg-slate-950/80"
                    >
                      <div className="rounded-2xl bg-white/10 p-3 text-sky-200">
                        <UploadCloud size={24} />
                      </div>
                      <div>
                        <div className="text-sm font-black text-white">
                          Tap to upload payment receipt
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          Phones, tablets, laptops, and desktop supported
                        </div>
                      </div>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleReceiptChange(e.target.files?.[0] || null)
                      }
                    />

                    {previewUrl ? (
                      <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/60">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                          <div>
                            <div className="text-sm font-bold text-white">
                              Receipt Preview
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {receiptFile?.name || "receipt-image"}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={clearReceipt}
                            className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-200 transition hover:bg-white/10"
                          >
                            <X size={14} />
                            Remove
                          </button>
                        </div>

                        <img
                          src={previewUrl}
                          alt="Receipt preview"
                          className="max-h-[340px] w-full object-contain bg-black/20"
                        />

                        <div className="grid gap-3 border-t border-white/10 px-4 py-4 sm:grid-cols-3">
                          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-3 text-xs text-emerald-200">
                            <div className="font-black uppercase tracking-[0.18em]">
                              Attachment
                            </div>
                            <div className="mt-1 text-sm font-bold text-white">
                              Added
                            </div>
                          </div>

                          <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-3 py-3 text-xs text-sky-200">
                            <div className="font-black uppercase tracking-[0.18em]">
                              Visibility
                            </div>
                            <div className="mt-1 text-sm font-bold text-white">
                              Readable Proof
                            </div>
                          </div>

                          <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-3 text-xs text-fuchsia-200">
                            <div className="font-black uppercase tracking-[0.18em]">
                              Reference Match
                            </div>
                            <div className="mt-1 text-sm font-bold text-white">
                              Ready to Submit
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {submitError ? (
                    <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {submitError}
                    </div>
                  ) : null}

                  <div className="grid gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting || !isValidPackage}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-5 py-3.5 text-sm font-black text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CreditCard size={16} />
                      {isSubmitting
                        ? "Submitting Payment Proof..."
                        : "Submit Payment Proof"}
                    </button>

                    <div className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-6 text-slate-300">
                      <Lock size={14} className="mt-1 shrink-0 text-sky-200" />
                      Your payment is logged as a wallet transaction record, queued
                      for secure review, and remains visible in your activity history
                      until final coin crediting.
                    </div>
                  </div>
                </form>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-xl backdrop-blur sm:p-5 lg:p-6">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
                  <ShieldCheck size={16} />
                  Trust Signals
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    "Official wallet details shown clearly",
                    "Receipt proof stays attached to the request",
                    "Submission gets a transaction ID",
                    "Status moves from pending to credited",
                    "Coins are tracked before release",
                    "Wallet activity stays visible after checkout",
                  ].map((text) => (
                    <div
                      key={text}
                      className="flex items-start gap-3 rounded-[22px] border border-white/10 bg-slate-950/60 p-4"
                    >
                      <div className="rounded-xl bg-white/10 p-2 text-sky-200">
                        <CheckCircle2 size={16} />
                      </div>
                      <div className="text-sm font-semibold text-white">{text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {showCoinBurst ? (
        <div className="pointer-events-none fixed inset-0 z-[95] overflow-hidden">
          <div className="absolute right-6 top-24 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-200 shadow-[0_20px_60px_rgba(251,191,36,0.22)] animate-bounce">
            +{coins.toLocaleString()} JB Coins
          </div>

          {Array.from({ length: 16 }).map((_, index) => (
            <div
              key={index}
              className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-300/30 bg-amber-300/10 backdrop-blur-sm animate-ping"
              style={{
                marginLeft: `${(index - 8) * 22}px`,
                marginTop: `${((index % 5) - 2) * 26}px`,
                animationDuration: `${1.6 + (index % 4) * 0.18}s`,
                animationDelay: `${index * 0.03}s`,
              }}
            >
              <div className="flex h-full w-full items-center justify-center text-amber-200">
                <Coins size={16} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showSuccess && latestTransaction ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-3 py-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[30px] border border-white/10 bg-slate-900 p-5 text-white shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:p-6">
            <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="rounded-[26px] border border-emerald-400/20 bg-emerald-500/10 p-5">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <CheckCircle2 size={32} />
                </div>

                <div className="mt-4 text-center">
                  <div className="text-2xl font-black">Payment Logged</div>
                  <p className="mt-2 text-sm leading-7 text-emerald-100/85">
                    Your receipt, reference number, and wallet request were submitted
                    successfully.
                  </p>
                </div>

                <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-300">Transaction ID</span>
                    <span className="text-sm font-black text-white">
                      {latestTransaction.id}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-300">Status</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                      <Clock3 size={12} />
                      Pending Review
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-300">Submitted</span>
                    <span className="text-sm font-black text-white">
                      {latestTransaction.createdAt
                        ? formatDateTime(new Date(latestTransaction.createdAt))
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-slate-950/60 p-5">
                <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
                  <ReceiptText size={16} />
                  Confirmation Summary
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-4 text-sm text-slate-200">
                    <span>Package</span>
                    <span className="font-black text-white">{latestTransaction.label}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm text-slate-200">
                    <span>Payment</span>
                    <span className="font-black text-amber-300">
                      {formatPeso(latestTransaction.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm text-slate-200">
                    <span>Coins to Receive</span>
                    <span className="font-black text-white">
                      {formatCoins(latestTransaction.coins)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm text-slate-200">
                    <span>Method</span>
                    <span className="font-black capitalize text-white">
                      {latestTransaction.method}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm text-slate-200">
                    <span>Reference</span>
                    <span className="font-black text-white">
                      {latestTransaction.referenceNumber}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm text-slate-200">
                    <span>Receipt</span>
                    <span className="font-black text-white">
                      {latestTransaction.receiptName}
                    </span>
                  </div>
                </div>

                <div className="mt-5 rounded-[24px] border border-sky-400/20 bg-sky-400/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-white/10 p-2 text-sky-200">
                      <FileCheck2 size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-black text-white">
                        What happens next
                      </div>
                      <p className="mt-1 text-sm leading-7 text-sky-100/85">
                        Your request is now visible in Transaction History. Once
                        approved, the status moves forward and your coins are credited
                        into your wallet.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleCloseSuccess}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-black text-white shadow-lg"
                  >
                    Done
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowSuccess(false)
                      document
                        .getElementById("transaction-history")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10"
                  >
                    View Activity
                    <ChevronRight size={16} />
                  </button>

                  <Link
                    href="/upgrade"
                    className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10"
                  >
                    Back to Store
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
          <div className="rounded-2xl border border-white/10 bg-slate-900 px-6 py-4 font-bold">
            Loading payment page...
          </div>
        </div>
      }
    >
      <PaymentPageContent />
    </Suspense>
  )
}
