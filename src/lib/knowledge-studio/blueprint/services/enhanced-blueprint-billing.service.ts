/**
 * EnhancedBlueprintBillingService - 增强蓝图配额计费服务
 * @module knowledge-studio/blueprint/services
 *
 * Story 8.2 实现：
 * - 集成增强蓝图与配额系统
 * - Free 用户每月 3 次试用限制
 * - 支持差异化配额消耗 (creditsCost: 2-3)
 * - 配额检查 → 执行 → 使用量记录
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { createUsageTracker } from "../../billing/usage-tracker";
import type { EnhancedBlueprintEngine } from "../enhanced-blueprint-engine";
import type { StructuredOutput } from "../types";
import type { UsageType } from "../../billing/types";
import type { Database } from "@/types/supabase";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 配额检查结果
 */
export interface QuotaCheckResult {
  /** 是否有足够配额 */
  hasQuota: boolean;
  /** 剩余配额 */
  remaining: number;
  /** 配额限制 */
  limit: number;
  /** 会员类型 */
  membershipType: "free" | "pro" | "enterprise";
  /** 蓝图消耗点数 */
  creditsCost: number;
  /** 配额不足时的提示消息 */
  message?: string;
}

/**
 * 执行结果
 */
export interface ExecutionResult<T> {
  /** 是否成功 */
  success: boolean;
  /** 执行结果数据 */
  data?: T;
  /** 错误信息 */
  error?: {
    code: string;
    message: string;
    /** 是否可恢复 */
    recoverable: boolean;
  };
  /** 配额信息 */
  quotaInfo?: QuotaCheckResult;
}

/**
 * 服务配置
 */
export interface EnhancedBlueprintBillingConfig {
  /** 使用类型（用于配额计算） */
  usageType: UsageType;
  /** 是否启用配额检查 */
  enableQuotaCheck: boolean;
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: EnhancedBlueprintBillingConfig = {
  usageType: "generation",
  enableQuotaCheck: true,
};

// ============================================================================
// 服务实现
// ============================================================================

/**
 * 增强蓝图配额计费服务
 *
 * 负责增强蓝图的配额检查、执行和使用量记录。
 *
 * @example
 * ```typescript
 * const service = new EnhancedBlueprintBillingService();
 *
 * // 检查配额
 * const quotaCheck = await service.checkQuota(userId, blueprint);
 * if (!quotaCheck.hasQuota) {
 *   console.log(quotaCheck.message);
 *   return;
 * }
 *
 * // 执行并记录使用量
 * const result = await service.executeWithQuota(
 *   userId,
 *   blueprint,
 *   async () => await blueprint.execute(input)
 * );
 * ```
 */
export class EnhancedBlueprintBillingService {
  private readonly config: EnhancedBlueprintBillingConfig;

