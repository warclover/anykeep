/**
 * AI 自我学习前端组件
 *
 * 提供意图纠正和学习反馈的 UI 组件
 *
 * @module ai/learning
 * @version 1.0.0
 * @since 2025-12-26
 *
 * @example
 * ```typescript
 * import {
 *   CorrectionDetectedToast,
 *   LearningConfirmation,
 *   WrongIntentButton,
 *   IntentCorrectionSelector,
 *   useLearningFeedback,
 * } from '@/components/ai/learning';
 *
 * // 在消息组件中使用
 * function AIMessage({ message }) {
 *   const {
 *     showCorrectionToast,
 *     correctionDetection,
 *     showLearningConfirmation,
 *     learningResult,
 *     triggerIntentCorrection,
 *     confirmCorrection,
 *     cancelCorrection,
 *     dismissLearningConfirmation,
 *   } = useLearningFeedback();
 *
 *   return (
 *     <>
 *       <WrongIntentButton
 *         currentIntent={message.intent}
 *         messageId={message.id}
 *         onClick={() => triggerIntentCorrection(message.intent, message.id)}
 *       />
 *
 *       <CorrectionDetectedToast
 *         detection={correctionDetection}
 *         isVisible={showCorrectionToast}
 *         onConfirm={confirmCorrection}
 *         onCancel={cancelCorrection}
 *       />
 *
 *       {learningResult && (
 *         <LearningConfirmation
 *           wrongIntent={learningResult.wrongIntent}
 *           correctIntent={learningResult.correctIntent}
 *           isVisible={showLearningConfirmation}
 *           onDismiss={dismissLearningConfirmation}
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 */

// =============================================================================
// 类型导出
// =============================================================================

export type {
  CorrectionDetection,
  CorrectionDetectedToastProps,
  LearningConfirmationProps,
  WrongIntentButtonProps,
  IntentCorrectionSelectorProps,
  LearningFeedbackState,
} from "./types";

export { INTENT_DISPLAY_NAMES } from "./types";

// =============================================================================
// 组件导出
// =============================================================================

export { CorrectionDetectedToast } from "./correction-detected-toast";
export { LearningConfirmation } from "./learning-confirmation";
export { WrongIntentButton } from "./wrong-intent-button";
export { IntentCorrectionSelector } from "./intent-correction-selector";

// =============================================================================
// Hook 导出
// =============================================================================

export { useLearningFeedback } from "./use-learning-feedback";
export type {
  UseLearningFeedbackOptions,
  UseLearningFeedbackReturn,
} from "./use-learning-feedback";
