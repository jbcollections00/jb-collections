"use client"

import { useEffect, useState, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import AdminHeader from "@/app/components/AdminHeader"
import { createClient } from "@/lib/supabase/client"

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

export default function CategoriesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [thumbnailUrl, setThumbnailUrl] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    checkAdminAndLoad()
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

      await loadCategories()
    } catch (error) {
      console.error("Admin categories auth check failed:", error)
      router.replace("/secure-admin-portal-7X9")
    } finally {
      setCheckingAdmin(false)
    }
  }

  async function loadCategories() {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
      setMessage("Failed to load categories.")
      return
    }

    setCategories((data as Category[]) || [])
  }

  async function handleThumbnailUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadingThumbnail(true)
      setMessage(null)

      if (!file.type.startsWith("image/")) {
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
        setMessage("Thumbnail upload failed.")
        return
      }

      const { data } = supabase.storage
        .from("category-thumbnails")
        .getPublicUrl(filePath)

      setThumbnailUrl(data.publicUrl)
      setMessage("Thumbnail uploaded successfully.")
    } catch (error) {
      console.error(error)
      setMessage("Something went wrong while uploading thumbnail.")
    } finally {
      setUploadingThumbnail(false)
      e.target.value = ""
    }
  }

  async function saveCategory() {
    if (!name.trim()) {
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
          setMessage("Failed to update category.")
          return
        }

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
          setMessage("Failed to create category.")
          return
        }

        setMessage("Category created successfully.")
      }

      clearForm()
      await loadCategories()
    } catch (error) {
      console.error(error)
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
      setMessage("Failed to delete category.")
      return
    }

    setMessage("Category deleted successfully.")
    await loadCategories()
  }

  function clearForm() {
    setName("")
    setDescription("")
    setThumbnailUrl("")
    setEditingId(null)
    setMessage(null)
  }

  if (checkingAdmin) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg,#020617 0%,#0f172a 45%,#111827 100%)",
          fontFamily: "Arial, Helvetica, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#e2e8f0",
        }}
      >
        Checking admin access...
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#020617 0%,#0f172a 45%,#111827 100%)",
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: "28px 18px 40px",
        color: "#e2e8f0",
      }}
    >
      <div style={{ maxWidth: "1700px", margin: "0 auto" }}>
        <AdminHeader />

        <h1
          style={{
            fontSize: "42px",
            fontWeight: 800,
            margin: "0 0 10px",
            color: "#f8fafc",
          }}
        >
          Categories
        </h1>

        <p
          style={{
            color: "#94a3b8",
            margin: "0 0 20px",
            fontSize: "17px",
          }}
        >
          Create, update, and organize your categories.
        </p>

        <div
          style={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: "24px",
            padding: "22px",
            marginBottom: "24px",
            boxShadow: "0 12px 30px rgba(0,0,0,0.28)",
          }}
        >
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 800,
              margin: "0 0 16px",
              color: "#f8fafc",
            }}
          >
            Category Manager
          </h2>

          {message && (
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 14px",
                borderRadius: "14px",
                background: "rgba(59,130,246,0.12)",
                border: "1px solid rgba(59,130,246,0.28)",
                color: "#93c5fd",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              {message}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1fr",
              gap: "18px",
              alignItems: "start",
            }}
          >
            <div>
              <input
                placeholder="Category name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "14px",
                  border: "1px solid #334155",
                  marginBottom: "12px",
                  fontSize: "16px",
                  background: "#020617",
                  color: "#f8fafc",
                  outline: "none",
                }}
              />

              <textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "110px",
                  padding: "14px",
                  borderRadius: "14px",
                  border: "1px solid #334155",
                  marginBottom: "12px",
                  fontSize: "16px",
                  resize: "vertical",
                  background: "#020617",
                  color: "#f8fafc",
                  outline: "none",
                }}
              />

              <div
                style={{
                  border: "1px solid #1e293b",
                  borderRadius: "18px",
                  padding: "14px",
                  marginBottom: "14px",
                  background: "#020617",
                }}
              >
                <p
                  style={{
                    margin: "0 0 10px 0",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#cbd5e1",
                  }}
                >
                  Upload Thumbnail
                </p>

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailUpload}
                  disabled={uploadingThumbnail}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "14px",
                    border: "1px solid #334155",
                    background: "#0f172a",
                    color: "#e2e8f0",
                    fontSize: "14px",
                    marginBottom: "10px",
                  }}
                />

                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "#94a3b8",
                  }}
                >
                  {uploadingThumbnail
                    ? "Uploading thumbnail..."
                    : thumbnailUrl
                      ? "Thumbnail uploaded and ready to save."
                      : "Choose an image file for this category."}
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  onClick={saveCategory}
                  disabled={saving || uploadingThumbnail}
                  style={{
                    padding: "12px 18px",
                    borderRadius: "12px",
                    background: "#2563eb",
                    color: "white",
                    border: "none",
                    fontWeight: 700,
                    cursor: saving || uploadingThumbnail ? "not-allowed" : "pointer",
                    opacity: saving || uploadingThumbnail ? 0.7 : 1,
                  }}
                >
                  {saving ? "Saving..." : editingId ? "Update Category" : "Create Category"}
                </button>

                <button
                  onClick={clearForm}
                  disabled={saving || uploadingThumbnail}
                  style={{
                    padding: "12px 18px",
                    borderRadius: "12px",
                    border: "1px solid #334155",
                    background: "#111827",
                    color: "#e2e8f0",
                    cursor: saving || uploadingThumbnail ? "not-allowed" : "pointer",
                    fontWeight: 700,
                    opacity: saving || uploadingThumbnail ? 0.7 : 1,
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            <div
              style={{
                border: "1px solid #1e293b",
                borderRadius: "18px",
                padding: "14px",
                background: "#020617",
                minHeight: "100%",
              }}
            >
              <p
                style={{
                  margin: "0 0 10px 0",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#cbd5e1",
                }}
              >
                Thumbnail Preview
              </p>

              {thumbnailUrl.trim() ? (
                <img
                  src={thumbnailUrl}
                  alt="Thumbnail preview"
                  style={{
                    width: "100%",
                    height: "240px",
                    objectFit: "cover",
                    borderRadius: "16px",
                    border: "1px solid #334155",
                    display: "block",
                    background: "#0f172a",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "240px",
                    borderRadius: "16px",
                    border: "1px dashed #334155",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#94a3b8",
                    background: "#0f172a",
                  }}
                >
                  No thumbnail preview
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: "14px",
            alignItems: "stretch",
          }}
        >
          {categories.map((cat) => (
            <div
              key={cat.id}
              style={{
                background: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: "18px",
                padding: "12px",
                boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
                display: "flex",
                flexDirection: "column",
                minHeight: "250px",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "110px",
                  borderRadius: "14px",
                  overflow: "hidden",
                  background: "#020617",
                  border: "1px solid #1e293b",
                  marginBottom: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {cat.thumbnail_url ? (
                  <img
                    src={cat.thumbnail_url}
                    alt={cat.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span style={{ fontSize: "30px" }}>📁</span>
                )}
              </div>

              <h3
                style={{
                  fontSize: "16px",
                  margin: "0 0 6px",
                  fontWeight: 800,
                  lineHeight: 1.3,
                  color: "#f8fafc",
                }}
              >
                {cat.name}
              </h3>

              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "12px",
                  lineHeight: 1.45,
                  margin: 0,
                  flexGrow: 1,
                  overflow: "hidden",
                }}
              >
                {cat.description || "No description"}
              </p>

              <div
                style={{
                  marginTop: "12px",
                  display: "flex",
                  gap: "8px",
                }}
              >
                <button
                  onClick={() => editCategory(cat)}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: "10px",
                    border: "1px solid #334155",
                    background: "#111827",
                    color: "#e2e8f0",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "12px",
                  }}
                >
                  Edit
                </button>

                <button
                  onClick={() => deleteCategory(cat.id)}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: "10px",
                    border: "1px solid rgba(239,68,68,0.25)",
                    background: "rgba(239,68,68,0.12)",
                    color: "#fca5a5",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "12px",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}