/**
 * Knowledge Extract Skill Types
 *
 * 知识萃取功能的类型定义
 * 从多篇收藏中提取、整合知识，支持 Perplexity 风格的来源标注
 *
 * @module ai-skills/skills/knowledge-extract
 */

/**
 * 萃取输出格式
 */
export type ExtractionFormat = "summary" | "memo" | "outline";

/**
 * 知识萃取请求
 */
export interface KnowledgeExtractInput {
  /** 目标书签 ID 列表 */
  bookmarkIds: number[];

  /** 可选：指定主题（未指定时自动识别） */
  topic?: string;

  /** 输出格式 */
  format: ExtractionFormat;

  /** 萃取选项 */
  options?: {
    /** 最大要点数（默认 7） */
    maxKeyPoints?: number;
    /** 是否包含概念定义（默认 true） */
    includeConceptDefinitions?: boolean;
    /** 是否包含行动建议（默认 false） */
    includeActionItems?: boolean;
  };
}

/**
 * 引用标注（Perplexity 风格）
 */
export interface Citation {
  /** 引用编号 [1], [2]... */
  id: number;
  /** 来源书签 ID */
  sourceId: number;
  /** 来源标题 */
  sourceTitle: string;
  /** 原文引用（可选） */
  quotedText?: string;
  /** 引用置信度 0-1 */
  confidence: number;
}

/**
 * 带来源标注的要点
 */
export interface KeyPoint {
  /** 要点唯一标识 */
  id: string;
  /** 要点内容 */
  content: string;
  /** 支撑引用 */
  citations: Citation[];
  /** 重要性 */
  importance: "high" | "medium";
  /** 是否为综合推断（从多个来源综合得出） */
  synthesized: boolean;
}

/**
 * 概念定义
 */
export interface ConceptDefinition {
  /** 概念名称 */
  term: string;
  /** 定义 */
  definition: string;
  /** 相关概念（可选） */
  relatedConcepts?: string[];
  /** 来源书签 ID 列表 */
  sourceIds: number[];
}

/**
 * 来源信息
 */
export interface SourceInfo {
  /** 书签 ID */
  id: number;
  /** 引用编号 [1] */
  index: number;
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** 平台 */
  platform: string;
  /** 收藏时间 */
  savedAt: Date;
}

/**
 * 萃取结果元数据
 */
export interface ExtractionMetadata {
  /** 来源数量 */
  sourceCount: number;
  /** 萃取时间 */
  extractedAt: Date;
  /** 输出格式 */
  format: ExtractionFormat;
  /** LLM 模型 */
  llmModel: string;
  /** 处理耗时（毫秒） */
  processingTimeMs: number;
}

/**
 * 知识萃取完整结果
 */
export interface KnowledgeExtraction {
  /** 结果唯一标识 */
  id: string;
  /** 自动生成的标题 */
  title: string;
  /** 识别/指定的主题 */
  topic: string;

  // 核心萃取内容
  /** 核心要点（3-7 个） */
  keyPoints: KeyPoint[];
  /** 核心概念 */
  concepts: ConceptDefinition[];
  /** 综合结论 */
  conclusion: string;
  /** 可选：行动建议 */
  actionItems?: string[];

  // 来源信息
  /** 来源书签列表 */
  sources: SourceInfo[];

  // 元数据
  /** 萃取元数据 */
  metadata: ExtractionMetadata;
}

/**
 * 书签内容（用于内部处理）
 */
export interface BookmarkContent {
  /** 书签 ID */
  bookmarkId: number;
  /** 标题 */
  title: string;
  /** 内容（全文或摘要） */
  content: string | null;
  /** AI 摘要 */
  summary: string | null;
  /** URL */
  url: string;
  /** 平台 */
  platform: string;
  /** 收藏时间 */
  savedAt: Date;
}

/**
 * LLM 提取要点的原始响应格式
 */
export interface RawKeyPointResponse {
  content: string;
  citations: number[];
  importance: "high" | "medium";
  synthesized?: boolean;
}

/**
 * LLM 提取概念的原始响应格式
 */
export interface RawConceptResponse {
  term: string;
  definition: string;
  relatedConcepts?: string[];
  sourceIds: number[];
}

/**
 * Skill 执行上下文扩展（步骤间数据传递）
 */
export interface ExtractionStepData {
  /** 获取到的书签内容 */
  contents?: BookmarkContent[];
  /** 识别的主题 */
  topic?: string;
  /** 萃取结果 */
  extraction?: KnowledgeExtraction;
  /** 格式化后的输出 */
  formatted?: string;
}
