/**
 * 数据验证 Schema
 * 使用 Zod 进行输入验证
 */

import { z } from 'zod'

/**
 * 搜索查询验证
 */
export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, '搜索关键词不能为空')
    .max(200, '搜索关键词不能超过 200 个字符')
    .refine(
      (val) => {
        // 防止 SQL 注入的基本检查
        const dangerousPatterns = /['";\\]/g
        return !dangerousPatterns.test(val)
      },
      {
        message: '搜索关键词包含非法字符',
      }
    ),
  ai: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
})

export type SearchQuery = z.infer<typeof searchQuerySchema>

/**
 * 文件夹名称验证
 */
export const folderNameSchema = z
  .string()
  .trim()
  .min(1, '文件夹名称不能为空')
  .max(50, '文件夹名称不能超过 50 个字符')
  .refine(
    (val) => {
      // 不允许特殊字符
      const invalidChars = /[<>:"/\\|?*]/
      return !invalidChars.test(val)
    },
    {
      message: '文件夹名称不能包含特殊字符 < > : " / \\ | ? *',
    }
  )

/**
 * 书签 URL 验证
 */
export const bookmarkUrlSchema = z
  .string()
  .url('请输入有效的 URL 地址')
  .max(2000, 'URL 长度不能超过 2000 个字符')

/**
 * 标签验证
 */
export const tagSchema = z
  .string()
  .trim()
  .min(1, '标签不能为空')
  .max(30, '标签不能超过 30 个字符')

/**
 * 标签数组验证
 */
export const tagsArraySchema = z
  .array(tagSchema)
  .max(20, '标签数量不能超过 20 个')

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
})

export type UserSettings = z.infer<typeof userSettingsSchema>

/**
 * 分页参数验证
 */
export const paginationSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1, '页码必须大于 0')
    .default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, '每页数量必须大于 0')
    .max(100, '每页数量不能超过 100')
    .default(20),
})

export type Pagination = z.infer<typeof paginationSchema>
