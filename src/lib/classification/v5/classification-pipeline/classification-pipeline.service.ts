/**
 * 智能分类 v5.0 - ClassificationPipeline 主服务
 *
 * 整合 L0 规则匹配、T0 快速生成、T1 异步纠正
 * v6: 添加 FolderContextProvider 为 T1 提供示例书签
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoggerService } from "../shared/logger";
import type { IEmbeddingService } from "../shared/embedding";
import type { VectorSearchService } from "../shared/vector-search";
import type { LLMService } from "../shared/llm";
import { L0RuleMatcher, type Rule } from "./l0-rule-matcher";
import { T0Generator } from "./t0-generator";
import { T1Corrector } from "./t1-corrector";
import { HybridRetriever } from "./hybrid-retriever";
import { LLMCaller } from "./llm-caller";
import { FolderContextProvider } from "./folder-context-provider";
import type {
  ClassificationRequest,
  ClassificationPipelineConfig,
} from "./types";
import type { FolderId } from "@/lib/shared/types";
import { ClassificationPipelineError } from "./types";

/**
 * 分类结果
 */
export interface ClassificationResult {
  /** 推荐的文件夹 ID */
  folderId: FolderId;
  /** 置信度 (0-1) */
  confidence: number;
  /** 是否使用了 T1 纠正 */
  usedT1: boolean;
  /** T1 推理过程（如果使用了 T1） */
  reasoning?: string;
  /** 总延迟（毫秒） */
  totalLatencyMs: number;
  /** T0 延迟（毫秒） */
  t0LatencyMs: number;
  /** T1 延迟（毫秒，如果使用了 T1） */
  t1LatencyMs?: number;
}

/**
 * ClassificationPipeline 主服务
 */
export class ClassificationPipelineService {
  private logger: LoggerService;
  private config: ClassificationPipelineConfig;
  private l0Matcher: L0RuleMatcher;
  private t0Generator: T0Generator;
  private t1Corrector: T1Corrector;
  private folderContextProvider?: FolderContextProvider;
  /** v6.3: 保存 supabase 引用，用于 loadUserRules 重建 L0RuleMatcher */
  private supabase?: SupabaseClient;

  constructor(
    logger: LoggerService,
    embeddingService: IEmbeddingService,
    vectorSearch: VectorSearchService,
    llmService: LLMService,
    config?: Partial<ClassificationPipelineConfig>,
    supabase?: SupabaseClient,
  ) {
    this.logger = logger.child({ service: "ClassificationPipeline" });

    // 默认配置
    this.config = {
      t0ConfidenceThreshold: config?.t0ConfidenceThreshold ?? 0.85,
      vectorConflictThreshold: config?.vectorConflictThreshold ?? 0.15,
      hybridWeights: {
        content: config?.hybridWeights?.content ?? 0.7,
        behavior: config?.hybridWeights?.behavior ?? 0.3,
      },
      rrfK: config?.rrfK ?? 60, // v6.2: 回退到60，修复分类回归问题
    };

    // 初始化组件（v5.1: 传递 embeddingService 用于名称护栏）
    const hybridRetriever = new HybridRetriever(
      logger,
      vectorSearch,
      {
        contentWeight: this.config.hybridWeights.content,
        behaviorWeight: this.config.hybridWeights.behavior,
        rrfK: this.config.rrfK,
        topK: 8, // v6.1: 扩展候选集从 5 到 8，提高正确答案入围概率
        useRawSimilarity: true, // v6: 使用原始相似度
      },
      embeddingService, // v5.1: 传递用于名称相似度计算
    );

    const llmCaller = new LLMCaller(logger, llmService, {
      lowConfidenceThreshold: this.config.t0ConfidenceThreshold,
      vectorConflictThreshold: this.config.vectorConflictThreshold,
    });

    // v6: 初始化 FolderContextProvider（如果提供了 supabase 客户端）
    if (supabase) {
      this.folderContextProvider = new FolderContextProvider(logger, supabase);
      this.logger.info("FolderContextProvider 已初始化，T1 将使用示例书签增强");
    }

    // v6.3: 保存 supabase 引用
    this.supabase = supabase;

    // v5.1 修复：传递 supabase 以启用 AI 标签匹配器
    this.l0Matcher = new L0RuleMatcher(logger, [], supabase);
    this.t0Generator = new T0Generator(
      logger,
      embeddingService,
      this.l0Matcher,
      hybridRetriever,
      llmCaller,
    );
    // v6: 传递 FolderContextProvider 给 T1Corrector
    this.t1Corrector = new T1Corrector(
      logger,
      llmCaller,
      this.folderContextProvider,
    );
  }

