/**
 * Ingestion Schemas
 *
 * 统一摄入相关的 Zod 验证 Schema
 *
 * @module contracts/schemas
 */

import { z } from "zod";

/**
 * 验证常量
 */
export const VALIDATION_LIMITS = {
  URL_MAX_LENGTH: 2000, // RFC 2616 建议
  TITLE_MAX_LENGTH: 500,
  DESCRIPTION_MAX_LENGTH: 5000,
  NOTES_MAX_LENGTH: 10000,
  TAG_MAX_LENGTH: 50,
  TAGS_MAX_COUNT: 20,
  BATCH_MAX_SIZE: 1000,
  BATCH_CHUNK_SIZE: 200,
} as const;

/**
 * 安全标签验证正则
 * 允许：字母、数字、中文、下划线、连字符、空格
 * 禁止：HTML 特殊字符（<>'"&）
 */
const SAFE_TAG_REGEX = /^[a-zA-Z0-9\u4e00-\u9fa5_\-\s]+$/;

/**
 * 安全标签 Schema
 */
export const SafeTagSchema = z
  .string()
  .min(1, "Tag cannot be empty")
  .max(
    VALIDATION_LIMITS.TAG_MAX_LENGTH,
    `Tag too long (max ${VALIDATION_LIMITS.TAG_MAX_LENGTH})`,
  )
  .regex(SAFE_TAG_REGEX, "Tag contains invalid characters")
  .transform((tag) => tag.trim());

/**
 * 安全 URL Schema
 * - 长度限制（RFC 2616）
 * - URL 格式验证
 * - 协议限制（仅 http/https）
 */
export const SafeUrlSchema = z
  .string()
  .max(
    VALIDATION_LIMITS.URL_MAX_LENGTH,
    `URL too long (max ${VALIDATION_LIMITS.URL_MAX_LENGTH})`,
  )
  .url("Invalid URL format")
  .refine((url) => {
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, "Only HTTP and HTTPS protocols are allowed");

/**
 * 摄入来源类型
 */
export const IngestionSourceSchema = z.enum([
  "web", // 网页手动添加
  "api", // API 调用
  "browser", // 浏览器导入
  "mobile", // 移动端分享
  "extension", // 浏览器扩展
]);

export type IngestionSource = z.infer<typeof IngestionSourceSchema>;

/**
 * 单条摄入请求 Schema
 */
export const IngestionRequestSchema = z.object({
  url: SafeUrlSchema,
  title: z
    .string()
    .max(
      VALIDATION_LIMITS.TITLE_MAX_LENGTH,
      `Title too long (max ${VALIDATION_LIMITS.TITLE_MAX_LENGTH})`,
    )
    .optional(),
  description: z
    .string()
    .max(
      VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH,
      `Description too long (max ${VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH})`,
    )
    .optional(),
  folderId: z.number().int().positive().optional().nullable(),
  tags: z
    .array(SafeTagSchema)
    .max(
      VALIDATION_LIMITS.TAGS_MAX_COUNT,
      `Too many tags (max ${VALIDATION_LIMITS.TAGS_MAX_COUNT})`,
    )
    .optional(),
  notes: z
    .string()
    .max(
      VALIDATION_LIMITS.NOTES_MAX_LENGTH,
      `Notes too long (max ${VALIDATION_LIMITS.NOTES_MAX_LENGTH})`,
    )
    .optional(),
  source: IngestionSourceSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type IngestionRequestInput = z.infer<typeof IngestionRequestSchema>;

/**
 * 批量摄入请求 Schema
 */
export const BatchIngestionRequestSchema = z.object({
  items: z
    .array(IngestionRequestSchema)
    .min(1, "At least one item required")
    .max(
      VALIDATION_LIMITS.BATCH_MAX_SIZE,
      `Too many items (max ${VALIDATION_LIMITS.BATCH_MAX_SIZE})`,
    ),
  skipDuplicates: z.boolean().default(true),
  batchSize: z
    .number()
    .min(10, "Batch size too small (min 10)")
    .max(
      VALIDATION_LIMITS.BATCH_CHUNK_SIZE,
      `Batch size too large (max ${VALIDATION_LIMITS.BATCH_CHUNK_SIZE})`,
    )
    .default(100),
});

export type BatchIngestionRequestInput = z.infer<
  typeof BatchIngestionRequestSchema
>;

/**
 * 摄入结果状态
 */
export const IngestionStatusSchema = z.enum([
  "created", // 成功创建
  "duplicate", // 已存在（跳过）
  "queued", // 已入队等待处理
  "failed", // 失败
]);

export type IngestionStatus = z.infer<typeof IngestionStatusSchema>;
