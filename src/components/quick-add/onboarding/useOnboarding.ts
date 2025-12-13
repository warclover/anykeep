/**
 * Onboarding Hook
 *
 * Manages the first-time user onboarding tutorial state.
 * Stores completion status in localStorage.
 */

import { useState, useEffect, useCallback } from "react";

// Storage key for onboarding completion
const ONBOARDING_KEY = "anykeep_onboarding_quick_add_v1";

export interface OnboardingStep {
  id: string;
  target: string | null; // CSS selector, null for centered display
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right" | "center";
  action?: () => void; // Optional action for this step
}

// Quick Add onboarding steps
export const QUICK_ADD_ONBOARDING: OnboardingStep[] = [
  {
    id: "quick-add-intro",
    target: ".quick-add-bookmark",
    title: "✨ 一键收藏",
    description: "复制任意网页链接，点击这里自动粘贴识别并预览内容",
    position: "bottom",
  },
  {
    id: "quick-add-actions",
    target: ".quick-add-bookmark",
    title: "🎯 快速操作",
    description:
      "按 Enter 或点击「收藏」快速保存\n点击 ⚙️ 可选择文件夹和添加标签",
    position: "bottom",
  },
  {
    id: "quick-add-complete",
    target: null,
    title: "🎉 准备就绪！",
    description:
      "现在就试试粘贴一个链接吧\n\n💡 小技巧：\n• Tab 键打开详情面板\n• Esc 键取消操作\n• Enter 键快速收藏",
    position: "center",
  },
];

export interface UseOnboardingReturn {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  step: OnboardingStep | null;
  next: () => void;
  prev: () => void;
  skip: () => void;
  complete: () => void;
  reset: () => void;
}

export function useOnboarding(
  steps: OnboardingStep[] = QUICK_ADD_ONBOARDING,
): UseOnboardingReturn {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Check completion status on mount
  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") return;

    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      // Delay showing onboarding to let page render first
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Complete onboarding
  const complete = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setIsActive(false);
    setCurrentStep(0);
  }, []);

  // Skip onboarding
  const skip = useCallback(() => {
    complete();
  }, [complete]);

  // Go to next step
  const next = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      complete();
    }
  }, [currentStep, steps.length, complete]);

  // Go to previous step
  const prev = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  // Reset onboarding (for testing)
  const reset = useCallback(() => {
    localStorage.removeItem(ONBOARDING_KEY);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  return {
    isActive,
    currentStep,
    totalSteps: steps.length,
    step: isActive ? steps[currentStep] : null,
    next,
    prev,
    skip,
    complete,
    reset,
  };
}
