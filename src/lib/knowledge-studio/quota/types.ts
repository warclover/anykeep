/**
 * Quota Manager - 配额管理器类型
 * @module knowledge-studio/quota
 */

import type { QuotaOperationType, RecoverableError } from "../types";

/**
 * 配额管理器配置
 */
export interface QuotaManagerConfig {
  /** 待确认操作超时时间（毫秒） */
  pendingTimeoutMs: number;

  /** 自动清理间隔（毫秒） */
  cleanupIntervalMs: number;

  /** 启用自动补偿 */
  enableAutoCompensation: boolean;
}

/**
 * 默认配额管理器配置
 */
export const DEFAULT_QUOTA_MANAGER_CONFIG: QuotaManagerConfig = {
  pendingTimeoutMs: 5 * 60 * 1000, // 5 分钟
  cleanupIntervalMs: 60 * 1000, // 1 分钟
  enableAutoCompensation: true,
};

/**
 * 配额扣除请求
 */
export interface DeductQuotaRequest {
  userId: string;
  operationType: QuotaOperationType;
  cost: number;
  metadata?: Record<string, unknown>;
}

/**
 * 配额扣除结果
 */
export interface DeductQuotaResult {
  success: boolean;
  operationId?: string;
  requestId?: string;
  error?: RecoverableError;
}

/**
 * 配额确认请求
 */
export interface ConfirmQuotaRequest {
  requestId: string;
  synthesisReportId?: string;
}

/**
 * 配额补偿请求
 */
export interface RefundQuotaRequest {
  requestId: string;
  reason: string;
}

/**
 * 操作成本配置
 */
export interface OperationCostConfig {
  [key: string]: number;
}

/**
 * 默认操作成本（单位：配额点数）
 */
export const DEFAULT_OPERATION_COSTS: Record<QuotaOperationType, number> = {
  chat_edit: 1,
  blueprint_generation: 5,
  material_analysis: 2,
};

/**
 * 用户配额信息
 */
export interface UserQuotaInfo {
  userId: string;
  totalQuota: number;
  usedQuota: number;
  pendingQuota: number;
  availableQuota: number;
  resetAt?: Date;
  membershipType: "free" | "pro" | "enterprise";
}

/**
 * 配额检查结果
 */
export interface QuotaCheckResult {
  allowed: boolean;
  availableQuota: number;
  requiredQuota: number;
  reason?: string;
}

/**
 * 会员配额限制
 */
export const MEMBERSHIP_QUOTA_LIMITS: Record<string, number> = {
  free: 100,
  pro: 1000,
  enterprise: -1, // 无限制
};
