import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { slugify } from '@/lib/utils';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const form = await request.formData();
  const title = String(form.get('title') || '').trim();
  const description = String(form.get('description') || '').trim();
  const categorySlug = String(form.get('categorySlug') || '').trim();
  const fileSize = String(form.get('fileSize') || '').trim();
  const objectKey = String(form.get('objectKey') || '').trim();
  const fileUrl = String(form.get('fileUrl') || '').trim();
  const isPremium = String(form.get('isPremium') || 'true') === 'true';

  const category = await db.category.findUnique({ where: { slug: categorySlug } });
  if (!category || !title) return NextResponse.redirect(new URL('/admin', request.url));

  await db.file.create({
    data: {
      title,
      slug: `${slugify(title)}-${Date.now()}`,
      description,
      categoryId: category.id,
      fileSize,
      objectKey: objectKey || null,
      fileUrl: fileUrl || null,
      isPremium
    }
  });

  return NextResponse.redirect(new URL('/admin', request.url));
}
