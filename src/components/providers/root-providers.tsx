"use client";

/**
 * 根提供者组件
 *
 * 将所有客户端 Context Provider 集中在这里，
 * 避免在根 layout 中直接使用 Context 导致的 SSR 问题
 *
 * ## 架构说明
 *
 * Provider 分为三组（V4.2.30 性能优化）：
 * - **EssentialProviders**: 首屏必需的基础 Provider
 * - **NavigationProviders**: 导航相关的 Provider
 * - **DeferredProviders**: 可延迟加载的功能 Provider
 *
 * ## 变更记录
 *
 * - V2.3.0 (2026-02-10): 修复条件性 Provider 渲染导致的 Hooks 错误
 * - V2.2.0 (2026-02-07): Provider 分层延迟加载，提升首屏性能
 * - V2.1.0 (2025-12-29): 添加 QueryProvider (TanStack Query) - Phase 4
 * - V2.0.0 (2025-12-24): 使用 composeProviders 重构，减少嵌套层级
 * - V1.3.0 (V4.2.30): 添加 SessionHeartbeatProvider 解决长时间操作会话过期问题
 * - V1.2.0 (Phase 3.5): HomePageProvider 移出 Suspense 边界
 *
 * @version 2.3.0
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
// Provider 分组定义（V4.2.30 性能优化）
// ============================================

/**
 * 首屏必需 Providers
 *
 * 最小化首屏所需的 Provider，提升首次渲染速度
 * 包含：Query、Theme、Sidebar、User
 */
const EssentialProviders = composeProviders(
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
);

/**
 * 导航相关 Providers
 *
 * 页面导航和缓存必需的 Provider
 * 注意：NavigationProvider 使用 useSearchParams()，需要 Suspense 包裹
 */
const NavigationProviders = composeProviders(
  // 首页状态管理（必须在 NavigationProvider 外层）
  HomePageProvider,
  // 导航状态（使用 useSearchParams，需要 Suspense）
  withSuspense(NavigationProvider, null),
  // 组件缓存
  KeepAliveProvider,
);

/**
 * 延迟加载 Providers
 *
 * 非首屏关键的功能 Provider，首屏渲染完成后加载
 * 包含：SessionHeartbeat、Onboarding、Notification、TTS
 *
 * 注意：必须始终渲染（不能条件性挂载），否则 children 在
 * Provider 树切换时会导致 "Rendered more hooks than during
 * the previous render" 错误。各 Provider 应自行内部处理延迟初始化。
 */
const DeferredProviders = composeProviders(
  // 会话心跳检测（可延迟）
  SessionHeartbeatProvider,
  // 新用户引导（可延迟）
  OnboardingProvider,
  // 消息通知（可延迟）
  MessageNotificationProvider,
  // AI Effect 通知（可延迟）
  NotificationProvider,
  // TTS 全局播放器（可延迟）
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
 * 架构改进 v2.3 (2026-02-10):
 * - 修复条件性 Provider 渲染导致的 "Rendered more hooks" 错误
 * - DeferredProviders 始终渲染，移除 requestIdleCallback 延迟机制
 * - 各 DeferredProvider 应自行内部处理延迟初始化逻辑
 *
 * 架构改进 v2.0 (2026-01-28):
 * - FeedbackProvider 移到 GlobalErrorBoundary 内部，确保错误边界触发时仍可用
 * - 这样 GlobalFallbackUI 可以安全地使用 useFeedback hook
 *
 * 架构改进 v1.0 (2025-12-28):
 * - 添加 GlobalErrorBoundary 作为最外层错误边界
 * - 捕获所有未处理的 React 渲染错��
 * - 自动上报到 Sentry
 */
export function RootProviders({ children }: RootProvidersProps) {
  return (
    <GlobalErrorBoundary feature="global">
      {/* FeedbackProvider 必须在 GlobalErrorBoundary 内部，这样错误边界触发时仍可用 */}
      <FeedbackProvider>
        <EssentialProviders>
          <NavigationProviders>
            {/*
             * V2.3.0: DeferredProviders 必须始终渲染
             * 条件性挂载/卸载 Provider 树会导致 children 组件的 Hook 数量
             * 在前后两次渲染中不一致，触发 React 错误：
             * "Rendered more hooks than during the previous render."
             */}
            <DeferredProviders>{children}</DeferredProviders>
          </NavigationProviders>
          {/* 全局组件（在 Provider 树内但不影响嵌套结构） */}
          <Toaster position="bottom-right" />
          {/* FeedbackFloatingButton 已移至 FloatingActionMenu 统一管理 */}
          <ServiceWorkerRegister />
          {/* Web Vitals 性能监控 */}
          <WebVitalsReporter debug={process.env.NODE_ENV === "development"} />
        </EssentialProviders>
      </FeedbackProvider>
    </GlobalErrorBoundary>
  );
}
