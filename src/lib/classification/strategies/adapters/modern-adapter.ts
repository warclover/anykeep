import type {
  IClassificationStrategy,
  ClassificationRequest,
  ClassificationResult,
} from "../../core";
import { CONFIDENCE_THRESHOLDS } from "../../core";
import type { ClassificationPipelineService } from "../../strategies/modern/classification-pipeline.service";

/**
 * Modern Strategy Adapter
 * 适配 ClassificationPipelineService (V5.0) 到 IClassificationStrategy
 */
export class ModernStrategyAdapter implements IClassificationStrategy {
  name = "modern";

  constructor(private service: ClassificationPipelineService) {}

  async classify(
    request: ClassificationRequest,
  ): Promise<ClassificationResult> {
    const pipelineRequest = this.mapRequest(request);
    const result = await this.service.classify(pipelineRequest);

    return {
      folderId: result.folderId,
      folderName: null, // Pipeline doesn't return folderName directly
      confidence: result.confidence * 100, // Pipeline returns 0-1, Core expects 0-100 usually?
      // Wait, SimpleClassificationService returns 0-100.
      // ClassificationPipelineService returns 0-1.
      // Core thresholds are 80, 60. So we need 0-100 scale.
      action: this.determineAction(result.confidence * 100),
      reason: result.reasoning,
      usedT1: result.usedT1,
      totalLatencyMs: result.totalLatencyMs,
      t0LatencyMs: result.t0LatencyMs,
      t1LatencyMs: result.t1LatencyMs,
    };
  }

  async classifyBatch(
    requests: ClassificationRequest[],
  ): Promise<ClassificationResult[]> {
    const pipelineRequests = requests.map((r) => this.mapRequest(r));
    const results = await this.service.classifyBatch(pipelineRequests);

    return results.map((r) => {
      if ("error" in r) {
        return {
          folderId: null,
          folderName: null,
          confidence: 0,
          action: "inbox",
          reason: `Batch classification failed: ${r.error}`,
        };
      }

      return {
        folderId: r.folderId ?? null,
        folderName: null,
        confidence: r.confidence * 100,
        action: this.determineAction(r.confidence * 100),
        reason: r.reasoning,
        usedT1: r.usedT1,
        totalLatencyMs: r.totalLatencyMs,
        t0LatencyMs: r.t0LatencyMs,
        t1LatencyMs: r.t1LatencyMs,
      };
    });
  }

  async classifyT0Only(
    request: ClassificationRequest,
  ): Promise<ClassificationResult> {
    const pipelineRequest = this.mapRequest(request);
    const result = await this.service.classifyT0Only(pipelineRequest);

    return {
      folderId: result.folderId ?? null,
      folderName: null,
      confidence: result.confidence * 100,
      action: this.determineAction(result.confidence * 100),
      reason: result.t1Reason,
      usedT1: false,
      totalLatencyMs: result.totalLatencyMs,
      t0LatencyMs: result.t0LatencyMs,
    };
  }

  private mapRequest(request: ClassificationRequest) {
    return {
      userId: request.userId,
      bookmarkId: request.bookmarkId,
      title: request.title,
      description: request.description,
      summary: request.summary,
      tags: request.tags,
      url: request.url || "",
      defaultFolderId: undefined,
    };
  }

  private determineAction(
    confidenceScore: number,
  ): "classify" | "suggest" | "inbox" {
    if (confidenceScore >= CONFIDENCE_THRESHOLDS.AUTO_CLASSIFY)
      return "classify";
    if (confidenceScore >= CONFIDENCE_THRESHOLDS.SUGGEST) return "suggest";
    return "inbox";
  }
}
