/**
 * Knowledge Studio - 账单服务
 * @module knowledge-studio/billing
 * @description Phase 3 存根 - 账单管理与消费明细
 * @version 0.1.0 (Stub)
 * @since 2025-01-02
 *
 * TODO Phase 3: 完整实现
 * - 账单生成
 * - 消费记录持久化
 * - 费用计算引擎
 * - 对账功能
 */

import { logger } from "@/lib/logger";
import type {
  IBillingService,
  Bill,
  BillingStatus,
  ConsumptionSummary,
  ConsumptionRecord,
  UsageType,
} from "./types";

// ============================================================================
// 存根实现
// ============================================================================

/**
 * 账单服务（Phase 3 存根）
 *
 * @example
 * ```typescript
 * const billing = new BillingServiceStub();
 *
 * // 获取账单列表
 * const bills = await billing.getBills('user-123');
 *
 * // 获取消费汇总
 * const summary = await billing.getConsumptionSummary(
 *   'user-123',
 *   startOfMonth,
 *   endOfMonth,
 * );
 * console.log(`本月消费: ¥${summary.totalCost / 100}`);
 * ```
 */
export class BillingServiceStub implements IBillingService {
  /**
   * 获取账单列表
   * @stub 返回空数组，Phase 3 实现账单查询
   */
  async getBills(
    userId: string,
    options?: {
      status?: BillingStatus;
      limit?: number;
    },
  ): Promise<Bill[]> {
    logger.info(
      `[BillingService] getBills(${userId}) - Phase 3 存根, options: ${JSON.stringify(options)}`,
    );
    return [];
  }

  /**
   * 获取账单详情
   * @stub 返回 null，Phase 3 实现详情查询
   */
  async getBill(billId: string): Promise<Bill | null> {
    logger.info(`[BillingService] getBill(${billId}) - Phase 3 存根`);
    return null;
  }

  /**
   * 获取消费汇总
   * @stub 返回空汇总，Phase 3 实现聚合统计
   */
  async getConsumptionSummary(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ConsumptionSummary> {
    logger.info(
      `[BillingService] getConsumptionSummary(${userId}) - Phase 3 存根`,
    );

    const emptyByType: Record<UsageType, { amount: number; cost: number }> = {
      generation: { amount: 0, cost: 0 },
      chat_edit: { amount: 0, cost: 0 },
      ai_recommendation: { amount: 0, cost: 0 },
      export: { amount: 0, cost: 0 },
      storage: { amount: 0, cost: 0 },
    };

    return {
      userId,
      period: { start: startDate, end: endDate },
      consumptionByType: emptyByType,
      totalAmount: 0,
      totalCost: 0,
      dailyAverage: 0,
      trend: "stable",
      trendPercent: 0,
    };
  }

  /**
   * 获取消费明细
   * @stub 返回空数组，Phase 3 实现明细查询
   */
  async getConsumptionRecords(
    userId: string,
    options?: {
      type?: UsageType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    },
  ): Promise<ConsumptionRecord[]> {
    logger.info(
      `[BillingService] getConsumptionRecords(${userId}) - Phase 3 存根, options: ${JSON.stringify(options)}`,
    );
    return [];
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建账单服务实例
 * @stub Phase 3 实现完整服务
 */
export function createBillingService(): IBillingService {
  return new BillingServiceStub();
}
