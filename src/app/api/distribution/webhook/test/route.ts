/**
 * Webhook 测试端点
 *
 * @description 测试 Webhook 连接是否可用
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // 验证用户登录
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { url, method = "POST", headers = {}, secretKey } = body;

    if (!url) {
      return NextResponse.json({ error: "缺少 Webhook URL" }, { status: 400 });
    }

    // 验证 URL 格式
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("不支持的协议");
      }
    } catch {
      return NextResponse.json({ error: "无效的 URL 格式" }, { status: 400 });
    }

    // 构建测试 payload
    const testPayload = {
      event: "test",
      timestamp: new Date().toISOString(),
      source: "anykeep",
      message: "This is a test webhook from AnyKeep",
    };

    const payloadString = JSON.stringify(testPayload);

    // 构建 Headers
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "AnyKeep-Webhook/1.0",
      ...headers,
    };

    // 如果有密钥，生成签名
    if (secretKey) {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secretKey);
      const messageData = encoder.encode(payloadString);

      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );

      const signature = await crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        messageData,
      );

      const hashArray = Array.from(new Uint8Array(signature));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      requestHeaders["X-AnyKeep-Signature"] = `sha256=${hashHex}`;
    }

    // 发送测试请求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 秒超时

    try {
      const response = await fetch(url, {
        method: method,
        headers: requestHeaders,
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return NextResponse.json({
        success: response.ok,
        statusCode: response.status,
        statusText: response.statusText,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error) {
        if (fetchError.name === "AbortError") {
          return NextResponse.json(
            { error: "请求超时（10秒）", success: false },
            { status: 408 },
          );
        }
        return NextResponse.json(
          { error: fetchError.message, success: false },
          { status: 502 },
        );
      }

      throw fetchError;
    }
  } catch (error) {
    console.error("Webhook test error:", error);
    return NextResponse.json({ error: "测试请求失败" }, { status: 500 });
  }
}
