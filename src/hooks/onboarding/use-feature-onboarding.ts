/**
 * 功能引导 Hook（泛化版）
 *
 * 管理任意功能的首次用户引导状态。
 * 通过 localStorage 持久化完成状态，每个引导流程使用独立 key。
 *
 * @example
 * ```tsx
 * const onboarding = useFeatureOnboarding(DRAG_DROP_STEPS, "anykeep_onboarding_drag_drop_v1");
 * ```
 */

import { useState, useEffect, useCallback } from "react";
import type { OnboardingStep, UseOnboardingReturn } from "./types";

/** 默认 storage key（向后兼容 QuickAdd） */
const DEFAULT_STORAGE_KEY = "anykeep_onboarding_quick_add_v1";

export function useFeatureOnboarding(
  steps: OnboardingStep[],
  storageKey: string = DEFAULT_STORAGE_KEY,
): UseOnboardingReturn {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // 挂载时检查完成状态
  useEffect(() => {
    if (typeof window === "undefined") return;

    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      // 延迟显示，让页面先完成渲染
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const complete = useCallback(() => {
    localStorage.setItem(storageKey, "true");
    setIsActive(false);
    setCurrentStep(0);
  }, [storageKey]);

  const skip = useCallback(() => {
    complete();
  }, [complete]);

  const next = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      complete();
    }
  }, [currentStep, steps.length, complete]);

  const prev = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(storageKey);
    setCurrentStep(0);
    setIsActive(true);
  }, [storageKey]);

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
