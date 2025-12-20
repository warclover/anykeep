/**
 * 批量操作验证 Schema
 * @module lib/batch/validation
 */

import { z } from "zod";

/**
 * 危险 HTML 字符正则
 * 用于检测潜在的 XSS 攻击向量
 */
const DANGEROUS_CHARS_REGEX = /[<>'"&]/;

/**
 * 标签安全验证
 * - 不允许包含 HTML 特殊字符
 * - 不允许纯空白字符
 */
const safeTagSchema = z
  .string()
  .min(1, "标签不能为空")
  .max(50, "标签最长 50 个字符")
  .refine((val) => val.trim().length > 0, "标签不能为纯空白")
  .refine(
    (val) => !DANGEROUS_CHARS_REGEX.test(val),
    "标签不能包含特殊字符 (<, >, ', \", &)",
  );

/**
 * 批量标签操作请求验证
 */
export const batchTagsSchema = z.object({
  /** 操作类型：添加或移除 */
  action: z.enum(["add", "remove"]),

  /** 书签 ID 列表 */
  bookmarkIds: z
    .array(z.number().int().positive())
    .min(1, "请至少选择一个书签")
    .max(200, "单次最多操作 200 个书签"),

  /** 标签列表（带 XSS 防护） */
  tags: z
    .array(safeTagSchema)
    .min(1, "请至少选择一个标签")
    .max(20, "单次最多操作 20 个标签"),
});

export type BatchTagsInput = z.infer<typeof batchTagsSchema>;

/**
 * 批量标签操作响应类型
 */
export interface BatchTagsResult {
  action: "add" | "remove";
  affectedCount: number;
  affectedIds: number[];
  tags: string[];
  message: string;
}

/**
 * 批量操作常量
 */
export const BATCH_LIMITS = {
  /** 单次最大操作书签数量 */
  MAX_BOOKMARKS: 200,
  /** 单次最大操作标签数量 */
  MAX_TAGS: 20,
  /** 单个标签最大长度 */
  MAX_TAG_LENGTH: 50,
} as const;
