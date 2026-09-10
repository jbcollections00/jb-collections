/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'nazbeukcmokpqffvzgk.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'cdn.jb-collections.com',
      },
      {
        protocol: 'https',
        hostname: 'pub-6d1fe926cad643ca93a21cfb34a02f93.r2.dev',
      },
    ],
  },

  // 🔥 FORCE fresh assets (fixes CSS 404 issues)
  headers: async () => [
    {
      source: "/_next/static/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
      ],
    },
  ],
};

export default nextConfig;