/**
 * 主题合成器 (Thematic Synthesizer) 类型定义
 *
 * 定义综述报告、四维结构化输出、SSE 事件等核心类型
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { OVERVIEW_PREVIEW_MAX_LENGTH } from "./constants";

// ============================================
// 枚举类型
// ============================================

/**
 * 综述来源类型
 */
export type SynthesisSourceType =
  | "folder" // 文件夹
  | "tag" // 标签
  | "selection" // 手动选择
  | "ai_recommend"; // AI 推荐

/**
 * 综述深度模式
 */
export type SynthesisDepthMode =
  | "quick" // 快读模式：1-2 分钟, 3-5 句概述
  | "standard" // 标准模式：3-5 分钟, 完整四维输出
  | "academic"; // 学术模式：5-8 分钟, 深度分析

/**
 * 综述输出风格
 *
 * @since 2026-01-01 [S1]
 */
export type SynthesisOutputStyle =
  | "summary" // 概要式：简洁要点列表
  | "narrative" // 叙事式：自然段落，有起承转合
  | "comparison" // 对比式：突出共识与分歧
  | "critical"; // 批判式：更多分歧和盲区分析

/**
 * 综述状态
 */
export type SynthesisStatus =
  | "pending" // 等待中
  | "generating" // 生成中
  | "completed" // 已完成
  | "failed" // 失败
  | "cancelled"; // 已取消

// ============================================
// 核心结构类型
// ============================================

/**
 * 来源书签引用
 */
export interface SourceReference {
  /** 书签 ID */
  id: string;
  /** 书签标题 */
  title: string;
  /** 支持引文（可选） */
  quote?: string;
}

/**
 * 共识点结构
 *
 * 表示多个来源都认同的观点
 */
export interface ConsensusPoint {
  /** 共识观点内容 */
  point: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 支持此观点的来源 */
  sources: SourceReference[];
}

/**
 * 分歧点结构
 *
 * 表示不同来源之间的观点冲突
 */
export interface DivergencePoint {
  /** 分歧主题 */
  topic: string;
  /** 观点 A */
  point_a: string;
  /** 支持观点 A 的来源 */
  sources_a: SourceReference[];
  /** 观点 B */
  point_b: string;
  /** 支持观点 B 的来源 */
  sources_b: SourceReference[];
  /** AI 客观分析（不做价值判断） */
  analysis: string;
}

/**
 * 知识盲区结构
 *
 * 表示用户收藏中尚未覆盖但相关的领域
 */
export interface BlindSpot {
  /** 盲区主题 */
  topic: string;
  /** 建议补充方向 */
  suggestion: string;
  /** 建议搜索关键词 */
  search_keywords: string[];
  /** 相关书签（可选） */
  related_bookmarks?: SourceReference[];
}

// ============================================
// 综述报告类型
// ============================================

/**
 * 综述报告摘要（列表页使用）
 */
export interface SynthesisReportSummary {
  /** 报告 ID */
  id: string;
  /** 报告标题 */
  title: string;
  /** 来源类型 */
  sourceType: SynthesisSourceType;
  /** 深度模式 */
  depthMode: SynthesisDepthMode;
  /** 输出风格 @since 2026-01-01 [S1] */
  outputStyle: SynthesisOutputStyle;
  /** 来源书签数量 */
  sourceCount: number;
  /** 生成字数 */
  wordCount: number;
  /** 状态 */
  status: SynthesisStatus;
  /** 创建时间 */
  createdAt: string;
  /** 完成时间 */
  completedAt: string | null;
  /** 概述预览（前 200 字） */
  overviewPreview: string;
  /** 共识点数量 */
  consensusCount: number;
  /** 分歧点数量 */
  divergenceCount: number;
  /** 盲区数量 */
  blindSpotCount: number;
}

/**
 * 综述报告完整数据
 */
export interface SynthesisReport extends SynthesisReportSummary {
  /** 用户 ID */
  userId: string;
  /** 来源 ID（文件夹 ID 或标签 ID） */
  sourceId: string | null;
  /** 来源书签 ID 列表（手动选择时使用） */
  sourceBookmarkIds: string[] | null;
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
  /** 错误信息（失败时） */
  errorMessage: string | null;
  /** 更新时间 */
  updatedAt: string;
  /** 来源书签详情 */
  sourceBookmarks?: BookmarkSource[];
}

