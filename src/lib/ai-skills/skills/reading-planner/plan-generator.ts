/**
 * ReadingPlanGenerator - 阅读计划生成器
 *
 * 负责：
 * - 估算阅读时间
 * - 生成日程安排
 * - 计算里程碑
 * - 生成统计信息
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { v4 as uuidv4 } from "uuid";
import type {
  ReadingPlannerInput,
  ReadingPlannerOutput,
  BookmarkForPlan,
  DaySchedule,
  ScheduleItem,
  Milestone,
  PlanStats,
  ItemPriority,
} from "./types";
import { PLATFORM_READ_TIME_ESTIMATES, GOAL_DESCRIPTIONS } from "./types";

/**
 * 带估算时间的书签
 */
interface BookmarkWithEstimate extends BookmarkForPlan {
  estimatedReadTime: number;
  priority: ItemPriority;
  isReview: boolean;
  topicRelevance?: number;
}

/**
 * 阅读计划生成器
 */
export class ReadingPlanGenerator {
  /**
   * 估算单个书签的阅读时间
   */
  estimateReadTime(bookmark: BookmarkForPlan): number {
    // 基础估算：按平台
    const platform = bookmark.platform || "default";
    let estimate =
      PLATFORM_READ_TIME_ESTIMATES[platform] ||
      PLATFORM_READ_TIME_ESTIMATES.default;

    // 根据内容长度调整（如果有）
    if (bookmark.content_length && bookmark.content_length > 0) {
      const wordsPerMinute = 200; // 中文阅读速度约 200 字/分钟
      const contentEstimate = Math.ceil(
        bookmark.content_length / wordsPerMinute,
      );
      // 取两者的加权平均
      estimate = Math.round(estimate * 0.3 + contentEstimate * 0.7);
    }

    // 限制在合理范围内（2-60 分钟）
    return Math.max(2, Math.min(60, estimate));
  }

