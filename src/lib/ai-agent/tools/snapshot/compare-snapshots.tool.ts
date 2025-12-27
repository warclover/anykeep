/**
 * CompareSnapshots Tool - 快照对比工具
 *
 * 对比两个快照版本的内容差异，支持：
 * 1. 与基线快照对比（默认）
 * 2. 两个指定版本对比
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { buildToolDescription } from "../tool-description-templates";
import * as Diff from "diff";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({
  snapshotId: z.number().int().positive().describe("当前快照 ID（必填）"),
  compareWithSnapshotId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("对比目标快照 ID（可选，默认与监控基线对比）"),
  versionNumber: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("对比的历史版本号（可选，与 compareWithSnapshotId 二选一）"),
});

type CompareSnapshotsParams = z.infer<typeof paramsSchema>;

interface DiffChange {
  type: "added" | "removed" | "unchanged";
  value: string;
  lineNumbers?: {
    old?: number;
    new?: number;
  };
}

interface DiffStats {
  addedLines: number;
  removedLines: number;
  unchangedLines: number;
  totalChanges: number;
  similarityScore: number;
}

interface SnapshotInfo {
  id: number;
  bookmarkId: number;
  bookmarkTitle: string;
  contentHash: string;
  capturedAt: string;
  wordCount: number;
  isVersion?: boolean;
  versionNumber?: number;
}

interface CompareSnapshotsResult {
  source: SnapshotInfo;
  target: SnapshotInfo;
  stats: DiffStats;
  changes: DiffChange[];
  summary: string;
  hasSignificantChanges: boolean;
}

// ============================================
// 工具描述
// ============================================

const COMPARE_SNAPSHOTS_DESCRIPTION = buildToolDescription({
  core: "对比两个快照版本的内容差异，识别页面变更。",
  scenarios: [
    '"这个页面最近有什么变化"',
    '"对比快照和上一版本"',
    '"查看页面内容更新了什么"',
    '"这篇文章有没有修改"',
  ],
  notes: [
    "默认与监控基线对比（如果存在）",
    "可指定特定的历史版本号进行对比",
    "返回详细的差异统计和变更摘要",
    "相似度低于 80% 视为显著变更",
  ],
  boundaries: ["notFound"],
});

// ============================================
// 辅助函数
// ============================================

/**
 * 计算相似度分数 (0-100)
 */
function calculateSimilarity(
  added: number,
  removed: number,
  unchanged: number,
): number {
  const total = added + removed + unchanged;
  if (total === 0) return 100;
  return Math.round((unchanged / total) * 100);
}

/**
 * 生成变更摘要
 */
function generateSummary(stats: DiffStats, hasSignificant: boolean): string {
  if (stats.totalChanges === 0) {
    return "内容完全相同，没有变化";
  }

  const parts: string[] = [];

  if (stats.addedLines > 0) {
    parts.push(`新增 ${stats.addedLines} 行`);
  }
  if (stats.removedLines > 0) {
    parts.push(`删除 ${stats.removedLines} 行`);
  }

  const summary = parts.join("，");
  const changeLevel = hasSignificant ? "显著变更" : "轻微变更";

  return `${changeLevel}：${summary}，相似度 ${stats.similarityScore}%`;
}

/**
 * 执行文本差异对比
 */
function performDiff(
  oldText: string,
  newText: string,
): {
  changes: DiffChange[];
  stats: DiffStats;
} {
  // 使用 diff 库进行行级对比
  const diffResult = Diff.diffLines(oldText || "", newText || "");

  const changes: DiffChange[] = [];
  let addedLines = 0;
  let removedLines = 0;
  let unchangedLines = 0;
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const part of diffResult) {
    const lines = part.value.split("\n").filter((line) => line.length > 0);
    const lineCount = lines.length;

    if (part.added) {
      changes.push({
        type: "added",
        value: part.value,
        lineNumbers: { new: newLineNum },
      });
      addedLines += lineCount;
      newLineNum += lineCount;
    } else if (part.removed) {
      changes.push({
        type: "removed",
        value: part.value,
        lineNumbers: { old: oldLineNum },
      });
      removedLines += lineCount;
      oldLineNum += lineCount;
    } else {
      changes.push({
        type: "unchanged",
        value: part.value,
        lineNumbers: { old: oldLineNum, new: newLineNum },
      });
      unchangedLines += lineCount;
      oldLineNum += lineCount;
      newLineNum += lineCount;
    }
  }

  const similarityScore = calculateSimilarity(
    addedLines,
    removedLines,
    unchangedLines,
  );

  return {
    changes,
    stats: {
      addedLines,
      removedLines,
      unchangedLines,
      totalChanges: addedLines + removedLines,
      similarityScore,
    },
  };
}

// ============================================
// Tool 实现
// ============================================

export const compareSnapshotsTool: Tool<
  CompareSnapshotsParams,
  CompareSnapshotsResult
