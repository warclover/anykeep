"use client";

/**
 * 根提供者组件
 * 将所有客户端 Context Provider 集中在这里，
 * 避免在根 layout 中直接使用 Context 导致的 SSR 问题
 *
 * Phase 3.5 修复：
 * - HomePageProvider 移出 Suspense 边界
 * - NavigationProvider 使用 useSearchParams() 会触发 Suspense
 * - 如果 HomePageProvider 在 Suspense 内，挂起时子组件无法访问 Context
 */

import { Suspense } from "react";
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
import { WebVitalsReporter } from "@/components/analytics/web-vitals-reporter";

interface RootProvidersProps {
  children: React.ReactNode;
}

export function RootProviders({ children }: RootProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* Phase 5: 侧边栏折叠状态管理 */}
      <SidebarProvider>
        <UserProvider>
          <OnboardingProvider>
            {/* Phase 3.5: HomePageProvider 移出 Suspense 边界
                避免 NavigationProvider 挂起时 Context 不可用 */}
            <HomePageProvider>
              <Suspense fallback={null}>
                <NavigationProvider>
                  <KeepAliveProvider>
                    <MessageNotificationProvider>
                      {children}
                    </MessageNotificationProvider>
                  </KeepAliveProvider>
                </NavigationProvider>
              </Suspense>
            </HomePageProvider>
          </OnboardingProvider>
        </UserProvider>
      </SidebarProvider>
      <Toaster position="top-center" offset={16} />
      <ServiceWorkerRegister />
      {/* V4.2.1: Web Vitals 性能监控 */}
      <WebVitalsReporter debug={process.env.NODE_ENV === "development"} />
    </ThemeProvider>
  );
}
