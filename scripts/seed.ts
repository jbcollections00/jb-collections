import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@jbcollections.com';
  const adminPassword = 'admin123456';

  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'JB Admin',
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: 'ADMIN',
      plan: 'PREMIUM'
    }
  });

  const categories = [
    { name: 'Ebooks', slug: 'ebooks', description: 'Digital books and reading materials.' },
    { name: 'Templates', slug: 'templates', description: 'Downloadable editable templates.' },
    { name: 'Reviewers', slug: 'reviewers', description: 'Study and review materials.' }
  ];

  for (const category of categories) {
    await db.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category
    });
  }

  const ebooks = await db.category.findUnique({ where: { slug: 'ebooks' } });
  if (ebooks) {
    await db.file.upsert({
      where: { slug: 'sample-premium-ebook' },
      update: {},
      create: {
        title: 'Sample Premium Ebook',
        slug: 'sample-premium-ebook',
        description: 'Replace with your real file record and S3 object key.',
        categoryId: ebooks.id,
        fileSize: '25 MB',
        isPremium: true,
        fileUrl: 'https://example.com/sample-premium-ebook.pdf'
      }
    });
  }

  console.log('Seed complete.');
  console.log(`Admin login: ${admin.email}`);
  console.log(`Admin password: ${adminPassword}`);
  console.log(`Admin id: ${admin.id}`);
}

main().finally(async () => {
  await db.$disconnect();
});
