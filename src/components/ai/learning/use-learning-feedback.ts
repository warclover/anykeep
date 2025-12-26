"use client";

/**
 * AI 学习反馈 Hook
 *
 * 管理意图纠正的完整流程：
 * 1. 检测纠正信号
 * 2. 显示纠正确认
 * 3. 记录学习
 * 4. 显示学习确认
 *
 * @module ai/learning
 * @version 1.0.0
 * @since 2025-12-26
 */

import { useState, useCallback, useRef } from "react";
import type { IntentType } from "@/lib/ai-learning/types";
import type { CorrectionDetection, LearningFeedbackState } from "./types";

// =============================================================================
// Hook 实现
// =============================================================================

export interface UseLearningFeedbackOptions {
  /** 用户 ID */
  userId?: string;
  /** 当前会话 ID */
  conversationId?: string;
  /** 学习成功回调 */
  onLearningSuccess?: (
    wrongIntent: IntentType,
    correctIntent: IntentType,
  ) => void;
  /** 学习失败回调 */
  onLearningError?: (error: string) => void;
}

export interface UseLearningFeedbackReturn {
  // 状态
  state: LearningFeedbackState;

  // 纠正检测 Toast
  correctionDetection: CorrectionDetection | null;
  showCorrectionToast: boolean;

  // 学习确认
  showLearningConfirmation: boolean;
  learningResult: { wrongIntent: IntentType; correctIntent: IntentType } | null;

  // 意图选择器
  showIntentSelector: boolean;
  selectorWrongIntent: IntentType | null;

  // 操作方法
  triggerIntentCorrection: (wrongIntent: IntentType, messageId: string) => void;
  handleCorrectionDetected: (detection: CorrectionDetection) => void;
  confirmCorrection: () => Promise<void>;
  cancelCorrection: () => void;
  selectCorrectIntent: (intent: IntentType) => Promise<void>;
  closeIntentSelector: () => void;
  dismissLearningConfirmation: () => void;
}

export function useLearningFeedback(
  options: UseLearningFeedbackOptions = {},
): UseLearningFeedbackReturn {
  const { userId, conversationId, onLearningSuccess, onLearningError } =
    options;

  // 状态管理
  const [state, setState] = useState<LearningFeedbackState>({
    isProcessing: false,
  });

  // 纠正检测 Toast
  const [correctionDetection, setCorrectionDetection] =
    useState<CorrectionDetection | null>(null);
  const [showCorrectionToast, setShowCorrectionToast] = useState(false);

  // 学习确认
  const [showLearningConfirmation, setShowLearningConfirmation] =
    useState(false);
  const [learningResult, setLearningResult] = useState<{
    wrongIntent: IntentType;
    correctIntent: IntentType;
  } | null>(null);

  // 意图选择器
  const [showIntentSelector, setShowIntentSelector] = useState(false);
  const [selectorWrongIntent, setSelectorWrongIntent] =
    useState<IntentType | null>(null);

  // 当前消息 ID（用于追踪）
  const currentMessageIdRef = useRef<string | null>(null);

  // =============================================================================
  // 内部方法（必须在调用它的函数之前定义）
  // =============================================================================

  /**
   * 记录学习到后端
   */
  const recordLearning = useCallback(
    async (wrongIntent: IntentType, correctIntent: IntentType) => {
      setState((prev) => ({ ...prev, isProcessing: true, error: undefined }));

      try {
        const response = await fetch("/api/ai/learning/correction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wrongIntent,
            correctIntent,
            messageId: currentMessageIdRef.current,
            conversationId,
            userId,
            signal: correctionDetection?.signalType || "negative_feedback",
            confidence: correctionDetection?.confidence || 0.9,
            originalInput: correctionDetection?.originalInput,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "记录学习失败");
        }

        // 成功 - 显示学习确认
        setLearningResult({ wrongIntent, correctIntent });
        setShowLearningConfirmation(true);

        setState((prev) => ({
          ...prev,
          isProcessing: false,
          lastLearning: {
            wrongIntent,
            correctIntent,
            timestamp: new Date(),
          },
        }));

        onLearningSuccess?.(wrongIntent, correctIntent);
      } catch (error) {
        const message = error instanceof Error ? error.message : "记录学习失败";
        setState((prev) => ({ ...prev, isProcessing: false, error: message }));
        onLearningError?.(message);
      }
    },
    [
      conversationId,
      userId,
      correctionDetection,
      onLearningSuccess,
      onLearningError,
    ],
  );

  // =============================================================================
  // 操作方法
  // =============================================================================

  /**
   * 手动触发意图纠正（点击"这不是我的意图"按钮）
   */
  const triggerIntentCorrection = useCallback(
    (wrongIntent: IntentType, messageId: string) => {
      currentMessageIdRef.current = messageId;
      setSelectorWrongIntent(wrongIntent);
      setShowIntentSelector(true);
    },
    [],
  );

  /**
   * 处理自动检测到的纠正信号
   */
  const handleCorrectionDetected = useCallback(
    (detection: CorrectionDetection) => {
      setCorrectionDetection(detection);
      setShowCorrectionToast(true);
    },
    [],
  );

  /**
   * 确认自动检测的纠正
   */
  const confirmCorrection = useCallback(async () => {
    if (!correctionDetection) return;

    const { wrongIntent, correctIntent } = correctionDetection;

    if (!correctIntent) {
      // 如果没有推断出正确意图，打开选择器
      setSelectorWrongIntent(wrongIntent);
      setShowIntentSelector(true);
      setShowCorrectionToast(false);
      return;
    }

    // 有推断的正确意图，直接记录学习
    await recordLearning(wrongIntent, correctIntent);
    setShowCorrectionToast(false);
    setCorrectionDetection(null);
  }, [correctionDetection, recordLearning]);

  /**
   * 取消纠正
   */
  const cancelCorrection = useCallback(() => {
    setShowCorrectionToast(false);
    setCorrectionDetection(null);
  }, []);

  /**
   * 选择正确意图（从选择器）
   */
  const selectCorrectIntent = useCallback(
    async (correctIntent: IntentType) => {
      if (!selectorWrongIntent) return;

      await recordLearning(selectorWrongIntent, correctIntent);
      setShowIntentSelector(false);
      setSelectorWrongIntent(null);
    },
    [selectorWrongIntent, recordLearning],
  );

  /**
   * 关闭意图选择器
   */
  const closeIntentSelector = useCallback(() => {
    setShowIntentSelector(false);
    setSelectorWrongIntent(null);
  }, []);

  /**
   * 关闭学习确认
   */
  const dismissLearningConfirmation = useCallback(() => {
    setShowLearningConfirmation(false);
    setLearningResult(null);
  }, []);

  return {
    state,
    correctionDetection,
    showCorrectionToast,
    showLearningConfirmation,
    learningResult,
    showIntentSelector,
    selectorWrongIntent,
    triggerIntentCorrection,
    handleCorrectionDetected,
    confirmCorrection,
    cancelCorrection,
    selectCorrectIntent,
    closeIntentSelector,
    dismissLearningConfirmation,
  };
}

export default useLearningFeedback;