/**
 * 书签来源（用于综述生成）
 */
export interface BookmarkSource {
  /** 书签 ID */
  id: string;
  /** 书签标题 */
  title: string;
  /** 书签 URL */
  url: string;
  /** 书签内容/摘要 */
  content: string;
  /** AI 生成的摘要 */
  aiSummary?: string;
  /** 平台 */
  platform: string;
  /** 创建时间 */
  createdAt: string;
}

// ============================================
// SSE 事件类型
// ============================================

/**
 * 进度事件数据
 */
export interface SynthesisProgressData {
  /** 当前步骤 ID */
  step: string;
  /** 进度百分比 (0-100) */
  percent: number;
  /** 进度消息 */
  message: string;
}

/**
 * 概述事件数据
 */
export interface SynthesisOverviewData {
  /** 概述内容 */
  content: string;
  /** 是否完成 */
  isComplete: boolean;
}

/**
 * 共识事件数据
 */
export interface SynthesisConsensusData {
  /** 共识点列表 */
  items: ConsensusPoint[];
  /** 是否完成 */
  isComplete: boolean;
}

/**
 * 分歧事件数据
 */
export interface SynthesisDivergenceData {
  /** 分歧点列表 */
  items: DivergencePoint[];
  /** 是否完成 */
  isComplete: boolean;
}

/**
 * 盲区事件数据
 */
export interface SynthesisBlindSpotData {
  /** 盲区列表 */
  items: BlindSpot[];
  /** 是否完成 */
  isComplete: boolean;
}

/**
 * 完成事件数据
 */
export interface SynthesisCompleteData {
  /** 报告 ID */
  reportId: string;
  /** 生成字数 */
  wordCount: number;
}

/**
 * 错误事件数据
 */
export interface SynthesisErrorData {
  /** 错误消息 */
  message: string;
  /** 错误代码 */
  code: string;
}

/**
 * SSE 事件联合类型
 */
export type SynthesisSSEEvent =
  | { type: "progress"; data: SynthesisProgressData }
  | { type: "overview"; data: SynthesisOverviewData }
  | { type: "consensus"; data: SynthesisConsensusData }
  | { type: "divergence"; data: SynthesisDivergenceData }
  | { type: "blindspot"; data: SynthesisBlindSpotData }
  | { type: "complete"; data: SynthesisCompleteData }
  | { type: "error"; data: SynthesisErrorData };

// ============================================
// API 请求/响应类型
// ============================================

/**
 * 创建综述请求
 */
export interface CreateSynthesisRequest {
  /** 来源类型 */
  sourceType: SynthesisSourceType;
  /** 来源 ID（文件夹 ID 或标签 ID） */
  sourceId?: string;
  /** 书签 ID 列表（手动选择时使用） */
  bookmarkIds?: string[];
  /** 深度模式 */
  depthMode: SynthesisDepthMode;
  /** 输出风格 @since 2026-01-01 [S1] */
  outputStyle?: SynthesisOutputStyle;
  /** 自定义标题（可选） */
  title?: string;
}

/**
 * 综述列表响应
 */
