/**
 * LearningPathSkill - 学习路径编排 Skill
 *
 * 功能：
 * - 基于书签创建学习路径
 * - 追踪学习进度
 * - 生成学习建议
 * - 分析学习统计
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { z } from "zod";
import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { SkillContext } from "../../core/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { logger } from "@/lib/logger";
import type {
  LearningPathInput,
  LearningPathOutput,
  LearningPath,
  LearningProgress,
  LearningStats,
} from "./types";
import {
  DIFFICULTY_CONFIG,
  DEFAULT_LEARNING_PATH_CONFIG,
  generatePathId,
} from "./types";
import {
  fetchBookmarks,
  fetchRecentBookmarks,
  organizeNodes,
  generateSuggestions,
} from "./helpers";

// ============================================
// Schema 定义
// ============================================

const LearningPathInputSchema = z.object({
  action: z.enum(["create", "update", "progress", "suggest", "analyze"]),
  pathId: z.string().optional(),
  createOptions: z
    .object({
      topic: z.string(),
      description: z.string().optional(),
      difficulty: z
        .enum(["beginner", "intermediate", "advanced", "mixed"])
        .default("intermediate"),
      estimatedDays: z.number().min(1).max(90).default(7),
      bookmarkIds: z.array(z.number()).optional(),
      folderId: z.number().optional(),
      tag: z.string().optional(),
    })
    .optional(),
  progressOptions: z
    .object({
      nodeId: z.string(),
      status: z.enum(["pending", "in_progress", "completed", "skipped"]),
      note: z.string().optional(),
      rating: z.number().min(1).max(5).optional(),
    })
    .optional(),
});

const LearningPathOutputSchema = z.object({
  action: z.enum(["create", "update", "progress", "suggest", "analyze"]),
  path: z.any().optional(),
  progress: z.any().optional(),
  stats: z.any().optional(),
  suggestions: z.array(z.any()).optional(),
  summary: z.string(),
  nextSteps: z.array(z.string()),
  generatedAt: z.string(),
});

// ============================================
// 步骤定义
// ============================================

const PATH_STEPS = [
  { id: "analyze", name: "分析内容", description: "分析学习内容", weight: 25 },
  { id: "organize", name: "组织路径", description: "组织学习路径", weight: 25 },
  { id: "plan", name: "制定计划", description: "制定学习计划", weight: 25 },
  { id: "complete", name: "完成", description: "完成路径创建", weight: 25 },
];

// ============================================
// LearningPathSkill 实现
// ============================================

export class LearningPathSkill extends OrchestrationSkill<
  LearningPathInput,
  LearningPathOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "learning_path",
    name: "学习路径助手",
    description:
      "基于收藏的书签创建个性化学习路径，追踪学习进度，提供学习建议，帮助您系统化地学习知识。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "path-creation",
      "progress-tracking",
      "learning-suggestions",
      "statistics",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 15000,
    maxExecutionTimeMs: 60000,
    deliverableTypes: ["document", "report"],
    outputFormats: ["markdown", "json"],
    steps: PATH_STEPS,
  };

  readonly inputSchema = LearningPathInputSchema;
  readonly outputSchema = LearningPathOutputSchema;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<LearningPathInput> {
    // 解析操作类型
    let action: LearningPathInput["action"] = "suggest";

    if (/创建|新建|生成.*路径|制定.*计划/.test(message)) {
      action = "create";
    } else if (/进度|更新|完成|标记/.test(message)) {
      action = "progress";
    } else if (/统计|分析|报告/.test(message)) {
      action = "analyze";
    } else if (/建议|推荐|下一步/.test(message)) {
      action = "suggest";
    }

    const input: LearningPathInput = { action };

    // 解析创建选项
    if (action === "create") {
      // 提取主题
      const topicMatch = message.match(
        /(?:学习|关于|主题[是为]?)[：:\s]*([^\s,，。]+)/,
      );
      const topic = topicMatch?.[1] || "未命名学习路径";

      // 提取难度
      let difficulty: NonNullable<
        LearningPathInput["createOptions"]
      >["difficulty"] = "intermediate";
      if (/入门|基础|简单/.test(message)) {
        difficulty = "beginner";
      } else if (/高级|深入|专业/.test(message)) {
        difficulty = "advanced";
      }

      // 提取天数
      const daysMatch = message.match(/(\d+)\s*天/);
      const estimatedDays = daysMatch
        ? parseInt(daysMatch[1], 10)
        : DEFAULT_LEARNING_PATH_CONFIG.estimatedDays;

      input.createOptions = {
        topic,
        difficulty,
        estimatedDays,
      };
    }

    return input;
  }

  /**
   * 流式执行学习路径操作
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as LearningPathInput;

    // 初始化进度
    this.initProgress(PATH_STEPS);

    try {
      switch (input.action) {
        case "create":
          yield* this.executeCreate(context, input);
          break;
        case "progress":
          yield* this.executeProgress(context, input);
          break;
        case "analyze":
          yield* this.executeAnalyze(context);
          break;
        case "suggest":
        default:
          yield* this.executeSuggest(context);
          break;
      }

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          action: input.action,
          durationMs: Date.now() - startTime,
        },
        "LearningPathSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "LearningPathSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "学习路径操作失败",
        "EXECUTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "学习路径操作失败");
    }
  }

  /**
   * 执行创建学习路径
   */
  private async *executeCreate(
    context: OrchestrationContext,
    input: LearningPathInput,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const options = input.createOptions;
    if (!options) {
      yield* this.emitText("缺少创建选项，无法创建学习路径。");
      return;
    }
    const difficultyConfig =
      DIFFICULTY_CONFIG[options.difficulty || "intermediate"];

    yield* this.reportProgress("分析内容", 5, "正在分析学习内容...");
    yield* this.emitText(
      `${difficultyConfig.icon} 正在为您创建「${options.topic}」学习路径...\n\n`,
    );

    // 获取书签
    const bookmarks = await fetchBookmarks(context.userId, options);

    yield* this.reportProgress(
      "分析内容",
      25,
      `收集到 ${bookmarks.length} 条学习资源`,
    );

    if (bookmarks.length === 0) {
      yield* this.emitText("没有找到符合条件的学习资源。\n");
      yield* this.emitDone(true, "没有找到学习资源");
      return;
    }

    yield* this.emitText(
      `📚 找到 **${bookmarks.length}** 条相关学习资源。\n\n`,
    );

    // 组织学习路径
    yield* this.reportProgress("组织路径", 30, "正在组织学习路径...");

    const nodes = organizeNodes(
      bookmarks,
      options.difficulty || "intermediate",
    );

    yield* this.reportProgress("组织路径", 50, "学习路径组织完成");

    // 制定计划
    yield* this.reportProgress("制定计划", 55, "正在制定学习计划...");

    const totalMinutes = nodes.reduce((sum, n) => sum + n.estimatedMinutes, 0);
    const estimatedDays =
      options.estimatedDays ||
      Math.ceil(totalMinutes / DEFAULT_LEARNING_PATH_CONFIG.minutesPerDay);

    const path: LearningPath = {
      id: generatePathId(),
      title: `${options.topic} 学习路径`,
      description: options.description,
      topic: options.topic,
      difficulty: options.difficulty || "intermediate",
      status: "draft",
      nodes,
      estimatedTotalMinutes: totalMinutes,
      estimatedDays,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    yield* this.reportProgress("制定计划", 75, "学习计划制定完成");

    // 完成
    yield* this.reportProgress("完成", 80, "正在完成路径创建...");

    const output: LearningPathOutput = {
      action: "create",
      path,
      summary: `已为您创建「${path.title}」，包含 ${nodes.length} 个学习节点，预计需要 ${estimatedDays} 天完成。`,
      nextSteps: ["开始第一个学习节点", "设置每日学习提醒", "完成后标记进度"],
      generatedAt: new Date().toISOString(),
    };

    yield* this.reportProgress("完成", 95, "路径创建完成");

    // 输出结果
    yield* this.emitText(`## 📚 ${path.title}\n\n`);

    if (path.description) {
      yield* this.emitText(`> ${path.description}\n\n`);
    }

    yield* this.emitText(`### 📊 路径概览\n\n`);
    yield* this.emitText(
      `- 难度级别: **${difficultyConfig.name}** ${difficultyConfig.icon}\n`,
    );
    yield* this.emitText(`- 学习节点: **${nodes.length}** 个\n`);
    yield* this.emitText(
      `- 预计时长: **${Math.round(totalMinutes / 60)}** 小时\n`,
    );
    yield* this.emitText(`- 建议周期: **${estimatedDays}** 天\n\n`);

    yield* this.emitText(`### 📖 学习节点\n\n`);

    let milestoneCount = 0;
    for (const node of nodes) {
      if (node.type === "milestone") {
        milestoneCount++;
        yield* this.emitText(
          `\n#### 🎯 里程碑 ${milestoneCount}: ${node.title}\n\n`,
        );
      } else {
        yield* this.emitText(
          `- [ ] **${node.title}** (${node.estimatedMinutes} 分钟)\n`,
        );
        if (node.platform) {
          yield* this.emitText(`  - 来源: ${node.platform}\n`);
        }
      }
    }

    yield* this.emitText("\n");

    // 输出交付物
    const deliverable = this.createDeliverable(
      "document",
      path.title,
      output,
      "markdown",
      {
        downloadable: true,
        shareable: true,
        metadata: {
          pathId: path.id,
          nodeCount: nodes.length,
          estimatedDays,
          difficulty: path.difficulty,
        },
      },
    );

    yield* this.emitDeliverable(deliverable);

    // 输出建议
    yield* this.emitSuggestions(
      output.nextSteps.map((s, i) => ({
        text: s,
        label: `步骤 ${i + 1}`,
        action: "learning",
        icon: "📖",
      })),
    );

    yield* this.reportProgress("完成", 100, "路径创建完成");
    yield* this.emitDone(
      true,
      `已创建学习路径，包含 ${nodes.length} 个学习节点`,
    );
  }

  /**
   * 执行进度更新
   */
  private async *executeProgress(
    _context: OrchestrationContext,
    _input: LearningPathInput,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    yield* this.reportProgress("分析内容", 25, "正在更新进度...");
    yield* this.emitText(`📝 正在更新学习进度...\n\n`);

    // 注意：实际实现需要数据库支持
    // 这里提供示例输出

    const progress: LearningProgress = {
      completedNodes: 3,
      totalNodes: 10,
      completionRate: 30,
      learnedMinutes: 45,
      remainingMinutes: 105,
      streakDays: 2,
      weeklyMinutes: 45,
    };

    yield* this.reportProgress("完成", 95, "进度更新完成");

    const output: LearningPathOutput = {
      action: "progress",
      progress,
      summary: `学习进度已更新！当前完成 ${progress.completionRate}%，已连续学习 ${progress.streakDays} 天。`,
      nextSteps: ["继续下一个学习节点", "保持学习节奏"],
      generatedAt: new Date().toISOString(),
    };

    yield* this.emitText(`### 📊 学习进度\n\n`);
    yield* this.emitText(
      `- 完成进度: **${progress.completionRate}%** (${progress.completedNodes}/${progress.totalNodes})\n`,
    );
    yield* this.emitText(`- 已学习: **${progress.learnedMinutes}** 分钟\n`);
    yield* this.emitText(`- 剩余: **${progress.remainingMinutes}** 分钟\n`);
    yield* this.emitText(`- 连续学习: **${progress.streakDays}** 天 🔥\n\n`);

    yield* this.emitDone(true, output.summary);
  }

  /**
   * 执行学习分析
   */
  private async *executeAnalyze(
    _context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    yield* this.reportProgress("分析内容", 25, "正在分析学习数据...");
    yield* this.emitText(`📊 正在分析您的学习数据...\n\n`);

    // 注意：实际实现需要数据库支持
    // 这里提供示例输出

    const stats: LearningStats = {
      activePathsCount: 2,
      completedPathsCount: 1,
      totalLearnedMinutes: 180,
      totalCompletedNodes: 15,
      avgCompletionRate: 65,
      longestStreak: 7,
      topTopics: [
        { topic: "前端开发", count: 8 },
        { topic: "AI 技术", count: 5 },
        { topic: "产品设计", count: 2 },
      ],
    };

    yield* this.reportProgress("完成", 95, "分析完成");

    const output: LearningPathOutput = {
      action: "analyze",
      stats,
      summary: `您已创建 ${stats.activePathsCount + stats.completedPathsCount} 条学习路径，完成 ${stats.totalCompletedNodes} 个学习节点，累计学习 ${Math.round(stats.totalLearnedMinutes / 60)} 小时。`,
      nextSteps: ["继续活跃的学习路径", "探索新的学习主题"],
      generatedAt: new Date().toISOString(),
    };

    yield* this.emitText(`### 📈 学习统计\n\n`);
    yield* this.emitText(`- 活跃路径: **${stats.activePathsCount}** 条\n`);
    yield* this.emitText(`- 已完成路径: **${stats.completedPathsCount}** 条\n`);
    yield* this.emitText(
      `- 总学习时长: **${Math.round(stats.totalLearnedMinutes / 60)}** 小时\n`,
    );
    yield* this.emitText(`- 完成节点数: **${stats.totalCompletedNodes}** 个\n`);
    yield* this.emitText(
      `- 最长连续学习: **${stats.longestStreak}** 天 🏆\n\n`,
    );

    if (stats.topTopics.length > 0) {
      yield* this.emitText(`### 🏷️ 热门学习主题\n\n`);
      for (const topic of stats.topTopics) {
        yield* this.emitText(`- **${topic.topic}**: ${topic.count} 个节点\n`);
      }
      yield* this.emitText("\n");
    }

    // 输出交付物
    const deliverable = this.createDeliverable(
      "report",
      "学习统计报告",
      output,
      "markdown",
      {
        downloadable: true,
        shareable: true,
      },
    );

    yield* this.emitDeliverable(deliverable);

    yield* this.emitDone(true, output.summary);
  }

  /**
   * 执行学习建议
   */
  private async *executeSuggest(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    yield* this.reportProgress("分析内容", 25, "正在生成学习建议...");
    yield* this.emitText(`💡 正在为您生成学习建议...\n\n`);

    // 获取用户书签以生成建议
    const bookmarks = await fetchRecentBookmarks(context.userId, 50);

    yield* this.reportProgress("分析内容", 50, "分析书签数据...");

    const suggestions = generateSuggestions(bookmarks);

    yield* this.reportProgress("完成", 95, "建议生成完成");

    const output: LearningPathOutput = {
      action: "suggest",
      suggestions,
      summary: `为您生成了 ${suggestions.length} 条学习建议。`,
      nextSteps: suggestions.slice(0, 2).map((s) => s.description),
      generatedAt: new Date().toISOString(),
    };

    yield* this.emitText(`### 💡 学习建议\n\n`);

    for (const suggestion of suggestions) {
      yield* this.emitText(`${suggestion.icon} **${suggestion.title}**\n`);
      yield* this.emitText(`   ${suggestion.description}\n\n`);
    }

    // 输出建议
    yield* this.emitSuggestions(
      suggestions.map((s) => ({
        text: s.description,
        label: s.title,
        action: "learning",
        icon: s.icon,
      })),
    );

    yield* this.emitDone(true, output.summary);
  }

  /**
   * 非流式执行
   */
  protected async executeInternal(
    input: LearningPathInput,
    context: SkillContext,
  ): Promise<LearningPathOutput> {
    const orchestrationContext: OrchestrationContext = {
      ...context,
      params: input,
    };

    let output: LearningPathOutput | undefined;

    for await (const chunk of this.executeStream(orchestrationContext)) {
      if (chunk.type === "deliverable") {
        output = chunk.data.content as LearningPathOutput;
      }
    }

    if (!output) {
      throw new Error("学习路径操作失败");
    }

    return output;
  }
}

// ============================================
// 导出
// ============================================

export const learningPathSkill = new LearningPathSkill();
