/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */

  // P0 修复：渐进式启用类型检查和 ESLint
  // 阶段 1: 先启用类型检查，ESLint 保持禁用
  eslint: {
    ignoreDuringBuilds: true, // 暂时保持禁用，待类型错误修复后再启用
  },
  typescript: {
    ignoreBuildErrors: false, // ✅ 启用类型检查
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
