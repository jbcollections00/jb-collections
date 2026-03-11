import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
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

function getExtension(name: string) {
  return name.includes(".") ? name.split(".").pop()?.toLowerCase() || "" : ""
}

function getPublicUrl(storageKey: string) {
  const base = process.env.R2_PUBLIC_BASE_URL
  if (!base) {
    throw new Error("R2_PUBLIC_BASE_URL is missing.")
  }
  return `${base.replace(/\/$/, "")}/${storageKey}`
}

async function handlePresign(body: any) {
  const {
    fileName,
    contentType,
    title,
    categoryId,
    folder,
  }: {
    fileName?: string
    contentType?: string
    title?: string
    categoryId?: string
    folder?: string
  } = body || {}

  if (!fileName) {
    return NextResponse.json({ error: "Missing fileName." }, { status: 400 })
  }

  const ext = getExtension(fileName)
  const safeName = sanitizeFileName(fileName)
  const randomPart = Math.random().toString(36).slice(2, 10)

  let storageKey = ""

  if (folder === "thumbnails") {
    storageKey = `thumbnails/${Date.now()}-${randomPart}-${safeName}${ext ? `.${ext}` : ""}`
  } else {
    if (!title || !categoryId) {
      return NextResponse.json(
        { error: "Missing title or categoryId for main file upload." },
        { status: 400 }
      )
    }

    const { data: categoryRow, error: categoryError } = await supabase
      .from("categories")
      .select("id, slug, name")
      .eq("id", categoryId)
      .single()

    if (categoryError || !categoryRow) {
      return NextResponse.json({ error: "Category not found." }, { status: 400 })
    }

    const safeTitle = slugify(title)
    const categorySlug =
      categoryRow.slug || slugify(categoryRow.name || "uncategorized")

    storageKey = `${categorySlug}/${Date.now()}-${safeTitle}${ext ? `.${ext}` : ""}`
  }

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: storageKey,
    ContentType: contentType || "application/octet-stream",
  })

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 60 * 15 })

  return NextResponse.json({
    success: true,
    uploadUrl,
    key: storageKey,
    url: getPublicUrl(storageKey),
  })
}

async function handleFinalize(body: any) {
  const {
    mode,
    id,
    title,
    description,
    categoryId,
    isPremium,
    fileUrl,
    storageKey,
    thumbnailUrl,
    thumbnailStorageKey,
    fileSize,
    fileType,
  }: {
    mode?: "create" | "update"
    id?: string
    title?: string
    description?: string
    categoryId?: string
    isPremium?: boolean
    fileUrl?: string | null
    storageKey?: string | null
    thumbnailUrl?: string | null
    thumbnailStorageKey?: string | null
    fileSize?: number | null
    fileType?: string | null
  } = body || {}

  if (!title || !categoryId) {
    return NextResponse.json(
      { error: "Missing required fields for finalize." },
      { status: 400 }
    )
  }

  if (mode === "update") {
    if (!id) {
      return NextResponse.json({ error: "Missing file id." }, { status: 400 })
    }

    const updatePayload = {
      title: title.trim(),
      description: description?.trim() || null,
      category_id: categoryId,
      is_premium: Boolean(isPremium),
      file_url: fileUrl || null,
      storage_key: storageKey || null,
      thumbnail_url: thumbnailUrl || null,
      thumbnail_storage_key: thumbnailStorageKey || null,
      file_size: fileSize ?? null,
      file_type: fileType || null,
    }

    const { error } = await supabase.from("files").update(updatePayload).eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "File updated successfully.",
    })
  }

  if (mode === "create") {
    if (!fileUrl || !storageKey) {
      return NextResponse.json(
        { error: "Missing uploaded file details for create." },
        { status: 400 }
      )
    }

    const safeTitle = slugify(title)

    const { error } = await supabase.from("files").insert({
      title: title.trim(),
      slug: `${safeTitle}-${Date.now()}`,
      description: description?.trim() || null,
      category_id: categoryId,
      storage_key: storageKey,
      file_url: fileUrl,
      thumbnail_url: thumbnailUrl || null,
      thumbnail_storage_key: thumbnailStorageKey || null,
      file_type: fileType || null,
      file_size: fileSize ?? null,
      is_premium: Boolean(isPremium),
      downloads_count: 0,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "File created successfully.",
    })
  }

  return NextResponse.json({ error: "Invalid finalize mode." }, { status: 400 })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const action = body?.action

    if (action === "presign") {
      return await handlePresign(body)
    }

    if (action === "finalize") {
      return await handleFinalize(body)
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 })
  } catch (err: any) {
    console.error("UPLOAD ROUTE ERROR:", err)
    console.error("STACK:", err?.stack)

    return NextResponse.json(
      { error: err?.message || "Upload failed." },
      { status: 500 }
    )
  }
}