/**
 * Payment System - Configuration Constants
 * 支付系统配置常量
 */

import type { Currency, PlanTier } from "./types";

// ============================================
// 环境变量
// ============================================

export const PAYMENT_CONFIG = {
  // Lemon Squeezy (国际支付)
  lemonsqueezy: {
    apiKey: process.env.LEMONSQUEEZY_API_KEY || "",
    storeId: process.env.LEMONSQUEEZY_STORE_ID || "",
    webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "",
    variants: {
      pro: process.env.LEMONSQUEEZY_VARIANT_PRO || "",
      pro_plus: process.env.LEMONSQUEEZY_VARIANT_PRO_PLUS || "",
      lifetime: process.env.LEMONSQUEEZY_VARIANT_LIFETIME || "",
    },
  },

  // YunGouOS (国内支付)
  yungouos: {
    mchId: process.env.YUNGOUOS_MCH_ID || "",
    apiKey: process.env.YUNGOUOS_API_KEY || "",
    webhookSecret: process.env.YUNGOUOS_WEBHOOK_SECRET || "",
  },

  // 应用配置
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL || "https://anykeep.app",
    billingTimezone:
      process.env.NEXT_PUBLIC_BILLING_TIMEZONE || "Asia/Shanghai",
  },
} as const;

// ============================================
// 定价配置（硬编码，避免汇率波动）
// 注意：价格单位为「分」
// ============================================

export const PRICING = {
  // Pro 套餐
  pro: {
    monthly: { cny: 1200, usd: 199 }, // ¥12/月, $1.99/月
    yearly: { cny: 9900, usd: 1499 }, // ¥99/年, $14.99/年
  },

  // Pro+ 套餐
  pro_plus: {
    monthly: { cny: 2200, usd: 399 }, // ¥22/月, $3.99/月
    yearly: { cny: 19900, usd: 2999 }, // ¥199/年, $29.99/年
  },

  // 终身版 (限量 100 份)
  lifetime: {
    price: { cny: 49900, usd: 6999 }, // ¥499, $69.99
    limit: 100,
  },

  // AI 加油包
  ai_booster: {
    price: { cny: 1900, usd: 299 }, // ¥19, $2.99
    calls: 1000, // 1000 次
  },
} as const;

// ============================================
// 配额配置
// ============================================

export const QUOTA_CONFIG = {
  free: {
    aiMonthly: 20,
    aiDaily: 50,
    storageMb: 100,
    bookmarks: 500,
    ttsHours: 0,
    synthesisMonthly: 0,
  },
  pro: {
    aiMonthly: 500,
    aiDaily: 100,
    storageMb: 5120, // 5 GB
    bookmarks: 5000,
    ttsHours: 10,
    synthesisMonthly: 10,
  },
  pro_plus: {
    aiMonthly: 3000,
    aiDaily: 200,
    storageMb: 20480, // 20 GB
    bookmarks: -1, // 无限
    ttsHours: 50,
    synthesisMonthly: -1, // 无限
  },
  lifetime: {
    aiMonthly: 500, // 与 Pro 同级（LTD 风控）
    aiDaily: 100,
    storageMb: 20480, // 与 Pro+ 同级
    bookmarks: -1,
    ttsHours: 10,
    synthesisMonthly: 10,
  },
} as const;

// ============================================
// 试用期配置
// ============================================

export const TRIAL_CONFIG = {
  durationDays: 7,
  trialTier: "pro" as PlanTier,
  features: [
    "主题合成器",
    "知识工作室",
    "TTS 语音朗读",
    "智能管理员",
    "500 次 AI 配额",
  ],
} as const;

// ============================================
// 宽限期配置
// ============================================

export const GRACE_PERIOD = {
  daysAfterExpiry: 7, // 过期后宽限期天数
  daysBeforeReminder: [7, 3, 1], // 到期前提醒天数
} as const;

// ============================================
// 退款配置
// ============================================

export const REFUND_CONFIG = {
  refundWindowDays: 7, // 退款窗口期（天）
  aiUsageThreshold: 0.2, // AI 使用超过 20% 扣除成本
  aiCostPerCall: 5, // 每次 AI 调用成本（分）
  maxRefundCount: 2, // 允许的最大退款次���
  blacklistThreshold: 3, // 退款次数达此值进入黑名单
} as const;

// ============================================
// 订单配置
// ============================================

export const ORDER_CONFIG = {
  expiryMinutes: 30, // 订单过期时间（分钟）
  pollIntervalMs: 1000, // 轮询间隔（毫秒）
  maxPollAttempts: 30, // 最大轮询次数
} as const;

// ============================================
// 辅助函数
// ============================================

/**
 * 获取价格（分）
 */
export function getPrice(
  tier: Exclude<PlanTier, "free">,
  interval: "monthly" | "yearly" | "lifetime",
  currency: Currency,
): number {
  if (tier === "lifetime") {
    return PRICING.lifetime.price[currency.toLowerCase() as "cny" | "usd"];
  }

  const tierPricing = PRICING[tier];
  if (interval === "lifetime") {
    throw new Error(`Invalid interval for tier: ${tier}`);
  }

  return tierPricing[interval][currency.toLowerCase() as "cny" | "usd"];
}

/**
 * 格式化价格显示
 */
export function formatPrice(amount: number, currency: Currency): string {
  const value = amount / 100;
  if (currency === "CNY") {
    return `¥${value.toFixed(2)}`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * 获取配额配置
 */
export function getQuotaConfig(tier: PlanTier) {
  return QUOTA_CONFIG[tier];
}

/**
 * 获取当前计费月份（北京时间）
 */
export function getCurrentBillingMonth(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PAYMENT_CONFIG.app.billingTimezone,
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7); // "2026-01"
}

/**
 * 检查是否为付费套餐
 */
export function isPaidTier(tier: PlanTier): boolean {
  return tier !== "free";
}

/**
 * 获取套餐显示名称
 */
export function getPlanDisplayName(tier: PlanTier): string {
  const names: Record<PlanTier, string> = {
    free: "免费版",
    pro: "Pro",
    pro_plus: "Pro+",
    lifetime: "终身版",
  };
  return names[tier];
}

/**
 * 根据浏览器环境推断默认货币
 */
export function detectDefaultCurrency(): Currency {
  if (typeof window === "undefined") {
    return "CNY";
  }

  const isChina =
    navigator.language.startsWith("zh") ||
    Intl.DateTimeFormat().resolvedOptions().timeZone.includes("Shanghai") ||
    Intl.DateTimeFormat().resolvedOptions().timeZone.includes("Beijing");

  return isChina ? "CNY" : "USD";
}
