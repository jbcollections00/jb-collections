"use client"

import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import AdminHeader from "@/app/components/AdminHeader"
import { createClient } from "@/lib/supabase/client"
import {
  ArrowRightLeft,
  BadgeCheck,
  FolderOpen,
  PencilLine,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react"

type Category = {
  id: string
  name: string
  slug: string
  description: string | null
  thumbnail_url: string | null
  created_at: string
}

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_14px_34px_rgba(2,6,23,0.32)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
          {label}
        </div>
        <div className="rounded-2xl bg-white/10 p-2 text-sky-200">
          <Icon size={16} />
        </div>
      </div>

      <div className={`mt-3 text-3xl font-black tracking-tight ${color}`}>{value}</div>
    </div>
  )
}

export default function CategoriesPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [thumbnailUrl, setThumbnailUrl] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [mergeSourceId, setMergeSourceId] = useState("")
  const [mergeTargetId, setMergeTargetId] = useState("")
  const [merging, setMerging] = useState(false)

  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info")
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    void checkAdminAndLoad()
  }, [])

  async function checkAdminAndLoad() {
    try {
      setCheckingAdmin(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace("/secure-admin-portal-7X9")
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profileError || profile?.role !== "admin") {
        router.replace("/secure-admin-portal-7X9")
        return
      }

      await loadCategories(true)
    } catch (error) {
      console.error("Admin categories auth check failed:", error)
      router.replace("/secure-admin-portal-7X9")
    } finally {
      setCheckingAdmin(false)
    }
  }

  async function loadCategories(showLoader = false) {
    if (showLoader) {
      setRefreshing(false)
    } else {
      setRefreshing(true)
    }

    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
      setMessageType("error")
      setMessage("Failed to load categories.")
      setRefreshing(false)
      return
    }

    const nextCategories = (data as Category[]) || []
    setCategories(nextCategories)

    if (mergeSourceId && !nextCategories.some((cat) => cat.id === mergeSourceId)) {
      setMergeSourceId("")
    }
    if (mergeTargetId && !nextCategories.some((cat) => cat.id === mergeTargetId)) {
      setMergeTargetId("")
    }

    setRefreshing(false)
  }

  async function handleThumbnailUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadingThumbnail(true)
      setMessage(null)

      if (!file.type.startsWith("image/")) {
        setMessageType("error")
        setMessage("Please upload an image file only.")
        return
      }

      const fileExt = file.name.split(".").pop() || "jpg"
      const safeName = file.name
        .replace(/\.[^/.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

      const fileName = `${Date.now()}-${safeName}.${fileExt}`
      const filePath = `categories/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("category-thumbnails")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) {
        console.error(uploadError)
        setMessageType("error")
        setMessage("Thumbnail upload failed.")
        return
      }

      const { data } = supabase.storage
        .from("category-thumbnails")
        .getPublicUrl(filePath)

      setThumbnailUrl(data.publicUrl)
      setMessageType("success")
      setMessage("Thumbnail uploaded successfully.")
    } catch (error) {
      console.error(error)
      setMessageType("error")
      setMessage("Something went wrong while uploading thumbnail.")
    } finally {
      setUploadingThumbnail(false)
      e.target.value = ""
    }
  }

  async function saveCategory() {
    if (!name.trim()) {
      setMessageType("error")
      setMessage("Category name is required.")
      return
    }

    try {
      setSaving(true)
      setMessage(null)

      const trimmedName = name.trim()
      const trimmedDescription = description.trim() || null
      const trimmedThumbnail = thumbnailUrl.trim() || null
      const slug = makeSlug(trimmedName)

      if (editingId) {
        const { error } = await supabase
          .from("categories")
          .update({
            name: trimmedName,
            slug,
            description: trimmedDescription,
            thumbnail_url: trimmedThumbnail,
          })
          .eq("id", editingId)

        if (error) {
          console.error(error)
          setMessageType("error")
          setMessage("Failed to update category.")
          return
        }

        setMessageType("success")
        setMessage("Category updated successfully.")
      } else {
        const { error } = await supabase.from("categories").insert({
          name: trimmedName,
          slug,
          description: trimmedDescription,
          thumbnail_url: trimmedThumbnail,
        })

        if (error) {
          console.error(error)
          setMessageType("error")
          setMessage("Failed to create category.")
          return
        }

        setMessageType("success")
        setMessage("Category created successfully.")
      }

      clearForm()
      await loadCategories()
    } catch (error) {
      console.error(error)
      setMessageType("error")
      setMessage("Something went wrong while saving.")
    } finally {
      setSaving(false)
    }
  }

  function editCategory(cat: Category) {
    setName(cat.name)
    setDescription(cat.description || "")
    setThumbnailUrl(cat.thumbnail_url || "")
    setEditingId(cat.id)
    setMessage(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function deleteCategory(id: string) {
    const confirmed = window.confirm("Delete this category?")
    if (!confirmed) return

    const { error } = await supabase.from("categories").delete().eq("id", id)

    if (error) {
      console.error(error)
      setMessageType("error")
      setMessage("Failed to delete category.")
      return
    }

    setMessageType("success")
    setMessage("Category deleted successfully.")
    await loadCategories()
  }

  async function mergeCategories() {
    if (!mergeSourceId || !mergeTargetId) {
      setMessageType("error")
      setMessage("Please choose both source and target categories.")
      return
    }

    if (mergeSourceId === mergeTargetId) {
      setMessageType("error")
      setMessage("Source and target categories must be different.")
      return
    }

    const source = categories.find((cat) => cat.id === mergeSourceId)
    const target = categories.find((cat) => cat.id === mergeTargetId)

    const confirmed = window.confirm(
      `Move all files from "${source?.name || "Source"}" into "${target?.name || "Target"}" and delete the source category?`
    )
    if (!confirmed) return

    try {
      setMerging(true)
      setMessage(null)

      const { error: moveFilesError } = await supabase
        .from("files")
        .update({ category_id: mergeTargetId })
        .eq("category_id", mergeSourceId)

      if (moveFilesError) {
        console.error(moveFilesError)
        setMessageType("error")
        setMessage("Failed to move files into the target category.")
        return
      }

      const { error: deleteSourceError } = await supabase
        .from("categories")
        .delete()
        .eq("id", mergeSourceId)

      if (deleteSourceError) {
        console.error(deleteSourceError)
        setMessageType("error")
        setMessage("Files were moved, but deleting the source category failed.")
        return
      }

      setMergeSourceId("")
      setMergeTargetId("")
      setMessageType("success")
      setMessage(`Merged "${source?.name || "source"}" into "${target?.name || "target"}" successfully.`)
      await loadCategories()
    } catch (error) {
      console.error(error)
      setMessageType("error")
      setMessage("Something went wrong while merging categories.")
    } finally {
      setMerging(false)
    }
  }

  function clearForm() {
    setName("")
    setDescription("")
    setThumbnailUrl("")
    setEditingId(null)
    setMessage(null)
  }

  const filteredCategories = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return categories

    return categories.filter((cat) => {
      return (
        cat.name.toLowerCase().includes(keyword) ||
        cat.slug.toLowerCase().includes(keyword) ||
        (cat.description || "").toLowerCase().includes(keyword)
      )
    })
  }, [categories, searchTerm])

  const mergeSourceOptions = categories
  const mergeTargetOptions = categories.filter((cat) => cat.id !== mergeSourceId)

  const stats = useMemo(() => {
    return {
      total: categories.length,
      withThumbs: categories.filter((cat) => Boolean(cat.thumbnail_url)).length,
      withoutThumbs: categories.filter((cat) => !cat.thumbnail_url).length,
      filtered: filteredCategories.length,
    }
  }, [categories, filteredCategories])

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
                  Admin Categories
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Category Manager
                </h1>

                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Create, update, merge, upload thumbnails, and organize your categories in a cleaner premium admin layout.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadCategories(false)}
                disabled={refreshing}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing..." : "Refresh Categories"}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Total Categories" value={stats.total} icon={FolderOpen} color="text-white" />
          <StatCard label="With Thumbnails" value={stats.withThumbs} icon={BadgeCheck} color="text-emerald-300" />
          <StatCard label="No Thumbnail" value={stats.withoutThumbs} icon={UploadCloud} color="text-amber-300" />
          <StatCard label="Showing" value={stats.filtered} icon={Search} color="text-sky-300" />
        </section>

        {message && (
          <div
            className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-bold ${
              messageType === "error"
                ? "border-red-400/20 bg-red-500/10 text-red-300"
                : messageType === "success"
                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                  : "border-sky-400/20 bg-sky-500/10 text-sky-300"
            }`}
          >
            {message}
          </div>
        )}

        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-[28px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.26)] backdrop-blur sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-black text-white">
                {editingId ? "Edit Category" : "Create Category"}
              </h2>

              {editingId ? (
                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
                  Editing
                </span>
              ) : (
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                  New
                </span>
              )}
            </div>

            <div className="grid gap-4">
              <input
                placeholder="Category name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40"
              />

              <textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40"
              />

              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <p className="mb-2 text-sm font-bold text-slate-200">Upload Thumbnail</p>

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailUpload}
                  disabled={uploadingThumbnail}
                  className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:font-semibold file:text-white"
                />

                <p className="mt-3 text-xs text-slate-400">
                  {uploadingThumbnail
                    ? "Uploading thumbnail..."
                    : thumbnailUrl
                      ? "Thumbnail uploaded and ready to save."
                      : "Choose an image file for this category."}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={saveCategory}
                  disabled={saving || uploadingThumbnail}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {editingId ? <PencilLine size={16} /> : <PlusCircle size={16} />}
                  {saving ? "Saving..." : editingId ? "Update Category" : "Create Category"}
                </button>

                <button
                  onClick={clearForm}
                  disabled={saving || uploadingThumbnail}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.26)] backdrop-blur sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-black text-white">Merge Categories</h2>
              <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-300">
                Safe Merge
              </span>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-200">Source Category</label>
                <select
                  value={mergeSourceId}
                  onChange={(e) => setMergeSourceId(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-400/40"
                >
                  <option value="">Select source category</option>
                  {mergeSourceOptions.map((cat) => (
                    <option key={cat.id} value={cat.id} className="text-black">
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-200">Target Category</label>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-400/40"
                >
                  <option value="">Select target category</option>
                  {mergeTargetOptions.map((cat) => (
                    <option key={cat.id} value={cat.id} className="text-black">
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-200">
                This will move all files from the source category into the target category, then delete the source category.
              </div>

              <button
                onClick={mergeCategories}
                disabled={merging}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-fuchsia-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <ArrowRightLeft size={16} />
                {merging ? "Merging..." : "Merge Categories"}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-white/10 bg-slate-900/75 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.26)] backdrop-blur sm:p-5">
          <div className="mb-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="mb-3 text-sm font-bold text-slate-200">Thumbnail Preview</p>

              {thumbnailUrl.trim() ? (
                <img
                  src={thumbnailUrl}
                  alt="Thumbnail preview"
                  className="h-[260px] w-full rounded-2xl border border-white/10 object-cover"
                />
              ) : (
                <div className="flex h-[260px] w-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-900 text-sm font-bold text-slate-500">
                  No thumbnail preview
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Generated Slug
                </div>
                <div className="mt-2 break-all text-sm font-bold text-sky-300">
                  {name.trim() ? makeSlug(name) : "category-slug-preview"}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-4 flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-2xl font-black text-white">Categories</h2>

                  <div className="inline-flex w-fit rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 sm:text-sm">
                    {filteredCategories.length} shown
                  </div>
                </div>

                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Search categories..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/40"
                  />
                </div>
              </div>

              {filteredCategories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/70 px-4 py-12 text-center text-sm font-bold text-slate-400">
                  No categories matched your search.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                  {filteredCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/80 shadow-[0_14px_34px_rgba(2,6,23,0.32)] transition hover:-translate-y-0.5 hover:border-sky-400/20"
                    >
                      <div className="flex aspect-[4/3] items-center justify-center bg-slate-900">
                        {cat.thumbnail_url ? (
                          <img
                            src={cat.thumbnail_url}
                            alt={cat.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-4xl">📁</span>
                        )}
                      </div>

                      <div className="p-4">
                        <h3 className="line-clamp-2 text-base font-extrabold leading-6 text-white">
                          {cat.name}
                        </h3>

                        <div className="mt-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-300">
                          /{cat.slug}
                        </div>

                        <p className="mt-3 line-clamp-3 min-h-[60px] text-sm leading-6 text-slate-400">
                          {cat.description || "No description"}
                        </p>

                        <div className="mt-3 text-xs font-semibold text-slate-500">
                          Created {formatDate(cat.created_at)}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => editCategory(cat)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/10"
                          >
                            <PencilLine size={14} />
                            Edit
                          </button>

                          <button
                            onClick={() => deleteCategory(cat.id)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
