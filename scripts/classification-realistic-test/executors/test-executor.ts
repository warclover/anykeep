/**
 * 测试执行器
 */

import type { Bookmark, ClassificationResult, UserProfile } from "../types";

/**
 * 分类服务接口（需要根据实际实现调整）
 */
interface ClassificationService {
  classify(request: ClassificationRequest): Promise<ClassificationResult>;
}

interface ClassificationRequest {
  bookmarkId: string;
  userId: string;
  title: string;
  summary?: string;
  tags?: string[];
  url: string;
}

export class TestExecutor {
  private classificationService: ClassificationService;

  constructor(classificationService: ClassificationService) {
    this.classificationService = classificationService;
  }

  /**
   * 执行分类测试
   */
  async execute(
    userId: string,
    bookmark: Bookmark,
  ): Promise<ClassificationResult & { strategy?: string }> {
    const request: ClassificationRequest = {
      bookmarkId: bookmark.id,
      userId,
      title: bookmark.title,
      summary: bookmark.summary,
      tags: bookmark.tags,
      url: bookmark.url,
    };

    const startTime = Date.now();

    try {
      const result = await this.classificationService.classify(request);

      return {
        ...result,
        totalLatencyMs: Date.now() - startTime,
        strategy: this.determineStrategy(result),
      };
    } catch (error) {
      return {
        folderId: null,
        confidence: 0,
        usedT1: false,
        totalLatencyMs: Date.now() - startTime,
        strategy: "ERROR",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 确定使用的策略
   */
  private determineStrategy(result: ClassificationResult): string {
    if (result.usedT1) return "L3_LLM";
    // 根据延迟推断（需要从结果中获取更多信息）
    if (result.totalLatencyMs < 50) return "L1_LOCAL";
    if (result.totalLatencyMs < 300) return "L2_VECTOR";
    return "L3_LLM";
  }

  /**
   * 批量执行测试
   */
  async executeBatch(
    userId: string,
    bookmarks: Bookmark[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<Array<ClassificationResult & { strategy?: string }>> {
    const results: Array<ClassificationResult & { strategy?: string }> = [];

    for (let i = 0; i < bookmarks.length; i++) {
      const bookmark = bookmarks[i];
      const result = await this.execute(userId, bookmark);
      results.push(result);

      if (onProgress) {
        onProgress(i + 1, bookmarks.length);
      }

      // 避免过快请求（可选）
      if (i < bookmarks.length - 1) {
        await this.delay(10); // 10ms 延迟
      }
    }

    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