  /**
   * 执行分类
   */
  async classify(
    request: ClassificationRequest,
  ): Promise<ClassificationResult> {
    const startTime = Date.now();

    this.logger.info("开始分类", {
      bookmarkId: request.bookmarkId,
      userId: request.userId,
      title: request.title,
    });

    try {
      // Step 1: L0 规则匹配
      const l0Result = await this.l0Matcher.match(request);
      if (l0Result.matched && l0Result.folderId) {
        this.logger.info("L0 规则匹配成功", {
          bookmarkId: request.bookmarkId,
          folderId: l0Result.folderId,
          ruleName: l0Result.ruleName,
          confidence: l0Result.confidence,
        });

        const totalLatency = Date.now() - startTime;
        return {
          folderId: l0Result.folderId,
          confidence: l0Result.confidence ?? 1.0,
          usedT1: false,
          totalLatencyMs: totalLatency,
          t0LatencyMs: totalLatency,
        };
      }

      // Step 2: T0 快速生成
      const t0Result = await this.t0Generator.generate(request);

      this.logger.info("T0 生成完成", {
        bookmarkId: request.bookmarkId,
        folderId: t0Result.folderId,
        confidence: t0Result.confidence,
        needsT1: t0Result.needsT1,
        t1Reason: t0Result.t1Reason,
        latencyMs: t0Result.latencyMs,
      });

      // Step 3: 判断是否需要 T1 纠正
      if (!t0Result.needsT1) {
        const totalLatency = Date.now() - startTime;

        // v6: null 分类兜底处理
        const finalFolderId = this.ensureValidFolderId(
          t0Result.folderId,
          request.defaultFolderId,
        );

        return {
          folderId: finalFolderId,
          confidence: t0Result.confidence,
          usedT1: false,
          totalLatencyMs: totalLatency,
          t0LatencyMs: t0Result.latencyMs,
        };
      }

      // Step 4: T1 异步纠正
      const t1Result = await this.t1Corrector.correct(request, t0Result);

      this.logger.info("T1 纠正完成", {
        bookmarkId: request.bookmarkId,
        t0FolderId: t0Result.folderId,
        t1FolderId: t1Result.folderId,
        t0Confidence: t0Result.confidence,
        t1Confidence: t1Result.confidence,
        latencyMs: t1Result.latencyMs,
      });

      const totalLatency = Date.now() - startTime;

      // v6: null 分类兜底处理
      const finalFolderId = this.ensureValidFolderId(
        t1Result.folderId,
        request.defaultFolderId,
      );

      return {
        folderId: finalFolderId,
        confidence: t1Result.confidence,
        usedT1: true,
        reasoning: t1Result.reasoning,
        totalLatencyMs: totalLatency,
        t0LatencyMs: t0Result.latencyMs,
        t1LatencyMs: t1Result.latencyMs,
      };
    } catch (error) {
      this.logger.error(
        "分类失败",
        error instanceof Error ? error : undefined,
        {
          bookmarkId: request.bookmarkId,
        },
      );

      throw new ClassificationPipelineError(
        `分类失败: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /**
   * 批量分类
   * v6.3 修复: 使用 allSettled 容忍部分失败，返回成功结果和错误信息
   */
  async classifyBatch(
    requests: ClassificationRequest[],
  ): Promise<(ClassificationResult | { error: string; bookmarkId: string })[]> {
    this.logger.info("开始批量分类", {
      count: requests.length,
    });

    const results = await Promise.allSettled(
      requests.map((request) => this.classify(request)),
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failureCount = results.filter((r) => r.status === "rejected").length;

    this.logger.info("批量分类完成", {
      total: requests.length,
      success: successCount,
      failure: failureCount,
    });

    return results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        this.logger.error(
          "批量分类中的单个请求失败",
          result.reason instanceof Error ? result.reason : undefined,
          {
            index,
            bookmarkId: requests[index].bookmarkId,
          },
        );

        // v6.3 修复: 返回错误对象而非抛出异常，保持 allSettled 语义
        return {
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
          bookmarkId: requests[index].bookmarkId,
        };
      }
    });
  }

  /**
   * 仅执行L0+T0阶段（用于Optimistic UI）
   * 返回T0结果和是否需要T1纠正的标志
   */
  async classifyT0Only(
    request: ClassificationRequest,
  ): Promise<ClassificationResult & { needsT1: boolean; t1Reason?: string }> {
    const startTime = Date.now();

    this.logger.info("开始T0分类（Optimistic模式）", {
      bookmarkId: request.bookmarkId,
      userId: request.userId,
      title: request.title,
    });

    try {
      // Step 1: L0 规则匹配
      const l0Result = await this.l0Matcher.match(request);
      if (l0Result.matched && l0Result.folderId) {
        this.logger.info("L0 规则匹配成功", {
          bookmarkId: request.bookmarkId,
          folderId: l0Result.folderId,
          ruleName: l0Result.ruleName,
          confidence: l0Result.confidence,
        });

        const totalLatency = Date.now() - startTime;
        return {
          folderId: l0Result.folderId,
          confidence: l0Result.confidence ?? 1.0,
          usedT1: false,
          totalLatencyMs: totalLatency,
          t0LatencyMs: totalLatency,
          needsT1: false,
        };
      }

      // Step 2: T0 快速生成
      const t0Result = await this.t0Generator.generate(request);

      this.logger.info("T0 生成完成（Optimistic模式）", {
        bookmarkId: request.bookmarkId,
        folderId: t0Result.folderId,
        confidence: t0Result.confidence,
        needsT1: t0Result.needsT1,
        t1Reason: t0Result.t1Reason,
        latencyMs: t0Result.latencyMs,
      });

      const totalLatency = Date.now() - startTime;
      return {
        folderId: t0Result.folderId,
        confidence: t0Result.confidence,
        usedT1: false,
        totalLatencyMs: totalLatency,
        t0LatencyMs: t0Result.latencyMs,
        needsT1: t0Result.needsT1,
        t1Reason: t0Result.t1Reason,
      };
    } catch (error) {
      this.logger.error(
        "T0分类失败",
        error instanceof Error ? error : undefined,
        {
          bookmarkId: request.bookmarkId,
        },
      );

      throw new ClassificationPipelineError(
        `T0分类失败: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /**
   * 加载用户自定义规则到 L0RuleMatcher
   * v6.3 修复: 传递 supabase 参数，保持 AI 标签匹配功能
   */
  loadUserRules(rules: Rule[]): void {
    const currentRuleCount = this.l0Matcher.getRules().length;
    this.logger.debug("清空现有L0规则", { count: currentRuleCount });

    // v6.3 修复: 传递 supabase 以保持 AI 标签匹配功能
    this.l0Matcher = new L0RuleMatcher(this.logger, rules, this.supabase);

    this.logger.info("用户规则已加载到L0RuleMatcher", {
      ruleCount: rules.length,
    });
  }

  /**
   * v6: 确保返回有效的 folderId，处理 null/undefined 情况
   */
  private ensureValidFolderId(
    folderId: FolderId | null | undefined,
    defaultFolderId?: FolderId,
  ): FolderId {
    // 检查是否为无效值
    if (!folderId || folderId === "null" || folderId === "undefined") {
      const fallbackId = defaultFolderId || "inbox";
      this.logger.warn("检测到无效 folderId，使用兜底值", {
        originalFolderId: folderId,
        fallbackFolderId: fallbackId,
      });
      return fallbackId;
    }
    return folderId;
  }
}
