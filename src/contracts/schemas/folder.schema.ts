/**
 * Folder Schemas
 *
 * 文件夹相关的 Zod 验证 Schema
 *
 * @module contracts/schemas
 */

import { z } from "zod";

/**
 * 文件夹 ID Schema
 */
export const FolderIdSchema = z.number().int().positive();

/**
 * 创建文件夹请求 Schema
 */
export const CreateFolderSchema = z.object({
  name: z
    .string()
    .min(1, "Folder name is required")
    .max(100, "Folder name too long"),
  parentId: z.number().int().positive().optional().nullable(),
  folderGroup: z.string().max(50).optional(),
});

export type CreateFolderInput = z.infer<typeof CreateFolderSchema>;

/**
 * 更新文件夹请求 Schema
 */
export const UpdateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.number().int().positive().optional().nullable(),
  isArchived: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type UpdateFolderInput = z.infer<typeof UpdateFolderSchema>;

/**
 * 移动文件夹请求 Schema
 */
export const MoveFolderSchema = z.object({
  targetParentId: z.number().int().positive().nullable(),
});

export type MoveFolderInput = z.infer<typeof MoveFolderSchema>;

/**
 * 批量排序请求 Schema
 */
export const BatchSortFoldersSchema = z.object({
  orderings: z
    .array(
      z.object({
        id: z.number().int().positive(),
        sortOrder: z.number().int(),
      }),
    )
    .min(1),
});

export type BatchSortFoldersInput = z.infer<typeof BatchSortFoldersSchema>;
