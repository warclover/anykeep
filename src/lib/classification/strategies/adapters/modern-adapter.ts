import type {
  IClassificationStrategy,
  ClassificationRequest,
  ClassificationResult,
} from "../../core";
import { CONFIDENCE_THRESHOLDS } from "../../core";
import type { ClassificationPipelineService } from "../../strategies/modern/classification-pipeline.service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { V5ClassificationResult } from "@/lib/classification/types/classification";

/**
 * Modern Strategy Adapter
 * 适配 ClassificationPipelineService (V5.0) 到 IClassificationStrategy
 */
export class ModernStrategyAdapter implements IClassificationStrategy {
  name = "modern";

  constructor(
    private service: ClassificationPipelineService,
    private supabase?: SupabaseClient,
  ) {}

  async classify(
    request: ClassificationRequest,
  ): Promise<ClassificationResult> {
    const pipelineRequest = this.mapRequest(request);
    const result = await this.service.classify(pipelineRequest);

    // 如果 folderId 不为 null，从数据库查询 folderName
    let folderName: string | null = null;
    if (result.folderId && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from("folders")
          .select("name")
          .eq("id", result.folderId)
          .eq("user_id", request.userId)
          .single();

        if (!error && data) {
          folderName = data.name as string;
        }
      } catch (error) {
        // 查询失败时保持 folderName 为 null
        console.error("Failed to fetch folder name:", error);
      }
    }

    const normalizedConfidence = this.normalizeConfidence(result.confidence);

    return {
      folderId: result.folderId,
      folderName,
      confidence: normalizedConfidence,
      action: this.determineAction(normalizedConfidence),
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

    // 批量查询 folderName
    const folderIds = results
      .filter(
        (r): r is V5ClassificationResult =>
          !("error" in r) && r.folderId != null,
      )
      .map((r) => r.folderId as number);
    const folderNameMap = new Map<number, string | null>();

    if (folderIds.length > 0 && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from("folders")
          .select("id, name")
          .in("id", folderIds);

        if (!error && data) {
          for (const folder of data) {
            folderNameMap.set(folder.id, folder.name as string);
          }
        }
      } catch (error) {
        console.error("Failed to batch fetch folder names:", error);
      }
    }

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

      // 此时 r 已经被类型守卫确认为 V5ClassificationResult
      const folderId = r.folderId ?? null;
      const folderName = folderId
        ? (folderNameMap.get(folderId) ?? null)
        : null;
      const normalizedConfidence = this.normalizeConfidence(r.confidence);

      return {
        folderId,
        folderName,
        confidence: normalizedConfidence,
        action: this.determineAction(normalizedConfidence),
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

    // 如果 folderId 不为 null，从数据库查询 folderName
    let folderName: string | null = null;
    if (result.folderId && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from("folders")
          .select("name")
          .eq("id", result.folderId)
          .eq("user_id", request.userId)
          .single();

        if (!error && data) {
          folderName = data.name as string;
        }
      } catch (error) {
        console.error("Failed to fetch folder name:", error);
      }
    }

    const normalizedConfidence = this.normalizeConfidence(result.confidence);

    return {
      folderId: result.folderId ?? null,
      folderName,
      confidence: normalizedConfidence,
      action: this.determineAction(normalizedConfidence),
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

  /**
   * 归一化置信度到 0-100 范围
   * V5 Pipeline 返回 0-1，Core 需要 0-100
   */
  private normalizeConfidence(confidence: number): number {
    // 如果已经是 0-100 范围（>1），则不再转换
    if (confidence > 1) {
      return confidence;
    }
    return confidence * 100;
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
