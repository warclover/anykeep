/**
 * LLM 调用服务 — 薄封装
 *
 * 封装 DeepSeek API 调用，包含：
 * - Prompt 注入防护（sanitizeInput）
 * - 重试逻辑（maxRetries=2）
 * - 超时控制（30s）
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { logger } from "@/lib/logger";
import { aiEnv } from "@/lib/env";
import { CLASSIFICATION_CONFIG } from "../config";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

/** LLM 请求参数 */
export interface LlmRequest {
  systemPrompt: string;
  userPrompt: string;
  /** 覆盖默认温度 */
  temperature?: number;
  /** 覆盖默认 maxTokens */
  maxTokens?: number;
}

/** LLM 响应 */
export interface LlmResponse {
  content: string;
  /** token 用量（如果 API 返回） */
  usage?: { promptTokens: number; completionTokens: number };
}

/**
 * 调用 DeepSeek API
 *
 * 内置重试和超时。失败时抛出 Error。
 */
export async function callLlm(request: LlmRequest): Promise<LlmResponse> {
  const { model, maxRetries, retryDelayMs, timeoutMs } =
    CLASSIFICATION_CONFIG.llm;
  const temperature =
    request.temperature ?? CLASSIFICATION_CONFIG.llm.temperature;
  const maxTokens = request.maxTokens ?? CLASSIFICATION_CONFIG.llm.maxTokens;

  const apiKey = aiEnv.deepseekApiKey;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 未配置");
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        throw new Error(
          `DeepSeek API ${response.status}: ${errorText.slice(0, 200)}`,
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("DeepSeek API 返回空内容");
      }

      return {
        content: content.trim(),
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens ?? 0,
              completionTokens: data.usage.completion_tokens ?? 0,
            }
          : undefined,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isAbort =
        lastError.name === "AbortError" || lastError.message.includes("abort");

      logger.warn(
        {
          attempt: attempt + 1,
          maxRetries,
          error: lastError.message,
          isTimeout: isAbort,
        },
        "LLM call failed, retrying",
      );

      if (attempt < maxRetries) {
        await sleep(retryDelayMs * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error("LLM 调用失败");
}

// ============================================================================
// Prompt 注入防护
// ============================================================================

/** 控制字符正则 */
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** 零宽字符正则 */
const ZERO_WIDTH = /[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g;

/** 模板注入模式 */
const TEMPLATE_INJECTION = /\{\{.*?\}\}|\{%.*?%\}|<%.*?%>/g;

/** SQL 关键词（大小写不敏感） */
const SQL_KEYWORDS =
  /\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|UNION|CREATE)\b/gi;

/** 角色前缀注入 */
const ROLE_INJECTION = /\b(system|assistant|user)\s*[:：]\s*/gi;

/** XML/HTML 标签 */
const XML_TAGS = /<\/?[a-zA-Z][^>]*>/g;

/** Base64 数据 URI */
const BASE64_DATA = /data:[^;]+;base64,[A-Za-z0-9+/=]{20,}/g;

/**
 * 清理用户输入，防止 prompt 注入
 *
 * 防护层：
 * 1. 移除控制字符、零宽字符
 * 2. 转义引号
 * 3. 移除模板注入模式
 * 4. 移除 SQL 关键词
 * 5. 移除角色前缀注入
 * 6. 移除 XML/HTML 标签
 * 7. 移除 Base64 数据 URI
 * 8. 长度截断
 */
export function sanitizeInput(input: string, maxLength: number): string {
  if (!input) return "";

  let sanitized = input;

  // 1. 控制字符
  sanitized = sanitized.replace(CONTROL_CHARS, "");

  // 2. 零宽字符
  sanitized = sanitized.replace(ZERO_WIDTH, "");

  // 3. 转义引号（防止跳出字符串上下文）
  sanitized = sanitized.replace(/"/g, '\\"');

  // 4. 模板注入
  sanitized = sanitized.replace(TEMPLATE_INJECTION, "");

  // 5. SQL 关键词
  sanitized = sanitized.replace(SQL_KEYWORDS, "[$1]");

  // 6. 角色前缀
  sanitized = sanitized.replace(ROLE_INJECTION, "");

  // 7. XML/HTML 标签
  sanitized = sanitized.replace(XML_TAGS, "");

  // 8. Base64 数据
  sanitized = sanitized.replace(BASE64_DATA, "[data-removed]");

  // 9. 截断
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized.trim();
}

// ============================================================================
// 工具
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
