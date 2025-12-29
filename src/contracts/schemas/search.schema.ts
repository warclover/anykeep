/**
 * Search Schemas
 *
 * 搜索相关的 Zod 验证 Schema
 *
 * @module contracts/schemas
 */

import { z } from "zod";

/**
 * 搜索类型
 */
export const SearchTypeSchema = z.enum([
  "keyword", // 关键词搜索（全文搜索）
  "semantic", // 语义搜索（向量搜索）
  "hybrid", // 混合搜索
]);

export type SearchType = z.infer<typeof SearchTypeSchema>;

/**
 * 搜索请求 Schema
 */
export const SearchRequestSchema = z.object({
  query: z.string().min(1, "Search query is required").max(500),
  type: SearchTypeSchema.default("hybrid"),
  folderId: z.coerce.number().int().positive().optional(),
  platform: z.string().optional(),
  tags: z
    .string()
    .transform((v) => v.split(",").filter(Boolean))
    .optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  minScore: z.coerce.number().min(0).max(1).default(0.3),
});

export type SearchRequestInput = z.infer<typeof SearchRequestSchema>;
