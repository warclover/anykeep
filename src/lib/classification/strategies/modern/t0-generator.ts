/**
 * 智能分类 v5.0 - T0 生成器
 *
 * T0快速生成（<500ms）：L0规则 → 混合检索
 *
 * v5.1.2: 添加常量定义，明确行为向量临时方案
 */

import type { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger";
import type { IEmbeddingService } from "@/lib/classification/infrastructure/shared-services/embedding";
import type { L0RuleMatcher } from "./l0-rule-matcher";
import type { HybridRetriever } from "./hybrid-retriever";
import type { LLMCaller } from "./llm-caller";
import type { ClassificationRequest, T0Result } from "./types";

/**
 * 书签文本最大长度（用于 embedding 生成）
 */
const MAX_BOOKMARK_TEXT_LENGTH = 8000;

/**
 * T1 触发阈值配置
 */
const T1_THRESHOLDS = {
  /** 低置信度阈值 */
  LOW_CONFIDENCE: 0.75,
  /** 向量冲突分数差阈值 */
  VECTOR_CONFLICT_DIFF: 0.1,
} as const;

/**
 * T0 生成器类
 */
export class T0Generator {
  private logger: LoggerService;
  private embeddingService: IEmbeddingService;
  private l0Matcher: L0RuleMatcher;
  private hybridRetriever: HybridRetriever;
  private llmCaller: LLMCaller;

  constructor(
    logger: LoggerService,
    embeddingService: IEmbeddingService,
    l0Matcher: L0RuleMatcher,
    hybridRetriever: HybridRetriever,
    llmCaller: LLMCaller,
  ) {
    this.logger = logger.child({ service: "T0Generator" });
    this.embeddingService = embeddingService;
    this.l0Matcher = l0Matcher;
    this.hybridRetriever = hybridRetriever;
    this.llmCaller = llmCaller;
  }

  /**
   * 生成T0结果
   */
  async generate(request: ClassificationRequest): Promise<T0Result> {
    const startTime = Date.now();

    this.logger.info("开始T0生成", {
      bookmarkId: request.bookmarkId,
    });

    // 1. L0规则匹配 (v5.1: L0RuleMatcher.match 现在是异步的，支持 AI 标签匹配)
    const l0Result = await this.l0Matcher.match(request);
    if (l0Result.matched && l0Result.folderId && l0Result.confidence) {
      const latencyMs = Date.now() - startTime;

      this.logger.info("L0规则匹配成功", {
        folderId: l0Result.folderId,
        latencyMs,
      });

      return {
        folderId: l0Result.folderId,
        confidence: l0Result.confidence,
        candidates: [
          {
            folderId: l0Result.folderId,
            folderName: "", // L0规则不返回文件夹名称
            similarity: l0Result.confidence,
          },
        ],
        needsT1: false,
        latencyMs,
      };
    }

    // 2. 生成书签向量
    const bookmarkText = this.buildBookmarkText(request);
    const bookmarkEmbedding =
      await this.embeddingService.generateEmbedding(bookmarkText);

    // 3. 混合检索（v5.1: 传递标题用于名称护栏）
    // NOTE: 行为向量暂未实现，当前使用内容向量作为占位符
    // TODO: 实现用户行为向量（基于历史点击、收藏时间等）以提升分类准确率
    const retrievalResults = await this.hybridRetriever.retrieve(
      request.userId,
      bookmarkEmbedding.embedding,
      bookmarkEmbedding.embedding, // FIXME: 行为向量未实现，暂用内容向量
      request.title, // v5.1: 传递标题用于名称相似度计算
    );

    // v5.1 修复: 无文件夹时优雅降级到 inbox，而非抛出异常
    if (retrievalResults.length === 0) {
      this.logger.warn("无可用文件夹，降级到 inbox", {
        bookmarkId: request.bookmarkId,
        userId: request.userId,
      });

      const latencyMs = Date.now() - startTime;
      return {
        folderId: request.defaultFolderId ?? 0,
        confidence: 0,
        candidates: [],
        needsT1: false,
        t1Reason: undefined,
        latencyMs,
      };
    }

    // 4. 构建T0结果
    const topResult = retrievalResults[0];
    const confidence = topResult.fusedScore;

    const candidates = retrievalResults.map((r) => ({
      folderId: r.folderId,
      folderName: r.folderName,
      similarity: r.fusedScore,
    }));

    // 5. 判断是否需要T1纠正
    const needsT1 = this.llmCaller.shouldCallLLM({
      folderId: topResult.folderId,
      confidence,
      candidates,
      needsT1: false,
      latencyMs: 0,
    });

    const latencyMs = Date.now() - startTime;

    this.logger.info("T0生成完成", {
      folderId: topResult.folderId,
      confidence,
      needsT1,
      latencyMs,
    });

    return {
      folderId: topResult.folderId,
      confidence,
      candidates,
      needsT1,
      t1Reason: needsT1
        ? this.determineT1Reason(confidence, candidates)
        : undefined,
      latencyMs,
    };
  }

  /**
   * 构建书签文本
   */
  private buildBookmarkText(request: ClassificationRequest): string {
    const parts = [
      request.title,
      request.description || "",
      request.summary || "",
      ...(request.tags || []),
    ];
    return parts.join(" ").slice(0, MAX_BOOKMARK_TEXT_LENGTH);
  }

  /**
   * 确定T1触发原因
   */
  private determineT1Reason(
    confidence: number,
    candidates: Array<{ similarity: number }>,
  ): "low_confidence" | "vector_conflict" {
    if (confidence < T1_THRESHOLDS.LOW_CONFIDENCE) {
      return "low_confidence";
    }

    if (candidates.length >= 2) {
      const scoreDiff = candidates[0].similarity - candidates[1].similarity;
      if (scoreDiff < T1_THRESHOLDS.VECTOR_CONFLICT_DIFF) {
        return "vector_conflict";
      }
    }

    return "low_confidence";
  }
}
