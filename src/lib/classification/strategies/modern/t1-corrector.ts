/**
 * 智能分类 v5.0 - T1 纠正器
 *
 * T1异步纠正（<5s）：LLM深度分析
 * v6: 添加文件夹上下文（示例书签）提升 LLM 理解能力
 */

import type { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger";
import type { LLMCaller } from "./llm-caller";
import type { FolderContextProvider } from "./folder-context-provider";
import type { ClassificationRequest, T0Result, T1Result } from "./types";

/**
 * T1 纠正器类
 */
export class T1Corrector {
  private logger: LoggerService;
  private llmCaller: LLMCaller;
  private folderContextProvider?: FolderContextProvider;

  constructor(
    logger: LoggerService,
    llmCaller: LLMCaller,
    folderContextProvider?: FolderContextProvider,
  ) {
    this.logger = logger.child({ service: "T1Corrector" });
    this.llmCaller = llmCaller;
    this.folderContextProvider = folderContextProvider;
  }

  /**
   * 执行T1纠正
   */
  async correct(
    request: ClassificationRequest,
    t0Result: T0Result,
  ): Promise<T1Result> {
    this.logger.info("开始T1纠正", {
      bookmarkId: request.bookmarkId,
      t0FolderId: t0Result.folderId,
      t0Confidence: t0Result.confidence,
      t1Reason: t0Result.t1Reason,
    });

    // v6: 获取文件夹上下文（示例书签）
    let candidatesWithContext = t0Result.candidates.map((c) => ({
      folderId: c.folderId,
      folderName: c.folderName,
      score: c.similarity,
      sampleBookmarks: [] as string[],
      keywordTags: [] as string[],
    }));

    if (this.folderContextProvider) {
      try {
        const contexts = await this.folderContextProvider.getFolderContextBatch(
          request.userId,
          t0Result.candidates.map((c) => ({
            folderId: c.folderId,
            folderName: c.folderName,
          })),
        );

        candidatesWithContext = t0Result.candidates.map((c, i) => ({
          folderId: c.folderId,
          folderName: c.folderName,
          score: c.similarity,
          sampleBookmarks: contexts[i]?.sampleBookmarks || [],
          keywordTags: contexts[i]?.keywordTags || [],
        }));

        this.logger.debug("已加载文件夹上下文", {
          candidateCount: candidatesWithContext.length,
          withSamples: candidatesWithContext.filter(
            (c) => c.sampleBookmarks.length > 0,
          ).length,
        });
      } catch (error) {
        this.logger.warn("加载文件夹上下文失败，继续使用基本信息", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 调用LLM进行深度分析
    const result = await this.llmCaller.callLLM({
      bookmark: request,
      candidates: candidatesWithContext,
    });

    this.logger.info("T1纠正完成", {
      bookmarkId: request.bookmarkId,
      t1FolderId: result.folderId,
      t1Confidence: result.confidence,
      latencyMs: result.latencyMs,
    });

    return result;
  }
}
