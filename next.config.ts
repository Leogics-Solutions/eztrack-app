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
