/**
 * AI Summary Service Interface
 *
 * 摘要服务核心接口定义
 *
 * @version 2.0.0
 * @since 2025-12-12
 */

import type {
  SummaryInput,
  SummaryResult,
  SummaryServiceConfig,
  SummaryServiceStats,
  GenerateOptions,
  ProviderHealth,
  ProviderName,
} from "../summary.types";

/**
 * 摘要服务接口
 *
 * 核心服务接口，定义摘要生成的所有操作
 *
 * @example
 * ```typescript
 * const service = new SummaryService();
 *
 * // 生成单个摘要
 * const result = await service.generate({
 *   bookmarkId: 123,
 *   userId: 'user-uuid',
 *   title: '文章标题',
 *   content: '文章内容...',
 * });
 *
 * // 批量生成
 * const results = await service.generateBatch([input1, input2, input3]);
 * ```
 */
export interface ISummaryService {
  /**
   * 生成摘要
   *
   * 核心方法：为单个书签生成摘要和标签
   *
   * 流程：
   * 1. 获取可用 Provider
   * 2. 调用 Provider.generateSummary
   * 3. 发布 summary:completed 事件
   * 4. 记录质量日志
   * 5. 如果失败且启用 Fallback，尝试备用 Provider
   *
   * @param input - 摘要输入
   * @param options - 生成选项
   * @returns 摘要结果
   * @throws {SummaryError} 当所有 Provider 都失败时
   */
  generate(
    input: SummaryInput,
    options?: GenerateOptions,
  ): Promise<SummaryResult>;

  /**
   * 批量生成摘要
   *
   * 并发处理多个书签的摘要生成
   *
   * @param inputs - 摘要输入数组
   * @param options - 生成选项
   * @returns 摘要结果数组（失败的项返回 Error）
   */
  generateBatch(
    inputs: SummaryInput[],
    options?: GenerateOptions,
  ): Promise<Array<SummaryResult | Error>>;

  /**
   * 重新生成摘要
   *
   * 为已有书签重新生成摘要（忽略现有摘要）
   *
   * @param bookmarkId - 书签 ID
   * @param userId - 用户 ID
   * @param options - 生成选项
   * @returns 摘要结果
   */
  regenerate(
    bookmarkId: number,
    userId: string,
    options?: GenerateOptions,
  ): Promise<SummaryResult>;

  /**
   * 获取所有 Provider 健康状态
   *
   * @returns Provider 健康状态映射
   */
  getProvidersHealth(): Promise<Map<ProviderName, ProviderHealth>>;

  /**
   * 获取服务统计
   *
   * @returns 服务统计信息
   */
  getStats(): Promise<SummaryServiceStats>;

  /**
   * 获取服务配置
   *
   * @returns 当前服务配置
   */
  getConfig(): SummaryServiceConfig;
}

/**
 * 内容提取服务接口
 *
 * 负责从 URL 提取内容（标题、描述、正文）
 */
export interface IContentFetcherService {
  /**
   * 提取内容
   *
   * @param url - 网页 URL
   * @returns 提取的内容
   */
  fetchContent(url: string): Promise<FetchedContent>;

  /**
   * 检测内容类型
   *
   * @param input - 检测输入
   * @returns 内容类型结果
   */
  detectContentType(input: ContentTypeInput): Promise<ContentTypeOutput>;
}

/**
 * 提取的内容
 */
export interface FetchedContent {
  /** 标题 */
  title: string;
  /** 描述 */
  description?: string;
  /** 正文内容 */
  content?: string;
  /** 字数 */
  wordCount?: number;
  /** 图片数 */
  imageCount?: number;
  /** 发布时间 */
  publishTime?: string;
  /** 作者 */
  author?: string;
  /** 封面图 */
  coverUrl?: string;
  /** 平台 */
  platform?: string;
  /** 最终 URL（跟随重定向后） */
  finalUrl?: string;
}

/**
 * 内容类型检测输入
 */
export interface ContentTypeInput {
  url?: string;
  title: string;
  description?: string;
  content?: string;
}

/**
 * 内容类型检测输出
 */
export interface ContentTypeOutput {
  type: "article" | "tutorial" | "video" | "tool";
  confidence: number;
  signals: string[];
}

/**
 * 质量追踪服务接口
 *
 * 负责记录和分析摘要质量
 */
export interface IQualityTrackerService {
  /**
   * 记录质量日志
   *
   * @param log - 质量日志条目
   */
  track(log: QualityLogInput): Promise<void>;

  /**
   * 记录用户反馈
   *
   * @param bookmarkId - 书签 ID
   * @param userId - 用户 ID
   * @param rating - 评分 (1-5)
   * @param feedback - 文字反馈
   */
  recordFeedback(
    bookmarkId: number,
    userId: string,
    rating: number,
    feedback?: string,
  ): Promise<void>;

  /**
   * 获取质量统计
   *
   * @param userId - 用户 ID
   * @param timeRange - 时间范围
   * @returns 质量统计
   */
  getStats(
    userId: string,
    timeRange?: { start: Date; end: Date },
  ): Promise<QualityStatsOutput>;

  /**
   * 计算自动质量分
   *
   * @param result - 摘要结果
   * @param input - 摘要输入
   * @returns 质量分 (0-1)
   */
  calculateAutoScore(result: SummaryResult, input: SummaryInput): number;
}

/**
 * 质量日志输入
 */
export interface QualityLogInput {
  /** 摘要输入 */
  input: SummaryInput;
  /** 摘要结果 */
  result: SummaryResult;
  /** 使用的 Provider */
  provider: string;
  /** 使用的模型 */
  model: string;
  /** Prompt 版本 */
  promptVersion?: string;
  /** 错误代码 */
  errorCode?: string;
  /** 错误消息 */
  errorMessage?: string;
  /** 是否使用了 Fallback */
  fallbackUsed?: boolean;
}

/**
 * 质量统计输出
 */
export interface QualityStatsOutput {
  totalCount: number;
  successCount: number;
  failedCount: number;
  averageQualityScore: number;
  averageLatencyMs: number;
  averageUserRating?: number;
  providerDistribution: Record<ProviderName, number>;
  fallbackRate: number;
  /** 质量趋势 */
  qualityTrend?: "improving" | "stable" | "declining";
}
