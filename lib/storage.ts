import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function getClient() {
  return new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || ''
    }
  });
}

export async function getDownloadUrl(objectKey: string) {
  if (!process.env.S3_BUCKET) throw new Error('S3 bucket is not configured.');

  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: objectKey
  });

  return getSignedUrl(getClient(), command, { expiresIn: 60 * 5 });
}
