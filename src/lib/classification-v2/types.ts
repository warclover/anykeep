/**
 * Classification V2 - 统一类型定义
 *
 * 设计原则：
 * - 所有类型集中在一个文件
 * - 清晰的输入/输出边界
 * - Scorer 接口是系统的核心契约
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

// ============================================================================
// 公开 API 类型
// ============================================================================

/**
 * 分类请求
 */
export interface ClassifyRequest {
  bookmarkId: string;
  title: string;
  url?: string;
  summary?: string;
  tags?: string[];
  userId: string;
}

/**
 * 分类行动类型
 *
 * - classify: 高置信度，自动分类
 * - suggest: 中置信度，生成建议待用户确认
 * - suggest_create: 无匹配文件夹，建议创建新文件夹
 * - inbox: 低置信度，放入待整理
 */
export type ClassifyAction =
  | "classify"
  | "suggest"
  | "suggest_create"
  | "inbox";

/**
 * 分类结果
 */
export interface ClassifyResult {
  /** 推荐的文件夹 ID（inbox 时为 null） */
  folderId: number | null;
  /** 推荐的文件夹名称 */
  folderName: string | null;
  /** 综合置信度 (0-1) */
  confidence: number;
  /** 行动类型 */
  action: ClassifyAction;
  /** 可读分类理由 */
  reason: string;
  /** 各 Scorer 详细得分（用于调试和学习） */
  scorerDetails: ScorerDetail[];
  /** Top-K 候选文件夹列表 */
  candidates: CandidateFolder[];
  /** 性能指标 */
  timing: ClassifyTiming;
  /** 如果 action=suggest_create，建议的新文件夹名 */
  suggestedFolderName?: string;
  /** 追踪 ID */
  traceId: string;
}

/**
 * 候选文件夹
 */
export interface CandidateFolder {
  folderId: number;
  folderName: string;
  /** 融合后的综合分数 (0-1) */
  mergedScore: number;
  /** 各 Scorer 对该文件夹的得分 */
  scorerBreakdown: Record<string, number>;
}

/**
 * 各 Scorer 的执行摘要
 */
export interface ScorerDetail {
  /** Scorer 名称 */
  scorer: string;
  /** 所属 tier */
  tier: ScorerTier;
  /** 实际使用的权重 */
  weight: number;
  /** 该 Scorer 推荐的 Top1 文件夹 */
  topFolderId: number | null;
  /** Top1 分数 */
  topScore: number;
  /** 是否实际执行 */
  executed: boolean;
  /** 跳过原因（如果 executed=false） */
  skippedReason?: string;
  /** 执行耗时 (ms) */
  durationMs: number;
}

/**
 * 性能指标
 */
export interface ClassifyTiming {
  totalMs: number;
  /** 每个 tier 的耗时 */
  tierMs: Partial<Record<ScorerTier, number>>;
  /** 在哪个 tier 提前终止（undefined = 走完全部） */
  earlyExitTier?: ScorerTier;
}

// ============================================================================
// Scorer 接口
// ============================================================================

/**
 * Scorer 层级
 *
 * - instant: <10ms（规则匹配、标签匹配）
 * - fast: <200ms（向量检索、历史匹配）
 * - slow: <3s（LLM 语义分类）
 */
export type ScorerTier = "instant" | "fast" | "slow";

/**
 * Scorer 接口 — 系统的核心契约
 *
 * 每个 Scorer 独立为候选文件夹打分。
 * 同 tier 内的 Scorer 并行执行。
 */
export interface Scorer {
  readonly name: string;
  readonly tier: ScorerTier;
  readonly defaultWeight: number;

  /**
   * 为每个候选文件夹打分
   *
   * @param bookmark - 书签上下文
   * @param candidates - 候选文件夹列表
   * @param userCtx - 用户上下文
   * @param priorResults - 前序 tier 的融合结果（供 slow tier 参考）
   * @returns Map<folderId, Score>
   */
  score(
    bookmark: BookmarkContext,
    candidates: FolderContext[],
    userCtx: UserContext,
    priorResults?: Map<number, MergedScore>,
  ): Promise<Map<number, Score>>;

  /**
   * 是否应该执行（动态跳过）
   * 默认返回 true
   */
  shouldRun?(bookmark: BookmarkContext, userCtx: UserContext): boolean;
}

/**
 * 单个 Scorer 对单个文件夹的评分
 */
export interface Score {
  /** 归一化分数 (0-1) */
  value: number;
  /** Scorer 对自身结果的置信度 (0-1) */
  confidence: number;
  /** 可读理由 */
  reason: string;
  /** 匹配信号明细 */
  signals: Signal[];
}

/**
 * 匹配信号
 */
export interface Signal {
  type: SignalType;
  /** 信号描述 */
  detail: string;
  /** 信号强度 (0-1) */
  strength: number;
}

export type SignalType =
  | "url_pattern"
  | "keyword"
  | "tag_exact"
  | "tag_alias"
  | "tag_partial"
  | "tag_core"
  | "tag_related"
  | "vector_sim"
  | "history"
  | "llm_semantic"
  | "name_similarity";

