/**
 * 智能列表验证 Schema
 * @module lib/validation/smart-list
 * @version 10.0.0
 * @description 使用 Zod 验证智能列表相关输入
 */

import { z } from "zod";

// ==================== 枚举和常量 ====================

/**
 * 智能列表颜色枚举
 */
export const SmartListColorEnum = z.enum([
  "default",
  "blue",
  "green",
  "orange",
  "purple",
  "red",
  "cyan",
  "pink",
  "amber",
  "emerald",
]);

/**
 * 智能列表排序方式枚举
 */
export const SmartListSortByEnum = z.enum([
  "created_desc",
  "created_asc",
  "title_asc",
  "title_desc",
  "rating_desc",
  "publish_time_desc",
]);

/**
 * 智能列表视图模式枚举
 */
export const SmartListViewModeEnum = z.enum([
  "inherit",
  "card",
  "list",
  "compact",
]);

/**
 * 时间范围类型枚举
 */
export const DateRangeTypeEnum = z.enum(["relative", "absolute"]);

/**
 * 时间单位枚举
 */
export const TimeUnitEnum = z.enum(["day", "week", "month", "year"]);

/**
 * 处理状态枚举
 */
export const BookmarkStatusEnum = z.enum(["PROCESSING", "COMPLETED", "FAILED"]);

/**
 * 分类置信度枚举
 */
export const ConfidenceLevelEnum = z.enum(["high", "medium", "low"]);

// ==================== 筛选条件 Schema ====================

/**
 * 时间范围筛选 Schema
 */
export const dateRangeFilterSchema = z.object({
  type: DateRangeTypeEnum,
  value: z.number().int().positive().optional(),
  unit: TimeUnitEnum.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/**
 * 评级范围筛选 Schema
 */
export const ratingFilterSchema = z.object({
  min: z.number().int().min(0).max(5).optional(),
  max: z.number().int().min(0).max(5).optional(),
});

/**
 * 智能列表筛选条件 Schema
 */
export const smartListFiltersSchema = z
  .object({
    // 来源维度
    platform: z.union([z.string(), z.array(z.string())]).optional(),
    excludePlatforms: z.array(z.string()).optional(),
    folderId: z
      .union([z.number().int().positive(), z.literal("uncategorized")])
      .optional(),
    includeSubfolders: z.boolean().optional(),
    sourceName: z.string().max(200).optional(),

    // 标签维度
    usageTags: z.array(z.string().max(50)).max(20).optional(),
    aiTags: z.array(z.string().max(50)).max(20).optional(),
    userTags: z.array(z.string().max(50)).max(20).optional(),

    // 时间维度
    dateRange: dateRangeFilterSchema.optional(),
    publishTimeRange: dateRangeFilterSchema.optional(),

    // 状态维度
    isRead: z.boolean().optional(),
    isStarred: z.boolean().optional(),
    isInvalid: z.boolean().optional(),
    status: BookmarkStatusEnum.optional(),

    // 质量维度
    rating: ratingFilterSchema.optional(),
    isHighValue: z.boolean().optional(),
    confidenceLevel: ConfidenceLevelEnum.optional(),

    // 内容维度
    contentType: z.array(z.string().max(50)).max(10).optional(),
    keyword: z.string().max(100).optional(),
    importSource: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .refine(
    (data) => {
      // 验证至少有一个筛选条件
      return Object.keys(data).some(
        (key) => data[key as keyof typeof data] !== undefined,
      );
    },
    {
      message: "至少需要设置一个筛选条件",
    },
  );

// ==================== API 请求 Schema ====================

/**
 * 创建智能列表请求 Schema
 */
export const createSmartListSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "智能列表名称不能为空")
    .max(100, "智能列表名称不能超过100个字符"),
  description: z.string().trim().max(500, "描述不能超过500个字符").optional(),
  icon: z.string().trim().max(50).default("filter"),
  color: SmartListColorEnum.default("default"),
  filters: smartListFiltersSchema,
  sortBy: SmartListSortByEnum.default("created_desc"),
  viewMode: SmartListViewModeEnum.default("inherit"),
});

export type CreateSmartListInput = z.infer<typeof createSmartListSchema>;

/**
 * 更新智能列表请求 Schema
 */
export const updateSmartListSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "智能列表名称不能为空")
    .max(100, "智能列表名称不能超过100个字符")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "描述不能超过500个字符")
    .nullable()
    .optional(),
  icon: z.string().trim().max(50).optional(),
  color: SmartListColorEnum.optional(),
  filters: smartListFiltersSchema.optional(),
  sortBy: SmartListSortByEnum.optional(),
  viewMode: SmartListViewModeEnum.optional(),
  isPinned: z.boolean().optional(),
});

export type UpdateSmartListInput = z.infer<typeof updateSmartListSchema>;

/**
 * 智能列表排序请求 Schema
 */
export const reorderSmartListsSchema = z.object({
  ids: z
    .array(z.number().int().positive())
    .min(1, "至少需要一个智能列表ID")
    .max(100, "一次最多排序100个智能列表"),
});

export type ReorderSmartListsInput = z.infer<typeof reorderSmartListsSchema>;

/**
 * 预览智能列表请求 Schema
 */
export const previewSmartListSchema = z.object({
  filters: smartListFiltersSchema,
});

export type PreviewSmartListInput = z.infer<typeof previewSmartListSchema>;

// ==================== 查询参数 Schema ====================

/**
 * 获取智能列表列表查询参数 Schema
 */
export const getSmartListsQuerySchema = z.object({
  includePresets: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val === "true"),
  sortBy: z
    .enum(["sort_order", "name", "created_at", "last_accessed_at"])
    .nullable()
    .optional()
    .transform((val) => val ?? "sort_order"),
});

export type GetSmartListsQuery = z.infer<typeof getSmartListsQuerySchema>;

/**
 * 智能列表 ID 参数 Schema
 */
export const smartListIdParamSchema = z.object({
  id: z.coerce.number().int().positive("智能列表ID必须是正整数"),
});

export type SmartListIdParam = z.infer<typeof smartListIdParamSchema>;
