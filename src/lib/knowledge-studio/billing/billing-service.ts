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
import { parseConsumptionSummaryRpc } from "./types";
import type { Database } from "@/types/supabase";

// ============================================================================
// 数据库类型别名（使用 Database 类型）
// ============================================================================

type BillRow = Database["public"]["Tables"]["ks_bills"]["Row"];
type BillLineItemRow =
  Database["public"]["Tables"]["ks_bill_line_items"]["Row"];
type ConsumptionRecordRow =
  Database["public"]["Tables"]["ks_consumption_records"]["Row"];
type ConsumptionRecordInsert =
  Database["public"]["Tables"]["ks_consumption_records"]["Insert"];

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
  generation: "模板生成",
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

    // 类型断言处理嵌套关联查询结果
    type BillWithLineItems = BillRow & { line_items: BillLineItemRow[] };
    const typedData = data as unknown as BillWithLineItems[] | null;

    return (typedData ?? []).map((row) => this.mapBillFromRow(row));
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
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error({ error: error.message }, "Failed to get bill");
      throw new Error(`获取账单详情失败: ${error.message}`);
    }

    // 类型断言处理嵌套关联查询结果
    type BillWithLineItems = BillRow & { line_items: BillLineItemRow[] };
    const typedData = data as unknown as BillWithLineItems | null;

    return typedData ? this.mapBillFromRow(typedData) : null;
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

    // 使用 Zod 验证 RPC 返回值
    const summaryData = parseConsumptionSummaryRpc(
      data,
      `consumption_summary:${userId}`,
    );

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
    if (summaryData.consumptionByType) {
      for (const [key, value] of Object.entries(
        summaryData.consumptionByType,
      )) {
        if (key in consumptionByType && value) {
          consumptionByType[key as UsageType] = {
            amount: value.amount,
            cost: value.cost,
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
      totalAmount: summaryData.totalAmount ?? 0,
      totalCost: summaryData.totalCost ?? 0,
      dailyAverage: Math.round(summaryData.dailyAverage ?? 0),
      trend: summaryData.trend ?? "stable",
      trendPercent: summaryData.trendPercent ?? 0,
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

    const typedData = data as ConsumptionRecordRow[] | null;

    return (typedData ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      timestamp: new Date(row.created_at),
      type: row.usage_type as UsageType,
      description: row.description,
      amount: row.amount,
      cost: row.cost,
      reportId: row.report_id ?? undefined,
      blueprintType: row.blueprint_type ?? undefined,
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

    const recordInsertData: ConsumptionRecordInsert = {
      user_id: userId,
      usage_type: type,
      description,
      amount,
      cost,
      report_id: options?.reportId ?? null,
      blueprint_type: options?.blueprintType ?? null,
    };

    const { error } = await supabase
      .from("ks_consumption_records")
      .insert(recordInsertData);

    if (error) {
      logger.error({ error: error.message }, "Failed to record consumption");
      throw new Error(`记录消费失败: ${error.message}`);
    }

    logger.info({ userId, type, amount, cost }, "Consumption recorded");
  }

  /**
   * 映射数据库行到 Bill 对象
   */
  private mapBillFromRow(
    row: BillRow & { line_items?: BillLineItemRow[] },
  ): Bill {
    const lineItems: BillingLineItem[] = (row.line_items ?? []).map((item) => ({
      id: item.id,
      description: item.description,
      usageType: item.usage_type as UsageType,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      totalPrice: item.total_price,
      discount: item.discount ?? 0,
    }));

    return {
      id: row.id,
      userId: row.user_id,
      period: {
        start: new Date(row.period_start),
        end: new Date(row.period_end),
      },
      lineItems,
      subtotal: row.subtotal,
      discount: row.discount,
      tax: row.tax,
      total: row.total,
      currency: row.currency,
      status: row.status as BillingStatus,
      createdAt: new Date(row.created_at),
      paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
      dueAt: new Date(row.due_at),
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
