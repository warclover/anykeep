/**
 * AI Generator 类型定义
 *
 * @module ai-generator/types
 * @version 1.0.0
 */

import type { ContentType } from "@/lib/summary/content-type-detector";

// Re-export ContentType for external use
export type { ContentType } from "@/lib/summary/content-type-detector";

/**
 * AI 生成结果
 */
export interface AIGenerateResult {
  summary: string;
  tags: string[];
  contentType?: ContentType;
  contentTypeConfidence?: number;
}

/**
 * 文件夹推荐结果
 */
export interface FolderRecommendation {
  folderId: number | null;
  folderName: string;
  confidence: number;
  reason: string;
  suggestNew: boolean;
}

/**
 * 已存在的文件夹信息
 */
export interface ExistingFolder {
  id: number;
  name: string;
  topTags?: string[];
  bookmarkCount?: number;
}

/**
 * AI 生成请求参数
 */
export interface AIGenerateRequest {
  title: string;
  url?: string;
  description?: string;
  content?: string;
  existingFolderNames?: string[];
}

/**
 * AI 生成选项
 */
export interface AIGenerateOptions {
  bookmarkId?: number;
  userId?: string;
  forceLegacy?: boolean;
}

/**
 * 从聚类书签生成文件夹名称的请求参数
 */
export interface GenerateFolderNameRequest {
  titles: string[];
  tags: string[];
  summaries: string[];
  count: number;
}

/**
 * 从聚类书签生成文件夹名称的返回结果
 */
export interface GenerateFolderNameResult {
  name: string;
  reason: string;
}

/**
 * DeepSeek API 生成选项
 */
export interface GenerateWithAIOptions {
  maxTokens?: number;
  temperature?: number;
}
