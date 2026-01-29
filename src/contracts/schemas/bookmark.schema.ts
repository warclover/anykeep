/**
 * Bookmark Schemas
 *
 * 书签相关的 Zod 验证 Schema
 *
 * @module contracts/schemas
 */

import { z } from "zod";

/**
 * 书签 ID Schema
 */
export const BookmarkIdSchema = z.number().int().positive();

/**
 * 创建书签请求 Schema
 */
export const CreateBookmarkSchema = z.object({
  url: z.string().url("Invalid URL format"),
  title: z.string().max(500, "Title too long").optional(),
  description: z.string().max(5000, "Description too long").optional(),
  folderId: z.number().int().positive().optional().nullable(),
  tags: z
    .array(z.string().max(50, "Tag too long"))
    .max(20, "Too many tags")
    .optional(),
  notes: z.string().max(10000, "Notes too long").optional(),
  platform: z.string().max(50).optional(),
});

export type CreateBookmarkInput = z.infer<typeof CreateBookmarkSchema>;

/**
 * 更新书签请求 Schema
 */
export const UpdateBookmarkSchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  folderId: z.number().int().positive().optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(10000).optional().nullable(),
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
});

export type UpdateBookmarkInput = z.infer<typeof UpdateBookmarkSchema>;

/**
 * 书签查询参数 Schema
 */
export const BookmarkQuerySchema = z.object({
  folderId: z.coerce.number().int().positive().optional(),
  /** V2.0: 批量文件夹查询（逗号分隔的 ID 列表） */
  folderIds: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      return v
        .split(",")
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id) && id > 0);
    }),
  platform: z.string().optional(),
  isRead: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  isStarred: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  isInTrash: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v === "true"),
  search: z.string().max(200).optional(),
  tags: z
    .string()
    .transform((v) => v.split(",").filter(Boolean))
    .optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  orderBy: z
    .enum(["created_at", "updated_at", "title", "starred_at"])
    .default("created_at"),
  orderDir: z.enum(["asc", "desc"]).default("desc"),
});

export type BookmarkQueryInput = z.infer<typeof BookmarkQuerySchema>;

/**
 * 批量操作请求 Schema
 */
export const BatchBookmarkIdsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
});

export type BatchBookmarkIdsInput = z.infer<typeof BatchBookmarkIdsSchema>;

/**
 * 批量移动到文件夹请求 Schema
 */
export const BatchMoveSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
  folderId: z.number().int().positive().nullable(),
});

export type BatchMoveInput = z.infer<typeof BatchMoveSchema>;

/**
 * 批量添加标签请求 Schema
 */
export const BatchAddTagsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
  tags: z.array(z.string().max(50)).min(1).max(20),
});

export type BatchAddTagsInput = z.infer<typeof BatchAddTagsSchema>;

/**
 * 批量删除标签请求 Schema
 */
export const BatchRemoveTagsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
  tags: z.array(z.string().max(50)).min(1).max(20),
});

export type BatchRemoveTagsInput = z.infer<typeof BatchRemoveTagsSchema>;
