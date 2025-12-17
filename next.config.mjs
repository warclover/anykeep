import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */

  // 使用 standalone 输出模式，优化生产部署
  output: 'standalone',

  // Turbopack 编译优化：优化大型包的导入（减少首次编译时间 30-50%）
  experimental: {
    optimizePackageImports: [
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

  // 模块化导入优化：避免 barrel exports 导致的全量加载
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

  // V4.2.24: HTTP/2 预连接和缓存优化
  async headers() {
    return [
      {
        // 所有页面添加预连接头
        source: '/(.*)',
        headers: [
          // 预连接 Supabase（减少 DNS + TLS 握手时间）
          {
            key: 'Link',
            value: `<${process.env.NEXT_PUBLIC_SUPABASE_URL}>; rel=preconnect`,
          },
          // 预连接 Google Fonts（favicon 服务）
          {
            key: 'Link',
            value: '<https://www.google.com>; rel=preconnect',
          },
          // DNS 预解析
          {
            key: 'Link',
            value: '<https://fonts.googleapis.com>; rel=dns-prefetch',
          },
        ],
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

export default exportedConfig;
