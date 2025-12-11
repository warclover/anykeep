/**
 * Trust Mode Module
 * V4.2 托管模式模块导出
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

// 配置
export * from "./config";

// Repository
export { TrustModeRepository } from "./trust-mode.repository";
export type {
  CreateTrustModeInput,
  UpdateTrustModeInput,
  IncrementStatsInput,
} from "./trust-mode.repository";

// Service
export {
  TrustModeService,
  trustModeService,
} from "./trust-mode.service";
export type {
  EffectiveTrustModeConfig,
  ClassificationDecisionContext,
  ClassificationDecision,
} from "./trust-mode.service";
