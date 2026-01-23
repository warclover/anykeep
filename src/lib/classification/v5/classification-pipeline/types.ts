/**
 * 智能分类 v5.0 - ClassificationPipeline 类型定义
 */

/**
 * 分类请求
 */
export interface ClassificationRequest {
  /** 用户 ID */
  userId: string;
  /** 书签 ID */
  bookmarkId: string;
  /** 书签标题 */
  title: string;
  /** 书签描述 */
  description?: string;
  /** 书签摘要 */
  summary?: string;
  /** 书签标签 */
  tags?: string[];
  /** 书签 URL */
  url: string;
  /** v6: 默认文件夹 ID（用于兜底） */
  defaultFolderId?: string;
}

/**
 * T0 快速生成结果
 */
export interface T0Result {
  /** 推荐的文件夹 ID */
  folderId: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 候选文件夹列表 */
  candidates: Array<{
    folderId: string;
    folderName: string;
    similarity: number;
  }>;
  /** 是否需要 T1 纠正 */
  needsT1: boolean;
  /** T1 触发原因 */
  t1Reason?: "low_confidence" | "vector_conflict" | "manual_request";
  /** 延迟（毫秒） */
  latencyMs: number;
}

/**
 * T1 纠正结果
 */
export interface T1Result {
  /** 推荐的文件夹 ID */
  folderId: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** LLM 推理过程 */
  reasoning: string;
  /** 延迟（毫秒） */
  latencyMs: number;
}

/**
 * L0 规则匹配结果
 */
export interface L0MatchResult {
  /** 是否匹配到规则 */
  matched: boolean;
  /** 匹配的文件夹 ID */
  folderId?: string;
  /** 匹配的规则名称 */
  ruleName?: string;
  /** 置信度 (0-1) */
  confidence?: number;
}

/**
 * 混合检索结果
 */
export interface HybridRetrievalResult {
  /** 文件夹 ID */
  folderId: string;
  /** 文件夹名称 */
  folderName: string;
  /** 内容相似度 */
  contentSimilarity: number;
  /** 行为相似度 */
  behaviorSimilarity: number;
  /** 融合分数 */
  fusedScore: number;
}

/**
 * LLM 调用请求
 */
export interface LLMCallRequest {
  /** 书签信息 */
  bookmark: ClassificationRequest;
  /** 候选文件夹列表 */
  candidates: Array<{
    folderId: string;
    folderName: string;
    description?: string;
    score: number;
    /** v6: 示例书签标题（用于 LLM 理解文件夹内容） */
    sampleBookmarks?: string[];
    /** v6: 关键词标签 */
    keywordTags?: string[];
  }>;
}

/**
 * ClassificationPipeline 配置
 */
export interface ClassificationPipelineConfig {
  /** T0 置信度阈值 */
  t0ConfidenceThreshold: number;
  /** 向量冲突阈值 */
  vectorConflictThreshold: number;
  /** 混合检索权重 */
  hybridWeights: {
    content: number;
    behavior: number;
  };
  /** RRF 常数 */
  rrfK: number;
}

/**
 * ClassificationPipeline 错误
 */
export class ClassificationPipelineError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ClassificationPipelineError";
  }
}

// =============================================================================
// AI 标签匹配器类型定义 (v5.1)
// =============================================================================

/**
 * 文件夹标签画像
 */
export interface FolderTagProfile {
  /** 文件夹 ID */
  folderId: number;
  /** 文件夹名称 */
  folderName: string;
  /** 核心标签（出现频率 > 30% 的标签） */
  coreTags: string[];
  /** 相关标签（出现频率 10%-30%） */
  relatedTags: string[];
  /** 文件夹名分词 */
  folderNameTokens: string[];
  /** 书签数量 */
  bookmarkCount: number;
}

/**
 * 标签匹配类型
 */
export type TagMatchType =
  | "exact_name"
  | "core_tag"
  | "related_tag"
  | "semantic";

/**
 * 标签匹配结果
 */
export interface TagMatchResult {
  /** 是否匹配成功 */
  matched: boolean;
  /** 匹配的文件夹 ID */
  folderId: string;
  /** 匹配的文件夹名称 */
  folderName: string;
  /** 匹配置信度 (0-1) */
  confidence: number;
  /** 匹配类型 */
  matchType: TagMatchType;
  /** 命中的标签列表 */
  matchedTags: string[];
  /** 匹配原因说明 */
  reason: string;
}

/**
 * 标签匹配器配置
 */
export interface TagMatcherConfig {
  /** 精确匹配置信度 (默认 0.98) */
  exactMatchConfidence: number;
  /** 核心标签匹配置信度 (默认 0.92) */
  coreTagConfidence: number;
  /** 相关标签匹配置信度 (默认 0.85) */
  relatedTagConfidence: number;
  /** 最小匹配标签数 (默认 1) */
  minMatchingTags: number;
  /** 核心标签最小命中数（用于高置信度，默认 2） */
  minCoreTagHits: number;
}
