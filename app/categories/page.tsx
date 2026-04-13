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
  if (v === "platinum") return "PLATINUM"
  if (v === "premium") return "PREMIUM"
  return "FREE"
}

function getTierClass(v: string) {
  if (v === "platinum") return "bg-fuchsia-500 text-white"
  if (v === "premium") return "bg-amber-500 text-white"
  return "bg-emerald-500 text-white"
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

  if (checking) return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>

  return (
    <div className="min-h-screen bg-slate-950">
      <SiteHeader />

      <div className="max-w-[1800px] mx-auto px-4 pt-24 pb-10">

        {/* HERO */}
        {featured && (
          <div className="mb-10 relative rounded-3xl overflow-hidden border border-white/10">
            <img
              src={getCategoryImage(featured) || ""}
              className="w-full h-[300px] object-cover"
            />
            <div className="absolute inset-0 bg-black/60 p-6 flex flex-col justify-end">
              <h2 className="text-4xl font-black text-white">{featured.name}</h2>
              <p className="text-white/80 mt-2">{featured.description}</p>

              <Link
                href={`/categories/${featured.id}`}
                className="mt-4 w-fit bg-white text-black px-5 py-3 rounded-xl font-bold"
              >
                Explore
              </Link>
            </div>
          </div>
        )}

        {/* FILTERS */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {["all","free","premium","platinum"].map(f => (
            <button
              key={f}
              onClick={()=>setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm ${
                filter===f ? "bg-white text-black" : "bg-white/10 text-white"
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        {/* SEARCH */}
        <input
          placeholder="Search..."
          className="mb-8 w-full p-4 rounded-xl bg-white"
          value={search}
          onChange={e=>setSearch(e.target.value)}
        />

        {/* GRID */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {filtered.map((c, i) => {
            const m = meta[c.id]

            return (
              <div
                key={c.id}
                className="group rounded-2xl overflow-hidden bg-slate-900 border border-white/10 hover:scale-105 transition"
              >
                <div className="relative">
                  <img src={getCategoryImage(c)||""} className="w-full h-[160px] object-cover"/>

                  <div className={`absolute top-2 left-2 px-2 py-1 text-xs rounded ${getTierClass(m?.visibility||"free")}`}>
                    {getTierLabel(m?.visibility||"free")}
                  </div>

                  {m?.downloads > 500 && (
                    <div className="absolute top-2 right-2 bg-red-500 text-xs px-2 py-1 rounded">
                      🔥
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <h3 className="text-white font-bold">{c.name}</h3>

                  <div className="text-xs text-gray-400 mt-1">
                    {format(m?.files)} files • {format(m?.downloads)} downloads
                  </div>

                  <Link
                    href={`/categories/${c.id}`}
                    className="block mt-3 bg-blue-600 text-white text-center py-2 rounded-lg"
                  >
                    Open
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}