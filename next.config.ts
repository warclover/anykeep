import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Next.js 16+ 配置：将 pino 相关包标记为服务端外部包
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],

  // Turbopack 配置（Next.js 16 默认使用 Turbopack）
  turbopack: {
    // 明确表示使用 Turbopack
  }
};

export default nextConfig;
