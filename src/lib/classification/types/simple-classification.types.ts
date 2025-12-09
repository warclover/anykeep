/**
 * V4.1 简化分类服务 - 类型定义
 *
 * @description 定义简化分类服务所需的类型
 * @version 4.1
 */

import type { ClassificationAction } from "./classification";

/**
 * 候选文件夹
 */
export interface CandidateFolder {
  /** 文件夹 ID */
  folderId: number;
  /** 文件夹名称 */
  folderName: string;
  /** 匹配分数 (0-100) */
  score: number;
  /** 匹配类型: profile=基于内容, name=基于名称(冷启动) */
  matchType: "profile" | "name";
  /** 文件夹内书签数量 */
  bookmarkCount: number;
  /** 文件夹高频标签 */
  topTags: string[];
  /** 标签增强分数 */
  tagBoost?: number;
}

/**
 * 简化分类输入
 */
export interface SimpleBookmarkInput {
  /** 书签标题 */
  title: string;
  /** 书签摘要 */
  summary?: string;
  /** 书签标签 */
  tags?: string[];
  /** 书签 URL */
  url?: string;
}

/**
 * 简化分类结果
 */
export interface SimpleClassificationResult {
  /** 目标文件夹 ID (null 表示创建新文件夹) */
  folderId: number | null;
  /** 目标文件夹名称 */
  folderName: string;
  /** 置信度 (0-100) */
  confidence: number;
  /** 分类动作 */
  action: ClassificationAction;
  /** 推理说明 */
  reason: string;
  /** 执行时间 (ms) */
  executionTime?: number;
  /** 候选文件夹列表 */
  candidates?: CandidateFolder[];
  /** 匹配类型 */
  matchType?: "profile" | "name" | "ai_select" | "ai_create";
  /** 标签增强分数 */
  tagBoost?: number;
}

/**
 * 统一搜索结果（来自 SQL 函数）
 */
export interface UnifiedSearchResult {
  folder_id: number;
  folder_name: string;
  similarity: number;
  match_type: "profile" | "name";
  bookmark_count: number;
  top_tags: string[] | null;
}

/**
 * V4.1 分类配置
 */
export interface SimpleClassificationConfig {
  /** 自动归类阈值 (默认 70) */
  autoClassifyThreshold: number;
  /** 最低匹配阈值 (默认 40) */
  minMatchThreshold: number;
  /** 最大候选数量 (默认 5) */
  maxCandidates: number;
  /** 标签增强最大值 (默认 15) */
  maxTagBoost: number;
  /** 是否启用 AI 选择题 */
  enableAISelection: boolean;
  /** 是否启用 AI 创建文件夹 */
  enableAICreate: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_SIMPLE_CONFIG: SimpleClassificationConfig = {
  autoClassifyThreshold: 70,
  minMatchThreshold: 40,
  maxCandidates: 5,
  maxTagBoost: 15,
  enableAISelection: true,
  enableAICreate: true,
};
