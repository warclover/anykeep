/**
 * Knowledge Studio - 账单与使用统计模块
 * @module knowledge-studio/billing
 * @description Phase 3 存根 - 账单明细、使用统计、消费记录
 * @version 0.1.0 (Stub)
 * @since 2025-01-02
 */

// 类型导出
export type {
  // 使用量类型
  UsageType,
  UsagePeriod,
  UsageRecord,
  UsageStatistics,
  // 账单类型
  BillingStatus,
  BillingLineItem,
  Bill,
  // 消费类型
  ConsumptionRecord,
  ConsumptionSummary,
  // 服务接口
  IUsageTracker,
  IBillingService,
} from "./types";

// 服务导出
export { UsageTrackerStub, createUsageTracker } from "./usage-tracker";
export { BillingServiceStub, createBillingService } from "./billing-service";
