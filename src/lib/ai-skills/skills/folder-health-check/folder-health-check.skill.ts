/**
 * FolderHealthCheckSkill - 文件夹健康检查
 *
 * 分析文件夹结构，发现问题并提供优化建议
 *
 * @version 1.0.0
 * @since 2025-01-08
 */

import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type {
  OrchestrationSkillMetadata,
  OrchestrationContext,
} from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import { FolderHealthService } from "@/lib/folder/health";
import {
  FolderProfileRepository,
  SuggestionRepository,
} from "@/lib/classification/repositories";
import { createClient } from "@/lib/supabase/server";
import {
  FOLDER_HEALTH_STEPS,
  FolderHealthCheckInputSchema,
  FolderHealthCheckOutputSchema,
  type FolderHealthCheckInput,
  type FolderHealthCheckOutput,
} from "./types";

/**
 * 文件夹健康检查 Skill
 *
 * 设计为编排 Skill，因为：
 * 1. 多步骤执行（扫描 → 诊断 → 建议）
 * 2. 需要进度报告
 * 3. 输出详细健康报告
 */
export class FolderHealthCheckSkill extends OrchestrationSkill<
  FolderHealthCheckInput,
  FolderHealthCheckOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "folder_health_check",
    name: "文件夹健康检查",
    description: "分析文件夹结构，发现问题并提供优化建议",
    category: "organizing",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["diagnose", "suggest", "action"],
    steps: FOLDER_HEALTH_STEPS,
  };

  readonly inputSchema = FolderHealthCheckInputSchema;
  readonly outputSchema = FolderHealthCheckOutputSchema;

  /**
   * 解析用户输入
   */
  async parseInput(
    _message: string,
    _context: OrchestrationContext,
  ): Promise<FolderHealthCheckInput> {
    return {};
  }

  /**
   * 流式执行
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const supabase = await createClient();

    // 创建服务实例（使用现有 FolderHealthService）
    const folderProfileRepo = new FolderProfileRepository(supabase);
    const suggestionRepo = new SuggestionRepository(supabase);
    const healthService = new FolderHealthService(
      folderProfileRepo,
      suggestionRepo,
      supabase,
    );

    this.initProgress(FOLDER_HEALTH_STEPS);

    // Step 1: 扫描
    yield* this.reportProgress("scan", 10, "正在扫描文件夹结构...");

    // Step 2: 诊断
    yield* this.reportProgress("diagnose", 30, "正在诊断问题...");
    const report = await healthService.checkHealth(context.userId);
    yield* this.reportProgress(
      "diagnose",
      60,
      `发现 ${report.foldersNeedingAttention} 个问题`,
    );

    // Step 3: 生成建议
    yield* this.reportProgress("suggest", 80, "正在生成优化建议...");

    // 输出健康报告
    const deliverable = this.createDeliverable(
      "report",
      "文件夹健康报告",
      {
        status: report.status,
        totalFolders: report.totalFolders,
        healthyFolders: report.healthyFolders,
        mergeSuggestions: report.mergeSuggestions,
        splitSuggestions: report.splitSuggestions,
      },
      "json",
      { metadata: { subType: "health_report" } },
    );
    yield* this.emitDeliverable(deliverable);

    // 输出文本摘要
    const statusEmoji =
      report.status === "healthy"
        ? "✅"
        : report.status === "needs_attention"
          ? "⚠️"
          : "🔴";
    yield* this.emitText(
      `${statusEmoji} **文件夹健康状态: ${this.getStatusText(report.status)}**\n\n` +
        `- 总文件夹: ${report.totalFolders} 个\n` +
        `- 健康文件夹: ${report.healthyFolders} 个\n` +
        `- 合并建议: ${report.mergeSuggestions.length} 条\n` +
        `- 拆分建议: ${report.splitSuggestions.length} 条`,
    );

    yield* this.reportProgress("suggest", 100, "完成");
    yield* this.emitDone(true);
  }

  /**
   * 获取状态文本
   */
  private getStatusText(status: string): string {
    switch (status) {
      case "healthy":
        return "健康";
      case "needs_attention":
        return "需要关注";
      case "critical":
        return "需要立即处理";
      default:
        return status;
    }
  }
}

// 单例导出
export const folderHealthCheckSkill = new FolderHealthCheckSkill();
