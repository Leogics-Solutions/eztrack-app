import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  // Critical for Amplify deployment
  output: 'standalone',
  
  typescript: {
    ignoreBuildErrors: false, // Keep this false to catch real errors
  },
  
  images: {
    unoptimized: true, // Required for Amplify static hosting
  },
  
  // Transpile packages that may cause issues in Amplify deployment
  transpilePackages: [
    'lucide-react',
    // Add other packages if needed
  ],
  
  // Turbopack configuration for dev mode (Next.js 16 uses Turbopack by default)
  // Note: The middleware deprecation warning is a known Turbopack issue and can be safely ignored
  // Middleware is still fully supported in Next.js 16
  turbopack: {},
  
  // Webpack configuration for production builds (used by Amplify)
  webpack: (config, { isServer }) => {
    // Handle ES modules properly
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    
    // Client-side fallbacks for Node.js modules
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
