"use client";

/**
 * 根提供者组件
 * 将所有客户端 Context Provider 集中在这里，
 * 避免在根 layout 中直接使用 Context 导致的 SSR 问题
 */

import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { UserProvider } from "@/contexts/user-context";
import { NavigationProvider } from "@/contexts/navigation-context";
import { HomePageProvider } from "@/contexts/home-page-context";
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
      <UserProvider>
        <OnboardingProvider>
          <Suspense fallback={null}>
            <NavigationProvider>
              {/* V4.2.17: 首页状态 Context（Event Bridge 已验证，关闭兼容模式） */}
              <HomePageProvider enableEventBridge={false}>
                <KeepAliveProvider>
                  <MessageNotificationProvider>
                    {children}
                  </MessageNotificationProvider>
                </KeepAliveProvider>
              </HomePageProvider>
            </NavigationProvider>
          </Suspense>
        </OnboardingProvider>
      </UserProvider>
      <Toaster position="top-center" offset={16} />
      <ServiceWorkerRegister />
      {/* V4.2.1: Web Vitals 性能监控 */}
      <WebVitalsReporter debug={process.env.NODE_ENV === "development"} />
    </ThemeProvider>
  );
}
