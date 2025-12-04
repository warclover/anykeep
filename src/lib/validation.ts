/**
 * 数据验证 Schema
 * 使用 Zod 进行输入验证
 */

import { z } from "zod";
import { VALIDATION as VALIDATION_LIMITS } from "./constants/app";
import { VALIDATION } from "./constants/messages";

/**
 * 搜索查询验证
 */
export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(
      VALIDATION_LIMITS.SEARCH_QUERY_MIN_LENGTH,
      VALIDATION.REQUIRED("搜索关键词"),
    )
    .max(
      VALIDATION_LIMITS.SEARCH_QUERY_MAX_LENGTH,
      VALIDATION.TOO_LONG(
        "搜索关键词",
        VALIDATION_LIMITS.SEARCH_QUERY_MAX_LENGTH,
      ),
    )
    .refine(
      (val) => {
        // 防止 SQL 注入的基本检查
        const dangerousPatterns = /['";\\]/g;
        return !dangerousPatterns.test(val);
      },
      {
        message: VALIDATION.INVALID_FORMAT("搜索关键词"),
      },
    ),
  ai: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

/**
 * 文件夹名称验证
 */
export const folderNameSchema = z
  .string()
  .trim()
  .min(
    VALIDATION_LIMITS.FOLDER_NAME_MIN_LENGTH,
    VALIDATION.FOLDER_NAME_REQUIRED,
  )
  .max(
    VALIDATION_LIMITS.FOLDER_NAME_MAX_LENGTH,
    VALIDATION.FOLDER_NAME_TOO_LONG(VALIDATION_LIMITS.FOLDER_NAME_MAX_LENGTH),
  )
  .refine(
    (val) => {
      // 不允许特殊字符
      const invalidChars = /[<>:"/\\|?*]/;
      return !invalidChars.test(val);
    },
    {
      message: '文件夹名称不能包含特殊字符 < > : " / \\ | ? *',
    },
  );

/**
 * 书签 URL 验证
 */
export const bookmarkUrlSchema = z
  .string()
  .url(VALIDATION.INVALID_URL)
  .max(2000, VALIDATION.TOO_LONG("URL", 2000));

/**
 * 标签验证
 */
export const tagSchema = z
  .string()
  .trim()
  .min(1, VALIDATION.REQUIRED("标签"))
  .max(30, VALIDATION.TOO_LONG("标签", 30));

/**
 * 标签数组验证
 */
export const tagsArraySchema = z
  .array(tagSchema)
  .max(20, VALIDATION.TOO_LARGE("标签数量", 20));

/**
 * 用户设置验证
 */
export const userSettingsSchema = z.object({
  platforms: z.object({
    wechat: z.boolean(),
    bilibili: z.boolean(),
    xiaohongshu: z.boolean(),
    zhihu: z.boolean(),
  }),
  ai: z.object({
    autoTags: z.boolean(),
    autoSummary: z.boolean(),
    semanticSearch: z.boolean(),
  }),
  privacy: z.object({
    dataEncryption: z.boolean(),
    shareAnalytics: z.boolean(),
  }),
  notifications: z.object({
    email: z.boolean(),
    inApp: z.boolean(),
    weeklyDigest: z.boolean(),
  }),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;

/**
 * 分页参数验证
 */
export const paginationSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1, VALIDATION.TOO_SMALL("页码", 1))
    .default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, VALIDATION.TOO_SMALL("每页数量", 1))
    .max(100, VALIDATION.TOO_LARGE("每页数量", 100))
    .default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

/**
 * 创建收藏验证 Schema
 */
export const createBookmarkSchema = z.object({
  url: bookmarkUrlSchema,
  // 标题改为选填：用户只需贴入链接即可创建，标题由后台异步补充
  title: z
    .string()
    .trim()
    .max(
      VALIDATION_LIMITS.BOOKMARK_TITLE_MAX_LENGTH,
      VALIDATION.TOO_LONG("标题", VALIDATION_LIMITS.BOOKMARK_TITLE_MAX_LENGTH),
    )
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .trim()
    .max(
      VALIDATION_LIMITS.SUMMARY_MAX_LENGTH,
      VALIDATION.TOO_LONG("描述", VALIDATION_LIMITS.SUMMARY_MAX_LENGTH),
    )
    .optional(),
  folderId: z.coerce.number().int().positive().optional(),
  userTags: tagsArraySchema.optional(),
  notes: z
    .string()
    .trim()
    .max(
      VALIDATION_LIMITS.SUMMARY_MAX_LENGTH,
      VALIDATION.TOO_LONG("备注", VALIDATION_LIMITS.SUMMARY_MAX_LENGTH),
    )
    .optional(),
  coverUrl: z
    .string()
    .trim()
    .url(VALIDATION.INVALID_FORMAT("封面图 URL"))
    .optional()
    .or(z.literal("")),
  // 来源和作者信息（从元数据自动获取）
  sourceName: z
    .string()
    .trim()
    .max(200, VALIDATION.TOO_LONG("来源名称", 200))
    .optional()
    .or(z.literal("")),
  author: z
    .string()
    .trim()
    .max(200, VALIDATION.TOO_LONG("作者", 200))
    .optional()
    .or(z.literal("")),
  // 内容统计（从元数据自动获取）
  wordCount: z.coerce.number().int().nonnegative().optional(),
  imageCount: z.coerce.number().int().nonnegative().optional(),
  // 发布时间（从元数据自动获取，ISO 8601 格式）
  publishTime: z
    .string()
    .trim()
    .refine(
      (val) => {
        if (!val) return true; // 允许空值
        const date = new Date(val);
        return !isNaN(date.getTime());
      },
      { message: "发布时间格式无效" },
    )
    .optional()
    .or(z.literal("")),
  // AI 预生成内容（前端 generate-tags API 返回，避免后端重复生成）
  aiSummary: z
    .string()
    .trim()
    .max(
      VALIDATION_LIMITS.SUMMARY_MAX_LENGTH,
      VALIDATION.TOO_LONG("AI 摘要", VALIDATION_LIMITS.SUMMARY_MAX_LENGTH),
    )
    .optional(),
  aiTags: tagsArraySchema.optional(),
});

export type CreateBookmark = z.infer<typeof createBookmarkSchema>;

/**
 * 更新收藏验证 Schema
 */
export const updateBookmarkSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, VALIDATION.BOOKMARK_TITLE_REQUIRED)
    .max(
      VALIDATION_LIMITS.BOOKMARK_TITLE_MAX_LENGTH,
      VALIDATION.TOO_LONG("标题", VALIDATION_LIMITS.BOOKMARK_TITLE_MAX_LENGTH),
    )
    .optional(),
  description: z
    .string()
    .trim()
    .max(
      VALIDATION_LIMITS.SUMMARY_MAX_LENGTH,
      VALIDATION.TOO_LONG("描述", VALIDATION_LIMITS.SUMMARY_MAX_LENGTH),
    )
    .optional(),
  folderId: z.coerce.number().int().positive().nullable().optional(),
  userTags: tagsArraySchema.optional(),
  notes: z
    .string()
    .trim()
    .max(
      VALIDATION_LIMITS.SUMMARY_MAX_LENGTH,
      VALIDATION.TOO_LONG("备注", VALIDATION_LIMITS.SUMMARY_MAX_LENGTH),
    )
    .optional(),
  // V6.0新增：评级和锁定功能
  rating: z
    .number()
    .int()
    .min(0, "评级不能小于0")
    .max(5, "评级不能大于5")
    .optional(),
  isLocked: z.boolean().optional(),
  isMarkedForDeletion: z.boolean().optional(), // V6.0新增：标记为待删除
});

