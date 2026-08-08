import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // As imagens de conversa jÃ¡ chegam prontas pela API. Desabilitar o otimizador
  // interno elimina uma superfÃ­cie HTTP desnecessÃ¡ria no servidor web.
  images: { unoptimized: true },
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  async rewrites() {
    // Navegador antigo e varias ferramentas pedem /favicon.ico direto, sem
    // olhar o <link>. Sem isto elas recebiam o 404 em HTML do Next e caiam no
    // icone generico. O conteudo servido e PNG — o que importa e o
    // content-type, nao a extensao na URL.
    const favicon = [{ source: '/favicon.ico', destination: '/icon' }];

    const apiProxyUrl = process.env.API_PROXY_URL;
    if (!apiProxyUrl) return favicon;
    return [
      ...favicon,
      {
        source: '/api/:path*',
        destination: `${apiProxyUrl}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), geolocation=(), payment=(), usb=(), microphone=(self)',
          },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
        ],
      },
    ];
  },
};

export default nextConfig;
