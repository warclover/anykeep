/**
 * 摘要格式化器
 *
 * 用于将摘要内容转换为不同的输出格式
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import type {
  TopicGroup,
  DigestOutputFormat,
  DigestInsight,
  DigestStats,
  SummaryLength,
} from "./types";
import { QUICK_DIGEST_CONFIG } from "./types";

/**
 * 格式化器接口
 */
export interface DigestFormatter {
  format(
    topics: TopicGroup[],
    stats: DigestStats,
    options: FormatOptions,
  ): string;
}

/**
 * 格式化选项
 */
export interface FormatOptions {
  title: string;
  summaryLength: SummaryLength;
  includeInsights: boolean;
  insights?: DigestInsight[];
  generatedAt: string;
}

/**
 * Markdown 格式化器
 */
export class MarkdownFormatter implements DigestFormatter {
  format(
    topics: TopicGroup[],
    stats: DigestStats,
    options: FormatOptions,
  ): string {
    const lines: string[] = [];

    // 标题
    lines.push(`# ${options.title}`);
    lines.push("");
    lines.push(`> 生成时间: ${options.generatedAt}`);
    lines.push(
      `> 共处理 ${stats.totalProcessed} 条收藏，识别 ${stats.topicsIdentified} 个主题`,
    );
    lines.push("");

    // 统计概览
    lines.push("## 📊 概览");
    lines.push("");
    lines.push(
      `- **时间范围**: ${stats.dateRange.start} ~ ${stats.dateRange.end}`,
    );
    lines.push(
      `- **平台分布**: ${this.formatPlatformDistribution(stats.platformDistribution)}`,
    );
    lines.push("");

    // 主题内容
    topics.forEach((topic, index) => {
      lines.push(
        `## ${this.getTopicEmoji(index)} ${topic.name} (${topic.count}篇)`,
      );
      lines.push("");

      if (topic.keywords.length > 0) {
        lines.push(`**关键词**: ${topic.keywords.join(", ")}`);
        lines.push("");
      }

      if (topic.summary) {
        lines.push(topic.summary);
        lines.push("");
      }

      // 书签列表
      topic.bookmarks.forEach((bookmark) => {
        const summary = this.truncateSummary(
          bookmark.summary,
          options.summaryLength,
        );
        lines.push(`### [${bookmark.title}](${bookmark.url})`);
        if (summary) {
          lines.push(`> ${summary}`);
        }
        lines.push("");
      });
    });

    // 洞察
    if (
      options.includeInsights &&
      options.insights &&
      options.insights.length > 0
    ) {
      lines.push("## 💡 洞察");
      lines.push("");
      options.insights.forEach((insight) => {
        const emoji = this.getInsightEmoji(insight.type);
        lines.push(`- ${emoji} ${insight.content}`);
      });
      lines.push("");
    }

    return lines.join("\n");
  }

  private formatPlatformDistribution(dist: Record<string, number>): string {
    return Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .map(([platform, count]) => `${platform}(${count})`)
      .join(", ");
  }

  private getTopicEmoji(index: number): string {
    const emojis = ["📚", "🎯", "💻", "🔬", "📝", "🎨", "🌐", "⚡", "🔧", "📈"];
    return emojis[index % emojis.length];
  }

  private getInsightEmoji(type: string): string {
    switch (type) {
      case "trend":
        return "📈";
      case "gap":
        return "🔍";
      case "recommendation":
        return "💡";
      default:
        return "•";
    }
  }

  private truncateSummary(summary: string, length: SummaryLength): string {
    if (!summary) return "";
    const maxChars = QUICK_DIGEST_CONFIG.SUMMARY_LENGTHS[length].maxChars;
    if (summary.length <= maxChars) return summary;
    return summary.slice(0, maxChars - 3) + "...";
  }
}

/**
 * Mindmap 格式化器（Markmap 兼容）
 */