> = {
  definition: {
    name: "compare_snapshots",
    description: COMPARE_SNAPSHOTS_DESCRIPTION,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 300,
  },

  async execute(
    params: CompareSnapshotsParams,
    context,
  ): Promise<ToolResult<CompareSnapshotsResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取源快照信息
      const { data: sourceSnapshot, error: sourceError } = await supabase
        .from("bookmark_snapshots")
        .select(
          `
          id,
          bookmark_id,
          content_hash,
          readable_text_content,
          word_count,
          captured_at,
          bookmarks!inner (
            id,
            title,
            user_id
          )
        `,
        )
        .eq("id", params.snapshotId)
        .single();

      if (sourceError || !sourceSnapshot) {
        return {
          success: false,
          error: "源快照不存在",
          errorCode: "NOT_FOUND",
        };
      }

      // 类型断言
      const bookmark = sourceSnapshot.bookmarks as unknown as {
        id: number;
        title: string;
        user_id: string;
      };

      // 验证所有权
      if (bookmark.user_id !== context.userId) {
        return {
          success: false,
          error: "无权访问此快照",
          errorCode: "UNAUTHORIZED",
        };
      }

      // 2. 确定对比目标
      let targetSnapshot: {
        id: number;
        content_hash: string;
        readable_text_content: string | null;
        word_count: number | null;
        captured_at: string;
        isVersion?: boolean;
        versionNumber?: number;
      } | null = null;

      if (params.compareWithSnapshotId) {
        // 与指定快照对比
        const { data: target, error: targetError } = await supabase
          .from("bookmark_snapshots")
          .select(
            "id, content_hash, readable_text_content, word_count, captured_at",
          )
          .eq("id", params.compareWithSnapshotId)
          .single();

        if (targetError || !target) {
          return {
            success: false,
            error: "对比目标快照不存在",
            errorCode: "NOT_FOUND",
          };
        }
        targetSnapshot = target;
      } else if (params.versionNumber) {
        // 与指定版本号对比
        const { data: version, error: versionError } = await supabase
          .from("snapshot_versions")
          .select(
            "id, content_hash, readable_text_content, word_count, original_captured_at, version_number",
          )
          .eq("snapshot_id", params.snapshotId)
          .eq("version_number", params.versionNumber)
          .single();

        if (versionError || !version) {
          return {
            success: false,
            error: `历史版本 ${params.versionNumber} 不存在`,
            errorCode: "NOT_FOUND",
          };
        }
        targetSnapshot = {
          id: version.id,
          content_hash: version.content_hash,
          readable_text_content: version.readable_text_content,
          word_count: version.word_count,
          captured_at: version.original_captured_at,
          isVersion: true,
          versionNumber: version.version_number,
        };
      } else {
        // 默认：与监控基线对比
        const { data: monitor } = await supabase
          .from("page_monitors")
          .select("baseline_snapshot_id, baseline_content_hash")
          .eq("bookmark_id", bookmark.id)
          .eq("user_id", context.userId)
          .single();

        if (monitor?.baseline_snapshot_id) {
          const { data: baseline } = await supabase
            .from("bookmark_snapshots")
            .select(
              "id, content_hash, readable_text_content, word_count, captured_at",
            )
            .eq("id", monitor.baseline_snapshot_id)
            .single();

          if (baseline) {
            targetSnapshot = baseline;
          }
        }

        // 如果没有基线，尝试获取最新的历史版本
        if (!targetSnapshot) {
          const { data: latestVersion } = await supabase
            .from("snapshot_versions")
            .select(
              "id, content_hash, readable_text_content, word_count, original_captured_at, version_number",
            )
            .eq("snapshot_id", params.snapshotId)
            .order("version_number", { ascending: false })
            .limit(1)
            .single();

          if (latestVersion) {
            targetSnapshot = {
              id: latestVersion.id,
              content_hash: latestVersion.content_hash,
              readable_text_content: latestVersion.readable_text_content,
              word_count: latestVersion.word_count,
              captured_at: latestVersion.original_captured_at,
              isVersion: true,
              versionNumber: latestVersion.version_number,
            };
          }
        }
      }

      // 如果没有对比目标
      if (!targetSnapshot) {
        return {
          success: false,
          error: "没有可对比的历史版本或基线快照",
          errorCode: "NO_BASELINE",
        };
      }

      // 3. 执行内容对比
      const { changes, stats } = performDiff(
        targetSnapshot.readable_text_content || "",
        sourceSnapshot.readable_text_content || "",
      );

      // 4. 判断是否为显著变更（相似度低于 80%）
      const hasSignificantChanges = stats.similarityScore < 80;

      // 5. 生成摘要
      const summary = generateSummary(stats, hasSignificantChanges);

      // 6. 构建结果
      const result: CompareSnapshotsResult = {
        source: {
          id: sourceSnapshot.id,
          bookmarkId: bookmark.id,
          bookmarkTitle: bookmark.title || "未命名",
          contentHash: sourceSnapshot.content_hash,
          capturedAt: sourceSnapshot.captured_at,
          wordCount: sourceSnapshot.word_count || 0,
        },
        target: {
          id: targetSnapshot.id,
          bookmarkId: bookmark.id,
          bookmarkTitle: bookmark.title || "未命名",
          contentHash: targetSnapshot.content_hash,
          capturedAt: targetSnapshot.captured_at,
          wordCount: targetSnapshot.word_count || 0,
          isVersion: targetSnapshot.isVersion,
          versionNumber: targetSnapshot.versionNumber,
        },
        stats,
        changes: changes.slice(0, 50), // 限制返回的变更数量
        summary,
        hasSignificantChanges,
      };

      logger.info(
        {
          toolName: "compare_snapshots",
          userId: context.userId,
          snapshotId: params.snapshotId,
          targetId: targetSnapshot.id,
          similarityScore: stats.similarityScore,
          hasSignificantChanges,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "compare_snapshots: Success",
      );

      return {
        success: true,
        data: result,
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "compare_snapshots",
          userId: context.userId,
          snapshotId: params.snapshotId,
          error: errorMessage,
        },
        "compare_snapshots: Failed",
      );

      return {
        success: false,
        error: `快照对比失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