// ============================================================================
// Ranker 类型
// ============================================================================

/**
 * 融合后的分数（多个 Scorer 的加权合并结果）
 */
export interface MergedScore {
  /** 加权融合分数 (0-1) */
  value: number;
  /** 融合置信度 (0-1) */
  confidence: number;
  /** 文件夹信息 */
  folderId: number;
  folderName: string;
  /** 各 Scorer 的原始分数 */
  breakdown: Record<string, number>;
  /** 合并的所有信号 */
  signals: Signal[];
}

/**
 * CascadeRanker 配置
 */
export interface CascadeConfig {
  /** 每个 tier 执行后的提前终止阈值 */
  earlyExitThresholds: {
    instant: number;
    fast: number;
  };
  /** 最终结果的行动阈值 */
  actionThresholds: {
    autoClassify: number;
    suggest: number;
  };
  /** 最大返回候选数 */
  topK: number;
}

/**
 * Ranker 的排序结果（内部使用）
 */
export interface RankEntry {
  folderId: number;
  folderName: string;
  mergedScore: MergedScore;
  /** 在哪个 tier 确定的 */
  decidedAtTier: ScorerTier;
}

// ============================================================================
// Context 类型
// ============================================================================

/**
 * 书签上下文 — 标准化后的输入
 */
export interface BookmarkContext {
  bookmarkId: string;
  /** 标题（截断至 200 字） */
  title: string;
  url?: string;
  /** 摘要（截断至 300 字） */
  summary?: string;
  /** 标签（最多 10 个，已清洗） */
  tags: string[];
  /** 向量 (1024 维) */
  embedding: number[];
  /** 标准化标题（小写 + trim） */
  normalizedTitle: string;
  /** 标准化标签（小写 + trim） */
  normalizedTags: string[];
}

/**
 * 文件夹上下文
 */
export interface FolderContext {
  id: number;
  name: string;
  /** 标准化名称（小写 + trim） */
  normalizedName: string;
  /** 别名列表 */
  aliases: string[];
  /** 核心标签（前 5） */
  coreTags: string[];
  /** 相关标签 */
  relatedTags: string[];
  /** 最近 5 条书签标题（示例） */
  sampleTitles: string[];
  /** 从名称提取的关键词 */
  keywords: string[];
  /** 书签数量 */
  bookmarkCount: number;
  /** 名称向量（可选） */
  nameEmbedding?: number[];
  /** 画像向量（可选） */
  profileEmbedding?: number[];
}

/**
 * 用户自定义规则
 */
export interface UserRule {
  id: number;
  /** 规则名称 */
  name?: string;
  /** URL 域名匹配列表 */
  urlDomains: string[];
  /** 标题关键词匹配列表 */
  titleKeywords: string[];
  /** 标签匹配列表 */
  tags: string[];
  /** 目标文件夹 */
  folderId: number;
  folderName: string;
  /** 规则置信度 (0-1) */
  confidence: number;
  /** 优先级（越小越高） */
  priority: number;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 用户上下文
 */
export interface UserContext {
  userId: string;
  /** 用户级 Scorer 权重覆盖 */
  weights: Record<string, number>;
  /** 用户自定义规则 */
  rules: UserRule[];
  /** 用户阶段 */
  stage: UserStage;
  /** 文件夹数量 */
  folderCount: number;
}

/**
 * 用户阶段
 *
 * - cold_start: 0-20 书签
 * - growing: 21-100 书签
 * - mature: 100+ 书签
 */
export type UserStage = "cold_start" | "growing" | "mature";

// ============================================================================
// 反馈类型
// ============================================================================

/**
 * 分类反馈
 */
export interface ClassifyFeedback {
  userId: string;
  bookmarkId: string;
  /** 分类结果的追踪 ID */
  traceId: string;
  /** 用户选择的正确文件夹 */
  correctFolderId: number;
  /** 系统推荐的文件夹 */
  predictedFolderId: number | null;
  /** 各 Scorer 的预测结果 */
  scorerResults: ScorerDetail[];
}

/**
 * 用户级 Scorer 权重
 */
export interface UserScorerWeights {
  userId: string;
  weights: Record<string, number>;
  updatedAt: Date;
  /** 累计反馈次数 */
  feedbackCount: number;
}

// ============================================================================
// 批量操作类型
// ============================================================================

/**
 * 批量分类请求
 */
export interface BatchClassifyRequest {
  requests: ClassifyRequest[];
  /** 并发数 */
  concurrency?: number;
}

/**
 * 批量分类结果
 */
export interface BatchClassifyResult {
  results: Array<ClassifyResult & { bookmarkId: string }>;
  /** 总耗时 */
  totalMs: number;
  /** 成功数 */
  successCount: number;
  /** 失败数 */
  failedCount: number;
}

// ============================================================================
// 工具类型
// ============================================================================

/**
 * 生成追踪 ID
 */
export function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `clf2_${timestamp}_${random}`;
}
