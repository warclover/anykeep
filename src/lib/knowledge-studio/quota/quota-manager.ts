/**
 * Quota Manager - 配额管理器
 * @module knowledge-studio/quota
 * @description 乐观计费 + 补偿机制实现
 */

import { createLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/client";
import type {
  QuotaOperationType,
  QuotaUsageSummary,
  RecoverableError,
} from "../types";
import { ERROR_CODES } from "../types";
import type { Database } from "@/types/supabase";
import type {
  QuotaManagerConfig,
  DeductQuotaRequest,
  DeductQuotaResult,
  ConfirmQuotaRequest,
  RefundQuotaRequest,
  UserQuotaInfo,
  QuotaCheckResult,
} from "./types";
import {
  DEFAULT_QUOTA_MANAGER_CONFIG,
  DEFAULT_OPERATION_COSTS,
  MEMBERSHIP_QUOTA_LIMITS,
} from "./types";
import type {
  DeductQuotaParams,
  ConfirmQuotaParams,
  RefundQuotaParams,
  GetQuotaUsageSummaryParams,
} from "./rpc-types";

const logger = createLogger("quota-manager");

/**
 * QuotaManager - 配额管理器
 *
 * 职责：
 * 1. 乐观扣除配额（先扣后执行）
 * 2. 确认配额消耗
 * 3. 失败时补偿（退还配额）
 * 4. 查询配额使用情况
 * 5. 检查配额是否充足
 */
export class QuotaManager {
  private config: QuotaManagerConfig;

  constructor(config: Partial<QuotaManagerConfig> = {}) {
    this.config = { ...DEFAULT_QUOTA_MANAGER_CONFIG, ...config };
  }

  /**
   * 乐观扣除配额
   */
  async deduct(request: DeductQuotaRequest): Promise<DeductQuotaResult> {
    const requestId = crypto.randomUUID();

    logger.info(
      {
        userId: request.userId,
        operationType: request.operationType,
        cost: request.cost,
        requestId,
      },
      "Deducting quota (optimistic)",
    );

    try {
      // 1. 检查配额是否充足
      const checkResult = await this.checkQuota(request.userId, request.cost);
      if (!checkResult.allowed) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.QUOTA_EXCEEDED,
            message: checkResult.reason || "配额不足",
            recoverable: false,
          },
        };
      }

      // 2. 调用 RPC 函数扣除配额
      const supabase = createClient();
      const params: DeductQuotaParams = {
        p_user_id: request.userId,
        p_operation_type: request.operationType,
        p_request_id: requestId,
        p_cost: request.cost,
      };
      const { data, error } = await supabase.rpc("deduct_quota", params);

      if (error) {
        logger.error({ error, requestId }, "Failed to deduct quota");
        throw error;
      }

      logger.info(
        { requestId, operationId: data },
        "Quota deducted successfully",
      );

      return {
        success: true,
        operationId: data,
        requestId,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          requestId,
        },
        "Quota deduction failed",
      );

      return {
        success: false,
        error: {
          code: ERROR_CODES.QUOTA_EXCEEDED,
          message: "配额扣除失败",
          recoverable: true,
          retryAfterMs: 1000,
        },
      };
    }
  }

  /**
   * 确认配额消耗
   */
  async confirm(request: ConfirmQuotaRequest): Promise<boolean> {
    logger.info(
      {
        requestId: request.requestId,
        synthesisReportId: request.synthesisReportId,
      },
      "Confirming quota consumption",
    );

    try {
      const supabase = createClient();
      const params: ConfirmQuotaParams = {
        p_request_id: request.requestId,
        p_synthesis_report_id: request.synthesisReportId || null,
      };
      const { data, error } = await supabase.rpc("confirm_quota", params);

      if (error) {
        logger.error(
          { error, requestId: request.requestId },
          "Failed to confirm quota",
        );
        return false;
      }

      logger.info(
        { requestId: request.requestId, result: data },
        "Quota confirmed",
      );
      return data === true;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          requestId: request.requestId,
        },
        "Quota confirmation failed",
      );
      return false;
    }
  }

  /**
   * 补偿/退还配额
   */
  async refund(request: RefundQuotaRequest): Promise<boolean> {
    logger.info(
      {
        requestId: request.requestId,
        reason: request.reason,
      },
      "Refunding quota",
    );

    try {
      const supabase = createClient();
      const params: RefundQuotaParams = {
        p_request_id: request.requestId,
        p_error_message: request.reason,
      };
      const { data, error } = await supabase.rpc("refund_quota", params);

      if (error) {
        logger.error(
          { error, requestId: request.requestId },
          "Failed to refund quota",
        );
        return false;
      }

      logger.info(
        { requestId: request.requestId, result: data },
        "Quota refunded",
      );
      return data === true;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          requestId: request.requestId,
        },
        "Quota refund failed",
      );
      return false;
    }
  }

  /**
   * 检查配额是否充足
   */
  async checkQuota(
    userId: string,
    requiredCost: number,
  ): Promise<QuotaCheckResult> {
    try {
      const quotaInfo = await this.getUserQuotaInfo(userId);

      if (quotaInfo.membershipType === "enterprise") {
        // 企业版无限制
        return {
          allowed: true,
          availableQuota: Infinity,
          requiredQuota: requiredCost,
        };
      }

      const allowed = quotaInfo.availableQuota >= requiredCost;

      return {
        allowed,
        availableQuota: quotaInfo.availableQuota,
        requiredQuota: requiredCost,
        reason: allowed
          ? undefined
          : `需要 ${requiredCost} 配额，当前可用 ${quotaInfo.availableQuota}`,
      };
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to check quota",
      );

      // 出错时默认允许，避免阻塞用户
      return {
        allowed: true,
        availableQuota: 0,
        requiredQuota: requiredCost,
      };
    }
  }

  /**
   * 获取用户配额信息
   */
  async getUserQuotaInfo(userId: string): Promise<UserQuotaInfo> {
    const supabase = createClient();

    // 1. 获取用户会员类型
    // 类型安全的查询
    type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", userId)
      .single<Pick<ProfileRow, "membership_type">>();

    if (profileError) {
      logger.error(
        { userId, error: profileError },
        "Failed to get user profile",
      );
      throw profileError;
    }

    const membershipType = (profile?.membership_type || "free") as
      | "free"
      | "pro"
      | "enterprise";
    const totalQuota = MEMBERSHIP_QUOTA_LIMITS[membershipType];

    // 2. 获取本月配额使用情况
    const params: GetQuotaUsageSummaryParams = {
      p_user_id: userId,
    };
    const { data: usage, error: usageError } = await supabase.rpc(
      "get_quota_usage_summary",
      params,
    );

    if (usageError) {
      logger.error({ userId, error: usageError }, "Failed to get quota usage");
      throw usageError;
    }

    const usedQuota = usage?.[0]?.total_consumed || 0;
    const pendingQuota = usage?.[0]?.total_pending || 0;

    return {
      userId,
      totalQuota,
      usedQuota,
      pendingQuota,
      availableQuota:
        totalQuota === -1
          ? Infinity
          : Math.max(0, totalQuota - usedQuota - pendingQuota),
      membershipType,
    };
  }

  /**
   * 获取配额使用摘要
   */
  async getUsageSummary(userId: string): Promise<QuotaUsageSummary> {
    const supabase = createClient();

    const params: GetQuotaUsageSummaryParams = {
      p_user_id: userId,
    };
    const { data, error } = await supabase.rpc(
      "get_quota_usage_summary",
      params,
    );

    if (error) {
      logger.error({ userId, error }, "Failed to get usage summary");
      throw error;
    }

    const row = data?.[0] || {};

    return {
      totalConsumed: row.total_consumed || 0,
      totalPending: row.total_pending || 0,
      totalRefunded: row.total_refunded || 0,
      operationCount: row.operation_count || 0,
    };
  }

  /**
   * 获取操作成本
   */
  getOperationCost(operationType: QuotaOperationType): number {
    return DEFAULT_OPERATION_COSTS[operationType] || 1;
  }

  /**
   * 执行带配额管理的操作
   */
  async executeWithQuota<T>(
    userId: string,
    operationType: QuotaOperationType,
    operation: () => Promise<T>,
    options?: {
      cost?: number;
      onSuccess?: (result: T, requestId: string) => Promise<string | undefined>;
    },
  ): Promise<{ success: boolean; data?: T; error?: RecoverableError }> {
    const cost = options?.cost ?? this.getOperationCost(operationType);

    // 1. 乐观扣除配额
    const deductResult = await this.deduct({
      userId,
      operationType,
      cost,
    });

    if (!deductResult.success || !deductResult.requestId) {
      return {
        success: false,
        error: deductResult.error,
      };
    }

    const requestId = deductResult.requestId;

    try {
      // 2. 执行操作
      const result = await operation();

      // 3. 成功后确认配额
      const synthesisReportId = options?.onSuccess
        ? await options.onSuccess(result, requestId)
        : undefined;

      await this.confirm({ requestId, synthesisReportId });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      // 4. 失败时补偿
      await this.refund({
        requestId,
        reason: error instanceof Error ? error.message : "Operation failed",
      });

      return {
        success: false,
        error: {
          code: ERROR_CODES.GENERATION_FAILED,
          message: error instanceof Error ? error.message : "操作失败",
          recoverable: true,
          retryAfterMs: 1000,
        },
      };
    }
  }
}

// 导出单例
export const quotaManager = new QuotaManager();