export type UpdateBookmark = z.infer<typeof updateBookmarkSchema>;

/**
 * 获取收藏列表查询参数验证
 * 注意：searchParams.get() 返回 null（不是 undefined），需要使用 .nullable()
 */
export const getBookmarksQuerySchema = z.object({
  platform: z
    .enum([
      "WECHAT_OFFICIAL_ACCOUNT",
      "BILIBILI",
      "XIAOHONGSHU",
      "UNKNOWN",
      "browser", // 统一浏览器平台入口
    ])
    .nullable()
    .optional()
    .transform((val) => val ?? undefined),
  excludeBrowser: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val === "true"), // 排除浏览器平台（用于"全部"）
  folderId: z.coerce.number().int().positive().nullable().optional(),
  folder: z
    .enum(["trash", "invalid", "high-value"])
    .nullable()
    .optional()
    .transform((val) => val ?? undefined), // 虚拟文件夹
  keyword: z
    .string()
    .trim()
    .max(
      VALIDATION_LIMITS.SEARCH_QUERY_MAX_LENGTH,
      VALIDATION.TOO_LONG("关键词", VALIDATION_LIMITS.SEARCH_QUERY_MAX_LENGTH),
    )
    .nullable()
    .optional()
    .transform((val) => val ?? undefined),
  cursor: z.coerce.number().int().positive().nullable().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sort: z
    .enum(["created_desc", "created_asc", "title_asc", "title_desc"])
    .nullable()
    .optional()
    .transform((val) => val ?? undefined),
});