export class MindmapFormatter implements DigestFormatter {
  format(
    topics: TopicGroup[],
    stats: DigestStats,
    options: FormatOptions,
  ): string {
    const lines: string[] = [];

    // 根节点
    lines.push(`# ${options.title}`);
    lines.push("");

    // 统计节点
    lines.push("## 📊 概览");
    lines.push(`- 收藏数: ${stats.totalProcessed}`);
    lines.push(`- 主题数: ${stats.topicsIdentified}`);
    lines.push(`- 时间: ${stats.dateRange.start} ~ ${stats.dateRange.end}`);
    lines.push("");

    // 主题节点
    topics.forEach((topic) => {
      lines.push(`## ${topic.name}`);

      // 关键词
      if (topic.keywords.length > 0) {
        lines.push("### 关键词");
        topic.keywords.forEach((kw) => {
          lines.push(`- ${kw}`);
        });
      }

      // 书签
      lines.push("### 内容");
      topic.bookmarks.forEach((bookmark) => {
        lines.push(`- [${bookmark.title}](${bookmark.url})`);
      });

      lines.push("");
    });

    // 洞察节点
    if (
      options.includeInsights &&
      options.insights &&
      options.insights.length > 0
    ) {
      lines.push("## 💡 洞察");
      options.insights.forEach((insight) => {
        lines.push(`- ${insight.content}`);
      });
    }

    return lines.join("\n");
  }
}

/**
 * Cards 格式化器（JSON 格式）
 */
export class CardsFormatter implements DigestFormatter {
  format(
    topics: TopicGroup[],
    stats: DigestStats,
    options: FormatOptions,
  ): string {
    const cards = topics.map((topic) => ({
      topic: topic.name,
      count: topic.count,
      keywords: topic.keywords,
      summary:
        topic.summary ||
        this.generateTopicSummary(topic, options.summaryLength),
      keyPoints: this.extractKeyPoints(topic),
      sources: topic.bookmarks.map((b) => ({
        id: b.id,
        title: b.title,
        url: b.url,
        platform: b.platform,
      })),
    }));

    const result = {
      title: options.title,
      generatedAt: options.generatedAt,
      stats: {
        totalProcessed: stats.totalProcessed,
        topicsIdentified: stats.topicsIdentified,
        dateRange: stats.dateRange,
      },
      cards,
      insights: options.insights || [],
    };

    return JSON.stringify(result, null, 2);
  }

  private generateTopicSummary(
    topic: TopicGroup,
    length: SummaryLength,
  ): string {
    // 聚合书签摘要生成主题摘要
    const summaries = topic.bookmarks
      .map((b) => b.summary)
      .filter((s) => s && s.length > 0);

    if (summaries.length === 0) {
      return `关于「${topic.name}」的 ${topic.count} 篇收藏`;
    }

    const maxChars =
      QUICK_DIGEST_CONFIG.SUMMARY_LENGTHS[length].topicSummaryChars;
    const combined = summaries.join(" ").slice(0, maxChars);

    return combined.length < summaries.join(" ").length
      ? combined + "..."
      : combined;
  }

  private extractKeyPoints(topic: TopicGroup): string[] {
    // 从书签摘要中提取关键点
    const points: string[] = [];

    topic.bookmarks.forEach((bookmark) => {
      if (bookmark.summary) {
        // 简单的关键点提取：取摘要的第一句
        const firstSentence = bookmark.summary.split(/[。！？\.!?]/)[0];
        if (firstSentence && firstSentence.length > 10) {
          points.push(firstSentence);
        }
      }
    });

    return points.slice(0, 5); // 最多 5 个关键点
  }
}

/**
 * Outline 格式化器（大纲格式）
 */
