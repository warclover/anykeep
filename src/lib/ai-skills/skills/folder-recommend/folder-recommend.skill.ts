/**
 * FolderRecommendSkill - 文件夹智能推荐
 *
 * 基于书签内容和使用习惯，推荐最佳文件夹结构
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import { BaseSkill } from "../../core/base-skill";
import type { SkillMetadata, SkillContext } from "../../core/types";
import { getFolderServiceAdapter } from "../../adapters/folder-service.adapter";
import {
  FolderRecommendInputSchema,
  FolderRecommendOutputSchema,
  type FolderRecommendInput,
  type FolderRecommendOutput,
} from "./types";

/**
 * 文件夹推荐 Skill
 *
 * 设计为原子 Skill（非编排），因为：
 * 1. 响应时间短（<2s）
 * 2. 单步执行，无需多阶段进度
 * 3. 输出为建议列表，无需复杂交付物
 */
export class FolderRecommendSkill extends BaseSkill<
  FolderRecommendInput,
  FolderRecommendOutput
> {
  readonly metadata: SkillMetadata = {
    id: "folder_recommend",
    name: "文件夹智能推荐",
    description: "基于书签内容和使用习惯，推荐最佳文件夹结构",
    category: "organizing",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["analyze", "recommend"],
  };

  readonly inputSchema = FolderRecommendInputSchema;
  readonly outputSchema = FolderRecommendOutputSchema;

  protected async executeInternal(
    input: FolderRecommendInput,
    context: SkillContext,
  ): Promise<FolderRecommendOutput> {
    const adapter = getFolderServiceAdapter();

    // 获取批量推荐结果
    const result = await adapter.analyzeAndRecommend(
      context.userId,
      input.maxRecommendations,
    );

    // 转换为输出格式
    return {
      recommendations: result.recommendations.map((rec) => ({
        name: rec.folderName,
        isNew: rec.suggestNew,
        folderId: rec.folderId,
        reason: rec.reason,
        matchingBookmarkCount: 0, // TODO: 统计匹配数量
        confidence: rec.confidence,
      })),
      currentFolderCount: result.currentFolderCount,
      unclassifiedCount: result.unclassifiedCount,
    };
  }
}

// 单例导出
export const folderRecommendSkill = new FolderRecommendSkill();
