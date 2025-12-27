/**
 * 链接健康检测 Skill Zod Schema
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { z } from "zod";

// ============================================
// 枚举 Schema
// ============================================

/**
 * 健康状态 Schema
 */
export const HealthStatusSchema = z.enum([
  "unknown",
  "healthy",
  "slow",
  "redirect",
  "failed",
  "ignored",
]);

/**
 * 错误类型 Schema
 */
export const HealthErrorTypeSchema = z.enum([
  "not_found",
  "timeout",
  "ssl_error",
  "dns_error",
  "connection_refused",
  "content_changed",
  "paywall",
  "login_required",
]);

/**
 * 检测范围 Schema
 */
export const CheckScopeSchema = z.enum(["all", "folder", "selected"]);

/**
 * 检测状态 Schema
 */
export const CheckStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

/**
 * 修复操作类型 Schema
 */
export const FixActionSchema = z.enum([
  "delete",
  "archive",
  "update_url",
  "ignore",
]);

// ============================================
// 数据结构 Schema
// ============================================

/**
 * 单个链接检测结果 Schema
 */
export const LinkCheckResultSchema = z.object({
  bookmarkId: z.number().int().positive().describe("书签 ID"),
  url: z.string().url().describe("链接 URL"),
  status: HealthStatusSchema.describe("健康状态"),
  httpStatus: z.number().int().optional().describe("HTTP 状态码"),
  responseTimeMs: z.number().int().optional().describe("响应时间（毫秒）"),
  errorType: HealthErrorTypeSchema.optional().describe("错误类型"),
  errorMessage: z.string().optional().describe("错误消息"),
  redirectUrl: z.string().url().optional().describe("重定向后的 URL"),
  waybackUrl: z.string().url().optional().describe("Wayback Machine 归档链接"),
  checkedAt: z.coerce.date().describe("检测时间"),
});

/**
 * 检测统计结果 Schema
 */
export const HealthCheckStatsSchema = z.object({
  totalChecked: z.number().int().min(0).describe("总检测数"),
  healthyCount: z.number().int().min(0).describe("健康链接数"),
  failedCount: z.number().int().min(0).describe("失效链接数"),
  slowCount: z.number().int().min(0).describe("缓慢链接数"),
  redirectCount: z.number().int().min(0).describe("重定向链接数"),
});

// ============================================
// Skill 输入/输出 Schema
// ============================================

/**
 * 检测输入参数 Schema
 */
export const LinkHealthCheckInputSchema = z
  .object({
    scope: CheckScopeSchema.default("all").describe(
      "检测范围：all=全部书签，folder=指定文件夹，selected=选中的书签",
    ),
    folderId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("文件夹 ID（scope='folder' 时必填）"),
    bookmarkIds: z
      .array(z.number().int().positive())
      .optional()
      .describe("书签 ID 列表（scope='selected' 时必填）"),
    includeWayback: z
      .boolean()
      .default(true)
      .describe("是否为失效链接查找 Wayback Machine 归档版本"),
    timeout: z
      .number()
      .int()
      .min(1000)
      .max(30000)
      .default(10000)
      .describe("单个链接检测超时时间（毫秒），默认 10 秒"),
    concurrency: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5)
      .describe("并发检测数量，默认 5"),
  })
  .refine(
    (data) => {
      if (data.scope === "folder" && !data.folderId) {
        return false;
      }
      if (
        data.scope === "selected" &&
        (!data.bookmarkIds || data.bookmarkIds.length === 0)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "scope='folder' 时必须提供 folderId，scope='selected' 时必须提供 bookmarkIds",
    },
  );

/**
 * 检测输出结果 Schema
 */
export const LinkHealthCheckOutputSchema = z.object({
  checkId: z.string().uuid().describe("检测记录 ID"),
  stats: HealthCheckStatsSchema.describe("检测统计结果"),
  problems: z.array(LinkCheckResultSchema).describe("问题链接列表"),
  summary: z.string().describe("检测结果摘要"),
  suggestions: z.array(z.string()).describe("修复建议列表"),
  generatedAt: z.string().datetime().describe("报告生成时间"),
});

/**
 * 修复操作请求 Schema
 */
export const FixActionRequestSchema = z.object({
  bookmarkId: z.number().int().positive().describe("书签 ID"),
  action: FixActionSchema.describe("操作类型"),
  newUrl: z
    .string()
    .url()
    .optional()
    .describe("新 URL（action='update_url' 时必填）"),
});

/**
 * 修复操作批量请求 Schema
 */
export const BatchFixRequestSchema = z.object({
  actions: z
    .array(FixActionRequestSchema)
    .min(1)
    .max(100)
    .describe("批量修复操作列表"),
});

/**
 * 修复操作结果 Schema
 */
export const FixActionResultSchema = z.object({
  bookmarkId: z.number().int().positive().describe("书签 ID"),
  success: z.boolean().describe("是否成功"),
  error: z.string().optional().describe("错误信息"),
});

/**
 * 批量修复响应 Schema
 */
export const BatchFixResponseSchema = z.object({
  success: z.boolean().describe("整体是否成功"),
  results: z.array(FixActionResultSchema).describe("各操作结果"),
  summary: z.string().describe("操作摘要"),
});

// ============================================
// API 请求/响应 Schema
// ============================================

/**
 * 触发检测请求 Schema
 */
export const CheckRequestSchema = z.object({
  message: z.string().optional().describe("自然语言描述（可选）"),
  scope: CheckScopeSchema.optional(),
  folderId: z.number().int().positive().optional(),
  bookmarkIds: z.array(z.number().int().positive()).optional(),
  includeWayback: z.boolean().optional(),
});

/**
 * 健康状态响应 Schema
 */
export const HealthStatusResponseSchema = z.object({
  lastCheck: z
    .object({
      id: z.string().uuid(),
      status: CheckStatusSchema,
      total_checked: z.number().int(),
      healthy_count: z.number().int(),
      failed_count: z.number().int(),
      slow_count: z.number().int(),
      redirect_count: z.number().int(),
      completed_at: z.string().datetime().nullable(),
      created_at: z.string().datetime(),
    })
    .nullable()
    .describe("最近一次检测记录"),
  stats: z
    .object({
      total: z.number().int(),
      healthy: z.number().int(),
      failed: z.number().int(),
      slow: z.number().int(),
      unknown: z.number().int(),
    })
    .describe("当前健康统计"),
});

/**
 * 历史记录响应 Schema
 */
export const HistoryResponseSchema = z.object({
  records: z.array(
    z.object({
      id: z.string().uuid(),
      scope: CheckScopeSchema,
      total_checked: z.number().int(),
      healthy_count: z.number().int(),
      failed_count: z.number().int(),
      status: CheckStatusSchema,
      created_at: z.string().datetime(),
      completed_at: z.string().datetime().nullable(),
    }),
  ),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});

// ============================================
// 类型推导
// ============================================

export type LinkHealthCheckInputType = z.infer<
  typeof LinkHealthCheckInputSchema
>;
export type LinkHealthCheckOutputType = z.infer<
  typeof LinkHealthCheckOutputSchema
>;
export type LinkCheckResultType = z.infer<typeof LinkCheckResultSchema>;
export type HealthCheckStatsType = z.infer<typeof HealthCheckStatsSchema>;
export type FixActionRequestType = z.infer<typeof FixActionRequestSchema>;
export type BatchFixRequestType = z.infer<typeof BatchFixRequestSchema>;
export type CheckRequestType = z.infer<typeof CheckRequestSchema>;
