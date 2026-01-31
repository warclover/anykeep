/**
 * Payment System - Custom Error Classes
 * 支付系统自定义错误类
 */

/**
 * 支付系统基础错误
 */
export class PaymentError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode: number = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // 保持正确的原型链
    Object.setPrototypeOf(this, PaymentError.prototype);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

/**
 * 配额超限错误
 */
export class QuotaExceededError extends PaymentError {
  public readonly quotaType: string;
  public readonly used: number;
  public readonly limit: number;

  constructor(
    quotaType: string,
    used: number,
    limit: number,
    message?: string,
  ) {
    super("QUOTA_EXCEEDED", message || `${quotaType} 配额已用完`, 429, {
      quotaType,
      used,
      limit,
    });
    this.name = "QuotaExceededError";
    this.quotaType = quotaType;
    this.used = used;
    this.limit = limit;

    Object.setPrototypeOf(this, QuotaExceededError.prototype);
  }
}

/**
 * 功能需要升级错误
 */
export class UpgradeRequiredError extends PaymentError {
  public readonly feature: string;
  public readonly requiredPlan: string;
  public readonly currentPlan: string;

  constructor(
    feature: string,
    requiredPlan: string,
    currentPlan: string,
    message?: string,
  ) {
    super(
      "UPGRADE_REQUIRED",
      message || `此功能需要 ${requiredPlan} 套餐`,
      403,
      { feature, requiredPlan, currentPlan },
    );
    this.name = "UpgradeRequiredError";
    this.feature = feature;
    this.requiredPlan = requiredPlan;
    this.currentPlan = currentPlan;

    Object.setPrototypeOf(this, UpgradeRequiredError.prototype);
  }
}

/**
 * 订阅无效错误
 */
export class InvalidSubscriptionError extends PaymentError {
  public readonly subscriptionId?: string;
  public readonly reason: string;

  constructor(reason: string, subscriptionId?: string) {
    super("INVALID_SUBSCRIPTION", `订阅无效: ${reason}`, 403, {
      subscriptionId,
      reason,
    });
    this.name = "InvalidSubscriptionError";
    this.subscriptionId = subscriptionId;
    this.reason = reason;

    Object.setPrototypeOf(this, InvalidSubscriptionError.prototype);
  }
}

/**
 * 支付失败错误
 */
export class PaymentFailedError extends PaymentError {
  public readonly provider: string;
  public readonly providerError?: string;

  constructor(provider: string, providerError?: string) {
    super("PAYMENT_FAILED", "支付失败，请重试或选择其他支付方式", 402, {
      provider,
      providerError,
    });
    this.name = "PaymentFailedError";
    this.provider = provider;
    this.providerError = providerError;

    Object.setPrototypeOf(this, PaymentFailedError.prototype);
  }
}

/**
 * Webhook 处理错误
 */
export class WebhookError extends PaymentError {
  public readonly eventId?: string;
  public readonly eventType?: string;

  constructor(message: string, eventId?: string, eventType?: string) {
    super("WEBHOOK_ERROR", message, 500, { eventId, eventType });
    this.name = "WebhookError";
    this.eventId = eventId;
    this.eventType = eventType;

    Object.setPrototypeOf(this, WebhookError.prototype);
  }
}

/**
 * Webhook 签名验证错误
 */
export class WebhookSignatureError extends PaymentError {
  public readonly provider: string;

  constructor(provider: string) {
    super("WEBHOOK_SIGNATURE_INVALID", "Webhook 签名验证失败", 401, {
      provider,
    });
    this.name = "WebhookSignatureError";
    this.provider = provider;

    Object.setPrototypeOf(this, WebhookSignatureError.prototype);
  }
}

/**
 * 订单过期错误
 */
export class OrderExpiredError extends PaymentError {
  public readonly orderId: string;
  public readonly expiredAt: Date;

  constructor(orderId: string, expiredAt: Date) {
    super("ORDER_EXPIRED", "订单已过期，请重新下单", 410, {
      orderId,
      expiredAt: expiredAt.toISOString(),
    });
    this.name = "OrderExpiredError";
    this.orderId = orderId;
    this.expiredAt = expiredAt;

    Object.setPrototypeOf(this, OrderExpiredError.prototype);
  }
}

/**
 * 退款拒绝错误
 */
export class RefundDeniedError extends PaymentError {
  public readonly reason: string;

  constructor(reason: string) {
    super("REFUND_DENIED", `退款申请被拒绝: ${reason}`, 403, { reason });
    this.name = "RefundDeniedError";
    this.reason = reason;

    Object.setPrototypeOf(this, RefundDeniedError.prototype);
  }
}

/**
 * 试用期已使用错误
 */
export class TrialAlreadyUsedError extends PaymentError {
  constructor() {
    super("TRIAL_ALREADY_USED", "您已使用过免费试用，请直接订阅", 403);
    this.name = "TrialAlreadyUsedError";

    Object.setPrototypeOf(this, TrialAlreadyUsedError.prototype);
  }
}

/**
 * 重复订阅错误
 */
export class DuplicateSubscriptionError extends PaymentError {
  public readonly existingPlan: string;

  constructor(existingPlan: string) {
    super(
      "DUPLICATE_SUBSCRIPTION",
      "您已有有效订阅，请先取消现有订阅或等待到期",
      409,
      { existingPlan },
    );
    this.name = "DuplicateSubscriptionError";
    this.existingPlan = existingPlan;

    Object.setPrototypeOf(this, DuplicateSubscriptionError.prototype);
  }
}

/**
 * LTD 售罄错误
 */
export class LTDSoldOutError extends PaymentError {
  public readonly totalLimit: number;
  public readonly soldCount: number;

  constructor(totalLimit: number, soldCount: number) {
    super("LTD_SOLD_OUT", "终身版限量已售罄", 410, { totalLimit, soldCount });
    this.name = "LTDSoldOutError";
    this.totalLimit = totalLimit;
    this.soldCount = soldCount;

    Object.setPrototypeOf(this, LTDSoldOutError.prototype);
  }
}

// ============================================
// 错误码常量
// ============================================

export const PaymentErrorCodes = {
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  UPGRADE_REQUIRED: "UPGRADE_REQUIRED",
  INVALID_SUBSCRIPTION: "INVALID_SUBSCRIPTION",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  WEBHOOK_ERROR: "WEBHOOK_ERROR",
  WEBHOOK_SIGNATURE_INVALID: "WEBHOOK_SIGNATURE_INVALID",
  ORDER_EXPIRED: "ORDER_EXPIRED",
  REFUND_DENIED: "REFUND_DENIED",
  TRIAL_ALREADY_USED: "TRIAL_ALREADY_USED",
  DUPLICATE_SUBSCRIPTION: "DUPLICATE_SUBSCRIPTION",
  LTD_SOLD_OUT: "LTD_SOLD_OUT",
} as const;

// ============================================
// 类型守卫
// ============================================

export function isPaymentError(error: unknown): error is PaymentError {
  return error instanceof PaymentError;
}

export function isQuotaExceededError(
  error: unknown,
): error is QuotaExceededError {
  return error instanceof QuotaExceededError;
}

export function isUpgradeRequiredError(
  error: unknown,
): error is UpgradeRequiredError {
  return error instanceof UpgradeRequiredError;
}
