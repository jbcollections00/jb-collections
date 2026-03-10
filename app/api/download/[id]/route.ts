import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDownloadUrl } from '@/lib/storage';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/login', request.url));

  const { id } = await context.params;
  const file = await db.file.findUnique({ where: { id } });
  if (!file) return NextResponse.redirect(new URL('/dashboard', request.url));

  if (file.isPremium && session.plan !== 'PREMIUM' && session.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/profile', request.url));
  }

  await db.download.upsert({
    where: { userId_fileId: { userId: session.id, fileId: file.id } },
    update: {},
    create: { userId: session.id, fileId: file.id }
  });

  if (file.objectKey) {
    try {
      const signedUrl = await getDownloadUrl(file.objectKey);
      return NextResponse.redirect(signedUrl);
    } catch {
      if (file.fileUrl) return NextResponse.redirect(file.fileUrl);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  if (file.fileUrl) return NextResponse.redirect(file.fileUrl);
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
