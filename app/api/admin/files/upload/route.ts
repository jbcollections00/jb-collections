import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { r2 } from "@/lib/r2"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()

    const file = formData.get("file") as File | null
    const folder = String(formData.get("folder") || "")
    const title = String(formData.get("title") || "")
    const description = String(formData.get("description") || "")
    const categoryId = String(formData.get("categoryId") || "")
    const isPremium = formData.get("isPremium") === "true"

    if (!file) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 })
    }

    // THUMBNAIL-ONLY MODE
    if (folder === "thumbnails") {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : ""
      const safeName = sanitizeFileName(file.name)
      const randomPart = Math.random().toString(36).slice(2, 10)
      const storageKey = `thumbnails/${Date.now()}-${randomPart}-${safeName}${ext ? `.${ext}` : ""}`

      await r2.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET!,
          Key: storageKey,
          Body: buffer,
          ContentType: file.type || "application/octet-stream",
        })
      )

      const publicUrl = `${process.env.R2_PUBLIC_BASE_URL}/${storageKey}`

      return NextResponse.json({
        success: true,
        url: publicUrl,
        key: storageKey,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      })
    }

    // MAIN FILE MODE
    if (!title || !categoryId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { data: categoryRow, error: categoryError } = await supabase
      .from("categories")
      .select("id, slug, name")
      .eq("id", categoryId)
      .single()

    if (categoryError || !categoryRow) {
      return NextResponse.json({ error: "Category not found." }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : ""
    const safeTitle = slugify(title)
    const storageKey = `${categoryRow.slug}/${Date.now()}-${safeTitle}${ext ? `.${ext}` : ""}`

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: storageKey,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
      })
    )

    const publicUrl = `${process.env.R2_PUBLIC_BASE_URL}/${storageKey}`

    const { error: insertError } = await supabase.from("files").insert({
      title,
      slug: `${safeTitle}-${Date.now()}`,
      description: description || null,
      category_id: categoryRow.id,
      storage_key: storageKey,
      file_url: publicUrl,
      file_type: ext?.toUpperCase() || null,
      file_size: file.size,
      is_premium: isPremium,
      downloads_count: 0,
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      file_url: publicUrl,
      storage_key: storageKey,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    })
  } catch (err: any) {
    console.error("UPLOAD ERROR FULL:", err)
    console.error("STACK:", err?.stack)

    return NextResponse.json(
      { error: err?.message || "Upload failed" },
      { status: 500 }
    )
  }
}