/**
 * ClassifySkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import type { ClassificationAction } from "@/lib/classification-v2/types/legacy-compat";

/**
 * 分类输入参数
 */
export interface ClassifySkillInput {
  /** 书签 ID（可选，用于更新已有书签的分类） */
  bookmarkId?: number;
  /** 书签标题 */
  title: string;
  /** 书签摘要（可选） */
  summary?: string;
  /** 书签标签（可选） */
  tags?: string[];
  /** 书签 URL（可选） */
  url?: string;
  /** 是否启用 AI 辅助分类 */
  enableAI?: boolean;
}

/**
 * 候选文件夹
 */
export interface ClassifyCandidateFolder {
  /** 文件夹 ID */
  folderId: number;
  /** 文件夹名称 */
  folderName: string;
  /** 匹配分数 (0-100) */
  score: number;
  /** 匹配类型 */
  matchType: "profile" | "name" | "ai_select" | "ai_create";
  /** 高频标签 */
  topTags: string[];
}

/**
 * 分类输出结果
 */
export interface ClassifySkillOutput {
  /** 推荐的文件夹 ID (null 表示建议创建新文件夹) */
  folderId: number | null;
  /** 推荐的文件夹名称 */
  folderName: string;
  /** 置信度 (0-100) */
  confidence: number;
  /** 分类动作 */
  action: ClassificationAction;
  /** 分类理由（用户可读） */
  reason: string;
  /** 候选文件夹列表 */
  candidates: ClassifyCandidateFolder[];
  /** 是否需要用户确认 */
  requiresConfirmation: boolean;
  /** 匹配类型 */
  matchType?: string;
}
