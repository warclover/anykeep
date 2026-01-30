"use client";

/**
 * 根提供者组件
 *
 * 将所有客户端 Context Provider 集中在这里，
 * 避免在根 layout 中直接使用 Context 导致的 SSR 问题
 *
 * ## 架构说明
 *
 * Provider 分为两组：
 * - **CoreProviders**: 基础设施类 Provider，必须按顺序执行
 * - **FeatureProviders**: 功能类 Provider，相对独立
 *
 * ## 变更记录
 *
 * - V2.1.0 (2025-12-29): 添加 QueryProvider (TanStack Query) - Phase 4
 * - V2.0.0 (2025-12-24): 使用 composeProviders 重构，减少嵌套层级
 * - V1.3.0 (V4.2.30): 添加 SessionHeartbeatProvider 解决长时间操作会话过期问题
 * - V1.2.0 (Phase 3.5): HomePageProvider 移出 Suspense 边界
 *
 * @version 2.1.0
 * @since 2025-12-24
 */

import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { UserProvider } from "@/contexts/user-context";
import { NavigationProvider } from "@/contexts/navigation-context";
import { HomePageProvider } from "@/contexts/home-page-context";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { KeepAliveProvider } from "@/lib/cache";
import { OnboardingProvider } from "@/components/providers/onboarding-provider";
import { MessageNotificationProvider } from "@/components/messages/message-notification-provider";
import { NotificationProvider } from "@/contexts/notification-context";
import { WebVitalsReporter } from "@/components/analytics/web-vitals-reporter";
import { SessionHeartbeatProvider } from "@/components/providers/session-heartbeat-provider";
import { GlobalErrorBoundary } from "@/components/error-boundary";
import { QueryProvider } from "@/lib/query";
import { TTSPlayerProvider } from "@/components/tts";
import { FeedbackProvider } from "@/components/feedback";
import {
  composeProviders,
  withProps,
  withSuspense,
} from "@/lib/utils/compose-providers";

// ============================================
// Provider 分组定义
// ============================================

/**
 * 核心 Providers
 *
 * 基础设施类 Provider，提供主题、用户、会话等核心功能
 * 必须按顺序执行：Query → Theme → Sidebar → User → SessionHeartbeat
 */
const CoreProviders = composeProviders(
  // TanStack Query (最外层，供其他 Provider 使用)
  QueryProvider,
  // 主题管理
  withProps(ThemeProvider, {
    attribute: "class",
    defaultTheme: "system",
    enableSystem: true,
    disableTransitionOnChange: true,
  }),
  // 侧边栏折叠状态管理
  SidebarProvider,
  // 用户认证状态
  UserProvider,
  // 会话心跳检测，防止长时间操作时会话过期
  SessionHeartbeatProvider,
);

/**
 * 功能 Providers
 *
 * 应用功能类 Provider，提供引导、页面状态、导航、缓存等功能
 * 相对独立，可按需调整顺序
 *
 * 注意：NavigationProvider 使用 useSearchParams()，需要 Suspense 包裹
 * HomePageProvider 必须在 NavigationProvider 外层，避免挂起时 Context 不可用
 */
const FeatureProviders = composeProviders(
  // 新用户引导
  OnboardingProvider,
  // 首页状态管理（必须在 NavigationProvider 外层）
  HomePageProvider,
  // 导航状态（使用 useSearchParams，需要 Suspense）
  withSuspense(NavigationProvider, null),
  // 组件缓存
  KeepAliveProvider,
  // 消息通知
  MessageNotificationProvider,
  // AI Effect 通知（v2.0.0 新增）
  NotificationProvider,
  // TTS 全局播放器（V4.2.27 新增，修复组件卸载导致请求中止的问题）
  TTSPlayerProvider,
);

// ============================================
// 根组件
// ============================================

interface RootProvidersProps {
  children: React.ReactNode;
}

/**
 * 根 Providers 组件
 *
 * 包含所有客户端 Context Provider，按优化后的结构组织
 *
 * 架构改进 v2.0 (2026-01-28):
 * - FeedbackProvider 移到 GlobalErrorBoundary 内部，确保错误边界触发时仍可用
 * - 这样 GlobalFallbackUI 可以安全地使用 useFeedback hook
 *
 * 架构改进 v1.0 (2025-12-28):
 * - 添加 GlobalErrorBoundary 作为最外层错误边界
 * - 捕获所有未处理的 React 渲染错误
 * - 自动上报到 Sentry
 */
export function RootProviders({ children }: RootProvidersProps) {
  return (
    <GlobalErrorBoundary feature="global">
      {/* FeedbackProvider 必须在 GlobalErrorBoundary 内部，这样错误边界触发时仍可用 */}
      <FeedbackProvider>
        <CoreProviders>
          <FeatureProviders>{children}</FeatureProviders>
          {/* 全局组件（在 Provider 树内但不影响嵌套结构） */}
          <Toaster position="top-center" offset={16} />
          {/* FeedbackFloatingButton 已��至 FloatingActionMenu 统一管理 */}
          <ServiceWorkerRegister />
          {/* Web Vitals 性能监控 */}
          <WebVitalsReporter debug={process.env.NODE_ENV === "development"} />
        </CoreProviders>
      </FeedbackProvider>
    </GlobalErrorBoundary>
  );
}