export class OutlineFormatter implements DigestFormatter {
  format(
    topics: TopicGroup[],
    stats: DigestStats,
    options: FormatOptions,
  ): string {
    const lines: string[] = [];

    // 标题
    lines.push(options.title);
    lines.push("=".repeat(options.title.length));
    lines.push("");

    // 元信息
    lines.push(`生成时间: ${options.generatedAt}`);
    lines.push(`收藏总数: ${stats.totalProcessed}`);
    lines.push(`主题数量: ${stats.topicsIdentified}`);
    lines.push(`时间范围: ${stats.dateRange.start} ~ ${stats.dateRange.end}`);
    lines.push("");
    lines.push("-".repeat(40));
    lines.push("");

    // 主题大纲
    topics.forEach((topic, topicIndex) => {
      lines.push(`${topicIndex + 1}. ${topic.name} (${topic.count})`);

      // 关键词
      if (topic.keywords.length > 0) {
        lines.push(`   关键词: ${topic.keywords.join(", ")}`);
      }

      // 书签
      topic.bookmarks.forEach((bookmark, bookmarkIndex) => {
        lines.push(
          `   ${topicIndex + 1}.${bookmarkIndex + 1} ${bookmark.title}`,
        );
        lines.push(`       URL: ${bookmark.url}`);
        if (bookmark.summary) {
          const summary = this.truncate(
            bookmark.summary,
            QUICK_DIGEST_CONFIG.SUMMARY_LENGTHS[options.summaryLength].maxChars,
          );
          lines.push(`       摘要: ${summary}`);
        }
      });

      lines.push("");
    });

    // 洞察
    if (
      options.includeInsights &&
      options.insights &&
      options.insights.length > 0
    ) {
      lines.push("-".repeat(40));
      lines.push("");
      lines.push("洞察与建议:");
      options.insights.forEach((insight, index) => {
        lines.push(`  ${index + 1}. [${insight.type}] ${insight.content}`);
      });
    }

    return lines.join("\n");
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + "...";
  }
}

/**
 * 格式化器工厂
 */
export function createFormatter(format: DigestOutputFormat): DigestFormatter {
  switch (format) {
    case "markdown":
      return new MarkdownFormatter();
    case "mindmap":
      return new MindmapFormatter();
    case "cards":
      return new CardsFormatter();
    case "outline":
      return new OutlineFormatter();
    default:
      return new MarkdownFormatter();
  }
}

/**
 * 生成摘要标题
 */
export function generateDigestTitle(scope: string): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  switch (scope) {
    case "today":
      return "今日阅读摘要";
    case "week":
      return "本周阅读摘要";
    case "month":
      return "本月阅读摘要";
    case "folder":
      return "文件夹内容摘要";
    case "selected":
      return "选中内容摘要";
    case "all":
      return `全部收藏摘要 (${dateStr})`;
    default:
      return `阅读摘要 (${dateStr})`;
  }
}

/**
 * 生成洞察
 */
export function generateInsights(
  topics: TopicGroup[],
  stats: DigestStats,
): DigestInsight[] {
  const insights: DigestInsight[] = [];

  // 趋势洞察
  if (topics.length > 0) {
    const topTopic = topics[0];
    if (topTopic.count >= 3) {
      insights.push({
        type: "trend",
        content: `您最近关注「${topTopic.name}」较多，已收藏 ${topTopic.count} 篇相关内容`,
      });
    }
  }

  // 平台分布洞察
  const platforms = Object.entries(stats.platformDistribution);
  if (platforms.length > 1) {
    const [topPlatform, topCount] = platforms.sort((a, b) => b[1] - a[1])[0];
    const percentage = Math.round((topCount / stats.totalProcessed) * 100);
    if (percentage >= 50) {
      insights.push({
        type: "trend",
        content: `${percentage}% 的收藏来自 ${topPlatform}，建议拓宽信息来源`,
      });
    }
  }

  // 空白区域洞察
  const singleItemTopics = topics.filter((t) => t.count === 1);
  if (singleItemTopics.length >= 3) {
    insights.push({
      type: "gap",
      content: `有 ${singleItemTopics.length} 个主题仅有单篇收藏，可以考虑深入探索`,
    });
  }

  // 推荐
  if (topics.length >= 2) {
    const secondTopic = topics[1];
    insights.push({
      type: "recommendation",
      content: `建议复习「${secondTopic.name}」相关内容，巩固知识体系`,
    });
  }

  return insights;
}
