import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite', '@electric-sql/pglite-pgvector', 'pg'],
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
};

export default nextConfig;
