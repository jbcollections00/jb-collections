import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase-server"
import { getR2BucketName, getSignedUploadUrl } from "@/lib/r2"

export const runtime = "nodejs"

type RequestBody =
  | {
      action: "presign"
      fileName?: string
      contentType?: string
      title?: string
      categoryId?: string
      folder?: string
    }
  | {
      action: "finalize"
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
    }

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^\w.\-]+/g, "_")
}

function getExtension(fileName: string) {
  const parts = fileName.split(".")
  if (parts.length < 2) return ""
  return parts.pop()?.toLowerCase() || ""
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      )
    }

    const adminDb = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const body = (await req.json()) as RequestBody

    if (!body?.action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 })
    }

    if (body.action === "presign") {
      const fileName = String(body.fileName || "").trim()
      const contentType = String(
        body.contentType || "application/octet-stream"
      ).trim()
      const folder = String(body.folder || "").trim()
      const title = String(body.title || "").trim()

      if (!fileName) {
        return NextResponse.json({ error: "Missing file name" }, { status: 400 })
      }

      const ext = getExtension(fileName)
      const safeTitle = slugify(title || fileName.replace(/\.[^/.]+$/, "")) || "file"
      const safeFileName = sanitizeFileName(fileName)
      const unique = `${Date.now()}-${randomUUID()}`
      const key = folder
        ? `${folder}/${unique}-${safeFileName}`
        : `files/${safeTitle}/${unique}-${safeFileName}`

      const uploadUrl = await getSignedUploadUrl({
        key,
        contentType,
        bucket: getR2BucketName(),
        expiresInSeconds: 900,
      })

      return NextResponse.json({
        success: true,
        uploadUrl,
        key,
        extension: ext || null,
      })
    }

    if (body.action === "finalize") {
      const mode = body.mode === "update" ? "update" : "create"
      const title = String(body.title || "").trim()
      const description = String(body.description || "").trim()
      const categoryId = String(body.categoryId || "").trim()
      const isPremium = Boolean(body.isPremium)
      const storageKey =
        typeof body.storageKey === "string" && body.storageKey.trim()
          ? body.storageKey.trim()
          : null
      const thumbnailUrl =
        typeof body.thumbnailUrl === "string" && body.thumbnailUrl.trim()
          ? body.thumbnailUrl.trim()
          : null
      const fileSize =
        typeof body.fileSize === "number" && Number.isFinite(body.fileSize)
          ? body.fileSize
          : null
      const fileType =
        typeof body.fileType === "string" && body.fileType.trim()
          ? body.fileType.trim().toLowerCase()
          : null

      if (!title) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 })
      }

      if (!categoryId) {
        return NextResponse.json({ error: "Category is required" }, { status: 400 })
      }

      const slug = slugify(title)
      const visibility = isPremium ? "premium" : "free"
      const bucketName = getR2BucketName()

      if (mode === "create") {
        if (!storageKey) {
          return NextResponse.json(
            { error: "A main file upload is required for new files." },
            { status: 400 }
          )
        }

        const { data: insertedFile, error: insertFileError } = await adminDb
          .from("files")
          .insert({
            title,
            slug,
            description: description || null,
            cover_url: thumbnailUrl,
            visibility,
            status: "published",
            category_id: categoryId,
          })
          .select("id")
          .single()

        if (insertFileError || !insertedFile) {
          return NextResponse.json(
            { error: insertFileError?.message || "Failed to create file record." },
            { status: 500 }
          )
        }

        const { error: insertVersionError } = await adminDb
          .from("file_versions")
          .insert({
            file_id: insertedFile.id,
            object_key: storageKey,
            bucket_name: bucketName,
            archive_type: fileType,
            mime_type: null,
            file_size_bytes: fileSize,
            is_current: true,
          })

        if (insertVersionError) {
          await adminDb.from("files").delete().eq("id", insertedFile.id)

          return NextResponse.json(
            {
              error:
                insertVersionError.message || "Failed to create file version.",
            },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          message: "File created successfully.",
          fileId: insertedFile.id,
        })
      }

      const fileId = String(body.id || "").trim()

      if (!fileId) {
        return NextResponse.json(
          { error: "Missing file id for update." },
          { status: 400 }
        )
      }

      const { data: existingFile, error: existingFileError } = await adminDb
        .from("files")
        .select("id")
        .eq("id", fileId)
        .maybeSingle()

      if (existingFileError || !existingFile) {
        return NextResponse.json({ error: "File not found." }, { status: 404 })
      }

      const { error: updateFileError } = await adminDb
        .from("files")
        .update({
          title,
          slug,
          description: description || null,
          cover_url: thumbnailUrl,
          visibility,
          category_id: categoryId,
          status: "published",
        })
        .eq("id", fileId)

      if (updateFileError) {
        return NextResponse.json(
          { error: updateFileError.message || "Failed to update file record." },
          { status: 500 }
        )
      }

      if (storageKey) {
        const { error: clearCurrentError } = await adminDb
          .from("file_versions")
          .update({ is_current: false })
          .eq("file_id", fileId)
          .eq("is_current", true)

        if (clearCurrentError) {
          return NextResponse.json(
            {
              error:
                clearCurrentError.message ||
                "Failed to update file version state.",
            },
            { status: 500 }
          )
        }

        const { error: insertVersionError } = await adminDb
          .from("file_versions")
          .insert({
            file_id: fileId,
            object_key: storageKey,
            bucket_name: bucketName,
            archive_type: fileType,
            mime_type: null,
            file_size_bytes: fileSize,
            is_current: true,
          })

        if (insertVersionError) {
          return NextResponse.json(
            {
              error:
                insertVersionError.message ||
                "Failed to create new file version.",
            },
            { status: 500 }
          )
        }
      }

      return NextResponse.json({
        success: true,
        message: "File updated successfully.",
        fileId,
      })
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 })
  } catch (error) {
    console.error("Admin upload route error:", error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}