export interface SynthesisListResponse {
  /** 综述报告列表 */
  data: SynthesisReportSummary[];
  /** 分页信息 */
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * 综述详情响应
 */
export interface SynthesisDetailResponse {
  /** 综述报告完整数据 */
  data: SynthesisReport;
}

/**
 * 综述列表查询参数
 */
export interface SynthesisListQuery {
  /** 来源类型筛选 */
  sourceType?: SynthesisSourceType | "all";
  /** 深度模式筛选 */
  depthMode?: SynthesisDepthMode | "all";
  /** 状态筛选 */
  status?: SynthesisStatus | "all";
  /** 搜索关键词 */
  search?: string;
  /** 排序字段 */
  sort?: "createdAt" | "updatedAt" | "wordCount";
  /** 排序方向 */
  order?: "asc" | "desc";
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/**
 * 导出格式
 */
export type SynthesisExportFormat = "markdown" | "obsidian" | "json" | "html";

/**
 * 导出请求
 */
export interface SynthesisExportRequest {
  /** 导出格式 */
  format: SynthesisExportFormat;
  /** 是否包含来源列表 */
  includeSources?: boolean;
  /** 是否包含元数据 */
  includeMetadata?: boolean;
}

// ============================================
// AI 推荐类型
// ============================================

/**
 * 综述推荐候选
 */
export interface SynthesisRecommendation {
  /** 推荐 ID */
  id: string;
  /** 主题名称 */
  topic: string;
  /** 书签数量 */
  bookmarkCount: number;
  /** 示例书签 */
  sampleBookmarks: Array<{ id: string; title: string }>;
  /** 推荐原因 */
  reason: string;
  /** 推荐置信度 (0-1) */
  confidence: number;
  /** 推荐来源类型 */
  sourceType: SynthesisSourceType;
  /** 来源 ID */
  sourceId?: string;
}

// ============================================
// 合成步骤类型
// ============================================

/**
 * 合成步骤 ID
 */
export type SynthesisStepId =
  | "prepare" // 准备阶段：收集源书签、提取内容
  | "analyze" // 分析阶段：内容聚类、主题提取
  | "synthesize" // 合成阶段：生成概述和共识
  | "conflict" // 冲突检测：识别观点分歧
  | "blindspot"; // 盲区发现：识别知识空白

/**
 * 合成步骤定义
 */
export interface SynthesisStepDefinition {
  /** 步骤 ID */
  id: SynthesisStepId;
  /** 步骤名称 */
  name: string;
  /** 步骤描述 */
  description: string;
  /** 权重（用于计算进度） */
  weight: number;
}

/**
 * 预定义的合成步骤
 */
export const SYNTHESIS_STEPS: SynthesisStepDefinition[] = [
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

// ============================================
// 错误类型
// ============================================

/**
 * 综述错误代码
 */
export enum SynthesisErrorCode {
  /** 来源未找到 */
  SOURCE_NOT_FOUND = "SOURCE_NOT_FOUND",
  /** 内容不足 */
  INSUFFICIENT_CONTENT = "INSUFFICIENT_CONTENT",
  /** Token 超限 */
  TOKEN_LIMIT_EXCEEDED = "TOKEN_LIMIT_EXCEEDED",
  /** LLM 错误 */
  LLM_ERROR = "LLM_ERROR",
  /** 生成超时 */
  GENERATION_TIMEOUT = "GENERATION_TIMEOUT",
  /** 用户取消 */
  USER_CANCELLED = "USER_CANCELLED",
  /** 无效参数 */
  INVALID_PARAMS = "INVALID_PARAMS",
  /** 未授权 */
  UNAUTHORIZED = "UNAUTHORIZED",
  /** 报告未找到 */
  REPORT_NOT_FOUND = "REPORT_NOT_FOUND",
  /** 通用未找到 */
  NOT_FOUND = "NOT_FOUND",
  /** 生成失败 */
  GENERATION_FAILED = "GENERATION_FAILED",
}

/**
 * 综述错误类
 */
export class SynthesisError extends Error {
  constructor(
    message: string,
    public readonly code: SynthesisErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "SynthesisError";
  }
}

// ============================================
// 配置类型
// ============================================

/**
 * 综述输出风格配置
 *
 * @since 2026-01-01 [S1]
 */
export interface SynthesisStyleConfig {
  /** 风格 ID */
  id: SynthesisOutputStyle;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 图标 */
  icon: string;
  /** 示例输出（用于预览） */
  example: string;
  /** 推荐场景 */
  recommendedFor: string;
  /** Prompt 修饰词 */
  promptModifier: string;
}

/**
 * 预定义的输出风格配置
 *
 * @since 2026-01-01 [S1]
 */
export const SYNTHESIS_STYLE_CONFIGS: Record<
  SynthesisOutputStyle,
  SynthesisStyleConfig
> = {
  summary: {
    id: "summary",
    name: "概要式",
    description: "简洁要点列表，快速获取核心信息",
    icon: "📋",
    example: "• 要点一：...\n• 要点二：...\n• 要点三：...",
    recommendedFor: "快速了解、会议准备、信息检索",
    promptModifier:
      "以简洁的要点列表形式输出，每个要点不超过一句话，突出核心信息",
  },
  narrative: {
    id: "narrative",
    name: "叙事式",
    description: "自然段落，有起承转合",
    icon: "📖",
    example: "在探讨这个主题时，我们首先需要理解...随后...最终...",
    recommendedFor: "深度阅读、知识内化、分享给他人",
    promptModifier:
      "以自然流畅的叙事方式输出，形成有起承转合的段落，便于阅读理解",
  },
  comparison: {
    id: "comparison",
    name: "对比式",
    description: "突出共识与分歧，多角度呈现",
    icon: "⚖️",
    example: "【共识】各来源普遍认为...\n【分歧】然而在...方面存在不同观点...",
    recommendedFor: "决策参考、辩论准备、多元视角",
    promptModifier:
      "重点突出不同来源之间的共识与分歧，明确标注观点来源，便于对比分析",
  },
  critical: {
    id: "critical",
    name: "批判式",
    description: "更多分歧和盲区分析",
    icon: "🔍",
    example: "【存疑】这一论点缺乏充分证据...\n【盲区】目前缺少对...的讨论...",
    recommendedFor: "学术研究、深度思考、发现问题",
    promptModifier:
      "以批判性思维分析内容，着重指出论证不足、逻辑漏洞和知识盲区，鼓励独立思考",
  },
} as const;

/**
 * 深度模式配置
 */
export interface DepthModeConfig {
  /** 模式 ID */
  id: SynthesisDepthMode;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 图标 */
  icon: string;
  /** 预估时间（分钟） */
  estimatedMinutes: [number, number];
  /** 预估成本（元） */
  estimatedCost: number;
  /** 概述字数范围 */
  overviewWords: [number, number];
  /** 模型层级 */
  modelTier: "fast" | "standard" | "deep";
  /** 是否需要付费 */
  isPaid: boolean;
}

/**
 * 预定义的深度模式配置
 */
export const DEPTH_MODE_CONFIGS: Record<SynthesisDepthMode, DepthModeConfig> = {
  quick: {
    id: "quick",
    name: "快读模式",
    description: "3-5 句概要",
    icon: "⚡",
    estimatedMinutes: [1, 2],
    estimatedCost: 0.02,
    overviewWords: [50, 150],
    modelTier: "fast",
    isPaid: false,
  },
  standard: {
    id: "standard",
    name: "标准模式",
    description: "完整四维输出",
    icon: "📖",
    estimatedMinutes: [3, 5],
    estimatedCost: 0.05,
    overviewWords: [300, 500],
    modelTier: "standard",
    isPaid: false,
  },
  academic: {
    id: "academic",
    name: "学术模式",
    description: "深度分析",
    icon: "🎓",
    estimatedMinutes: [5, 8],
    estimatedCost: 0.15,
    overviewWords: [800, 1200],
    modelTier: "deep",
    isPaid: true,
  },
} as const;

// ============================================
// 数据库类型映射
// ============================================

/**
 * 数据库行类型（与 Supabase 表结构对应）
 *
 * 注意：Supabase 返回 string 类型，需要在 mapRowToReport 中进行类型断言
 */
export interface SynthesisReportRow {
  id: string;
  user_id: string;
  title: string;
  source_type: string | null; // SynthesisSourceType 的字符串形式（知识工坊报告可能为 null）
  source_id: string | null;
  source_bookmark_ids: string[] | null;
  depth_mode: string | null; // SynthesisDepthMode 的字符串形式（知识工坊报告可能为 null）
  output_style: string | null; // SynthesisOutputStyle 的字符串形式 [S1]
  overview: string | null;
  consensus: ConsensusPoint[] | null;
  divergence: DivergencePoint[] | null;
  blind_spots: BlindSpot[] | null;
  full_markdown: string | null;
  content: string | null; // 知识工坊报告的内容（Markdown 格式）
  blueprint_type: string | null; // 知识工坊蓝图类型
  citations: Array<{
    bookmarkId: string;
    title: string;
    url: string;
    excerpt?: string;
    position?: number;
  }> | null; // 知识工坊报告的引用
  generation_metadata: Record<string, unknown> | null; // 知识工坊报告的生成元数据
  embedding: number[] | null;
  status: string; // SynthesisStatus 的字符串形式
  error_message: string | null;
  source_count: number;
  word_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/**
 * 将数据库行转换为 API 响应格式
 */
export function mapRowToReport(row: SynthesisReportRow): SynthesisReport {
  // 检测是否是知识工坊报告（有 blueprint_type 或 content 字段）
  // 注意：知识工坊的表结构可能没有 status 字段，所以需要检查 blueprint_type
  const isKnowledgeStudioReport = !!(row.blueprint_type || (row.content && !row.overview && !row.source_type));
  
  if (isKnowledgeStudioReport) {
    // 知识工坊报告：使用 content 作为 fullMarkdown，设置默认的四维结构
    const content = row.content || row.full_markdown || "";
    
    // 调试日志
    if (process.env.NODE_ENV === "development") {
      console.log("Mapping Knowledge Studio report:", {
        id: row.id,
        hasContent: !!row.content,
        contentLength: row.content?.length,
        contentPreview: row.content?.slice(0, 200),
        hasFullMarkdown: !!row.full_markdown,
        fullMarkdownLength: row.full_markdown?.length,
        blueprintType: row.blueprint_type,
        generationMetadata: row.generation_metadata,
        rowKeys: Object.keys(row),
      });
    }
    
    // 从 generation_metadata 中获取 source_bookmark_ids
    // 注意：知识工坊保存的是字符串数组，需要转换为字符串格式以便 API 使用
    const metadataBookmarkIds = row.generation_metadata?.source_bookmark_ids as string[] | number[] | undefined;
    const rawBookmarkIds = row.source_bookmark_ids || metadataBookmarkIds || null;
    // 确保所有 ID 都是字符串格式（API 期望字符串）
    const sourceBookmarkIds = rawBookmarkIds 
      ? rawBookmarkIds.map(id => String(id))
      : null;
    
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      // 知识工坊报告使用 "selection" 作为 sourceType，以便预览 API 能正确查询
      sourceType: "selection" as SynthesisSourceType,
      sourceId: row.source_id,
      sourceBookmarkIds: sourceBookmarkIds,
      depthMode: (row.depth_mode as SynthesisDepthMode) || "standard",
      outputStyle: (row.output_style || "narrative") as SynthesisOutputStyle,
      overview: content, // 将 content 作为 overview 显示
      consensus: row.consensus || [],
      divergence: row.divergence || [],
      blindSpots: row.blind_spots || [],
      fullMarkdown: content,
      status: (row.status as SynthesisStatus | undefined) || "completed", // 知识工坊报告默认为 completed（可能没有 status 字段）
      errorMessage: row.error_message,
      sourceCount: row.source_count || sourceBookmarkIds?.length || 0,
      wordCount: row.word_count || content.length || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at || row.created_at, // 如果没有 completed_at，使用 created_at
      overviewPreview: content.slice(0, OVERVIEW_PREVIEW_MAX_LENGTH),
      consensusCount: row.consensus?.length || 0,
      divergenceCount: row.divergence?.length || 0,
      blindSpotCount: row.blind_spots?.length || 0,
    };
  }
  
  // 主题合成器报告：使用原有的映射逻辑
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    sourceType: row.source_type as SynthesisSourceType,
    sourceId: row.source_id,
    sourceBookmarkIds: row.source_bookmark_ids,
    depthMode: row.depth_mode as SynthesisDepthMode,
    outputStyle: (row.output_style || "narrative") as SynthesisOutputStyle, // [S1]
    overview: row.overview || "",
    consensus: row.consensus || [],
    divergence: row.divergence || [],
    blindSpots: row.blind_spots || [],
    fullMarkdown: row.full_markdown || "",
    status: row.status as SynthesisStatus,
    errorMessage: row.error_message,
    sourceCount: row.source_count,
    wordCount: row.word_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    overviewPreview: (row.overview || "").slice(0, OVERVIEW_PREVIEW_MAX_LENGTH),
    consensusCount: row.consensus?.length || 0,
    divergenceCount: row.divergence?.length || 0,
    blindSpotCount: row.blind_spots?.length || 0,
  };
}

/**
 * 将数据库行转换为摘要格式
 */
export function mapRowToSummary(
  row: SynthesisReportRow,
): SynthesisReportSummary {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type as SynthesisSourceType,
    depthMode: row.depth_mode as SynthesisDepthMode,
    outputStyle: (row.output_style || "narrative") as SynthesisOutputStyle, // [S1]
    sourceCount: row.source_count,
    wordCount: row.word_count,
    status: row.status as SynthesisStatus,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    overviewPreview: (row.overview || "").slice(0, OVERVIEW_PREVIEW_MAX_LENGTH),
    consensusCount: row.consensus?.length || 0,
    divergenceCount: row.divergence?.length || 0,
    blindSpotCount: row.blind_spots?.length || 0,
  };
}
