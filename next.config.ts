import type { NextConfig } from 'next';

const standaloneBuild = process.env.NEXT_STANDALONE_BUILD === 'true';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The Maincell Windows deployment uses `next start`. Standalone output is
  // still available for container/Amplify packaging when explicitly enabled.
  ...(standaloneBuild ? { output: 'standalone' as const } : {}),

  // Keep Next.js scoped to this app even when a parent folder has another
  // package-lock.json.
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    unoptimized: true,
  },

  // A same-origin gateway preserves the existing Smartdok API and login flow.
  // This server-only upstream is supplied by the deployment, never a request.
  async rewrites() {
    const upstream = process.env.SMARTDOK_BACKEND_URL;
    const sstUpstream = process.env.MAHA_SST_BACKEND_URL;
    return [
      ...(sstUpstream ? [{ source: '/maha-api/api/v1/maha-sst/:path*', destination: `${sstUpstream.replace(/\/$/, '')}/api/v1/maha-sst/:path*` }] : []),
      ...(upstream ? [{ source: '/maha-api/:path*', destination: `${upstream.replace(/\/$/, '')}/:path*` }] : []),
    ];
  },

  async headers() {
    return [{ source: '/maha/:path*', headers: [
      { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ] }];
  },

  transpilePackages: ['lucide-react'],

  webpack: (config, { isServer }) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },

  poweredByHeader: false,
};

export default nextConfig;
