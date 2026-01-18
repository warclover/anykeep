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
  t1Reason?: 'low_confidence' | 'vector_conflict' | 'manual_request';
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
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ClassificationPipelineError';
  }
}
