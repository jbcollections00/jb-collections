"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import AdminHeader from "@/app/components/AdminHeader"
import AdminToast from "@/app/components/AdminToast"
import { createClient } from "@/lib/supabase/client"
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coins,
  DollarSign,
  Download,
  Eye,
  Mail,
  Package2,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react"

type UpgradeRequest = {
  id: string
  sender_id: string | null
  name: string | null
  email: string | null
  plan: string | null
  subject: string | null
  body: string | null
  status: string | null
  admin_reply: string | null
  receipt_url?: string | null
  receipt_path?: string | null
  created_at: string
  amount?: number | null
  coins?: number | null
  label?: string | null
  package_label?: string | null
  payment_name?: string | null
  payment_method?: string | null
  reference_number?: string | null
  payment_note?: string | null
  payment_proof_url?: string | null
  coins_credited?: boolean | null
  coins_credited_at?: string | null
}

type AdminPaymentStats = {
  totalRequests: number
  pendingRequests: number
  approvedRequests: number
  creditedRequests: number
  rejectedRequests: number
  totalRevenue: number
  creditedRevenue: number
  pendingRevenue: number
  totalCoinsRequested: number
  totalCoinsCredited: number
  todayRevenue: number
  monthRevenue: number
  approvalRate: number
  creditRate: number
}

type FilterType = "all" | "pending" | "approved" | "credited" | "rejected"
type SortType = "newest" | "oldest" | "name_az" | "name_za"
type DatePreset = "all_time" | "today" | "last_7_days" | "this_month" | "custom"

type ToastState = {
  open: boolean
  type: "success" | "error" | "info" | "warning"
  title: string
  message: string
}

type StatusAction = {
  id: string | null
  action: "approve" | "reject" | "pending" | null
}

type TrendPoint = {
  key: string
  label: string
  revenue: number
  creditedRevenue: number
  count: number
}

type PackagePoint = {
  label: string
  revenue: number
  count: number
  coins: number
}

function normalizePlan(plan?: string | null) {
  const value = String(plan || "").trim().toLowerCase()
  if (value === "platinum") return "platinum"
  if (value === "coin_topup") return "coin_topup"
  return "premium"
}

function normalizeStatus(status?: string | null) {
  const value = String(status || "pending").trim().toLowerCase()
  if (value === "approved") return "approved"
  if (value === "credited") return "credited"
  if (value === "rejected") return "rejected"
  return "pending"
}

function normalizeMethod(method?: string | null) {
  const value = String(method || "").trim().toLowerCase()
  if (value === "gcash") return "gcash"
  if (value === "maya") return "maya"
  return "other"
}

function getPackageLabel(req: UpgradeRequest) {
  return (
    String(req.package_label || "").trim() ||
    String(req.label || "").trim() ||
    String(req.subject || "").trim() ||
    "Unknown Package"
  )
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatPeso(value?: number | null) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatCoins(value?: number | null) {
  return `${new Intl.NumberFormat("en-PH").format(Number(value || 0))} JB Coins`
}

function getStatusLabel(req: UpgradeRequest) {
  return normalizeStatus(req.status)
}

function getInitial(name: string | null, email: string | null) {
  const value = (name || email || "U").trim()
  return value.charAt(0).toUpperCase()
}

function getStatusClasses(status: string) {
  if (status === "credited") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
  if (status === "approved") return "border-sky-400/20 bg-sky-500/10 text-sky-300"
  if (status === "rejected") return "border-red-400/20 bg-red-500/10 text-red-300"
  return "border-amber-400/20 bg-amber-500/10 text-amber-300"
}

function getPlanClasses(plan?: string | null) {
  const normalized = normalizePlan(plan)
  if (normalized === "platinum") return "border-violet-400/20 bg-violet-500/10 text-violet-300"
  if (normalized === "coin_topup") return "border-amber-400/20 bg-amber-500/10 text-amber-300"
  return "border-blue-400/20 bg-blue-500/10 text-blue-300"
}

function isImage(url: string) {
  return /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url)
}

function isPdf(url: string) {
  return /\.pdf(\?|$)/i.test(url)
}

function csvCell(value: unknown) {
  const text = String(value ?? "")
  return `"${text.replace(/"/g, '""')}"`
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function isWithinDateRange(
  createdAt: string,
  preset: DatePreset,
  customStart: string,
  customEnd: string
) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return false

  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  if (preset === "all_time") return true
  if (preset === "today") return date >= startOfToday
  if (preset === "last_7_days") {
    const start = new Date(startOfToday)
    start.setDate(start.getDate() - 6)
    return date >= start
  }
  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return date >= start
  }
  if (preset === "custom") {
    const start = customStart ? new Date(`${customStart}T00:00:00`) : null
    const end = customEnd ? new Date(`${customEnd}T23:59:59`) : null
    if (start && Number.isNaN(start.getTime())) return false
    if (end && Number.isNaN(end.getTime())) return false
    if (start && date < start) return false
    if (end && date > end) return false
    return true
  }
  return true
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_14px_34px_rgba(2,6,23,0.32)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</div>
        <div className="rounded-2xl bg-white/10 p-2 text-sky-200">
          <Icon size={16} />
        </div>
      </div>
      <div className={`mt-3 text-3xl font-black tracking-tight ${color}`}>{value}</div>
    </div>
  )
}

function AnalyticsCard({
  label,
  value,
  sublabel,
  icon: Icon,
}: {
  label: string
  value: string
  sublabel: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_14px_34px_rgba(2,6,23,0.32)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</div>
        <div className="rounded-2xl bg-white/10 p-2 text-emerald-200">
          <Icon size={16} />
        </div>
      </div>
      <div className="mt-3 text-3xl font-black tracking-tight text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{sublabel}</div>
    </div>
  )
}

