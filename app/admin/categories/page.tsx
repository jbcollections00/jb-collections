"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import AdminHeader from "@/app/components/AdminHeader"
import { createClient } from "@/lib/supabase/client"

type Category = {
  id: string
  name: string
  description: string | null
  created_at: string
}

export default function CategoriesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)

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
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("created_at", { ascending: false })

    setCategories((data as Category[]) || [])
  }

  async function saveCategory() {
    if (!name.trim()) return

    if (editingId) {
      await supabase
        .from("categories")
        .update({
          name: name.trim(),
          description: description.trim() || null,
        })
        .eq("id", editingId)
    } else {
      await supabase.from("categories").insert({
        name: name.trim(),
        description: description.trim() || null,
      })
    }

    clearForm()
    loadCategories()
  }

  function editCategory(cat: Category) {
    setName(cat.name)
    setDescription(cat.description || "")
    setEditingId(cat.id)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function deleteCategory(id: string) {
    await supabase.from("categories").delete().eq("id", id)
    loadCategories()
  }

  function clearForm() {
    setName("")
    setDescription("")
    setEditingId(null)
  }

  if (checkingAdmin) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg, #eef4ff 0%, #f8fbff 45%, #ffffff 100%)",
          fontFamily: "Arial, Helvetica, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "24px",
            padding: "28px 32px",
            boxShadow: "0 12px 30px rgba(0,0,0,0.05)",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
            Checking admin access...
          </p>
          <p style={{ fontSize: "14px", color: "#64748b", margin: "8px 0 0" }}>
            Please wait.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #eef4ff 0%, #f8fbff 45%, #ffffff 100%)",
        fontFamily: "Arial, Helvetica, sans-serif",
        padding: "40px 24px",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <AdminHeader />

        <h1 style={{ fontSize: "42px", fontWeight: 800, margin: "0 0 10px", color: "#0f172a" }}>
          Categories
        </h1>
        <p style={{ color: "#64748b", margin: "0 0 24px", fontSize: "17px" }}>
          Create, update, and organize your categories.
        </p>

        <div
          style={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "24px",
            padding: "28px",
            boxShadow: "0 12px 30px rgba(0,0,0,0.05)",
            marginBottom: "28px",
          }}
        >
          <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "0 0 18px", color: "#0f172a" }}>
            Category Manager
          </h2>

          <input
            placeholder="Category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "14px",
              border: "1px solid #cbd5e1",
              marginBottom: "14px",
              fontSize: "16px",
              boxSizing: "border-box",
            }}
          />

          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: "100%",
              minHeight: "120px",
              padding: "14px",
              borderRadius: "14px",
              border: "1px solid #cbd5e1",
              marginBottom: "16px",
              fontSize: "16px",
              boxSizing: "border-box",
            }}
          />

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={saveCategory}
              style={{
                padding: "12px 18px",
                borderRadius: "12px",
                background: "#2563eb",
                color: "white",
                border: "none",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {editingId ? "Update Category" : "Create Category"}
            </button>

            <button
              onClick={clearForm}
              style={{
                padding: "12px 18px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                background: "white",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: "20px",
          }}
        >
          {categories.map((cat) => (
            <div
              key={cat.id}
              style={{
                background: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "20px",
                padding: "22px",
                boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
              }}
            >
              <h3 style={{ fontSize: "24px", margin: "0 0 8px", color: "#0f172a" }}>{cat.name}</h3>

              <p style={{ color: "#64748b", fontSize: "15px", lineHeight: 1.7, minHeight: "54px" }}>
                {cat.description || "No description"}
              </p>

              <div style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
                <button
                  onClick={() => editCategory(cat)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Edit
                </button>

                <button
                  onClick={() => deleteCategory(cat.id)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "none",
                    background: "#ef4444",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 700,
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