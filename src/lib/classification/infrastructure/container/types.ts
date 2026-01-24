/**
 * Classification Container - Service Type Identifiers
 *
 * 服务类型标识符，用于依赖注入容器
 *
 * @version 1.0.0
 * @since 2026-01-24 Phase 4
 */

/**
 * 服务类型标识符
 *
 * 使用 Symbol 确保类型唯一性
 */
export const SERVICE_TYPES = {
  // ============================================================================
  // 基础设施服务
  // ============================================================================

  /** Supabase 客户端 */
  SupabaseClient: Symbol.for("SupabaseClient"),

  /** 日志服务 */
  Logger: Symbol.for("Logger"),

  // ============================================================================
  // 共享服务
  // ============================================================================

  /** 嵌入向量服务 */
  EmbeddingService: Symbol.for("EmbeddingService"),

  /** LLM 服务 */
  LLMService: Symbol.for("LLMService"),

  /** 向量搜索服务 */
  VectorSearchService: Symbol.for("VectorSearchService"),

  /** Feature Flags 服务 */
  FeatureFlagService: Symbol.for("FeatureFlagService"),

  // ============================================================================
  // 分类核心服务
  // ============================================================================

  /** 分类门面（统一入口） */
  ClassificationFacade: Symbol.for("ClassificationFacade"),

  /** 策略解析器 */
  StrategyResolver: Symbol.for("StrategyResolver"),

  /** Classic 策略（V4.1） */
  ClassicStrategy: Symbol.for("ClassicStrategy"),

  /** Modern 策略（V5.0） */
  ModernStrategy: Symbol.for("ModernStrategy"),

  // ============================================================================
  // Pipeline 组件
  // ============================================================================

  /** L0 规则匹配器 */
  L0RuleMatcher: Symbol.for("L0RuleMatcher"),

  /** T0 生成器 */
  T0Generator: Symbol.for("T0Generator"),

  /** T1 纠正器 */
  T1Corrector: Symbol.for("T1Corrector"),

  /** 混合检索器 */
  HybridRetriever: Symbol.for("HybridRetriever"),

  /** Pipeline 服务 */
  PipelineService: Symbol.for("PipelineService"),

  // ============================================================================
  // 画像服务
  // ============================================================================

  /** 文件夹画像器 */
  FolderProfiler: Symbol.for("FolderProfiler"),

  /** 用户阶段服务 */
  UserStageService: Symbol.for("UserStageService"),

  /** 兴趣服务 */
  InterestService: Symbol.for("InterestService"),

  /** 收件箱组织服务 */
  InboxOrganizerService: Symbol.for("InboxOrganizerService"),

  // ============================================================================
  // 仓储层
  // ============================================================================

  /** 文件夹仓储 */
  FolderRepository: Symbol.for("FolderRepository"),

  /** 书签仓储 */
  BookmarkRepository: Symbol.for("BookmarkRepository"),

  /** 建议仓储 */
  SuggestionRepository: Symbol.for("SuggestionRepository"),

  /** 文件夹画像仓储 */
  FolderProfileRepository: Symbol.for("FolderProfileRepository"),

  /** 兴趣仓储 */
  InterestRepository: Symbol.for("InterestRepository"),

  // ============================================================================
  // 反馈与规则服务
  // ============================================================================

  /** 反馈服务 */
  FeedbackService: Symbol.for("FeedbackService"),

  /** Chat-to-Rule 服务 */
  ChatToRuleService: Symbol.for("ChatToRuleService"),
} as const;

/**
 * 服务类型键
 */
export type ServiceTypeKey = keyof typeof SERVICE_TYPES;

/**
 * 服务类型值
 */
export type ServiceTypeSymbol = (typeof SERVICE_TYPES)[ServiceTypeKey];
