/** @type {import('next').NextConfig} */

// Em produção (Vercel), o vercel.json cuida do proxy via rewrite.
// Em desenvolvimento local (Docker), o Next.js redireciona /api → backend:8000.
const backendUrl = process.env.BACKEND_URL || 'http://backend:8000';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Só ativa o proxy local se não estiver no Vercel
    if (process.env.VERCEL) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
