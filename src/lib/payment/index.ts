/**
 * Payment System - Module Entry Point
 * 支付系统模块入口
 */

// ============================================
// 类型导出
// ============================================
export type {
  // 基础类型
  PaymentProvider,
  Currency,
  PlanTier,
  SubscriptionStatus,
  PaymentStatus,
  OrderStatus,
  PaymentMethod,
  // 订阅相关
  SubscriptionPlan,
  UserSubscription,
  UserEntitlement,
  // 配额相关
  QuotaUsage,
  QuotaCheckResult,
  // 订单相关
  PaymentOrder,
  PaymentRecord,
  // Checkout
  CheckoutOptions,
  CheckoutResult,
  // Webhook
  WebhookEventType,
  WebhookEvent,
  WebhookProcessResult,
  // 试用期
  TrialResult,
  // 退款
  RefundReason,
  RefundStatus,
  RefundRequest,
  // 取消订阅
  CancelReason,
  CancelSubscriptionResult,
  // 定价
  PricingPlan,
  // API 响应
  PaymentApiResponse,
  // 数据库类型
  DbSubscriptionPlan,
  DbUserSubscription,
  DbUserEntitlement,
  DbQuotaUsage,
} from "./types";

// ============================================
// Feature Gates 导出
// ============================================
export {
  FEATURE_GATES,
  FEATURE_CATEGORIES,
  FEATURE_DISPLAY_NAMES,
  FEATURE_UNITS,
  isBooleanGate,
  getFeatureValue,
  hasFeatureAccess,
  getFeatureLimit,
  getRequiredPlan,
  getUpgradeFeatures,
} from "./feature-gates";
export type { FeatureKey } from "./feature-gates";

// ============================================
// 配置导出
// ============================================
export {
  PAYMENT_CONFIG,
  PRICING,
  QUOTA_CONFIG,
  TRIAL_CONFIG,
  GRACE_PERIOD,
  REFUND_CONFIG,
  ORDER_CONFIG,
  getPrice,
  formatPrice,
  getQuotaConfig,
  getCurrentBillingMonth,
  isPaidTier,
  getPlanDisplayName,
  detectDefaultCurrency,
} from "./config";

// ============================================
// 错误类导出
// ============================================
export {
  PaymentError,
  QuotaExceededError,
  UpgradeRequiredError,
  InvalidSubscriptionError,
  PaymentFailedError,
  WebhookError,
  WebhookSignatureError,
  OrderExpiredError,
  RefundDeniedError,
  TrialAlreadyUsedError,
  DuplicateSubscriptionError,
  LTDSoldOutError,
  PaymentErrorCodes,
  isPaymentError,
  isQuotaExceededError,
  isUpgradeRequiredError,
} from "./errors";

// ============================================
// 服务导出 (待实现)
// ============================================
// export { subscriptionService } from './services/subscription.service';
// export { quotaService } from './services/quota.service';
// export { webhookService } from './services/webhook.service';
// export { orderService } from './services/order.service';
// export { trialService } from './services/trial.service';

// ============================================
// Hooks 导出 (待实现)
// ============================================
// export { useSubscription } from './hooks/use-subscription';
// export { useQuota } from './hooks/use-quota';
// export { useFeatureGate } from './hooks/use-feature-gate';
// export { usePricing } from './hooks/use-pricing';
// export { useEntitlement } from './hooks/use-entitlement';