  /**
   * 计算书签优先级
   */
  calculatePriority(
    bookmark: BookmarkForPlan,
    prioritizeBy: string,
    topic?: string,
  ): { priority: ItemPriority; topicRelevance?: number } {
    switch (prioritizeBy) {
      case "date": {
        // 按收藏时间：越早收藏优先级越高
        const createdAt = new Date(bookmark.created_at);
        const now = new Date();
        const daysOld = Math.floor(
          (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysOld > 30) return { priority: "high" };
        if (daysOld > 7) return { priority: "medium" };
        return { priority: "low" };
      }

      case "importance": {
        // 按重要程度：根据标签和平台判断
        const tags = bookmark.ai_tags || [];
        const importantKeywords = [
          "重要",
          "必读",
          "收藏",
          "精选",
          "干货",
          "教程",
          "指南",
          "important",
          "must-read",
        ];
        const hasImportantTag = tags.some((tag) =>
          importantKeywords.some((kw) =>
            tag.toLowerCase().includes(kw.toLowerCase()),
          ),
        );
        if (hasImportantTag) return { priority: "high" };
        // GitHub 和技术博客优先级较高
        if (["github", "medium", "juejin"].includes(bookmark.platform || "")) {
          return { priority: "medium" };
        }
        return { priority: "low" };
      }

      case "reading_time": {
        // 按阅读时长：短文优先
        const readTime = this.estimateReadTime(bookmark);
        if (readTime <= 5) return { priority: "high" };
        if (readTime <= 15) return { priority: "medium" };
        return { priority: "low" };
      }

      case "topic": {
        // 按主题相关性：需要计算相关度
        if (!topic) return { priority: "medium" };

        const relevance = this.calculateTopicRelevance(bookmark, topic);
        if (relevance >= 0.7)
          return { priority: "high", topicRelevance: relevance };
        if (relevance >= 0.4)
          return { priority: "medium", topicRelevance: relevance };
        return { priority: "low", topicRelevance: relevance };
      }

      default:
        return { priority: "medium" };
    }
  }

  /**
   * 计算主题相关度
   */
  calculateTopicRelevance(bookmark: BookmarkForPlan, topic: string): number {
    const topicLower = topic.toLowerCase();
    const topicWords = topicLower.split(/\s+/);

    let score = 0;
    let maxScore = 0;

    // 标题匹配（权重 40%）
    maxScore += 40;
    const titleLower = bookmark.title.toLowerCase();
    for (const word of topicWords) {
      if (titleLower.includes(word)) {
        score += 40 / topicWords.length;
      }
    }

    // 标签匹配（权重 30%）
    maxScore += 30;
    const tags = bookmark.ai_tags || [];
    for (const tag of tags) {
      const tagLower = tag.toLowerCase();
      for (const word of topicWords) {
        if (tagLower.includes(word)) {
          score += 30 / (tags.length * topicWords.length);
        }
      }
    }

    // 摘要匹配（权重 30%）
    maxScore += 30;
    if (bookmark.ai_summary) {
      const summaryLower = bookmark.ai_summary.toLowerCase();
      for (const word of topicWords) {
        if (summaryLower.includes(word)) {
          score += 30 / topicWords.length;
        }
      }
    }

    return Math.min(1, score / maxScore);
  }

  /**
   * 排序书签
   */
  sortBookmarks(
    bookmarks: BookmarkWithEstimate[],
    prioritizeBy: string,
  ): BookmarkWithEstimate[] {
    return [...bookmarks].sort((a, b) => {
      // 优先级排序
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff =
        priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // 按主题相关度（如果有）
      if (a.topicRelevance !== undefined && b.topicRelevance !== undefined) {
        return b.topicRelevance - a.topicRelevance;
      }

      // 按阅读时间（短的优先）
      if (prioritizeBy === "reading_time") {
        return a.estimatedReadTime - b.estimatedReadTime;
      }

      // 按收藏时间（旧的优先）
      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }

  /**
   * 生成日程安排
   */
  generateSchedule(
    bookmarks: BookmarkWithEstimate[],
    input: ReadingPlannerInput,
  ): DaySchedule[] {
    const { timeAvailable, preferences } = input;
    const { dailyMinutes, daysPerWeek, totalWeeks } = timeAvailable;

    // 计算总天数
    const maxWeeks = totalWeeks || 4; // 默认 4 周
    const totalDays = maxWeeks * daysPerWeek;

    // 按优先级排序
    const sorted = this.sortBookmarks(bookmarks, preferences.prioritizeBy);

    // 生成日期序列
    const startDate = new Date();
    const schedule: DaySchedule[] = [];

    let bookmarkIndex = 0;
    let dayCount = 0;
    let actualDay = 0;

    // 计算哪些天是阅读日
    const readingDays = this.getReadingDays(daysPerWeek);

    while (dayCount < totalDays && bookmarkIndex < sorted.length) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + actualDay);

      const dayOfWeek = currentDate.getDay();
      const isReadingDay = readingDays.includes(dayOfWeek);

      if (isReadingDay) {
        dayCount++;
        const daySchedule: DaySchedule = {
          day: dayCount,
          date: currentDate.toISOString().split("T")[0],
          estimatedMinutes: 0,
          items: [],
        };

        // 填充当天的阅读项
        let remainingMinutes = dailyMinutes;

        while (remainingMinutes > 0 && bookmarkIndex < sorted.length) {
          const bookmark = sorted[bookmarkIndex];

          // 如果当前书签的阅读时间超过剩余时间太多，跳过
          if (
            bookmark.estimatedReadTime > remainingMinutes + 10 &&
            daySchedule.items.length > 0
          ) {
            // 尝试找一个更短的书签
            const shorterIndex = sorted
              .slice(bookmarkIndex)
              .findIndex((b) => b.estimatedReadTime <= remainingMinutes + 5);

            if (shorterIndex === -1) break;
            // 交换位置（简化处理）
          }

          const item: ScheduleItem = {
            bookmarkId: bookmark.id,
            title: bookmark.title,
            estimatedReadTime: bookmark.estimatedReadTime,
            priority: bookmark.priority,
            isReview: bookmark.isReview,
            platform: bookmark.platform,
            url: bookmark.url,
          };

          daySchedule.items.push(item);
          daySchedule.estimatedMinutes += bookmark.estimatedReadTime;
          remainingMinutes -= bookmark.estimatedReadTime;
          bookmarkIndex++;
        }

        if (daySchedule.items.length > 0) {
          schedule.push(daySchedule);
        }
      }

      actualDay++;
      // 安全检查：避免无限循环
      if (actualDay > 365) break;
    }

    return schedule;
  }

  /**
   * 获取每周阅读日
   */
  private getReadingDays(daysPerWeek: number): number[] {
    // 0=周日, 1=周一, ..., 6=周六
    switch (daysPerWeek) {
      case 1:
        return [6]; // 周六
      case 2:
        return [3, 6]; // 周三、周六
      case 3:
        return [1, 3, 5]; // 周一、三、五
      case 4:
        return [1, 3, 5, 6]; // 周一、三、五、六
      case 5:
        return [1, 2, 3, 4, 5]; // 周一至周五
      case 6:
        return [1, 2, 3, 4, 5, 6]; // 周一至周六
      case 7:
        return [0, 1, 2, 3, 4, 5, 6]; // 每天
      default:
        return [1, 3, 5]; // 默认周一、三、五
    }
  }

  /**
   * 生成里程碑
   */
  generateMilestones(schedule: DaySchedule[]): Milestone[] {
    const milestones: Milestone[] = [];
    let totalItems = 0;

    // 每完成 25%、50%、75%、100% 设置里程碑
    const totalScheduledItems = schedule.reduce(
      (sum, day) => sum + day.items.length,
      0,
    );

    const milestoneTargets = [
      { percent: 25, description: "完成 25% - 良好开端！" },
      { percent: 50, description: "完成 50% - 半程达成！" },
      { percent: 75, description: "完成 75% - 即将完成！" },
      { percent: 100, description: "完成 100% - 恭喜完成计划！" },
    ];

    for (const day of schedule) {
      totalItems += day.items.length;
      const currentPercent = (totalItems / totalScheduledItems) * 100;

      for (const target of milestoneTargets) {
        // 检查是否刚刚达到目标
        const previousPercent =
          ((totalItems - day.items.length) / totalScheduledItems) * 100;
        if (
          previousPercent < target.percent &&
          currentPercent >= target.percent
        ) {
          milestones.push({
            day: day.day,
            description: target.description,
            itemsCompleted: totalItems,
          });
        }
      }
    }

    return milestones;
  }

  /**
   * 计算统计信息
   */
  calculateStats(
    bookmarks: BookmarkWithEstimate[],
    schedule: DaySchedule[],
  ): PlanStats {
    const totalItems = schedule.reduce((sum, day) => sum + day.items.length, 0);
    const totalReadingTime = schedule.reduce(
      (sum, day) => sum + day.estimatedMinutes,
      0,
    );
    const averagePerDay =
      schedule.length > 0 ? Math.round(totalReadingTime / schedule.length) : 0;

    // 主题覆盖
    const topicCoverage: Record<string, number> = {};
    for (const bookmark of bookmarks.slice(0, totalItems)) {
      const tags = bookmark.ai_tags || [];
      for (const tag of tags) {
        topicCoverage[tag] = (topicCoverage[tag] || 0) + 1;
      }
    }

    // 平台分布
    const platformDistribution: Record<string, number> = {};
    for (const bookmark of bookmarks.slice(0, totalItems)) {
      const platform = bookmark.platform || "unknown";
      platformDistribution[platform] =
        (platformDistribution[platform] || 0) + 1;
    }

    // 优先级分布
    const priorityDistribution: Record<ItemPriority, number> = {
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const bookmark of bookmarks.slice(0, totalItems)) {
      priorityDistribution[bookmark.priority]++;
    }

    return {
      totalItems,
      totalReadingTime,
      averagePerDay,
      topicCoverage,
      platformDistribution,
      priorityDistribution,
    };
  }

  /**
   * 生成建议
   */
  generateSuggestions(
    input: ReadingPlannerInput,
    stats: PlanStats,
    schedule: DaySchedule[],
  ): string[] {
    const suggestions: string[] = [];

    // 基于统计的建议
    if (stats.averagePerDay > input.timeAvailable.dailyMinutes) {
      suggestions.push(
        `计划每日阅读时间略超预期，建议适当延长计划周期或减少每日阅读量`,
      );
    }

    if (stats.totalItems < 10) {
      suggestions.push(`待阅读内容较少，建议定期收藏新内容丰富阅读库`);
    }

    // 基于内容的建议
    const topPlatform = Object.entries(stats.platformDistribution).sort(
      ([, a], [, b]) => b - a,
    )[0];
    if (topPlatform && topPlatform[1] > stats.totalItems * 0.5) {
      suggestions.push(
        `${topPlatform[0]} 内容占比较高（${Math.round((topPlatform[1] / stats.totalItems) * 100)}%），建议拓展其他平台的优质内容`,
      );
    }

    // 基于优先级的建议
    if (stats.priorityDistribution.high > stats.totalItems * 0.5) {
      suggestions.push(`高优先级内容较多，建议先专注完成这些重要内容`);
    }

    // 基于计划时长的建议
    if (schedule.length > 28) {
      suggestions.push(
        `计划跨度较长（${schedule.length} 天），建议每周检查进度并适时调整`,
      );
    }

    // 默认建议
    if (suggestions.length === 0) {
      suggestions.push(`计划安排合理，按部就班执行即可`);
      suggestions.push(`建议在固定时间段阅读，形成良好习惯`);
    }

    return suggestions;
  }

  /**
   * 生成计划摘要
   */
  generateSummary(
    input: ReadingPlannerInput,
    stats: PlanStats,
    schedule: DaySchedule[],
  ): string {
    const goalDesc = GOAL_DESCRIPTIONS[input.goal];
    const durationDesc =
      schedule.length > 0
        ? `${schedule[0].date} 至 ${schedule[schedule.length - 1].date}（${schedule.length} 天）`
        : "暂无安排";

    const topTopics = Object.entries(stats.topicCoverage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([topic]) => topic);

    const parts: string[] = [
      `📚 阅读计划：${goalDesc}`,
      `📅 时间安排：${durationDesc}`,
      `📖 总计 ${stats.totalItems} 篇内容，预计 ${stats.totalReadingTime} 分钟`,
      `⏱️ 平均每天 ${stats.averagePerDay} 分钟`,
    ];

    if (topTopics.length > 0) {
      parts.push(`🏷️ 主要主题：${topTopics.join("、")}`);
    }

    return parts.join("\n");
  }

  /**
   * 生成完整的阅读计划
   */
  generatePlan(
    bookmarks: BookmarkForPlan[],
    input: ReadingPlannerInput,
  ): ReadingPlannerOutput {
    // Step 1: 估算每个书签的阅读时间和优先级
    const bookmarksWithEstimate: BookmarkWithEstimate[] = bookmarks.map(
      (bookmark) => {
        const { priority, topicRelevance } = this.calculatePriority(
          bookmark,
          input.preferences.prioritizeBy,
          input.topic,
        );
        return {
          ...bookmark,
          estimatedReadTime: this.estimateReadTime(bookmark),
          priority,
          isReview: false,
          topicRelevance,
        };
      },
    );

    // Step 2: 生成日程安排
    const schedule = this.generateSchedule(bookmarksWithEstimate, input);

    // Step 3: 生成里程碑
    const milestones = this.generateMilestones(schedule);

    // Step 4: 计算统计
    const stats = this.calculateStats(bookmarksWithEstimate, schedule);

    // Step 5: 生成建议和摘要
    const suggestions = this.generateSuggestions(input, stats, schedule);
    const summary = this.generateSummary(input, stats, schedule);

    // 构建输出
    const startDate =
      schedule[0]?.date || new Date().toISOString().split("T")[0];
    const endDate =
      schedule[schedule.length - 1]?.date ||
      new Date().toISOString().split("T")[0];

    return {
      plan: {
        id: uuidv4(),
        name: this.generatePlanName(input),
        goal: input.goal,
        createdAt: new Date().toISOString(),
        duration: {
          startDate,
          endDate,
          totalDays: schedule.length,
        },
      },
      schedule,
      stats,
      milestones,
      summary,
      suggestions,
    };
  }

  /**
   * 生成计划名称
   */
  private generatePlanName(input: ReadingPlannerInput): string {
    const today = new Date().toISOString().split("T")[0];

    switch (input.goal) {
      case "clear_backlog":
        return `清理积压计划 - ${today}`;
      case "learn_topic":
        return `学习计划：${input.topic || "综合"} - ${today}`;
      case "daily_routine":
        return `日常阅读计划 - ${today}`;
      case "custom":
        return `自定义计划 - ${today}`;
      default:
        return `阅读计划 - ${today}`;
    }
  }
}

/**
 * 默认计划生成器实例
 */
export const planGenerator = new ReadingPlanGenerator();