export type GetBookmarksQuery = z.infer<typeof getBookmarksQuerySchema>;

/**
 * 创建文件夹验证 Schema
 */
export const createFolderSchema = z.object({
  name: folderNameSchema,
  parentId: z.coerce.number().int().positive().optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, VALIDATION.INVALID_FORMAT("颜色"))
    .optional(),
  icon: z
    .string()
    .trim()
    .max(50, VALIDATION.TOO_LONG("图标名称", 50))
    .optional(),
});

export type CreateFolder = z.infer<typeof createFolderSchema>;

/**
 * 更新文件夹验证 Schema
 */
export const updateFolderSchema = z.object({
  name: folderNameSchema.optional(),
  parentId: z.coerce.number().int().positive().nullable().optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, VALIDATION.INVALID_FORMAT("颜色"))
    .nullable()
    .optional(),
  icon: z
    .string()
    .trim()
    .max(50, VALIDATION.TOO_LONG("图标名称", 50))
    .nullable()
    .optional(),
});

export type UpdateFolder = z.infer<typeof updateFolderSchema>;

/**
 * 批量删除收藏验证 Schema
 */
export const batchDeleteBookmarksSchema = z.object({
  ids: z
    .array(z.number().int().positive())
    .min(1, VALIDATION.BATCH_SELECT_REQUIRED)
    .max(100, VALIDATION.BATCH_LIMIT_EXCEEDED(100)),
});

export type BatchDeleteBookmarks = z.infer<typeof batchDeleteBookmarksSchema>;

/**
 * 批量移动收藏到文件夹验证 Schema
 */
export const batchMoveBookmarksSchema = z.object({
  ids: z
    .array(z.number().int().positive())
    .min(1, VALIDATION.BATCH_SELECT_REQUIRED)
    .max(100, VALIDATION.BATCH_LIMIT_EXCEEDED(100)),
  folderId: z.coerce.number().int().positive().nullable(),
});

export type BatchMoveBookmarks = z.infer<typeof batchMoveBookmarksSchema>;

/**
 * 切换已读状态验证 Schema
 */
export const toggleReadSchema = z.object({
  isRead: z.boolean({
    message: "isRead 必须是布尔值",
  }),
});

export type ToggleRead = z.infer<typeof toggleReadSchema>;

/**
 * 切换星标状态验证 Schema
 * V8.0新增：星标/Pin置顶功能
 */
export const toggleStarredSchema = z.object({
  isStarred: z.boolean({
    message: "isStarred 必须是布尔值",
  }),
});

export type ToggleStarred = z.infer<typeof toggleStarredSchema>;

/**
 * PATCH 收藏状态验证 Schema（统一处理已读和星标）
 */
export const patchBookmarkSchema = z
  .object({
    isRead: z.boolean().optional(),
    isStarred: z.boolean().optional(),
  })
  .refine((data) => data.isRead !== undefined || data.isStarred !== undefined, {
    message: "必须提供 isRead 或 isStarred 中的至少一个",
  });

export type PatchBookmark = z.infer<typeof patchBookmarkSchema>;
