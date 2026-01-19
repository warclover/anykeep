/**
 * 智能分类 v5.0 - ClassificationPipeline 主服务
 *
 * 整合 L0 规则匹配、T0 快速生成、T1 异步纠正
 */

import type { LoggerService } from "../shared/logger";
import type { EmbeddingService } from "../shared/embedding";
import type { VectorSearchService } from "../shared/vector-search";
import type { LLMService } from "../shared/llm";
import { L0RuleMatcher, type Rule } from "./l0-rule-matcher";
import { T0Generator } from "./t0-generator";
import { T1Corrector } from "./t1-corrector";
import { HybridRetriever } from "./hybrid-retriever";
import { LLMCaller } from "./llm-caller";
import type {
  ClassificationRequest,
  ClassificationPipelineConfig,
} from "./types";
import { ClassificationPipelineError } from "./types";

/**
 * 分类结果
 */
export interface ClassificationResult {
  /** 推荐的文件夹 ID */
  folderId: string;
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

  constructor(
    logger: LoggerService,
    embeddingService: EmbeddingService,
    vectorSearch: VectorSearchService,
    llmService: LLMService,
    config?: Partial<ClassificationPipelineConfig>,
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
      rrfK: config?.rrfK ?? 60,
    };

    // 初始化组件（v5.1: 传递 embeddingService 用于名称护栏）
    const hybridRetriever = new HybridRetriever(
      logger,
      vectorSearch,
      {
        contentWeight: this.config.hybridWeights.content,
        behaviorWeight: this.config.hybridWeights.behavior,
        rrfK: this.config.rrfK,
        topK: 5,
      },
      embeddingService, // v5.1: 传递用于名称相似度计算
    );

    const llmCaller = new LLMCaller(logger, llmService, {
      lowConfidenceThreshold: this.config.t0ConfidenceThreshold,
      vectorConflictThreshold: this.config.vectorConflictThreshold,
    });

    this.l0Matcher = new L0RuleMatcher(logger);
    this.t0Generator = new T0Generator(
      logger,
      embeddingService,
      this.l0Matcher,
      hybridRetriever,
      llmCaller,
    );
    this.t1Corrector = new T1Corrector(logger, llmCaller);
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
        return {
          folderId: t0Result.folderId,
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
      return {
        folderId: t1Result.folderId,
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
   */
  async classifyBatch(
    requests: ClassificationRequest[],
  ): Promise<ClassificationResult[]> {
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

        // 返回默认结果（可以根据业务需求调整)
        throw new ClassificationPipelineError(
          `批量分类中的请求 ${index} 失败`,
          result.reason,
        );
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
   */
  loadUserRules(rules: Rule[]): void {
    // 清空现有规则
    const currentRules = this.l0Matcher.getRules();
    this.logger.debug("清空现有L0规则", { count: currentRules.length });

    // 重新初始化 L0RuleMatcher
    this.l0Matcher = new L0RuleMatcher(this.logger, rules);

    this.logger.info("用户规则已加载到L0RuleMatcher", {
      ruleCount: rules.length,
    });
  }
}
