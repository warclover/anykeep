/**
 * 智能分类 v5.0 - T0 生成器
 *
 * T0快速生成（<500ms）：L0规则 → 混合检索
 */

import type { LoggerService } from "../shared/logger";
import type { IEmbeddingService } from "../shared/embedding";
import type { L0RuleMatcher } from "./l0-rule-matcher";
import type { HybridRetriever } from "./hybrid-retriever";
import type { LLMCaller } from "./llm-caller";
import type { ClassificationRequest, T0Result } from "./types";

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

    // 1. L0规则匹配
    const l0Result = this.l0Matcher.match(request);
    if (l0Result.matched) {
      const latencyMs = Date.now() - startTime;

      this.logger.info("L0规则匹配成功", {
        folderId: l0Result.folderId,
        latencyMs,
      });

      return {
        folderId: l0Result.folderId!,
        confidence: l0Result.confidence!,
        candidates: [
          {
            folderId: l0Result.folderId!,
            folderName: "", // L0规则不返回文件夹名称
            similarity: l0Result.confidence!,
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
    const retrievalResults = await this.hybridRetriever.retrieve(
      request.userId,
      bookmarkEmbedding.embedding,
      bookmarkEmbedding.embedding, // 暂时使用相同的向量作为行为向量
      request.title, // v5.1: 传递标题用于名称相似度计算
    );

    if (retrievalResults.length === 0) {
      throw new Error("No folders found for classification");
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
    return parts.join(" ").slice(0, 8000);
  }

  /**
   * 确定T1触发原因
   */
  private determineT1Reason(
    confidence: number,
    candidates: Array<{ similarity: number }>,
  ): "low_confidence" | "vector_conflict" {
    if (confidence < 0.75) {
      return "low_confidence";
    }

    if (candidates.length >= 2) {
      const scoreDiff = candidates[0].similarity - candidates[1].similarity;
      if (scoreDiff < 0.1) {
        return "vector_conflict";
      }
    }

    return "low_confidence";
  }
}
