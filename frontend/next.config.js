/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Proxy: redireciona /api/* para o backend internamente (server-side).
  // O celular nunca chama a porta 8000 diretamente — tudo passa pela porta 3000.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://backend:8000/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
