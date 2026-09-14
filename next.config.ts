import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow a new local build without overwriting the running server artifacts.
  distDir: process.env.SMARTDOK_BUILD_DIR || ".next",

  // Critical for Amplify deployment
  output: 'standalone',

  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    unoptimized: true,
  },

  transpilePackages: [
    'lucide-react',
  ],

  // Next.js 16 uses Turbopack by default in development.
  turbopack: {},

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
