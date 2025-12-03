"use client";

/**
 * 根提供者组件
 * 将所有客户端 Context Provider 集中在这里，
 * 避免在根 layout 中直接使用 Context 导致的 SSR 问题
 */

import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { UserProvider } from "@/contexts/user-context";

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
      <UserProvider>{children}</UserProvider>
      <Toaster />
      <ServiceWorkerRegister />
    </ThemeProvider>
  );
}
