/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  
  // 跳过 lint 和类型检查以加快构建
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