function MethodCard({
  label,
  count,
  revenue,
  percentage,
  icon: Icon,
}: {
  label: string
  count: number
  revenue: number
  percentage: number
  icon: React.ComponentType<{ size?: number; className?: string }>
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_14px_34px_rgba(2,6,23,0.32)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</div>
        <div className="rounded-2xl bg-white/10 p-2 text-violet-200">
          <Icon size={16} />
        </div>
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight text-white">{formatPeso(revenue)}</div>
      <div className="mt-2 text-sm text-slate-400">{count} request{count === 1 ? "" : "s"}</div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-violet-400" style={{ width: `${Math.max(percentage, 4)}%` }} />
      </div>
      <div className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-200">
        {percentage.toFixed(0)}% of visible revenue
      </div>
    </div>
  )
}

function PackageCard({
  item,
  percentage,
}: {
  item: PackagePoint
  percentage: number
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_14px_34px_rgba(2,6,23,0.32)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="line-clamp-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
          {item.label}
        </div>
        <div className="rounded-2xl bg-white/10 p-2 text-amber-200">
          <Package2 size={16} />
        </div>
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight text-white">{formatPeso(item.revenue)}</div>
      <div className="mt-2 text-sm text-slate-400">
        {item.count} request{item.count === 1 ? "" : "s"} • {formatCoins(item.coins)}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(percentage, 4)}%` }} />
      </div>
      <div className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
        {percentage.toFixed(0)}% of visible revenue
      </div>
    </div>
  )
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[28px] border border-slate-800/90 bg-slate-900/90 p-5 shadow-[0_18px_40px_rgba(2,6,23,0.34)] backdrop-blur sm:p-6">
      <div className="mb-5">
        <h3 className="text-lg font-black tracking-tight text-white">{title}</h3>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function RevenueTrendChart({ points }: { points: TrendPoint[] }) {
  const safePoints =
    points.length > 0
      ? points
      : [{ key: "empty", label: "No data", revenue: 0, creditedRevenue: 0, count: 0 }]

  const maxValue = Math.max(...safePoints.map((point) => Math.max(point.revenue, point.creditedRevenue, 1)))
  const chartWidth = 100
  const chartHeight = 100

  const revenuePath = safePoints
    .map((point, index) => {
      const x = safePoints.length === 1 ? 50 : (index / (safePoints.length - 1)) * chartWidth
      const y = chartHeight - (point.revenue / maxValue) * chartHeight
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")

  const creditedPath = safePoints
    .map((point, index) => {
      const x = safePoints.length === 1 ? 50 : (index / (safePoints.length - 1)) * chartWidth
      const y = chartHeight - (point.creditedRevenue / maxValue) * chartHeight
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")

  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-900/75 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.26)] backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Revenue Trend</div>
          <h3 className="mt-2 text-xl font-black text-white">Visible date window</h3>
          <p className="mt-1 text-sm text-slate-400">Submitted revenue versus credited revenue.</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-sky-200">Total revenue line</span>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-200">Credited revenue line</span>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
        <svg viewBox="0 0 100 100" className="h-64 w-full">
          {[0, 25, 50, 75, 100].map((y) => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} className="stroke-white/10" strokeWidth="0.4" />
          ))}
          <path d={revenuePath} fill="none" stroke="rgb(56 189 248)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d={creditedPath} fill="none" stroke="rgb(16 185 129)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          {safePoints.map((point, index) => {
            const x = safePoints.length === 1 ? 50 : (index / (safePoints.length - 1)) * chartWidth
            const yRevenue = chartHeight - (point.revenue / maxValue) * chartHeight
            const yCredited = chartHeight - (point.creditedRevenue / maxValue) * chartHeight
            return (
              <g key={point.key}>
                <circle cx={x} cy={yRevenue} r="1.4" fill="rgb(56 189 248)" />
                <circle cx={x} cy={yCredited} r="1.4" fill="rgb(16 185 129)" />
              </g>
            )
          })}
        </svg>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {safePoints.map((point) => (
            <div key={point.key} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{point.label}</div>
              <div className="mt-2 text-sm font-black text-white">{formatPeso(point.revenue)}</div>
              <div className="mt-1 text-xs text-emerald-300">Credited {formatPeso(point.creditedRevenue)}</div>
              <div className="mt-1 text-xs text-slate-500">{point.count} request{point.count === 1 ? "" : "s"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function UpgradesPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [requests, setRequests] = useState<UpgradeRequest[]>([])
  const [selectedRequest, setSelectedRequest] = useState<UpgradeRequest | null>(null)
  const [requestModalOpen, setRequestModalOpen] = useState(false)

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [sortBy, setSortBy] = useState<SortType>("newest")
  const [datePreset, setDatePreset] = useState<DatePreset>("all_time")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [replyBody, setReplyBody] = useState("")
  const [savingReply, setSavingReply] = useState(false)

  const [isEditingRequest, setIsEditingRequest] = useState(false)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPlan, setEditPlan] = useState("premium")
  const [editSubject, setEditSubject] = useState("")
  const [editBody, setEditBody] = useState("")
  const [savingRequestEdit, setSavingRequestEdit] = useState(false)

  const [isEditingReply, setIsEditingReply] = useState(false)
  const [editReplyText, setEditReplyText] = useState("")
  const [savingReplyEdit, setSavingReplyEdit] = useState(false)

  const [statusAction, setStatusAction] = useState<StatusAction>({ id: null, action: null })
  const [deletingRequest, setDeletingRequest] = useState(false)

  const [stats, setStats] = useState<AdminPaymentStats>({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    creditedRequests: 0,
    rejectedRequests: 0,
    totalRevenue: 0,
    creditedRevenue: 0,
    pendingRevenue: 0,
    totalCoinsRequested: 0,
    totalCoinsCredited: 0,
    todayRevenue: 0,
    monthRevenue: 0,
    approvalRate: 0,
    creditRate: 0,
  })

  const [toast, setToast] = useState<ToastState>({
    open: false,
    type: "success",
    title: "",
    message: "",
  })

  function showToast(
    type: "success" | "error" | "info" | "warning",
    title: string,
    message: string
  ) {
    setToast({ open: false, type, title, message })
    window.setTimeout(() => {
      setToast({ open: true, type, title, message })
    }, 10)
  }

  useEffect(() => {
    async function init() {
      const ok = await checkAdmin()
      if (!ok) return

      await Promise.all([loadRequests(true), loadAnalytics()])
    }

    void init()

    const now = new Date()
    setCustomStartDate(toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)))
    setCustomEndDate(toDateInputValue(now))
  }, [])

  useEffect(() => {
    if (!selectedRequest) {
      setReplyBody("")
      setIsEditingRequest(false)
      setIsEditingReply(false)
      return
    }

    setEditName(selectedRequest.name || selectedRequest.payment_name || "")
    setEditEmail(selectedRequest.email || "")
    setEditPlan(normalizePlan(selectedRequest.plan))
    setEditSubject(selectedRequest.subject || selectedRequest.label || "")
    setEditBody(selectedRequest.body || selectedRequest.payment_note || "")
    setReplyBody("")
    setEditReplyText(selectedRequest.admin_reply || "")
    setIsEditingRequest(false)
    setIsEditingReply(false)
  }, [selectedRequest])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setRequestModalOpen(false)
    }

    if (requestModalOpen) window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [requestModalOpen])

  async function checkAdmin() {
    try {
      setCheckingAdmin(true)
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace("/secure-admin-portal-7X9")
        return false
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profileError || profile?.role !== "admin") {
        router.replace("/secure-admin-portal-7X9")
        return false
      }

      return true
    } catch (error) {
      console.error("Admin upgrades auth check failed:", error)
      router.replace("/secure-admin-portal-7X9")
      return false
    } finally {
      setCheckingAdmin(false)
    }
  }

  async function loadAnalytics() {
    try {
      const response = await fetch("/api/admin/payments/stats", {
        method: "GET",
        cache: "no-store",
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to load analytics.")
      if (data?.stats) setStats(data.stats)
    } catch (error) {
      console.error("Load analytics error:", error)
    }
  }

  async function loadRequests(showLoader = false) {
    if (showLoader) setLoading(true)
    else setRefreshing(true)

    const { data, error } = await supabase
      .from("upgrades")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Load upgrades error:", error)
      if (showLoader) setLoading(false)
      setRefreshing(false)
      showToast("error", "Load Failed", error.message || "Could not load upgrade requests.")
      return
    }

    const nextRequests = (data as UpgradeRequest[]) || []
    setRequests(nextRequests)
    setSelectedRequest((current) => {
      if (!current) return nextRequests[0] || null
      return nextRequests.find((req) => req.id === current.id) || nextRequests[0] || null
    })

    if (showLoader) setLoading(false)
    setRefreshing(false)
  }

  const visibleRequests = useMemo(() => {
    return requests.filter((req) =>
      isWithinDateRange(req.created_at, datePreset, customStartDate, customEndDate)
    )
  }, [requests, datePreset, customStartDate, customEndDate])

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase()

    let nextRequests = visibleRequests.filter((req) => {
      const matchesSearch =
        !term ||
        (req.name || "").toLowerCase().includes(term) ||
        (req.email || "").toLowerCase().includes(term) ||
        (req.plan || "").toLowerCase().includes(term) ||
        (req.subject || "").toLowerCase().includes(term) ||
        (req.body || "").toLowerCase().includes(term) ||
        (req.admin_reply || "").toLowerCase().includes(term) ||
        (req.reference_number || "").toLowerCase().includes(term) ||
        (req.payment_method || "").toLowerCase().includes(term) ||
        (req.label || "").toLowerCase().includes(term) ||
        (req.package_label || "").toLowerCase().includes(term)

      const status = getStatusLabel(req)
      const matchesFilter = filter === "all" ? true : status === filter

      return matchesSearch && matchesFilter
    })

    nextRequests = [...nextRequests].sort((a, b) => {
      if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortBy === "name_az") return (a.name || a.email || "").localeCompare(b.name || b.email || "")
      if (sortBy === "name_za") return (b.name || b.email || "").localeCompare(a.name || a.email || "")
      return 0
    })

    return nextRequests
  }, [visibleRequests, search, filter, sortBy])

  const visibleStats = useMemo(() => {
    return {
      total: visibleRequests.length,
      pending: visibleRequests.filter((req) => getStatusLabel(req) === "pending").length,
      approved: visibleRequests.filter((req) => getStatusLabel(req) === "approved").length,
      credited: visibleRequests.filter((req) => getStatusLabel(req) === "credited").length,
      rejected: visibleRequests.filter((req) => getStatusLabel(req) === "rejected").length,
    }
  }, [visibleRequests])

  const visibleRevenue = useMemo(
    () => filteredRequests.reduce((sum, req) => sum + Number(req.amount || 0), 0),
    [filteredRequests]
  )

  const visibleCreditedRevenue = useMemo(
    () =>
      filteredRequests.reduce((sum, req) => {
        if (getStatusLabel(req) === "credited" || Boolean(req.coins_credited)) {
          return sum + Number(req.amount || 0)
        }
        return sum
      }, 0),
    [filteredRequests]
  )

  const methodBreakdown = useMemo(() => {
    const base = {
      gcash: { count: 0, revenue: 0 },
      maya: { count: 0, revenue: 0 },
      other: { count: 0, revenue: 0 },
    }

    for (const req of filteredRequests) {
      const method = normalizeMethod(req.payment_method)
      base[method].count += 1
      base[method].revenue += Number(req.amount || 0)
    }

    const totalRevenue = Math.max(base.gcash.revenue + base.maya.revenue + base.other.revenue, 1)

    return {
      gcash: { ...base.gcash, percentage: (base.gcash.revenue / totalRevenue) * 100 },
      maya: { ...base.maya, percentage: (base.maya.revenue / totalRevenue) * 100 },
      other: { ...base.other, percentage: (base.other.revenue / totalRevenue) * 100 },
    }
  }, [filteredRequests])

  const packageBreakdown = useMemo(() => {
    const map = new Map<string, PackagePoint>()

    for (const req of filteredRequests) {
      const label = getPackageLabel(req)
      const current = map.get(label) || { label, revenue: 0, count: 0, coins: 0 }
      current.revenue += Number(req.amount || 0)
      current.count += 1
      current.coins += Number(req.coins || 0)
      map.set(label, current)
    }

    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 4)
  }, [filteredRequests])

  const trendPoints = useMemo(() => {
    const dates = [...visibleRequests]
      .map((req) => req.created_at)
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())

    if (dates.length === 0) return []

    const start = new Date(dates[0])
    start.setHours(0, 0, 0, 0)
    const end = new Date(dates[dates.length - 1])
    end.setHours(0, 0, 0, 0)

    const days: TrendPoint[] = []
    const current = new Date(start)

    while (current <= end) {
      const key = current.toISOString().slice(0, 10)
      const label = current.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      })

      days.push({ key, label, revenue: 0, creditedRevenue: 0, count: 0 })
      current.setDate(current.getDate() + 1)
    }

    const dayMap = new Map(days.map((day) => [day.key, day]))

    for (const req of visibleRequests) {
      const created = new Date(req.created_at)
      if (Number.isNaN(created.getTime())) continue

      const key = new Date(created.getFullYear(), created.getMonth(), created.getDate())
        .toISOString()
        .slice(0, 10)

      const target = dayMap.get(key)
      if (!target) continue

      const amount = Number(req.amount || 0)
      target.revenue += amount
      target.count += 1

      if (getStatusLabel(req) === "credited" || Boolean(req.coins_credited)) {
        target.creditedRevenue += amount
      }
    }

    return days.slice(-14)
  }, [visibleRequests])

  function exportCsv() {
    try {
      setExporting(true)

      const summaryRows = [
        ["Metric", "Value"],
        ["Date Preset", datePreset],
        ["Custom Start", customStartDate || ""],
        ["Custom End", customEndDate || ""],
        ["Total Requests", visibleRequests.length],
        ["Pending Requests", visibleStats.pending],
        ["Approved Requests", visibleStats.approved],
        ["Credited Requests", visibleStats.credited],
        ["Rejected Requests", visibleStats.rejected],
        ["Visible Revenue", visibleRevenue],
        ["Visible Credited Revenue", visibleCreditedRevenue],
        ["GCash Revenue", methodBreakdown.gcash.revenue],
        ["GCash Requests", methodBreakdown.gcash.count],
        ["Maya Revenue", methodBreakdown.maya.revenue],
        ["Maya Requests", methodBreakdown.maya.count],
        ["Other Revenue", methodBreakdown.other.revenue],
        ["Other Requests", methodBreakdown.other.count],
      ]

      const packageHeader = ["Package Label", "Revenue", "Request Count", "Coins"]
      const packageRows = packageBreakdown.map((item) => [
        item.label,
        item.revenue,
        item.count,
        item.coins,
      ])

      const requestHeader = [
        "ID","Created At","Name","Email","Plan","Status","Amount","Coins","Package Label",
        "Payment Method","Reference Number","Payment Note","Admin Reply","Coins Credited",
        "Coins Credited At","Receipt URL","Receipt Path",
      ]

      const requestRows = filteredRequests.map((req) => [
        req.id,
        req.created_at,
        req.name || req.payment_name || "",
        req.email || "",
        normalizePlan(req.plan),
        getStatusLabel(req),
        Number(req.amount || 0),
        Number(req.coins || 0),
        getPackageLabel(req),
        req.payment_method || "",
        req.reference_number || "",
        req.payment_note || req.body || "",
        req.admin_reply || "",
        Boolean(req.coins_credited),
        req.coins_credited_at || "",
        req.receipt_url || req.payment_proof_url || "",
        req.receipt_path || "",
      ])

      const trendHeader = ["Date", "Revenue", "Credited Revenue", "Request Count"]
      const trendRows = trendPoints.map((point) => [
        point.label,
        point.revenue,
        point.creditedRevenue,
        point.count,
      ])

      const csv = [
        "PAYMENT ANALYTICS SUMMARY",
        ...summaryRows.map((row) => row.map(csvCell).join(",")),
        "",
        "TOP PACKAGES",
        packageHeader.map(csvCell).join(","),
        ...packageRows.map((row) => row.map(csvCell).join(",")),
        "",
        "REVENUE TREND VISIBLE WINDOW",
        trendHeader.map(csvCell).join(","),
        ...trendRows.map((row) => row.map(csvCell).join(",")),
        "",
        "PAYMENT REQUESTS",
        requestHeader.map(csvCell).join(","),
        ...requestRows.map((row) => row.map(csvCell).join(",")),
      ].join("\n")

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const stamp = new Date().toISOString().slice(0, 10)

      link.href = url
      link.download = `jb-payments-report-${stamp}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      showToast("success", "CSV Exported", "Filtered payment analytics and requests were exported.")
    } catch (error) {
      console.error("CSV export error:", error)
      showToast("error", "Export Failed", "Could not export CSV report.")
    } finally {
      setExporting(false)
    }
  }

  function openRequestModal(req: UpgradeRequest) {
    setSelectedRequest(req)
    setRequestModalOpen(true)
  }

  async function setPending(id: string) {
    try {
      setStatusAction({ id, action: "pending" })
      const { error } = await supabase.from("upgrades").update({ status: "pending" }).eq("id", id)
      if (error) {
        console.error("Set pending error:", error)
        showToast("error", "Update Failed", error.message)
        return
      }

      await Promise.all([loadRequests(false), loadAnalytics()])
      showToast("info", "Request Updated", "Request set to pending.")
    } finally {
      setStatusAction({ id: null, action: null })
    }
  }

  async function approveRequest(request: UpgradeRequest) {
    try {
      setStatusAction({ id: request.id, action: "approve" })
      const response = await fetch(`/api/admin/upgrades/${request.id}/approve`, {
        method: "POST",
      })

      const text = await response.text()
      let result: { error?: string; message?: string; ok?: boolean; alreadyCredited?: boolean } = {}

      try {
        result = text ? JSON.parse(text) : {}
      } catch {
        result = { error: text || "Invalid server response" }
      }

      if (!response.ok) {
        showToast("error", "Approval Failed", result.error || "Approve failed.")
        return
      }

      await Promise.all([loadRequests(false), loadAnalytics()])
      showToast(
        "success",
        result.alreadyCredited ? "Already Credited" : "Coins Credited",
        result.message || "Payment approved and coins credited."
      )
    } catch (error) {
      console.error("Approve request error:", error)
      showToast("error", "Approval Failed", "Approve failed.")
    } finally {
      setStatusAction({ id: null, action: null })
    }
  }

  async function rejectRequest(request: UpgradeRequest) {
    try {
      setStatusAction({ id: request.id, action: "reject" })
      const { error } = await supabase
        .from("upgrades")
        .update({
          status: "rejected",
          admin_reply: request.admin_reply || "Rejected by admin",
        })
        .eq("id", request.id)

      if (error) {
        showToast("error", "Reject Failed", error.message || "Reject failed.")
        return
      }

      await Promise.all([loadRequests(false), loadAnalytics()])
      showToast("warning", "Request Rejected", "Request rejected.")
    } catch (error) {
      console.error("Reject request error:", error)
      showToast("error", "Reject Failed", "Reject failed.")
    } finally {
      setStatusAction({ id: null, action: null })
    }
  }

  async function deleteRequest(id: string) {
    const confirmed = window.confirm("Delete this upgrade request?")
    if (!confirmed) return

    try {
      setDeletingRequest(true)
      const { error } = await supabase.from("upgrades").delete().eq("id", id)

      if (error) {
        console.error("Delete upgrade request error:", error)
        showToast("error", "Delete Failed", error.message)
        return
      }

      await Promise.all([loadRequests(false), loadAnalytics()])
      setRequestModalOpen(false)
      showToast("success", "Request Deleted", "The upgrade request was deleted.")
    } finally {
      setDeletingRequest(false)
    }
  }

  async function sendReply() {
    if (!selectedRequest) return
    const trimmed = replyBody.trim()
    if (!trimmed) return

    try {
      setSavingReply(true)
      const { error } = await supabase
        .from("upgrades")
        .update({
          admin_reply: trimmed,
          status:
            selectedRequest.status === "approved" ||
            selectedRequest.status === "rejected" ||
            selectedRequest.status === "credited"
              ? selectedRequest.status
              : "pending",
        })
        .eq("id", selectedRequest.id)

      if (error) {
        console.error("Send admin reply error:", error)
        showToast("error", "Reply Failed", error.message)
        return
      }

      setReplyBody("")
      await loadRequests(false)
      showToast("success", "Reply Saved", "Your admin reply has been saved.")
    } finally {
      setSavingReply(false)
    }
  }

  async function saveRequestEdit() {
    if (!selectedRequest) return

    try {
      setSavingRequestEdit(true)
      const { error } = await supabase
        .from("upgrades")
        .update({
          name: editName.trim() || null,
          email: editEmail.trim() || null,
          plan: normalizePlan(editPlan),
          subject: editSubject.trim() || null,
          body: editBody.trim() || null,
        })
        .eq("id", selectedRequest.id)

      if (error) {
        console.error("Edit request error:", error)
        showToast("error", "Save Failed", error.message)
        return
      }

      setIsEditingRequest(false)
      await loadRequests(false)
      showToast("success", "Request Updated", "The upgrade request was updated.")
    } finally {
      setSavingRequestEdit(false)
    }
  }

  async function saveReplyEdit() {
    if (!selectedRequest) return

    try {
      setSavingReplyEdit(true)
      const { error } = await supabase
        .from("upgrades")
        .update({ admin_reply: editReplyText.trim() || null })
        .eq("id", selectedRequest.id)

      if (error) {
        console.error("Edit reply error:", error)
        showToast("error", "Save Failed", error.message)
        return
      }

      setIsEditingReply(false)
      await loadRequests(false)
      showToast("success", "Reply Updated", "The admin reply was updated.")
    } finally {
      setSavingReplyEdit(false)
    }
  }

  async function deleteAdminReply() {
    if (!selectedRequest) return
    const confirmed = window.confirm("Delete the admin reply?")
    if (!confirmed) return

    const { error } = await supabase
      .from("upgrades")
      .update({ admin_reply: null })
      .eq("id", selectedRequest.id)

    if (error) {
      console.error("Delete admin reply error:", error)
      showToast("error", "Delete Failed", error.message)
      return
    }

    setIsEditingReply(false)
    setEditReplyText("")
    await loadRequests(false)
    showToast("success", "Reply Deleted", "The admin reply was deleted.")
  }

  const isCurrentAction = (id: string, action: StatusAction["action"]) =>
    statusAction.id === id && statusAction.action === action

  if (checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
        <div className="rounded-[24px] border border-slate-800 bg-slate-900 px-8 py-6 text-center shadow-2xl">
          <p className="text-lg font-bold text-white">Checking admin access...</p>
          <p className="mt-2 text-sm text-slate-400">Please wait.</p>
        </div>
      </div>
    )
  }

  const selectedStatus = selectedRequest ? getStatusLabel(selectedRequest) : "pending"
  const selectedReceiptUrl = selectedRequest?.receipt_url || selectedRequest?.payment_proof_url || null
  const packageRevenueBase = Math.max(packageBreakdown[0]?.revenue || 0, 1)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_24%),linear-gradient(180deg,#020617_0%,#0b1220_48%,#111827_100%)] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1800px]">
        <AdminHeader />

        <section className="mt-4 overflow-hidden rounded-[30px] border border-white/10 bg-slate-900/75 shadow-[0_18px_50px_rgba(0,0,0,0.34)] backdrop-blur">
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.22),transparent_30%),linear-gradient(135deg,#0f172a_0%,#0b1220_45%,#111827_100%)]" />
            <div className="relative flex flex-col gap-5 px-5 py-6 sm:px-6 sm:py-7 lg:flex-row lg:items-end lg:justify-between lg:px-8">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-sky-200">
                  <ShieldCheck size={14} />
                  Admin Upgrades
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Upgrade Payment Requests
                </h1>

                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Review receipts, filter by date range, export reports, compare payment methods, and track top-selling packages.
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={exporting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={16} />
                  {exporting ? "Exporting..." : "Export CSV"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void loadRequests(false)
                    void loadAnalytics()
                  }}
                  disabled={refreshing}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                  {refreshing ? "Refreshing..." : "Refresh Dashboard"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.26)] backdrop-blur sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-slate-300">
            <CalendarDays size={16} />
            Date Range
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
            <div className="flex flex-wrap gap-2">
              {([
                ["all_time", "All Time"],
                ["today", "Today"],
                ["last_7_days", "Last 7 Days"],
                ["this_month", "This Month"],
                ["custom", "Custom"],
              ] as Array<[DatePreset, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDatePreset(value)}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-black transition ${
                    datePreset === value
                      ? "bg-sky-500 text-white shadow-lg"
                      : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              type="date"
              value={customStartDate}
              onChange={(e) => {
                setCustomStartDate(e.target.value)
                setDatePreset("custom")
              }}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-sky-400/40"
            />

            <input
              type="date"
              value={customEndDate}
              onChange={(e) => {
                setCustomEndDate(e.target.value)
                setDatePreset("custom")
              }}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-sky-400/40"
            />
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <AnalyticsCard
            label="Visible Revenue"
            value={formatPeso(visibleRevenue)}
            sublabel={`Credited: ${formatPeso(visibleCreditedRevenue)}`}
            icon={DollarSign}
          />
          <AnalyticsCard
            label="Global Revenue"
            value={formatPeso(stats.totalRevenue)}
            sublabel={`Month: ${formatPeso(stats.monthRevenue)}`}
            icon={TrendingUp}
          />
          <AnalyticsCard
            label="Global Coins"
            value={formatCoins(stats.totalCoinsRequested)}
            sublabel={`Credited: ${formatCoins(stats.totalCoinsCredited)}`}
            icon={Coins}
          />
          <AnalyticsCard
            label="Approval Health"
            value={`${stats.approvalRate}%`}
            sublabel={`Credit rate: ${stats.creditRate}%`}
            icon={BadgeCheck}
          />
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-3">
          <MethodCard
            label="GCash"
            count={methodBreakdown.gcash.count}
            revenue={methodBreakdown.gcash.revenue}
            percentage={methodBreakdown.gcash.percentage}
            icon={Smartphone}
          />
          <MethodCard
            label="Maya"
            count={methodBreakdown.maya.count}
            revenue={methodBreakdown.maya.revenue}
            percentage={methodBreakdown.maya.percentage}
            icon={Wallet}
          />
          <MethodCard
            label="Other"
            count={methodBreakdown.other.count}
            revenue={methodBreakdown.other.revenue}
            percentage={methodBreakdown.other.percentage}
            icon={Coins}
          />
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-4">
          {packageBreakdown.length === 0 ? (
            <div className="lg:col-span-4 rounded-[24px] border border-dashed border-white/10 bg-slate-900/75 p-8 text-center text-sm text-slate-400">
              No package sales in the current view.
            </div>
          ) : (
            packageBreakdown.map((item) => (
              <PackageCard
                key={item.label}
                item={item}
                percentage={(item.revenue / packageRevenueBase) * 100}
              />
            ))
          )}
        </section>

        <section className="mt-5">
          <RevenueTrendChart points={trendPoints} />
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
          <StatCard label="Visible Requests" value={visibleStats.total} icon={BadgeCheck} color="text-white" />
          <StatCard label="Pending" value={visibleStats.pending} icon={Clock3} color="text-amber-300" />
          <StatCard label="Approved" value={visibleStats.approved} icon={CheckCircle2} color="text-sky-300" />
          <StatCard label="Credited" value={visibleStats.credited} icon={Coins} color="text-emerald-300" />
          <StatCard label="Rejected" value={visibleStats.rejected} icon={XCircle} color="text-red-300" />
        </section>

        <section className="mt-5 rounded-[28px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.26)] backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative xl:flex-1">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, package, method, or reference"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", "pending", "approved", "credited", "rejected"] as FilterType[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-black capitalize transition ${
                    filter === item
                      ? "bg-sky-500 text-white shadow-lg"
                      : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-sky-400/40"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name_az">Name A–Z</option>
              <option value="name_za">Name Z–A</option>
            </select>
          </div>
        </section>

        <section className="mt-5">
          {loading ? (
            <div className="rounded-[28px] border border-white/10 bg-slate-900/75 px-4 py-16 text-center text-sm font-semibold text-slate-300 shadow-xl backdrop-blur">
              Loading upgrade requests...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/10 bg-slate-900/75 px-4 py-16 text-center shadow-xl backdrop-blur">
              <div className="mx-auto max-w-md">
                <div className="text-lg font-black text-white">No matching requests found</div>
                <div className="mt-2 text-sm text-slate-400">
                  Try changing the date window, search term, or filter.
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredRequests.map((req) => {
                const status = getStatusLabel(req)
                const plan = normalizePlan(req.plan)

                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => openRequestModal(req)}
                    className="rounded-[28px] border border-white/10 bg-slate-900/80 p-4 text-left shadow-[0_18px_40px_rgba(0,0,0,0.26)] backdrop-blur transition hover:-translate-y-1 hover:border-sky-400/20 sm:p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-lg font-black text-sky-200 ring-1 ring-sky-400/20">
                        {getInitial(req.name, req.email)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="truncate text-lg font-black text-white">
                              {req.name || req.payment_name || "No name"}
                            </div>
                            <div className="mt-1 truncate text-sm text-slate-400">
                              {req.email || "No email"}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${getStatusClasses(status)}`}>
                              {status}
                            </span>

                            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${getPlanClasses(plan)}`}>
                              {plan}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                          <div className="line-clamp-1 text-sm font-black text-white">
                            {getPackageLabel(req)}
                          </div>
                          <div className="mt-1 line-clamp-2 text-sm leading-6 text-slate-400">
                            {req.payment_note || req.body || "No message"}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-400">
                          <span>{formatDate(req.created_at)}</span>
                          {req.receipt_url || req.payment_proof_url ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-violet-300">
                              <Mail size={12} />
                              Receipt attached
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {requestModalOpen && selectedRequest ? (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 p-3 backdrop-blur-sm sm:p-5">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[30px] border border-slate-800 bg-[#020617] shadow-[0_24px_80px_rgba(2,6,23,0.65)]">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4 sm:px-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-blue-300">Upgrade Request</div>
                <div className="mt-1 text-lg font-black text-white">{getPackageLabel(selectedRequest)}</div>
              </div>

              <button
                type="button"
                onClick={() => setRequestModalOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-xl text-white transition hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="overflow-hidden rounded-[30px] border border-slate-800/90 bg-slate-900/90 shadow-[0_18px_40px_rgba(2,6,23,0.34)]">
                <div className="relative h-36 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_45%,#312e81_100%)]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.18),transparent_34%)]" />
                </div>

                <div className="relative px-5 pb-5 sm:px-6">
                  <div className="-mt-12 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex items-end gap-4">
                      <div className="flex h-24 w-24 items-center justify-center rounded-[26px] border-4 border-slate-900 bg-gradient-to-br from-sky-500/25 to-violet-500/25 text-4xl font-black text-white shadow-[0_12px_30px_rgba(15,23,42,0.35)] backdrop-blur">
                        {getInitial(selectedRequest.name, selectedRequest.email)}
                      </div>

                      <div className="pb-1">
                        <h2 className="text-2xl font-black tracking-tight text-white">
                          {selectedRequest.name || selectedRequest.payment_name || "No name"}
                        </h2>
                        <div className="mt-1 text-sm text-slate-300">{selectedRequest.email || "No email"}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase ${getStatusClasses(selectedStatus)}`}>
                            {selectedStatus}
                          </span>

                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase ${getPlanClasses(selectedRequest.plan)}`}>
                            {normalizePlan(selectedRequest.plan)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center backdrop-blur">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">Amount</div>
                        <div className="mt-1 text-sm font-black text-white">{formatPeso(selectedRequest.amount)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center backdrop-blur">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">Coins</div>
                        <div className="mt-1 text-sm font-black text-white">{formatCoins(selectedRequest.coins)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center backdrop-blur">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">Method</div>
                        <div className="mt-1 text-sm font-black text-white uppercase">{selectedRequest.payment_method || "—"}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-center backdrop-blur">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">Date</div>
                        <div className="mt-1 text-sm font-black text-white">{new Date(selectedRequest.created_at).toLocaleDateString("en-PH")}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                      <span className="font-bold text-white">Sender ID:</span> {selectedRequest.sender_id || "Not set"}
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                      <span className="font-bold text-white">Reference:</span> {selectedRequest.reference_number || "No reference"}
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                      <span className="font-bold text-white">Receipt:</span> {selectedReceiptUrl ? "Attached" : "None"}
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                      <span className="font-bold text-white">Credited At:</span> {formatDate(selectedRequest.coins_credited_at)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <div className="space-y-5">
                  <SectionCard title="Request Details" subtitle="Review or edit the request information.">
                    <div className="mb-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setIsEditingRequest((prev) => !prev)
                          setIsEditingReply(false)
                        }}
                        className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-slate-800"
                      >
                        {isEditingRequest ? "Cancel Edit" : "Edit Request"}
                      </button>

                      <button
                        onClick={() => deleteRequest(selectedRequest.id)}
                        disabled={deletingRequest}
                        className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {deletingRequest ? "Deleting..." : "Delete"}
                      </button>
                    </div>

                    {isEditingRequest ? (
                      <div className="grid gap-4">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Name"
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                        />
                        <input
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="Email"
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                        />
                        <select
                          value={editPlan}
                          onChange={(e) => setEditPlan(e.target.value)}
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                        >
                          <option value="premium">premium</option>
                          <option value="platinum">platinum</option>
                          <option value="coin_topup">coin_topup</option>
                        </select>
                        <input
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          placeholder="Subject"
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                        />
                        <textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          placeholder="Request message"
                          rows={5}
                          className="w-full resize-y rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                        />

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <button
                            onClick={saveRequestEdit}
                            disabled={savingRequestEdit}
                            className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {savingRequestEdit ? "Saving..." : "Save Request"}
                          </button>
                          <button
                            onClick={() => setIsEditingRequest(false)}
                            className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-slate-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-7 text-slate-300">
                          <div className="font-bold text-white">Subject</div>
                          <div className="mt-2 whitespace-pre-wrap">
                            {selectedRequest.subject || selectedRequest.label || "No subject"}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-7 text-slate-300">
                          <div className="font-bold text-white">Message / Notes</div>
                          <div className="mt-2 whitespace-pre-wrap">
                            {selectedRequest.payment_note || selectedRequest.body || "No message"}
                          </div>
                        </div>
                      </div>
                    )}
                  </SectionCard>

                  <SectionCard title="Reply" subtitle="Create, edit, or remove the admin reply.">
                    {selectedRequest.admin_reply && !isEditingReply && (
                      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Admin Reply</div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                setIsEditingReply(true)
                                setIsEditingRequest(false)
                                setEditReplyText(selectedRequest.admin_reply || "")
                              }}
                              className="rounded-2xl border border-blue-400/20 bg-white/10 px-3 py-2 text-sm font-bold text-blue-100 transition hover:bg-white/15"
                            >
                              Edit Reply
                            </button>

                            <button
                              onClick={deleteAdminReply}
                              className="rounded-2xl bg-red-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-700"
                            >
                              Delete Reply
                            </button>
                          </div>
                        </div>

                        <div className="whitespace-pre-wrap text-sm leading-7 text-slate-100">
                          {selectedRequest.admin_reply}
                        </div>
                      </div>
                    )}

                    {isEditingReply && (
                      <div>
                        <textarea
                          value={editReplyText}
                          onChange={(e) => setEditReplyText(e.target.value)}
                          placeholder="Edit admin reply..."
                          rows={5}
                          className="w-full resize-y rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                        />

                        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                          <button
                            onClick={saveReplyEdit}
                            disabled={savingReplyEdit}
                            className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {savingReplyEdit ? "Saving..." : "Save Reply"}
                          </button>

                          <button
                            onClick={() => {
                              setIsEditingReply(false)
                              setEditReplyText(selectedRequest.admin_reply || "")
                            }}
                            className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-slate-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {!selectedRequest.admin_reply && !isEditingReply ? (
                      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-400">
                        No admin reply yet.
                      </div>
                    ) : null}

                    <div className="mt-4">
                      <textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="Write your admin reply here..."
                        rows={5}
                        className="w-full resize-y rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
                      />

                      <button
                        onClick={sendReply}
                        disabled={savingReply || !replyBody.trim()}
                        className="mt-3 inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {savingReply ? "Saving..." : selectedRequest.admin_reply ? "Replace Reply" : "Send Reply"}
                      </button>
                    </div>
                  </SectionCard>
                </div>

                <div className="space-y-5">
                  <SectionCard title="Receipt & Actions" subtitle="Preview proof, then approve, reject, or set pending.">
                    {selectedReceiptUrl ? (
                      <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                        {isImage(selectedReceiptUrl) ? (
                          <img
                            src={selectedReceiptUrl}
                            alt="Submitted receipt"
                            className="w-full rounded-2xl border border-slate-800 bg-white/5"
                          />
                        ) : isPdf(selectedReceiptUrl) ? (
                          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm font-bold text-slate-200">
                            PDF receipt uploaded
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
                            Receipt file attached
                          </div>
                        )}

                        <div className="mt-3 flex flex-col gap-3">
                          <a
                            href={selectedReceiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-bold text-sky-200 transition hover:bg-sky-500/15"
                          >
                            Open Receipt
                          </a>

                          {isImage(selectedReceiptUrl) ? (
                            <button
                              type="button"
                              onClick={() => window.open(selectedReceiptUrl, "_blank")}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                            >
                              <Eye size={16} />
                              Preview Larger
                            </button>
                          ) : null}
                        </div>

                        {selectedRequest.receipt_path ? (
                          <p className="mt-3 break-all text-xs text-slate-500">
                            <strong>Storage path:</strong> {selectedRequest.receipt_path}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mb-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-400">
                        No receipt uploaded.
                      </div>
                    )}

                    <div className="grid gap-3">
                      <button
                        onClick={() => approveRequest(selectedRequest)}
                        disabled={Boolean(statusAction.action) || selectedStatus === "credited"}
                        className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isCurrentAction(selectedRequest.id, "approve")
                          ? "Approving..."
                          : selectedStatus === "credited"
                          ? "Already Credited"
                          : "Approve & Credit Coins"}
                      </button>

                      <button
                        onClick={() => rejectRequest(selectedRequest)}
                        disabled={Boolean(statusAction.action)}
                        className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isCurrentAction(selectedRequest.id, "reject") ? "Rejecting..." : "Reject"}
                      </button>

                      <button
                        onClick={() => setPending(selectedRequest.id)}
                        disabled={Boolean(statusAction.action)}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isCurrentAction(selectedRequest.id, "pending") ? "Updating..." : "Set Pending"}
                      </button>
                    </div>
                  </SectionCard>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <AdminToast
        open={toast.open}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
    </div>
  )
}
