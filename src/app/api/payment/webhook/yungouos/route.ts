/**
 * YunGouOS Webhook API
 * POST /api/payment/webhook/yungouos
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { webhookService } from "@/lib/payment/services/webhook.service";
import type { WebhookEvent } from "@/lib/payment/types";
import { PAYMENT_CONFIG } from "@/lib/payment/config";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    // YunGouOS 使用 form-urlencoded
    const formData = await request.formData();
    const params: Record<string, string> = {};

    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    // 验证签名
    if (!verifySignature(params)) {
      logger.error("[YunGouOS Webhook] Invalid signature");
      return new NextResponse("FAIL", { status: 401 });
    }

    // 检查支付状态
    if (params.payStatus !== "1") {
      // 支付未成功，忽略
      return new NextResponse("SUCCESS");
    }

    // 解析 attach 数据
    let attachData: Record<string, unknown> = {};
    try {
      attachData = JSON.parse(params.attach || "{}");
    } catch {
      logger.error("[YunGouOS Webhook] Invalid attach data");
    }

    // 构造统一事件格式
    const event: WebhookEvent = {
      id: params.payNo || crypto.randomUUID(),
      type: "payment.succeeded",
      provider: "yungouos",
      data: {
        order_no: params.outTradeNo,
        pay_no: params.payNo,
        amount: parseInt(params.money || "0", 10) * 100, // 元转分
        pay_channel: params.payChannel, // wxpay / alipay
        attach: params.attach,
        ...attachData,
      },
      receivedAt: new Date(),
    };

    // 处理事件
    const result = await webhookService.handleWebhook(event);

    if (!result.success) {
      logger.error(
        { error: result.error },
        "[YunGouOS Webhook] Processing failed",
      );
      return new NextResponse("FAIL", { status: 500 });
    }

    // YunGouOS 要求返回 SUCCESS
    return new NextResponse("SUCCESS");
  } catch (error) {
    logger.error({ error }, "[YunGouOS Webhook] Error");
    return new NextResponse("FAIL", { status: 500 });
  }
}

function verifySignature(params: Record<string, string>): boolean {
  const secret = PAYMENT_CONFIG.yungouos.webhookSecret;
  if (!secret) {
    logger.error(
      "[YunGouOS Webhook] YUNGOUOS_WEBHOOK_SECRET not configured, rejecting request",
    );
    return false; // fail-safe：未配置密钥时拒绝所有请求
  }

  // YunGouOS 签名规则：按字母排序拼接参数 + key，MD5
  const sign = params.sign;
  // 避免修改原始对象：过滤排除 sign 字段
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "sign")
    .sort();
  const signStr =
    sortedKeys.map((k) => `${k}=${params[k]}`).join("&") + `&key=${secret}`;
  const expectedSign = crypto
    .createHash("md5")
    .update(signStr)
    .digest("hex")
    .toUpperCase();

  // 使用 timingSafeEqual 防止时序攻击
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sign ?? ""),
      Buffer.from(expectedSign),
    );
  } catch {
    // Buffer 长度不一致时 timingSafeEqual 会抛异常
    return false;
  }
}
