/**
 * 意图预测模块导出
 *
 * @module ai-skills/router/intent-predictor
 */

export { IntentPredictor, createIntentPredictor } from "./intent-predictor";

export type {
  IntentPredictorConfig,
  PredictedIntent,
  QuickAction,
  IntentHistoryEntry,
  CorrectionRecord,
  TransitionMatrixRow,
  TransitionProbability,
  IIntentPredictor,
} from "./types";

export {
  DEFAULT_PREDICTOR_CONFIG,
  DEFAULT_PREDICTIONS,
  QUICK_ACTION_ICONS,
  LOG_MODULE,
} from "./types";
