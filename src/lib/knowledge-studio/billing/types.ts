/**
 * Knowledge Studio - 账单与使用统计类型定义
 * @module knowledge-studio/billing
 * @description Phase 3 存根 - 账单明细、使用统计、消费记录
 * @version 0.1.0 (Stub)
 * @since 2025-01-02
 *
 * TODO Phase 3: 完整实现
 * - 使用量追踪
 * - 账单生成
 * - 消费明细
 * - 费用计算
 */

// ============================================================================
// 使用量类型
// ============================================================================

/**
 * 使用量类型
 */
export type UsageType =
  | "generation" // 蓝图生成
  | "chat_edit" // Chat-to-Edit
  | "ai_recommendation" // AI 推荐
  | "export" // 导出
  | "storage"; // 存储

/**
 * 使用量周期
 */
export type UsagePeriod = "daily" | "weekly" | "monthly" | "yearly";

/**
 * 使用量记录
 */
export interface UsageRecord {
  /** 记录 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 使用类型 */
  type: UsageType;
  /** 使用量 */
  amount: number;
  /** 单位 */
  unit: string;
  /** 使用时间 */
  timestamp: Date;
  /** 关联资源 ID */
  resourceId?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 使用量统计
 */
export interface UsageStatistics {
  /** 用户 ID */
  userId: string;
  /** 统计周期 */
  period: UsagePeriod;
  /** 周期开始时间 */
  periodStart: Date;
  /** 周期结束时间 */
  periodEnd: Date;
  /** 各类型使用量 */
  usageByType: Record<UsageType, number>;
  /** 总使用量 */
  totalUsage: number;
  /** 配额限制 */
  quotaLimit: number;
  /** 配额使用率 */
  usageRate: number;
}

// ============================================================================
// 账单类型
// ============================================================================

/**
 * 账单状态
 */
export type BillingStatus =
  | "pending" // 待支付
  | "paid" // 已支付
  | "overdue" // 逾期
  | "cancelled" // 已取消
  | "refunded"; // 已退款

/**
 * 账单项目
 */
export interface BillingLineItem {
  /** 项目 ID */
  id: string;
  /** 描述 */
  description: string;
  /** 使用类型 */
  usageType: UsageType;
  /** 数量 */
  quantity: number;
  /** 单价 (分) */
  unitPrice: number;
  /** 总价 (分) */
  totalPrice: number;
  /** 折扣 (分) */
  discount?: number;
}

/**
 * 账单
 */
export interface Bill {
  /** 账单 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 账单周期 */
  period: {
    start: Date;
    end: Date;
  };
  /** 账单项目 */
  lineItems: BillingLineItem[];
  /** 小计 (分) */
  subtotal: number;
  /** 折扣 (分) */
  discount: number;
  /** 税费 (分) */
  tax: number;
  /** 总计 (分) */
  total: number;
  /** 货币 */
  currency: string;
  /** 状态 */
  status: BillingStatus;
  /** 创建时间 */
  createdAt: Date;
  /** 支付时间 */
  paidAt?: Date;
  /** 到期时间 */
  dueAt: Date;
}

// ============================================================================
// 消费明细
// ============================================================================

/**
 * 消费记录
 */
export interface ConsumptionRecord {
  /** 记录 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 消费时间 */
  timestamp: Date;
  /** 消费类型 */
  type: UsageType;
  /** 消费描述 */
  description: string;
  /** 消费量 */
  amount: number;
  /** 消费金额 (分) */
  cost: number;
  /** 关联报告 ID */
  reportId?: string;
  /** 关联蓝图类型 */
  blueprintType?: string;
}

/**
 * 消费汇总
 */
export interface ConsumptionSummary {
  /** 用户 ID */
  userId: string;
  /** 统计周期 */
  period: {
    start: Date;
    end: Date;
  };
  /** 各类型消费 */
  consumptionByType: Record<UsageType, { amount: number; cost: number }>;
  /** 总消费量 */
  totalAmount: number;
  /** 总消费金额 (分) */
  totalCost: number;
  /** 日均消费 */
  dailyAverage: number;
  /** 趋势 (相比上期) */
  trend: "up" | "down" | "stable";
  /** 趋势百分比 */
  trendPercent: number;
}

// ============================================================================
// 服务接口 (Phase 3 存根)
// ============================================================================

/**
 * 使用量追踪服务接口
 * @stub Phase 3 实现
 */
export interface IUsageTracker {
  /** 记录使用量 */
  trackUsage(record: Omit<UsageRecord, "id">): Promise<void>;
  /** 获取使用统计 */
  getStatistics(userId: string, period: UsagePeriod): Promise<UsageStatistics>;
  /** 获取使用历史 */
  getHistory(
    userId: string,
    options?: {
      type?: UsageType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    },
  ): Promise<UsageRecord[]>;
  /** 检查配额 */
  checkQuota(
    userId: string,
    type: UsageType,
  ): Promise<{
    remaining: number;
    limit: number;
    isExceeded: boolean;
  }>;
}

/**
 * 账单服务接口
 * @stub Phase 3 实现
 */
export interface IBillingService {
  /** 获取账单列表 */
  getBills(
    userId: string,
    options?: {
      status?: BillingStatus;
      limit?: number;
    },
  ): Promise<Bill[]>;
  /** 获取账单详情 */
  getBill(billId: string): Promise<Bill | null>;
  /** 获取消费汇总 */
  getConsumptionSummary(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ConsumptionSummary>;
  /** 获取消费明细 */
  getConsumptionRecords(
    userId: string,
    options?: {
      type?: UsageType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    },
  ): Promise<ConsumptionRecord[]>;
}
