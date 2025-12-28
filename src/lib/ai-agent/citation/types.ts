/**
 * 引用追踪系统类型定义
 *
 * 支持为搜索结果建立引用索引，并在 AI 响应中生成 [^N] 格式引用
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

// ============================================================================
// 基础类型
// ============================================================================

/**
 * 单个引用
 */
export interface Citation {
  /** 引用编号 (1-based) */
  index: number;
  /** 关联的书签 ID */
  bookmarkId: number;
  /** 书签标题 */
  title: string;
  /** 书签 URL */
  url: string;
  /** 来源平台 */
  platform?: string;
  /** 摘要（可选） */
  summary?: string;
  /** 相关性得分 (0-1) */
  relevanceScore?: number;
}

/**
 * 引用索引（会话级别）
 */
export interface CitationIndex {
  /** 会话 ID */
  conversationId: string;
  /** 引用映射 (index -> Citation) */
  citations: Map<number, Citation>;
  /** 书签 ID 到引用编号的反向映射 */
  bookmarkToIndex: Map<number, number>;
  /** 下一个可用的引用编号 */
  nextIndex: number;
  /** 创建时间 */
  createdAt: number;
  /** 最后更新时间 */
  updatedAt: number;
}

/**
 * 搜索结果项（用于建立引用）
 */
export interface SearchResultItem {
  /** 书签 ID */
  bookmarkId: number;
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** 平台 */
  platform?: string;
  /** 摘要 */
  summary?: string;
  /** 相关性得分 */
  score?: number;
}

// ============================================================================
// 引用标注类型
// ============================================================================

/**
 * 引用标注结果
 */
export interface CitationAnnotationResult {
  /** 标注后的文本 */
  annotatedText: string;
  /** 使用的引用编号列表 */
  usedCitations: number[];
  /** 匹配到的引用数量 */
  matchCount: number;
  /** 是否有新增引用 */
  hasNewCitations: boolean;
}

/**
 * 序数引用模式
 */
export interface OrdinalPattern {
  /** 正则表达式 */
  pattern: RegExp;
  /** 提取序数的函数 */
  extractOrdinal: (match: RegExpMatchArray) => number;
}

// ============================================================================
// 引用渲染类型
// ============================================================================

/**
 * 引用列表渲染选项
 */
export interface CitationRenderOptions {
  /** 标题 */
  title?: string;
  /** 是否显示平台 */
  showPlatform?: boolean;
  /** 是否显示摘要 */
  showSummary?: boolean;
  /** 最大显示数量 */
  maxItems?: number;
  /** 输出格式 */
  format?: "markdown" | "html" | "plain";
}

/**
 * 引用渲染结果
 */
export interface CitationRenderResult {
  /** 渲染后的文本 */
  content: string;
  /** 渲染的引用数量 */
  count: number;
  /** 是否截断 */
  truncated: boolean;
}

// ============================================================================
// 引用增强类型
// ============================================================================

/**
 * 引用增强配置
 */
export interface CitationEnricherConfig {
  /** 是否自动标注 */
  autoAnnotate?: boolean;
  /** 是否追加引用列表 */
  appendReferences?: boolean;
  /** 引用列表标题 */
  referencesTitle?: string;
  /** 引用置信度阈值 (低于此值不引用) */
  minConfidence?: number;
}

/**
 * 引用增强结果
 */
export interface CitationEnrichResult {
  /** 增强后的文本 */
  enrichedText: string;
  /** 使用的引用列表 */
  citations: Citation[];
  /** 是否有引用 */
  hasCitations: boolean;
  /** 引用统计 */
  stats: {
    /** 总引用数 */
    total: number;
    /** 文内引用数 */
    inlineCount: number;
    /** 列表引用数 */
    listCount: number;
  };
}

// ============================================================================
// 流式输出类型
// ============================================================================

/**
 * 引用块数据
 */
export interface CitationChunkData {
  /** 是否已建立索引 */
  indexed: boolean;
  /** 总引用数 */
  totalCitations: number;
  /** 引用摘要列表 */
  citationSummary: Array<{
    index: number;
    title: string;
    bookmarkId: number;
  }>;
  /** 搜索查询（触发引用的查询） */
  query?: string;
}

// ============================================================================
// 常量
// ============================================================================

/**
 * 中文序数词映射
 */
export const CHINESE_ORDINAL_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  第一: 1,
  第二: 2,
  第三: 3,
  第四: 4,
  第五: 5,
  第六: 6,
  第七: 7,
  第八: 8,
  第九: 9,
  第十: 10,
};

/**
 * 默认引用增强配置
 */
export const DEFAULT_CITATION_CONFIG: Required<CitationEnricherConfig> = {
  autoAnnotate: true,
  appendReferences: true,
  referencesTitle: "参考来源",
  minConfidence: 0.3,
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 创建空的引用索引
 */
export function createCitationIndex(conversationId: string): CitationIndex {
  return {
    conversationId,
    citations: new Map(),
    bookmarkToIndex: new Map(),
    nextIndex: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * 创建引用增强配置
 */
export function createCitationConfig(
  overrides?: Partial<CitationEnricherConfig>,
): Required<CitationEnricherConfig> {
  return {
    ...DEFAULT_CITATION_CONFIG,
    ...overrides,
  };
}

/**
 * 将搜索结果转换为引用
 */
export function searchResultToCitation(
  item: SearchResultItem,
  index: number,
): Citation {
  return {
    index,
    bookmarkId: item.bookmarkId,
    title: item.title,
    url: item.url,
    platform: item.platform,
    summary: item.summary,
    relevanceScore: item.score,
  };
}
