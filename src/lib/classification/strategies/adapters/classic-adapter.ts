import type {
  IClassificationStrategy,
  ClassificationRequest,
  ClassificationResult,
} from "../../core";
import type { SimpleClassificationService } from "../../services/simple-classification.service";
import type { SimpleClassificationResult } from "../../types/simple-classification.types";

/**
 * Classic Strategy Adapter
 * 适配 SimpleClassificationService (V4.1) 到 IClassificationStrategy
 */
export class ClassicStrategyAdapter implements IClassificationStrategy {
  name = "classic";

  constructor(private service: SimpleClassificationService) {}

  async classify(
    request: ClassificationRequest,
  ): Promise<ClassificationResult> {
    const simpleInput = {
      id:
        request.bookmarkId && !isNaN(parseInt(request.bookmarkId))
          ? parseInt(request.bookmarkId)
          : undefined,
      title: request.title,
      summary: request.summary,
      tags: request.tags,
      url: request.url,
    };

    const result = await this.service.classify(request.userId, simpleInput);
    return this.mapResult(result);
  }

  private mapResult(result: SimpleClassificationResult): ClassificationResult {
    return {
      folderId: result.folderId,
      folderName: result.folderName,
      confidence: result.confidence,
      action: result.action,
      reason: result.reason,
      totalLatencyMs: result.executionTime,
    };
  }
}
