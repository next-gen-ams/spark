import type { NextConfig } from 'next';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig: NextConfig = isGitHubPages
  ? {
      basePath: '/emt-tracker',
      assetPrefix: '/emt-tracker',
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
