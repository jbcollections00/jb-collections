import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const accountId = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const defaultBucket = process.env.R2_BUCKET

if (!accountId) {
  throw new Error("Missing R2_ACCOUNT_ID")
}

if (!accessKeyId) {
  throw new Error("Missing R2_ACCESS_KEY_ID")
}

if (!secretAccessKey) {
  throw new Error("Missing R2_SECRET_ACCESS_KEY")
}

if (!defaultBucket) {
  throw new Error("Missing R2_BUCKET")
}

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
})

export function getR2BucketName(): string {
  if (!defaultBucket) {
    throw new Error("R2_BUCKET is not set")
  }
  return defaultBucket
}

export async function getSignedDownloadUrl({
  key,
  bucket = getR2BucketName(),
  expiresInSeconds = 120,
  downloadFilename,
}: {
  key: string
  bucket?: string
  expiresInSeconds?: number
  downloadFilename?: string
}) {
  const safeFilename = downloadFilename
    ? downloadFilename.replace(/["\r\n]/g, "")
    : undefined

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(safeFilename
      ? {
          ResponseContentDisposition: `attachment; filename="${safeFilename}"`,
        }
      : {}),
  })

  return getSignedUrl(r2, command, {
    expiresIn: expiresInSeconds,
  })
}

export async function getSignedUploadUrl({
  key,
  contentType,
  bucket = getR2BucketName(),
  expiresInSeconds = 900,
}: {
  key: string
  contentType: string
  bucket?: string
  expiresInSeconds?: number
}) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType || "application/octet-stream",
  })

  return getSignedUrl(r2, command, {
    expiresIn: expiresInSeconds,
  })
}