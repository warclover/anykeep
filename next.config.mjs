/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */

  // P0 修复：渐进式启用类型检查和 ESLint
  // 阶段 2: 类型检查已通过，现在启用 ESLint
  eslint: {
    ignoreDuringBuilds: false, // ✅ 启用 ESLint 检查
  },
  typescript: {
    ignoreBuildErrors: false, // ✅ 保持启用类型检查
  },

  // 允许外部图片域名
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.google.com',
        pathname: '/s2/favicons/**',
      },
    ],
  },
};

export default nextConfig;