  constructor(config?: Partial<EnhancedBlueprintBillingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 检查用户配额
   *
   * @param userId - 用户 ID
   * @param blueprint - 蓝图实例（用于获取 creditsCost）
   * @returns 配额检查结果
   */
  async checkQuota(
    userId: string,
    blueprint: EnhancedBlueprintEngine<StructuredOutput>,
  ): Promise<QuotaCheckResult> {
    const supabase = await createClient();

    // 1. 获取用户会员类型
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", userId)
      .single<
        Pick<Database["public"]["Tables"]["profiles"]["Row"], "membership_type">
      >();

    if (profileError) {
      logger.error(
        { error: profileError.message, userId },
        "Failed to get user profile for quota check",
      );
      // Fail-secure: 无法验证会员状态时，默认拒绝
      return {
        hasQuota: false,
        remaining: 0,
        limit: 0,
        membershipType: "free",
        creditsCost: blueprint.creditsCost,
        message: "无法验证会员状态，请稍后重试",
      };
    }

    const membershipType = (profile?.membership_type?.toLowerCase() ??
      "free") as "free" | "pro" | "enterprise";
    const creditsCost = blueprint.creditsCost;

    // 2. Pro/Enterprise 用户无限制
    if (membershipType === "pro" || membershipType === "enterprise") {
      return {
        hasQuota: true,
        remaining: 999999,
        limit: -1, // -1 表示无限
        membershipType,
        creditsCost,
      };
    }

    // 3. Free 用户检查配额
    const tracker = createUsageTracker();
    const quotaResult = await tracker.checkQuota(userId, this.config.usageType);

    const hasQuota = quotaResult.remaining >= creditsCost;

    return {
      hasQuota,
      remaining: quotaResult.remaining,
      limit: quotaResult.limit,
      membershipType,
      creditsCost,
      message: hasQuota
        ? undefined
        : this.getQuotaExhaustedMessage(quotaResult.remaining, creditsCost),
    };
  }

  /**
   * 带配额检查的执行
   *
   * 执行流程：
   * 1. 检查配额是否足够
   * 2. 执行操作
   * 3. 记录使用量
   *
   * @param userId - 用户 ID
   * @param blueprint - 蓝图实例
   * @param operation - 要执行的操作
   * @param options - 可选配置
   * @returns 执行结果
   */
  async executeWithQuota<T>(
    userId: string,
    blueprint: EnhancedBlueprintEngine<StructuredOutput>,
    operation: () => Promise<T>,
    options?: {
      /** 资源 ID（如报告 ID） */
      resourceId?: string;
      /** 额外元数据 */
      metadata?: Record<string, unknown>;
    },
  ): Promise<ExecutionResult<T>> {
    // 1. 配额检查
    if (this.config.enableQuotaCheck) {
      const quotaCheck = await this.checkQuota(userId, blueprint);

      if (!quotaCheck.hasQuota) {
        logger.warn(
          {
            userId,
            blueprintId: blueprint.blueprintId,
            remaining: quotaCheck.remaining,
            creditsCost: quotaCheck.creditsCost,
          },
          "Quota exceeded for enhanced blueprint",
        );

        return {
          success: false,
          error: {
            code: "QUOTA_EXCEEDED",
            message: quotaCheck.message ?? "配额不足",
            recoverable: false,
          },
          quotaInfo: quotaCheck,
        };
      }
    }

    // 2. 执行操作
    try {
      const result = await operation();

      // 3. 记录使用量（仅在成功时记录）
      await this.trackUsage(userId, blueprint, options);

      // 4. 获取更新后的配额信息
      const updatedQuota = await this.checkQuota(userId, blueprint);

      logger.info(
        {
          userId,
          blueprintId: blueprint.blueprintId,
          creditsCost: blueprint.creditsCost,
          remainingAfter: updatedQuota.remaining,
        },
        "Enhanced blueprint executed with quota",
      );

      return {
        success: true,
        data: result,
        quotaInfo: updatedQuota,
      };
    } catch (error) {
      logger.error(
        {
          userId,
          blueprintId: blueprint.blueprintId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Enhanced blueprint execution failed",
      );

      return {
        success: false,
        error: {
          code: "EXECUTION_FAILED",
          message: error instanceof Error ? error.message : "执行失败",
          recoverable: true,
        },
      };
    }
  }

  /**
   * 记录使用量
   *
   * @param userId - 用户 ID
   * @param blueprint - 蓝图实例
   * @param options - 可选配置
   */
  async trackUsage(
    userId: string,
    blueprint: EnhancedBlueprintEngine<StructuredOutput>,
    options?: {
      resourceId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const tracker = createUsageTracker();

    await tracker.trackUsage({
      userId,
      type: this.config.usageType,
      amount: blueprint.creditsCost, // 使用蓝图的 creditsCost
      unit: "credits",
      timestamp: new Date(),
      resourceId: options?.resourceId,
      metadata: {
        blueprintId: blueprint.blueprintId,
        blueprintName: blueprint.displayName,
        creditsCost: blueprint.creditsCost,
        tier: blueprint.tier,
        ...options?.metadata,
      },
    });
  }

  /**
   * 获取用户当月使用统计
   *
   * @param userId - 用户 ID
   * @returns 使用统计
   */
  async getMonthlyUsage(userId: string): Promise<{
    used: number;
    limit: number;
    remaining: number;
    membershipType: string;
    resetAt: Date;
  }> {
    const supabase = await createClient();

    // 获取会员类型
    const { data: profile } = await supabase
      .from("profiles")
      .select("membership_type")
      .eq("id", userId)
      .single<
        Pick<Database["public"]["Tables"]["profiles"]["Row"], "membership_type">
      >();

    const membershipType = profile?.membership_type?.toLowerCase() ?? "free";

    // Pro/Enterprise 无限制
    if (membershipType === "pro" || membershipType === "enterprise") {
      return {
        used: 0,
        limit: -1,
        remaining: 999999,
        membershipType,
        resetAt: this.getNextResetDate(),
      };
    }

    // Free 用户获取使用量
    const tracker = createUsageTracker();
    const quota = await tracker.checkQuota(userId, this.config.usageType);

    return {
      used: quota.limit - quota.remaining,
      limit: quota.limit,
      remaining: quota.remaining,
      membershipType,
      resetAt: this.getNextResetDate(),
    };
  }

  /**
   * 生成配额用尽提示消息
   */
  private getQuotaExhaustedMessage(
    remaining: number,
    required: number,
  ): string {
    if (remaining <= 0) {
      return "本月免费额度已用完，升级到专业版享受无限制使用";
    }
    return `本月剩余 ${remaining} 点配额，该蓝图需要 ${required} 点，请升级会员或等待下月重置`;
  }

  /**
   * 获取下次配额重置日期（下月1日）
   */
  private getNextResetDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建增强蓝图计费服务实例
 */
export function createEnhancedBlueprintBillingService(
  config?: Partial<EnhancedBlueprintBillingConfig>,
): EnhancedBlueprintBillingService {
  return new EnhancedBlueprintBillingService(config);
}

// ============================================================================
// 单例实例
// ============================================================================

let enhancedBlueprintBillingServiceInstance: EnhancedBlueprintBillingService | null =
  null;

/**
 * 获取增强蓝图计费服务单例
 */
export function getEnhancedBlueprintBillingService(): EnhancedBlueprintBillingService {
  if (!enhancedBlueprintBillingServiceInstance) {
    enhancedBlueprintBillingServiceInstance =
      new EnhancedBlueprintBillingService();
  }
  return enhancedBlueprintBillingServiceInstance;
}
