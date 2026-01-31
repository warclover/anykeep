/**
 * Payment System - Type Definitions
 * 支付系统核心类型定义
 */

// ============================================
// 基础枚举类型
// ============================================

export type PaymentProvider = "lemonsqueezy" | "yungouos";
export type Currency = "CNY" | "USD";
export type PlanTier = "free" | "pro" | "pro_plus" | "lifetime";

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "expired"
  | "past_due"
  | "refunded"
  | "trialing";

export type PaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type OrderStatus = "pending" | "paid" | "expired" | "refunded";

export type PaymentMethod =
  | "wechat"
  | "alipay"
  | "card"
  | "paypal"
  | "apple_pay";

// ============================================
// 订阅计划
// ============================================

export interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  priceCny: number; // 价格（分）
  priceUsd: number; // 美元价格（分）
  interval: "month" | "year" | "lifetime";
  intervalCount: number;
  aiQuota: number; // -1 表示无限
  storageQuotaMb: number;
  features: string[];
  isActive: boolean;
  sortOrder: number;
}

// ============================================
// 用户订阅
// ============================================

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  paymentProvider: PaymentProvider;
  providerSubscriptionId?: string;
  providerCustomerId?: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  gracePeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  cancellationReason?: string;
  plan?: SubscriptionPlan;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 用户权益（高频查询缓存）
// ============================================

export interface UserEntitlement {
  userId: string;
  planTier: PlanTier;
  validUntil?: Date;
  aiQuotaMonthly: number;
  aiQuotaDailyLimit: number;
  storageLimitMb: number;
  ttsSecondsMonthly: number;
  isLifetime: boolean;
  // 试用期
  trialStartedAt?: Date;
  trialEndsAt?: Date;
  trialUsed: boolean;
  trialConverted: boolean;
  // 退款追踪
  refundCount: number;
  lastRefundedAt?: Date;
  refundReason?: string;
}

// ============================================
// 配额使用
// ============================================

export interface QuotaUsage {
  aiCallsUsed: number;
  aiCallsLimit: number;
  aiCallsToday: number;
  aiCallsDailyLimit: number;
  storageUsedMb: number;
  storageLimitMb: number;
  ttsSecondsUsed: number;
  ttsSecondsLimit: number;
  synthesisCount: number;
  synthesisLimit: number;
  isOverLimit: boolean;
  isOverDailyLimit: boolean;
}

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  reason?: string;
  upgradeRequired?: boolean;
}

// ============================================
// 支付订单（国内支付）
// ============================================

export interface PaymentOrder {
  id: string;
  orderNo: string;
  userId: string;
  planId: string;
  amount: number; // 金额（分）
  currency: Currency;
  status: OrderStatus;
  paymentProvider: PaymentProvider;
  paymentMethod?: PaymentMethod;
  paidAt?: Date;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// ============================================
// 支付记录
// ============================================

export interface PaymentRecord {
  id: string;
  userId: string;
  subscriptionId?: string;
  paymentProvider: PaymentProvider;
  providerPaymentId: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  refundAmount: number;
  refundReason?: string;
  paymentMethod?: PaymentMethod;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// ============================================
// Checkout 流程
// ============================================

export interface CheckoutOptions {
  userId: string;
  planId: string;
  email: string;
  currency: Currency;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, unknown>;
}

export interface CheckoutResult {
  checkoutUrl: string;
  sessionId?: string;
  orderId?: string;
  qrCodeUrl?: string; // 国内支付二维码
  expiresAt?: Date;
}

// ============================================
// Webhook 事件
// ============================================

export type WebhookEventType =
  | "subscription.created"
  | "subscription.updated"
  | "subscription.canceled"
  | "subscription.expired"
  | "payment.succeeded"
  | "payment.failed"
  | "payment.refunded";

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  provider: PaymentProvider;
  data: Record<string, unknown>;
  receivedAt: Date;
}

export interface WebhookProcessResult {
  success: boolean;
  eventId: string;
  action?: string;
  error?: string;
}

// ============================================
// 试用期
// ============================================

export interface TrialResult {
  success: boolean;
  trialEndsAt?: Date;
  reason?: "TRIAL_ALREADY_USED" | "USER_NOT_FOUND";
}

// ============================================
// 退款
// ============================================

export type RefundReason =
  | "not_as_expected"
  | "too_expensive"
  | "found_alternative"
  | "rarely_use"
  | "technical_issues"
  | "accidental_purchase"
  | "other";

export type RefundStatus = "pending" | "approved" | "rejected" | "refunded";

export interface RefundRequest {
  id: string;
  userId: string;
  subscriptionId?: string;
  reason: RefundReason;
  reasonDetail?: string;
  originalAmount: number;
  refundAmount?: number;
  aiUsageCount: number;
  usagePercentage: number;
  status: RefundStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 取消订阅
// ============================================

export type CancelReason =
  | "too_expensive"
  | "not_using_enough"
  | "missing_features"
  | "found_alternative"
  | "technical_issues"
  | "temporary_pause"
  | "other";

export interface CancelSubscriptionResult {
  success: boolean;
  canceledAt?: Date;
  effectiveAt?: Date; // 生效时间（当期结束）
  error?: string;
}

// ============================================
// 定价展示
// ============================================

export interface PricingPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: number; // 当前货币价格（分）
  originalPrice?: number; // 原价（用于显示折扣）
  currency: Currency;
  interval: "month" | "year" | "lifetime";
  features: string[];
  highlighted?: boolean; // 推荐套餐高亮
  badge?: string; // 徽章文字，如 "最受欢迎"
  aiQuota: number;
  storageQuotaMb: number;
}

// ============================================
// API 响应
// ============================================

export interface PaymentApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================
// 数据库行类型（与 Supabase 生成类型对应）
// ============================================

export interface DbSubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  price_cny: number;
  price_usd: number;
  interval: string;
  interval_count: number;
  ai_quota: number;
  storage_quota_mb: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DbUserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  payment_provider: string;
  provider_subscription_id: string | null;
  provider_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  grace_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  cancellation_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbUserEntitlement {
  user_id: string;
  plan_tier: string;
  valid_until: string | null;
  ai_quota_monthly: number;
  ai_quota_daily_limit: number;
  storage_limit_mb: number;
  tts_seconds_monthly: number;
  is_lifetime: boolean;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_used: boolean;
  trial_converted: boolean;
  refund_count: number;
  last_refunded_at: string | null;
  refund_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbQuotaUsage {
  id: string;
  user_id: string;
  month: string;
  ai_calls_used: number;
  ai_calls_today: number;
  last_call_date: string | null;
  storage_used_mb: number;
  tts_seconds_used: number;
  synthesis_count: number;
  created_at: string;
  updated_at: string;
}
