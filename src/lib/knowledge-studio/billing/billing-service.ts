/**
 * Knowledge Studio - 账单服务
 * @module knowledge-studio/billing
 * @description P4 实现 - 账单管理与消费明细
 * @version 1.0.0
 * @since 2026-01-02
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  IBillingService,
  Bill,
  BillingStatus,
  BillingLineItem,
  ConsumptionSummary,
  ConsumptionRecord,
  UsageType,
} from "./types";

// ============================================================================
// 价格配置（分）
// ============================================================================

/** 使用类型单价配置 */
export const USAGE_UNIT_PRICES: Record<UsageType, number> = {
  generation: 0, // Pro 包含，免费用户限制次数
  chat_edit: 50, // ¥0.5/次
  ai_recommendation: 0,
  export: 0,
  storage: 10, // ¥0.1/MB/月
};

/** 使用类型描述 */
const USAGE_TYPE_DESCRIPTIONS: Record<UsageType, string> = {
  generation: "蓝图生成",
  chat_edit: "聊天式修改",
  ai_recommendation: "AI 推荐",
  export: "内容导出",
  storage: "存储空间",
};

// ============================================================================
// 账单服务实现
// ============================================================================

/**
 * 账单服务
 *
 * @example
 * ```typescript
 * const billing = new BillingService();
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
export class BillingService implements IBillingService {
  /**
   * 获取账单列表
   */
  async getBills(
    userId: string,
    options?: {
      status?: BillingStatus;
      limit?: number;
    },
  ): Promise<Bill[]> {
    const supabase = await createClient();

    let query = supabase
      .from("ks_bills")
      .select(
        `
        *,
        line_items:ks_bill_line_items(*)
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (options?.status) {
      query = query.eq("status", options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error: error.message }, "Failed to get bills");
      throw new Error(`获取账单列表失败: ${error.message}`);
    }

    return (data ?? []).map((row) => this.mapBillFromRow(row));
  }

  /**
   * 获取账单详情
   * @param billId 账单 ID
   * @param userId 用户 ID（用于所有权验证）
   */
  async getBill(billId: string, userId: string): Promise<Bill | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ks_bills")
      .select(
        `
        *,
        line_items:ks_bill_line_items(*)
      `,
      )
      .eq("id", billId)
      .eq("user_id", userId) // 添加用户所有权验证
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error({ error: error.message }, "Failed to get bill");
      throw new Error(`获取账单详情失败: ${error.message}`);
    }

    return this.mapBillFromRow(data);
  }

  /**
   * 获取消费汇总
   */
  async getConsumptionSummary(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ConsumptionSummary> {
    const supabase = await createClient();

    // 调用 RPC 函数
    const { data, error } = await supabase.rpc("get_consumption_summary", {
      p_user_id: userId,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
    });

    if (error) {
      logger.error(
        { error: error.message },
        "Failed to get consumption summary",
      );
      throw new Error(`获取消费汇总失败: ${error.message}`);
    }

    // 确保所有类型都有值
    const consumptionByType: Record<
      UsageType,
      { amount: number; cost: number }
    > = {
      generation: { amount: 0, cost: 0 },
      chat_edit: { amount: 0, cost: 0 },
      ai_recommendation: { amount: 0, cost: 0 },
      export: { amount: 0, cost: 0 },
      storage: { amount: 0, cost: 0 },
    };

    // 合并 RPC 返回的数据
    if (data?.consumptionByType) {
      for (const [key, value] of Object.entries(data.consumptionByType)) {
        if (key in consumptionByType) {
          consumptionByType[key as UsageType] = value as {
            amount: number;
            cost: number;
          };
        }
      }
    }

    return {
      userId,
      period: {
        start: startDate,
        end: endDate,
      },
      consumptionByType,
      totalAmount: data?.totalAmount ?? 0,
      totalCost: data?.totalCost ?? 0,
      dailyAverage: Math.round(data?.dailyAverage ?? 0),
      trend: (data?.trend as "up" | "down" | "stable") ?? "stable",
      trendPercent: data?.trendPercent ?? 0,
    };
  }

  /**
   * 获取消费明细
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
    const supabase = await createClient();

    let query = supabase
      .from("ks_consumption_records")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (options?.type) {
      query = query.eq("usage_type", options.type);
    }

    if (options?.startDate) {
      query = query.gte("created_at", options.startDate.toISOString());
    }

    if (options?.endDate) {
      query = query.lte("created_at", options.endDate.toISOString());
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error(
        { error: error.message },
        "Failed to get consumption records",
      );
      throw new Error(`获取消费明细失败: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      timestamp: new Date(row.created_at),
      type: row.usage_type as UsageType,
      description: row.description,
      amount: row.amount,
      cost: row.cost,
      reportId: row.report_id,
      blueprintType: row.blueprint_type,
    }));
  }

  /**
   * 记录消费（内部使用）
   */
  async recordConsumption(
    userId: string,
    type: UsageType,
    amount: number,
    options?: {
      reportId?: string;
      blueprintType?: string;
      description?: string;
    },
  ): Promise<void> {
    const supabase = await createClient();

    const unitPrice = USAGE_UNIT_PRICES[type];
    const cost = unitPrice * amount;
    const description =
      options?.description ?? `${USAGE_TYPE_DESCRIPTIONS[type]} x ${amount}`;

    const { error } = await supabase.from("ks_consumption_records").insert({
      user_id: userId,
      usage_type: type,
      description,
      amount,
      cost,
      report_id: options?.reportId,
      blueprint_type: options?.blueprintType,
    });

    if (error) {
      logger.error({ error: error.message }, "Failed to record consumption");
      throw new Error(`记录消费失败: ${error.message}`);
    }

    logger.info({ userId, type, amount, cost }, "Consumption recorded");
  }

  /**
   * 映射数据库行到 Bill 对象
   */
  private mapBillFromRow(row: Record<string, unknown>): Bill {
    const lineItems: BillingLineItem[] = (
      (row.line_items as unknown[]) ?? []
    ).map((item: Record<string, unknown>) => ({
      id: item.id as string,
      description: item.description as string,
      usageType: item.usage_type as UsageType,
      quantity: item.quantity as number,
      unitPrice: item.unit_price as number,
      totalPrice: item.total_price as number,
      discount: (item.discount as number) ?? 0,
    }));

    return {
      id: row.id as string,
      userId: row.user_id as string,
      period: {
        start: new Date(row.period_start as string),
        end: new Date(row.period_end as string),
      },
      lineItems,
      subtotal: row.subtotal as number,
      discount: row.discount as number,
      tax: row.tax as number,
      total: row.total as number,
      currency: row.currency as string,
      status: row.status as BillingStatus,
      createdAt: new Date(row.created_at as string),
      paidAt: row.paid_at ? new Date(row.paid_at as string) : undefined,
      dueAt: new Date(row.due_at as string),
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建账单服务实例
 */
export function createBillingService(): IBillingService {
  return new BillingService();
}
