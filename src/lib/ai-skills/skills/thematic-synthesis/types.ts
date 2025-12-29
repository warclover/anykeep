/**
 * 主题合成器 Skill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type {
  SynthesisSourceType,
  SynthesisDepthMode,
  ConsensusPoint,
  DivergencePoint,
  BlindSpot,
  BookmarkSource,
} from "@/lib/synthesis";

// ============================================
// 输入类型
// ============================================

/**
 * 主题合成器输入参数
 */
export interface ThematicSynthesisInput {
  /** 来源类型 */
  sourceType: SynthesisSourceType;
  /** 来源 ID（文件夹 ID 或标签） */
  sourceId?: string;
  /** 书签 ID 列表（手动选择时使用） */
  bookmarkIds?: string[];
  /** 深度模式 */
  depthMode: SynthesisDepthMode;
  /** 报告 ID（可选，如果已创建报告） */
  reportId?: string;
  /** 自定义标题 */
  title?: string;
}

// ============================================
// 输出类型
// ============================================

/**
 * 主题合成器输出结果
 */
export interface ThematicSynthesisOutput {
  /** 报告 ID */
  reportId: string;
  /** 报告标题 */
  title: string;
  /** 概述内容 */
  overview: string;
  /** 核心共识列表 */
  consensus: ConsensusPoint[];
  /** 观点分歧列表 */
  divergence: DivergencePoint[];
  /** 知识盲区列表 */
  blindSpots: BlindSpot[];
  /** 完整 Markdown 文本 */
  fullMarkdown: string;
  /** 来源书签数量 */
  sourceCount: number;
  /** 生成字数 */
  wordCount: number;
  /** 生成时间戳 */
  generatedAt: string;
}

// ============================================
// 中间状态类型
// ============================================

/**
 * 准备阶段结果
 */
export interface PrepareStepResult {
  /** 加载的书签列表 */
  bookmarks: BookmarkSource[];
  /** 总 Token 数估算 */
  estimatedTokens: number;
  /** 是否需要截断 */
  needsTruncation: boolean;
  /** 截断后的书签数 */
  truncatedCount?: number;
}

/**
 * 分析阶段结果
 */
export interface AnalyzeStepResult {
  /** 主题聚类 */
  topicClusters: TopicCluster[];
  /** 关键实体 */
  keyEntities: KeyEntity[];
  /** 内容统计 */
  contentStats: ContentStats;
}

/**
 * 主题聚类
 */
export interface TopicCluster {
  /** 聚类 ID */
  id: string;
  /** 主题名称 */
  name: string;
  /** 主题描述 */
  description?: string;
  /** 关联书签 ID */
  relatedBookmarkIds: string[];
  /** 关键词 */
  keywords: string[];
  /** 权重 (0-1) */
  weight: number;
}

/**
 * 关键实体
 */
export interface KeyEntity {
  /** 实体名称 */
  name: string;
  /** 实体类型：人物、概念、技术、组织、事件等 */
  type:
    | "person"
    | "concept"
    | "technology"
    | "organization"
    | "event"
    | "other";
  /** 出现次数 */
  mentions: number;
  /** 关联的主题聚类 ID */
  relatedClusters: string[];
}

/**
 * 内容统计
 */
export interface ContentStats {
  /** 总词数 */
  totalWords: number;
  /** 平均词数 */
  avgWords: number;
  /** 平台分布 */
  platformDistribution: Record<string, number>;
  /** 时间分布（按周） */
  timeDistribution: Record<string, number>;
}

// ============================================
// 合成阶段 Prompt 上下文
// ============================================

/**
 * LLM 调用上下文
 */
export interface SynthesisPromptContext {
  /** 深度模式配置 */
  depthMode: SynthesisDepthMode;
  /** 书签内容（已格式化） */
  formattedContent: string;
  /** 主题聚类（分析阶段结果） */
  topicClusters: TopicCluster[];
  /** 关键实体（分析阶段结果） */
  keyEntities: KeyEntity[];
  /** 用户 ID */
  userId: string;
}

// ============================================
// 步骤定义常量
// ============================================

/**
 * 合成步骤定义
 */
export const SYNTHESIS_SKILL_STEPS = [
  {
    id: "prepare",
    name: "准备阶段",
    description: "收集源书签、提取内容、预处理",
    weight: 15,
  },
  {
    id: "analyze",
    name: "分析阶段",
    description: "内容聚类、主题提取、关系建立",
    weight: 20,
  },
  {
    id: "synthesize",
    name: "合成阶段",
    description: "生成概述和共识点",
    weight: 30,
  },
  {
    id: "conflict",
    name: "冲突检测",
    description: "识别观点分歧、对抗性分析",
    weight: 20,
  },
  {
    id: "blindspot",
    name: "盲区发现",
    description: "识别知识缺口、生成建议",
    weight: 15,
  },
] as const;

export type SynthesisSkillStepId = (typeof SYNTHESIS_SKILL_STEPS)[number]["id"];
