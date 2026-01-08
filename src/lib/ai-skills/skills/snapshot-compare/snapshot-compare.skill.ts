/**
 * SnapshotCompareSkill - 快照对比分析
 *
 * 对比书签内容的历史快照，发现页面变化
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import { BaseSkill } from "../../core/base-skill";
import type { SkillMetadata, SkillContext } from "../../core/types";
import { compareSnapshotsTool } from "@/lib/ai-agent/tools/snapshot/compare-snapshots.tool";
import {
  SnapshotCompareInputSchema,
  SnapshotCompareOutputSchema,
  type SnapshotCompareInput,
  type SnapshotCompareOutput,
} from "./types";

/**
 * 快照对比 Skill
 *
 * 封装现有的 compareSnapshotsTool，作为原子 Skill 暴露
 *
 * 设计为原子 Skill（非编排），因为：
 * 1. 响应时间短（<2s）
 * 2. 单步执行，无需多阶段进度
 * 3. 输出为对比结果，无需复杂交付物
 */
export class SnapshotCompareSkill extends BaseSkill<
  SnapshotCompareInput,
  SnapshotCompareOutput
> {
  readonly metadata: SkillMetadata = {
    id: "snapshot_compare",
    name: "快照对比分析",
    description: "对比书签内容的历史快照，发现页面变化",
    category: "utility",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["compare", "highlight", "notify"],
  };

  readonly inputSchema = SnapshotCompareInputSchema;
  readonly outputSchema = SnapshotCompareOutputSchema;

  protected async executeInternal(
    input: SnapshotCompareInput,
    context: SkillContext,
  ): Promise<SnapshotCompareOutput> {
    // 直接调用现有 Tool
    const result = await compareSnapshotsTool.execute(
      {
        snapshotId: input.snapshotId,
        compareWithSnapshotId: input.compareWithSnapshotId,
        versionNumber: input.versionNumber,
      },
      { userId: context.userId },
    );

    if (!result.success) {
      throw new Error(result.error || "快照对比失败");
    }

    const data = result.data;

    // 转换为 Skill 输出格式
    return {
      hasChanges: data.hasSignificantChanges,
      changeType: this.determineChangeType(data),
      summary: data.summary,
      similarityScore: data.stats.similarityScore,
      stats: {
        addedLines: data.stats.addedLines,
        removedLines: data.stats.removedLines,
      },
    };
  }

  /**
   * 确定变更类型
   */
  private determineChangeType(data: {
    hasSignificantChanges: boolean;
    stats: { totalChanges: number };
  }): "major" | "minor" | "none" {
    if (data.hasSignificantChanges) {
      return "major";
    }
    if (data.stats.totalChanges > 0) {
      return "minor";
    }
    return "none";
  }
}

// 单例导出
export const snapshotCompareSkill = new SnapshotCompareSkill();
