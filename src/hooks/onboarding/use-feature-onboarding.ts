/**
 * 功能引导 Hook（泛化版）
 *
 * 管理任意功能的首次用户引导状态。
 * 通过 localStorage 持久化完成状态，每个引导流程使用独立 key。
 *
 * @example
 * ```tsx
 * const onboarding = useFeatureOnboarding(DRAG_DROP_STEPS, DRAG_DROP_STORAGE_KEY);
 * ```
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { OnboardingStep, UseOnboardingReturn } from "./types";

export function useFeatureOnboarding(
  steps: OnboardingStep[],
  storageKey: string,
): UseOnboardingReturn {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  // 保存 steps 引用，供 action 调用使用（在 effect 中更新，避免 render 中赋值 ref）
  const stepsRef = useRef(steps);
  useEffect(() => {
    stepsRef.current = steps;
  });

  // M-4: 空数组防御
  const hasSteps = steps.length > 0;

  // 挂载时检查完成状态
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasSteps) return;

    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      // 延迟显示，让页面先完成渲染
      const timer = setTimeout(() => {
        setIsActive(true);
        // H-4: 激活第一步时调用 action
        stepsRef.current[0]?.action?.();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [storageKey, hasSteps]);

  const complete = useCallback(() => {
    localStorage.setItem(storageKey, "true");
    setIsActive(false);
    setCurrentStep(0);
  }, [storageKey]);

  const skip = useCallback(() => {
    complete();
  }, [complete]);

  const next = useCallback(() => {
    if (!hasSteps) return;
    if (currentStep < steps.length - 1) {
      const nextIdx = currentStep + 1;
      setCurrentStep(nextIdx);
      // H-4: 进入下一步时调用 action
      stepsRef.current[nextIdx]?.action?.();
    } else {
      complete();
    }
  }, [currentStep, steps.length, complete, hasSteps]);

  const prev = useCallback(() => {
    const prevIdx = Math.max(0, currentStep - 1);
    setCurrentStep(prevIdx);
    stepsRef.current[prevIdx]?.action?.();
  }, [currentStep]);

  const reset = useCallback(() => {
    localStorage.removeItem(storageKey);
    setCurrentStep(0);
    setIsActive(true);
    stepsRef.current[0]?.action?.();
  }, [storageKey]);

  return {
    isActive: isActive && hasSteps,
    currentStep,
    totalSteps: steps.length,
    step: isActive && hasSteps ? steps[currentStep] : null,
    next,
    prev,
    skip,
    complete,
    reset,
  };
}
