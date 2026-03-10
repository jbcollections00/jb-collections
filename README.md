# JB Collections

A full-stack starter for a file-download website with:

- member login and signup
- premium-gated downloads
- member profile page
- member-to-admin request messaging
- category dashboard
- admin dashboard for managing categories, files, users, and premium approvals
- S3-compatible storage-ready download flow for large file hosting

## Best storage setup for a large download site

For a site focused on many downloadable files and large storage, use this stack:

- **Frontend / app**: Next.js
- **Database**: PostgreSQL or SQLite for local dev
- **Auth**: built-in cookie/JWT auth in this starter
- **Storage**: **Cloudflare R2**, **Backblaze B2**, **Wasabi**, **AWS S3**, or **MinIO**
- **Deployment**: VPS, Railway, Render, Coolify, or Vercel + external DB/storage

This starter already supports **S3-compatible object storage** through signed download URLs.

## Main user flow

1. User signs up.
2. User logs in and sees the dashboard categories.
3. Free users can browse but premium files redirect them to the profile upgrade page.
4. User sends an upgrade request or file request via Messages/Profile.
5. Admin logs in and approves premium from the admin dashboard.
6. Premium users can download premium files.

## Project structure

- `app/` - pages and API routes
- `lib/` - auth, db, session, storage helpers
- `prisma/` - database schema
- `scripts/seed.ts` - seed admin account and sample data

## Setup

1. Install dependencies

```bash
npm install
```

2. Copy env file

```bash
cp .env.example .env
```

3. Generate Prisma client and create database

```bash
npx prisma generate
npx prisma migrate dev --name init
```

4. Seed sample data

```bash
npm run db:seed
```

5. Start the app

```bash
npm run dev
```

## Default admin login after seeding

- **Email**: value of `ADMIN_EMAIL` in `.env`
- **Password**: `admin123456`

Change this immediately after first setup.

## Storage notes

To use large external storage:

1. Create an S3-compatible bucket.
2. Set the values in `.env`:
   - `S3_ENDPOINT`
   - `S3_REGION`
   - `S3_ACCESS_KEY_ID`
   - `S3_SECRET_ACCESS_KEY`
   - `S3_BUCKET`
3. When creating file records in the admin panel, use `objectKey` for the file stored in your bucket.
4. The app will generate a signed URL during download.

## What is included vs. what you may still want next

Included:
- full starter UI and routes
- authentication
- premium gating
- admin/member roles
- message/request flow
- storage-ready downloads

Recommended next upgrades:
- online payment integration for premium membership
- real chat thread replies instead of one-way requests
- file upload directly from admin panel to S3
- email notifications
- search, tags, favorites, and download analytics
- rate limiting and anti-abuse tools
- PostgreSQL for production

## Production recommendation

For a real public download site, I recommend:

- **Next.js app** on a VPS / Render / Railway
- **PostgreSQL** instead of SQLite
- **Cloudflare R2** or **Backblaze B2** for low-cost large storage
- **Cloudflare** in front for caching and security

