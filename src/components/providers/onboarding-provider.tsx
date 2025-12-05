"use client";

/**
 * 新用户引导 Provider
 * 检测用户是否完成引导，未完成则展示引导对话框
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useUser } from "@/contexts/user-context";
import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";
import type { Json } from "@/types/supabase";

interface OnboardingContextValue {
  /** 是否已完成引导 */
  hasCompletedOnboarding: boolean;
  /** 是否正在加载 */
  isChecking: boolean;
  /** 手动触发引导 */
  triggerOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

interface OnboardingProviderProps {
  children: ReactNode;
}

/**
 * 检查 profile.settings 中是否有 onboarding_completed_at
 */
function checkOnboardingCompleted(settings: Json | null | undefined): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return false;
  }

  const settingsObj = settings as Record<string, unknown>;
  return Boolean(settingsObj.onboarding_completed_at);
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { user, profile, isLoading: isUserLoading } = useUser();
  const [showDialog, setShowDialog] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true); // 默认 true 避免闪烁
  const [isChecking, setIsChecking] = useState(true);

  // 检查引导状态
  useEffect(() => {
    if (isUserLoading) {
      return;
    }

    // 未登录用户不显示引导
    if (!user) {
      // 使用 setTimeout 避免 effect 中同步 setState 警告
      const timer = setTimeout(() => {
        setIsChecking(false);
        setHasCompletedOnboarding(true);
      }, 0);
      return () => clearTimeout(timer);
    }

    // 检查 profile.settings 中的 onboarding_completed_at
    const completed = checkOnboardingCompleted(profile?.settings);

    // 使用 setTimeout 避免 effect 中同步 setState 警告
    const timer = setTimeout(() => {
      setHasCompletedOnboarding(completed);

      // 如果未完成引导，显示对话框（延迟一下，确保页面已渲染）
      if (!completed) {
        setTimeout(() => setShowDialog(true), 500);
      }

      setIsChecking(false);
    }, 0);

    return () => clearTimeout(timer);
  }, [user, profile, isUserLoading]);

  // 完成引导
  const handleComplete = useCallback(() => {
    setShowDialog(false);
    setHasCompletedOnboarding(true);
    setIsChecking(false);
  }, []);

  // 手动触发引导（用于设置页重新配置）
  const triggerOnboarding = useCallback(() => {
    setShowDialog(true);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        hasCompletedOnboarding,
        isChecking,
        triggerOnboarding,
      }}
    >
      {children}

      {/* 引导对话框 */}
      {user && (
        <OnboardingDialog open={showDialog} onComplete={handleComplete} />
      )}
    </OnboardingContext.Provider>
  );
}

/**
 * 获取引导状态的 Hook
 */
export function useOnboarding() {
  const context = useContext(OnboardingContext);

  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }

  return context;
}
