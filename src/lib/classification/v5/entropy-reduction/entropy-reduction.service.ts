/**
 * 智能分类 v5.0 - Entropy Reduction 服务
 *
 * 功能说明：
 * - 计算文件夹的熵值（混乱程度）
 * - 识别高熵文件夹
 * - 建议熵减少方案
 * - 执行熵减少操作
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { LoggerService } from "../shared/logger";
import type {
  EntropyCalculationResult,
  HighEntropyFolder,
  EntropyReductionSuggestion,
  EntropyReductionResult,
  EntropyReductionAction,
} from "./types";

export class EntropyReductionService {
  private supabase: SupabaseClient<Database>;
  private logger: LoggerService;

  // 熵值阈值
  private readonly HIGH_ENTROPY_THRESHOLD = 0.7;
  private readonly MEDIUM_ENTROPY_THRESHOLD = 0.5;

  constructor(supabase: SupabaseClient<Database>, logger: LoggerService) {
    this.supabase = supabase;
    this.logger = logger.child({ service: "EntropyReductionService" });
  }

  /**
   * 计算单个文件夹的熵值
   */
  async calculateFolderEntropy(
    folderId: number,
  ): Promise<EntropyCalculationResult | null> {
    try {
      this.logger.debug("Calculating folder entropy", {
        folderId: String(folderId),
      });

      const { data, error } = await this.supabase.rpc(
        "calculate_folder_entropy",
        { p_folder_id: folderId },
      );

      if (error) {
        throw new Error(`Failed to calculate entropy: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return null;
      }

      const result = data[0];

      // 获取文件夹名称
      const { data: folder, error: folderError } = await this.supabase
        .from("folders")
        .select("name")
        .eq("id", folderId)
        .single();

      if (folderError) {
        throw new Error(`Failed to get folder name: ${folderError.message}`);
      }

      return {
        folderId,
        folderName: folder.name,
        entropyScore: parseFloat(result.entropy_score.toString()),
        bookmarkCount: result.bookmark_count,
        avgSimilarity: result.avg_similarity
          ? parseFloat(result.avg_similarity.toString())
          : null,
        similarityStddev: result.similarity_stddev
          ? parseFloat(result.similarity_stddev.toString())
          : null,
      };
    } catch (error) {
      this.logger.error(
        "Failed to calculate folder entropy",
        error instanceof Error ? error : new Error(String(error)),
        { folderId: String(folderId) },
      );
      return null;
    }
  }

  /**
   * 批量计算所有文件夹的熵值
   */
  async calculateAllFolderEntropy(): Promise<EntropyCalculationResult[]> {
    try {
      this.logger.info("Calculating entropy for all folders");

      const { data, error } = await this.supabase.rpc(
        "calculate_all_folder_entropy",
      );

      if (error) {
        throw new Error(`Failed to calculate all entropy: ${error.message}`);
      }

      return (data || []).map((row) => ({
        folderId: row.folder_id,
        folderName: row.folder_name,
        entropyScore: parseFloat(row.entropy_score.toString()),
        bookmarkCount: row.bookmark_count,
        avgSimilarity: null,
        similarityStddev: null,
      }));
    } catch (error) {
      this.logger.error("Failed to calculate all folder entropy", { error });
      return [];
    }
  }

  /**
   * 识别高熵文件夹
   */
  async identifyHighEntropyFolders(
    minBookmarkCount: number = 5,
  ): Promise<HighEntropyFolder[]> {
    try {
      this.logger.info("Identifying high entropy folders", {
        minBookmarkCount,
      });

      // 获取当前用户ID
      const {
        data: { user },
      } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // 查询高熵文件夹
      const { data, error } = await this.supabase
        .from("folder_entropy_scores")
        .select(
          "folder_id, entropy_score, bookmark_count, folders!folder_entropy_scores_folder_id_fkey(name)",
        )
        .eq("user_id", user.id)
        .gte("bookmark_count", minBookmarkCount)
        .gte("entropy_score", this.MEDIUM_ENTROPY_THRESHOLD)
        .order("entropy_score", { ascending: false });

      if (error) {
        throw new Error(
          `Failed to query high entropy folders: ${error.message}`,
        );
      }

      return (data || []).map((row) => ({
        folderId: row.folder_id,
        folderName: (row.folders as { name: string } | null)?.name || "Unknown",
        entropyScore: parseFloat(row.entropy_score.toString()),
        bookmarkCount: row.bookmark_count,
        severity: this.getEntropySeverity(
          parseFloat(row.entropy_score.toString()),
        ),
      }));
    } catch (error) {
      this.logger.error("Failed to identify high entropy folders", { error });
      return [];
    }
  }

  /**
   * 获取熵值严重程度
   */
  private getEntropySeverity(entropyScore: number): "high" | "medium" | "low" {
    if (entropyScore >= this.HIGH_ENTROPY_THRESHOLD) {
      return "high";
    } else if (entropyScore >= this.MEDIUM_ENTROPY_THRESHOLD) {
      return "medium";
    } else {
      return "low";
    }
  }

  /**
   * 建议熵减少方案
   */
  async suggestEntropyReduction(
    folderId: number,
  ): Promise<EntropyReductionSuggestion[]> {
    try {
      this.logger.debug("Suggesting entropy reduction", { folderId });

      // 1. 获取文件夹熵值
      const entropyResult = await this.calculateFolderEntropy(folderId);
      if (!entropyResult) {
        return [];
      }

      const suggestions: EntropyReductionSuggestion[] = [];

      // 2. 根据熵值和书签数量生成建议
      if (entropyResult.entropyScore >= this.HIGH_ENTROPY_THRESHOLD) {
        // 高熵：建议拆分
        if (entropyResult.bookmarkCount >= 20) {
          suggestions.push({
            folderId,
            folderName: entropyResult.folderName,
            currentEntropy: entropyResult.entropyScore,
            actionType: "split",
            description: "文件夹内容过于杂乱，建议按主题拆分为多个子文件夹",
            estimatedEntropyAfter: entropyResult.entropyScore * 0.6,
            affectedBookmarkCount: entropyResult.bookmarkCount,
            details: {
              reason: "high_entropy_large_folder",
              suggestedSplitCount: Math.ceil(entropyResult.bookmarkCount / 10),
            },
          });
        } else {
          suggestions.push({
            folderId,
            folderName: entropyResult.folderName,
            currentEntropy: entropyResult.entropyScore,
            actionType: "reclassify",
            description: "文件夹内容混乱，建议重新分类书签",
            estimatedEntropyAfter: entropyResult.entropyScore * 0.7,
            affectedBookmarkCount: entropyResult.bookmarkCount,
            details: {
              reason: "high_entropy_small_folder",
            },
          });
        }
      } else if (entropyResult.entropyScore >= this.MEDIUM_ENTROPY_THRESHOLD) {
        // 中等熵：建议重新分类
        suggestions.push({
          folderId,
          folderName: entropyResult.folderName,
          currentEntropy: entropyResult.entropyScore,
          actionType: "reclassify",
          description: "文件夹内容较为分散，建议重新分类部分书签",
          estimatedEntropyAfter: entropyResult.entropyScore * 0.8,
          affectedBookmarkCount: Math.ceil(entropyResult.bookmarkCount * 0.3),
          details: {
            reason: "medium_entropy",
          },
        });
      }

      return suggestions;
    } catch (error) {
      this.logger.error("Failed to suggest entropy reduction", {
        error,
        folderId,
      });
      return [];
    }
  }

  /**
   * 执行熵减少操作
   */
  async executeEntropyReduction(
    folderId: number,
    actionType: EntropyReductionAction,
    actionDetails: Record<string, unknown>,
  ): Promise<EntropyReductionResult> {
    try {
      this.logger.info("Executing entropy reduction", {
        folderId,
        actionType,
      });

      // 1. 获取操作前的熵值
      const beforeEntropy = await this.calculateFolderEntropy(folderId);
      if (!beforeEntropy) {
        return {
          success: false,
          folderId,
          actionType,
          beforeEntropy: 0,
          afterEntropy: null,
          affectedBookmarkCount: 0,
          error: "Failed to calculate before entropy",
        };
      }

      // 2. 根据操作类型执行相应操作
      let affectedBookmarkCount = 0;
      switch (actionType) {
        case "split":
          // 拆分操作的具体实现由调用方处理
          // 这里只记录日志
          affectedBookmarkCount =
            (actionDetails.affectedBookmarkCount as number) || 0;
          break;
        case "merge":
          // 合并操作的具体实现由调用方处理
          affectedBookmarkCount =
            (actionDetails.affectedBookmarkCount as number) || 0;
          break;
        case "reclassify":
          // 重新分类操作的具体实现由调用方处理
          affectedBookmarkCount =
            (actionDetails.affectedBookmarkCount as number) || 0;
          break;
      }

      // 3. 重新计算熵值
      const afterEntropy = await this.calculateFolderEntropy(folderId);

      // 4. 记录操作日志
      await this.logEntropyReduction(
        folderId,
        actionType,
        beforeEntropy.entropyScore,
        afterEntropy?.entropyScore || null,
        affectedBookmarkCount,
        actionDetails,
      );

      return {
        success: true,
        folderId,
        actionType,
        beforeEntropy: beforeEntropy.entropyScore,
        afterEntropy: afterEntropy?.entropyScore || null,
        affectedBookmarkCount,
      };
    } catch (error) {
      this.logger.error("Failed to execute entropy reduction", {
        error,
        folderId,
        actionType,
      });

      return {
        success: false,
        folderId,
        actionType,
        beforeEntropy: 0,
        afterEntropy: null,
        affectedBookmarkCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 记录熵减少操作日志
   */
  private async logEntropyReduction(
    folderId: number,
    actionType: EntropyReductionAction,
    beforeEntropy: number,
    afterEntropy: number | null,
    affectedBookmarkCount: number,
    actionDetails: Record<string, unknown>,
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("entropy_reduction_logs")
        .insert({
          folder_id: folderId,
          action_type: actionType,
          before_entropy: beforeEntropy,
          after_entropy: afterEntropy,
          affected_bookmark_count: affectedBookmarkCount,
          action_details: actionDetails,
        });

      if (error) {
        throw new Error(`Failed to log entropy reduction: ${error.message}`);
      }

      this.logger.debug("Entropy reduction logged", {
        folderId,
        actionType,
      });
    } catch (error) {
      this.logger.error("Failed to log entropy reduction", {
        error,
        folderId,
      });
    }
  }
}
