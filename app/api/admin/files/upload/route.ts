import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase-server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { r2, getR2BucketName } from "@/lib/r2"

export const runtime = "nodejs"

const adminSupabase = createAdminClient(
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

async function requireAdmin() {
  const supabase = await createServerClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || profile?.role !== "admin") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { user }
}

async function handlePresign(body: any) {
  const adminCheck = await requireAdmin()
  if ("error" in adminCheck) return adminCheck.error

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

    const { data: categoryRow, error: categoryError } = await adminSupabase
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

    storageKey = `archives/${categorySlug}/${Date.now()}-${safeTitle}${ext ? `.${ext}` : ""}`
  }

  const command = new PutObjectCommand({
    Bucket: getR2BucketName(),
    Key: storageKey,
    ContentType: contentType || "application/octet-stream",
  })

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 60 * 15 })

  return NextResponse.json({
    success: true,
    uploadUrl,
    key: storageKey,
  })
}

async function handleFinalize(body: any) {
  const adminCheck = await requireAdmin()
  if ("error" in adminCheck) return adminCheck.error

  const {
    mode,
    id,
    title,
    description,
    categoryId,
    isPremium,
    storageKey,
    thumbnailUrl,
    fileSize,
    fileType,
  }: {
    mode?: "create" | "update"
    id?: string
    title?: string
    description?: string
    categoryId?: string
    isPremium?: boolean
    storageKey?: string | null
    thumbnailUrl?: string | null
    fileSize?: number | null
    fileType?: string | null
  } = body || {}

  if (!title || !categoryId) {
    return NextResponse.json(
      { error: "Missing required fields for finalize." },
      { status: 400 }
    )
  }

  const visibility = isPremium ? "premium" : "free"
  const archiveType = fileType?.toLowerCase() || getExtension(storageKey || "") || "zip"

  if (mode === "update") {
    if (!id) {
      return NextResponse.json({ error: "Missing file id." }, { status: 400 })
    }

    const updatePayload = {
      title: title.trim(),
      slug: `${slugify(title)}-${Date.now()}`,
      description: description?.trim() || null,
      category_id: categoryId,
      visibility,
      status: "published",
      cover_url: thumbnailUrl || null,
    }

    const { error: updateError } = await adminSupabase
      .from("files")
      .update(updatePayload)
      .eq("id", id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (storageKey) {
      await adminSupabase
        .from("file_versions")
        .update({ is_current: false })
        .eq("file_id", id)
        .eq("is_current", true)

      const { error: versionError } = await adminSupabase
        .from("file_versions")
        .insert({
          file_id: id,
          version_label: `v${Date.now()}`,
          object_key: storageKey,
          bucket_name: getR2BucketName(),
          archive_type: archiveType,
          mime_type: null,
          file_size_bytes: fileSize ?? null,
          is_current: true,
        })

      if (versionError) {
        return NextResponse.json({ error: versionError.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      message: "File updated successfully.",
    })
  }

  if (mode === "create") {
    if (!storageKey) {
      return NextResponse.json(
        { error: "Missing uploaded file key for create." },
        { status: 400 }
      )
    }

    const slug = `${slugify(title)}-${Date.now()}`

    const { data: insertedFile, error: insertFileError } = await adminSupabase
      .from("files")
      .insert({
        title: title.trim(),
        slug,
        description: description?.trim() || null,
        category_id: categoryId,
        visibility,
        status: "published",
        cover_url: thumbnailUrl || null,
      })
      .select("id")
      .single()

    if (insertFileError || !insertedFile) {
      return NextResponse.json(
        { error: insertFileError?.message || "Failed to create file." },
        { status: 500 }
      )
    }

    const { error: versionError } = await adminSupabase
      .from("file_versions")
      .insert({
        file_id: insertedFile.id,
        version_label: "v1",
        object_key: storageKey,
        bucket_name: getR2BucketName(),
        archive_type: archiveType,
        mime_type: null,
        file_size_bytes: fileSize ?? null,
        is_current: true,
      })

    if (versionError) {
      return NextResponse.json({ error: versionError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "File created successfully.",
      fileId: insertedFile.id,
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