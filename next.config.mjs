import { withSentryConfig } from "@sentry/nextjs";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

const analyzeBundles = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */

  // 将版本号注入为环境变量，避免运行时 require()（Edge Runtime 兼容）
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },

  // 使用默认 Node/standalone 输出模式，支持动态路由与动态渲染
  // 注意：`output: "export"` 会与 `dynamic = "force-dynamic"` 等动态特性冲突，
  // 会在本地开发与构建时直接报错，因此这里不再启用静态导出模式。

  // V5.3: Webpack 编译优化（Next.js 14+ 自动启用文件系统缓存）
  // 注意：Next.js 不允许修改 devtool，会自动恢复为 eval-source-map

  // Webpack 配置：将 puppeteer 标记为外部依赖（可选安装）
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 将 puppeteer 排除在 webpack 打包外（可选依赖）
      config.externals = config.externals || [];
      config.externals.push({
        puppeteer: 'commonjs puppeteer',
      });
    }
    return config;
  },

  // Turbopack 编译优化：优化大型包的导入（减少首次编译时间 30-50%）
  experimental: {
    // V4.2.28: 将 ws 包排除在 webpack 打包外，解决 bufferUtil.mask 兼容性问题
    serverComponentsExternalPackages: ['ws', 'bufferutil', 'utf-8-validate', 'puppeteer'],

    optimizePackageImports: [
      // AI SDK 相关（减少 AI API 路由首次编译时间）
      'ai',
      '@ai-sdk/anthropic',
      '@ai-sdk/openai',
      '@ai-sdk/deepseek',
      '@ai-sdk/react',
      '@ai-sdk/provider-utils',
      '@ai-sdk/provider',
      // UI 图标库
      'lucide-react',
      // Radix UI 组件（全系列）
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-accordion',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-switch',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-label',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      // 动画库
      'framer-motion',
      // 拖拽库
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      // 数据处理
      'date-fns',
      'zod',
      // 状态管理
      'swr',
      // 表单
      'react-hook-form',
      '@hookform/resolvers',
      // 图表
      'recharts',
      // 通知
      'sonner',
      // Supabase
      '@supabase/supabase-js',
      '@supabase/ssr',
    ],
  },

  // 模块化导入优化：避免 barrel exports 导致的��量加载
  modularizeImports: {
    // 优化 lucide-react 图标导入
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },

  // P0 修复：渐进式启用类型检查和 ESLint
  // 阶段 2: 类型检查已通过，现在启用 ESLint
  eslint: {
    ignoreDuringBuilds: false, // ✅ 启用 ESLint 检查
  },
  typescript: {
    ignoreBuildErrors: false, // ✅ 保持启用类型检查
  },

  // 图片优化配置
  // 注意：移除了 unoptimized: true，启用自动 WebP/AVIF 格式转换
  images: {
    remotePatterns: [
      // 允许所有 HTTPS 来源（书签封面图来自各平台 CDN，域名不固定）
      {
        protocol: 'https',
        hostname: '**',
      },
      // 允许 HTTP（部分老图片链接）
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
    // 现代格式优先（减少传输体积 30-60%）
    formats: ['image/avif', 'image/webp'],
  },

  // API 路径重写：向后兼容旧路径
  // Phase 0.1: 隔离管理/调试 API 到 /internal/ 目录
  // Phase 1.1: Classification API 合并重定向
  async rewrites() {
    return [
      // =====================================================
      // Phase 0.1: Internal API 重写
      // =====================================================
      // Cron APIs: /api/cron/* → /api/internal/cron/*
      { source: '/api/cron/:path*', destination: '/api/internal/cron/:path*' },
      // Dev APIs: /api/dev/* → /api/internal/dev/*
      { source: '/api/dev/:path*', destination: '/api/internal/dev/:path*' },
      // Debug APIs: /api/debug/* → /api/internal/debug/*
      { source: '/api/debug/:path*', destination: '/api/internal/debug/:path*' },
      // Maintenance APIs: /api/maintenance/* → /api/internal/maintenance/:path*' },
      { source: '/api/maintenance/:path*', destination: '/api/internal/maintenance/:path*' },

      // =====================================================
      // Phase 1.1: Classification API 合并重写
      // =====================================================
      // Debug 相关（已合并到 /debug?type=xxx）
      { source: '/api/classification/test', destination: '/api/classification/debug?type=test' },
      { source: '/api/classification/trace', destination: '/api/classification/debug?type=trace' },

      // Analytics 相关（已合并到 /analytics?type=xxx）
      { source: '/api/classification/statistics', destination: '/api/classification/analytics?type=statistics' },
      { source: '/api/classification/history', destination: '/api/classification/analytics?type=history' },
      { source: '/api/classification/ab-test', destination: '/api/classification/analytics?type=abtest' },

      // Inbox 相关（已合并到 /inbox?type=xxx）
      { source: '/api/classification/cluster-suggestions', destination: '/api/classification/inbox?type=suggestions' },
      { source: '/api/classification/cluster-stats', destination: '/api/classification/inbox?type=stats' },
    ];
  },

  // V4.2.24: HTTP/2 预连接和缓存优化
  async headers() {
    // 构建预连接头数组
    const preconnectHeaders = [];

    // 预连接 Supabase（减少 DNS + TLS 握手时间）
    // 仅在环境变量存在时添加
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      preconnectHeaders.push({
        key: 'Link',
        value: `<${process.env.NEXT_PUBLIC_SUPABASE_URL}>; rel=preconnect`,
      });
    }

    // 预连接 Google Fonts（favicon 服务）
    preconnectHeaders.push({
      key: 'Link',
      value: '<https://www.google.com>; rel=preconnect',
    });

    // DNS 预解析
    preconnectHeaders.push({
      key: 'Link',
      value: '<https://fonts.googleapis.com>; rel=dns-prefetch',
    });

    return [
      {
        // 所有页面添加预连接头
        source: '/(.*)',
        headers: preconnectHeaders,
      },
      {
        // 静态资源缓存优化
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // API 路由禁止缓存
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
      {
        // Analytics 页面禁止缓存（需要实时数据）
        source: '/analytics',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ];
  },
};

// Sentry configuration options
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
};

// Export with Sentry wrapper (仅在生产环境且设置了 SENTRY_DSN 时启用)
// 开发环境禁用 Sentry 可减少 2-5 秒启动时间

const exportedConfig =
  process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN
    ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
    : nextConfig;

export default analyzeBundles(exportedConfig);
