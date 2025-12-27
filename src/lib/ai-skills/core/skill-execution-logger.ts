/**
 * Skill 执行日志记录服务
 *
 * 负责将 Skill 执行结果异步写入 ai_skill_executions 表
 * 采用 fire-and-forget 模式，不阻塞主流程
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/supabase";
import type {
  SkillContext,
  SkillMetadata,
  SkillExecutionMetrics,
  SkillExecutionStatus,
} from "./types";

// ============================================
// 类型定义
// ============================================

/**
 * 执行日志记录参数
 */
export interface LogExecutionParams {
  /** Skill 元数据 */
  metadata: SkillMetadata;
  /** 执行上下文 */
  context: SkillContext;
  /** 输入参数 */
  input: unknown;
  /** 输出结果（成功时） */
  output?: unknown;
  /** 执行状态 */
  status: SkillExecutionStatus;
  /** 执行指标 */
  metrics: SkillExecutionMetrics;
  /** 错误信息（失败时） */
  errorMessage?: string;
  /** 错误代码（失败时） */
  errorCode?: string;
}

/**
 * 数据库记录格式
 */
interface ExecutionLogRecord {
  user_id: string;
  conversation_id: string | null;
  skill_id: string;
  skill_version: string;
  input: Json;
  output: Json | null;
  status: SkillExecutionStatus;
  latency_ms: number | null;
  tokens_used: number;
  error_message: string | null;
}

// ============================================
// 日志记录服务
// ============================================

/**
 * 记录 Skill 执行日志
 *
 * 采用异步 fire-and-forget 模式：
 * - 不阻塞主流程
 * - 静默处理错误（仅记录到控制台）
 * - 适合高频调用场景
 *
 * @param params - 执行日志参数
 */
export async function logSkillExecution(
  params: LogExecutionParams,
): Promise<void> {
  const { metadata, context, input, output, status, metrics, errorMessage } =
    params;

  // 必须有 userId 才能记录
  if (!context.userId) {
    logger.warn(
      { skillId: metadata.id },
      "SkillExecutionLogger: Missing userId, skipping log",
    );
    return;
  }

  try {
    const supabase = await createClient();

    // 构建数据库记录
    // 注意：conversation_id 设为 null，因为 AgentMemory 中的 conversationId
    // 是内存临时 ID，不存在于 ai_conversations 表中，会导致 FK 约束失败
    const record: ExecutionLogRecord = {
      user_id: context.userId,
      conversation_id: null, // 禁用 FK 关联，避免 23503 错误
      skill_id: metadata.id,
      skill_version: metadata.version,
      input: sanitizeForJson(input),
      output: output ? sanitizeForJson(output) : null,
      status,
      latency_ms: metrics.executionTimeMs || null,
      tokens_used: metrics.tokensUsed || 0,
      error_message: errorMessage || null,
    };

    // 异步写入数据库
    const { error } = await supabase.from("ai_skill_executions").insert(record);

    if (error) {
      // 静默处理错误，不影响主流程
      logger.error(
        {
          skillId: metadata.id,
          error: error.message,
          code: error.code,
        },
        "SkillExecutionLogger: Failed to insert log",
      );
      return;
    }

    logger.debug(
      {
        skillId: metadata.id,
        status,
        latencyMs: metrics.executionTimeMs,
      },
      "SkillExecutionLogger: Log inserted",
    );
  } catch (error) {
    // 捕获所有异常，确保不影响主流程
    logger.error(
      {
        skillId: metadata.id,
        error: error instanceof Error ? error.message : String(error),
      },
      "SkillExecutionLogger: Unexpected error",
    );
  }
}

/**
 * 异步记录 Skill 执行日志（fire-and-forget）
 *
 * 使用此方法时，日志记录在后台进行，不会阻塞调用方
 *
 * @param params - 执行日志参数
 */
export function logSkillExecutionAsync(params: LogExecutionParams): void {
  // 使用 void 显式表示我们不关心 Promise 结果
  void logSkillExecution(params).catch((error) => {
    // 双重保险：即使 logSkillExecution 内部处理了错误，
    // 这里也捕获任何可能遗漏的异常
    logger.error(
      {
        skillId: params.metadata.id,
        error: error instanceof Error ? error.message : String(error),
      },
      "SkillExecutionLogger: Async logging failed",
    );
  });
}

// ============================================
// 辅助函数
// ============================================

/**
 * 清理数据以确保 JSON 序列化安全
 *
 * - 移除循环引用
 * - 截断过长的字符串
 * - 移除敏感字段
 */
function sanitizeForJson(data: unknown, maxStringLength = 10000): Json {
  if (data === null || data === undefined) {
    return null;
  }

  if (typeof data === "string") {
    // 截断过长字符串
    return data.length > maxStringLength
      ? data.substring(0, maxStringLength) + "...[truncated]"
      : data;
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return data;
  }

  if (Array.isArray(data)) {
    // 限制数组长度
    const maxItems = 100;
    const truncated = data.slice(0, maxItems);
    return truncated.map((item) => sanitizeForJson(item, maxStringLength));
  }

  if (typeof data === "object") {
    const sanitized: Record<string, Json> = {};
    const sensitiveKeys = ["password", "token", "secret", "key", "auth"];

    for (const [key, value] of Object.entries(data)) {
      // 跳过敏感字段
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        sanitized[key] = "[REDACTED]";
        continue;
      }

      // 递归处理
      sanitized[key] = sanitizeForJson(value, maxStringLength);
    }

    return sanitized;
  }

  // 其他类型转为字符串
  return String(data);
}
