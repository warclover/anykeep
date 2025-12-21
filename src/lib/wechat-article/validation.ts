/**
 * 微信文章 API 验证 Schema
 *
 * @module wechat-article/validation
 * @description Zod 验证 Schema，用于 API 输入验证
 */

import { z } from "zod";

// =============================================================================
// 通用验证
// =============================================================================

/**
 * 快照 ID 验证
 */
export const snapshotIdSchema = z.coerce
  .number()
  .int()
  .positive("快照 ID 必须为正整数");

/**
 * 书签 ID 验证
 */
export const bookmarkIdSchema = z.coerce
  .number()
  .int()
  .positive("书签 ID 必须为正整数");

/**
 * 样式保留级别验证
 */
export const styleLevelSchema = z
  .enum(["text-only", "full-snapshot"])
  .optional();

// =============================================================================
// API 请求 Schema
// =============================================================================

/**
 * POST /api/wechat-article/[id] - 抓取文章
 */
export const crawlArticleSchema = z.object({
  styleLevel: styleLevelSchema,
});

/**
 * POST /api/wechat-article/[id]/refetch - 重新获取
 */
export const refetchArticleSchema = z.object({
  forceUpdate: z.boolean().optional(),
  redownloadImages: z.boolean().optional(),
  imagesOnly: z.boolean().optional(),
  styleLevel: styleLevelSchema,
});

/**
 * POST /api/wechat-article/create - 创建快照
 */
export const createArticleSchema = z.object({
  bookmarkId: bookmarkIdSchema,
});

// =============================================================================
// 类型导出
// =============================================================================

export type CrawlArticleInput = z.infer<typeof crawlArticleSchema>;
export type RefetchArticleInput = z.infer<typeof refetchArticleSchema>;
export type CreateArticleInput = z.infer<typeof createArticleSchema>;

// =============================================================================
// 验证辅助函数
// =============================================================================

/**
 * 安全解析 JSON 请求体
 *
 * @param request - Next.js Request 对象
 * @param schema - Zod Schema
 * @returns 解析结果，失败时返回空对象或默认值
 */
export async function safeParseBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errorMessage = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      return { success: false, error: errorMessage };
    }

    return { success: true, data: result.data };
  } catch {
    // JSON 解析失败，尝试使用默认值
    const defaultResult = schema.safeParse({});
    if (defaultResult.success) {
      return { success: true, data: defaultResult.data };
    }
    return { success: false, error: "请求体格式无效" };
  }
}

/**
 * 验证路由参数中的 ID
 *
 * @param id - 路由参数中的 ID 字符串
 * @returns 验证后的数字 ID，失败时返回 null
 */
export function validateId(id: string): number | null {
  const result = snapshotIdSchema.safeParse(id);
  return result.success ? result.data : null;
}
