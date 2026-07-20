"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import SiteHeader from "@/app/components/SiteHeader"

type Category = {
  id: string
  name: string
  description: string | null
  slug?: string | null
  image_url?: string | null
  thumbnail_url?: string | null
  cover_url?: string | null
  created_at?: string | null
}

type FileRow = {
  category_id: string
  downloads_count?: number | null
  visibility?: "free" | "premium" | "platinum" | null
  created_at?: string | null
}

type Meta = {
  downloads: number
  files: number
  visibility: "free" | "premium" | "platinum"
  latest?: string | null
}

function getCategoryImage(c: Category) {
  return c.cover_url || c.thumbnail_url || c.image_url || null
}

function getTierLabel(v: string) {
  if (v === "platinum") return "Platinum Elite"
  if (v === "premium") return "Premium Member"
  return "Free Explorer"
}

function getTierClass(v: string) {
  if (v === "platinum") return "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
  if (v === "premium") return "bg-cyan-500/10 text-cyan-200 border-cyan-400/20"
  return "bg-slate-500/10 text-slate-300 border-white/10"
}

function format(n?: number | null) {
  return new Intl.NumberFormat().format(n || 0)
}

export default function CategoriesPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [categories, setCategories] = useState<Category[]>([])
  const [meta, setMeta] = useState<Record<string, Meta>>({})
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")

  useEffect(() => {
    init()
  }, [])

  async function init() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace("/login")

      const [catRes, fileRes] = await Promise.all([
        supabase.from("categories").select("*"),
        supabase.from("files").select("category_id, downloads_count, visibility, created_at").eq("status", "published")
      ])

      setCategories(catRes.data || [])

      const map: Record<string, Meta> = {}

      for (const f of (fileRes.data || []) as FileRow[]) {
        if (!map[f.category_id]) {
          map[f.category_id] = { downloads: 0, files: 0, visibility: "free" }
        }

        map[f.category_id].downloads += f.downloads_count || 0
        map[f.category_id].files += 1

        if (f.visibility === "platinum") map[f.category_id].visibility = "platinum"
        else if (f.visibility === "premium" && map[f.category_id].visibility !== "platinum") {
          map[f.category_id].visibility = "premium"
        }

        if (!map[f.category_id].latest || new Date(f.created_at!).getTime() > new Date(map[f.category_id].latest!).getTime()) {
          map[f.category_id].latest = f.created_at
        }
      }

      setMeta(map)
    } finally {
      setChecking(false)
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    let list = categories.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase())
    )

    if (filter !== "all") {
      list = list.filter(c => meta[c.id]?.visibility === filter)
    }

    return list.sort((a, b) =>
      (meta[b.id]?.downloads || 0) - (meta[a.id]?.downloads || 0)
    )
  }, [categories, search, filter, meta])

  const featured = filtered[0]

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4 text-white">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.05] px-8 py-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent mx-auto mb-3" />
          <p className="text-lg font-semibold text-white">Loading categories...</p>
          <p className="mt-2 text-sm text-slate-300">Please wait.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans antialiased">
      {/* Background Gradients Mesh */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.15),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.15),_transparent_30%),linear-gradient(180deg,_#030712_0%,_#020617_45%,_#061229_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] opacity-[0.08]" />
      
      <SiteHeader />

      <div className="mx-auto w-full max-w-[1800px] px-4 pb-10 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        
        {/* HERO / FEATURED SPOTLIGHT */}
        {featured && (
          <div className="group relative mb-10 overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.04] shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <div className="relative aspect-[21/9] w-full min-h-[320px] max-h-[440px] bg-slate-900/60 overflow-hidden">
              {getCategoryImage(featured) ? (
                <img
                  src={getCategoryImage(featured) || ""}
                  alt={featured.name}
                  className="w-full h-full object-cover transition duration-700 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-slate-950 via-blue-950/40 to-slate-900" />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-transparent" />
              
              <div className="absolute inset-0 p-6 sm:p-8 lg:p-12 flex flex-col justify-end max-w-4xl">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200 mb-3">
                  <span>✨ Spotlight Collection</span>
                </div>
                
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
                  {featured.name}
                </h2>
                
                <p className="text-slate-300 text-sm sm:text-base mt-3 leading-relaxed line-clamp-2 max-w-2xl">
                  {featured.description || "Explore all assets, software tools, and premium content bundled under this community category."}
                </p>

                <Link
                  href={`/categories/${featured.slug || featured.id}`}
                  className="mt-6 w-fit inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-950/40 transition duration-300 hover:-translate-y-0.5 hover:brightness-110"
                >
                  Explore Collection
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* CONTROLS HEADER */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-[28px] border border-white/5 bg-white/[0.02] p-4 sm:p-5 backdrop-blur-sm">
          {/* SEARCH */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search collections..."
              className="w-full px-4 py-3 text-sm rounded-xl bg-slate-900/60 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50 transition duration-200"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* FILTERS TABS */}
          <div className="flex gap-2 flex-wrap items-center">
            {["all", "free", "premium", "platinum"].map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-xs font-bold tracking-wider uppercase transition border ${
                  filter === f 
                    ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white border-transparent shadow-md shadow-blue-500/20" 
                    : "bg-white/[0.05] text-slate-300 border-white/5 hover:bg-white/[0.08]"
                }`}
              >
                {f === "all" ? "⚡ All Tiers" : f}
              </button>
            ))}
          </div>
        </div>

        {/* DYNAMIC CATEGORY GRID */}
        {filtered.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center text-sm font-medium text-slate-400">
            📂 No categories match your search parameters or select filtering tier.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {filtered.map((c) => {
              const m = meta[c.id]
              const image = getCategoryImage(c)
              const hasHighDownloads = m?.downloads > 500

              return (
                <div
                  key={c.id}
                  className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] shadow-[0_14px_36px_rgba(0,0,0,0.28)] backdrop-blur-sm transition duration-300 hover:-translate-y-1.5 hover:border-cyan-400/40 hover:bg-white/[0.07] hover:shadow-[0_24px_60px_rgba(37,99,235,0.24)]"
                >
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-24 bg-cyan-400/10 blur-3xl opacity-0 transition duration-300 group-hover:opacity-100" />
                  
                  {/* Image Frame Container */}
                  <div className="relative aspect-[16/11] overflow-hidden bg-slate-900/60 border-b border-white/5">
                    {image ? (
                      <img 
                        src={image} 
                        alt={c.name}
                        className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-500 bg-gradient-to-br from-slate-900 to-slate-950 text-xs italic tracking-wide">
                        No Thumbnail
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

                    {/* Tier Pill Badge */}
                    <div className={`absolute top-3 left-3 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] rounded-full border backdrop-blur-md ${getTierClass(m?.visibility || "free")}`}>
                      {getTierLabel(m?.visibility || "free")}
                    </div>

                    {/* High Traffic Hot Badge Indicator */}
                    {hasHighDownloads && (
                      <div className="absolute top-3 right-3 bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] uppercase px-2.5 py-0.5 rounded-full font-bold backdrop-blur-md animate-pulse">
                        🔥 Hot
                      </div>
                    )}
                  </div>

                  {/* Body Info Text Details */}
                  <div className="p-4 flex flex-col justify-between min-h-[170px]">
                    <div>
                      <h3 className="text-white font-bold text-base leading-6 truncate group-hover:text-cyan-300 transition duration-200">
                        {c.name}
                      </h3>
                      
                      <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {c.description || "Access custom configuration files, documentation resources, and open bundles inside."}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300 border-t border-white/5 pt-3 mt-3">
                        <span className="font-semibold text-white">{format(m?.files)}</span> files
                        <span className="text-white/20">•</span>
                        <span className="font-semibold text-white">{format(m?.downloads)}</span> downloads
                      </div>

                      <Link
                        href={`/categories/${c.slug || c.id}`}
                        className="block mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg transition duration-300 hover:brightness-110"
                      >
                        Open Category
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}