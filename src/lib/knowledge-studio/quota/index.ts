/**
 * Quota Manager Module - 配额管理模块
 * @module knowledge-studio/quota
 */

export { QuotaManager, quotaManager } from "./quota-manager";
export {
  DEFAULT_QUOTA_MANAGER_CONFIG,
  DEFAULT_OPERATION_COSTS,
  MEMBERSHIP_QUOTA_LIMITS,
} from "./types";
export type {
  QuotaManagerConfig,
  DeductQuotaRequest,
  DeductQuotaResult,
  ConfirmQuotaRequest,
  RefundQuotaRequest,
  OperationCostConfig,
  UserQuotaInfo,
  QuotaCheckResult,
} from "./types";
