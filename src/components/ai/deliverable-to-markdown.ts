/**
 * 交付物内容 → Markdown 格式化工具
 *
 * 将结构化的交付物 JSON 转换为可读的 Markdown 文本，
 * 用于"保存到笔记"和"复制"操作。
 *
 * @version 1.0.0
 * @since 2026-02-10
 */

import type { DeliverableType } from "./types";

// ── 周期报告类型守卫 ──────────────────────────────────────

interface PeriodicReportData {
  title: string;
  period: string;
  periodLabel: string;
  dateRange: { start: string; end: string };
  stats: {
    newBookmarks: number;
    activeDays: number;
    dailyAverage: number;
    estimatedReadingTime: number;
    mostActiveDay: string;
    mostActiveHour: number;
  };
  comparison?: {
    currentPeriod: string;
    previousPeriod: string;
    bookmarksChange: {
      current: number;
      previous: number;
      changeRate: number;
      trend: "up" | "down" | "stable";
    };
    activityChange?: {
      current: number;
      previous: number;
      changeRate: number;
      trend: "up" | "down" | "stable";
    };
    platformChanges?: Array<{
      platform: string;
      current: number;
      previous: number;
      changeRate: number;
    }>;
  };
  highlights: Array<{
    id: number;
    title: string;
    url: string;
    platform: string;
    summary?: string;
    reason: string;
    createdAt: string;
  }>;
  insights: Array<{
    type: string;
    title: string;
    description: string;
    icon: string;
  }>;
  summary: string;
  suggestions: string[];
  generatedAt: string;
}

function isPeriodicReport(content: unknown): content is PeriodicReportData {
  if (typeof content !== "object" || content === null) return false;
  const obj = content as Record<string, unknown>;
  return (
    typeof obj.stats === "object" &&
    Array.isArray(obj.highlights) &&
    Array.isArray(obj.insights) &&
    typeof obj.summary === "string"
  );
}

// ── 洞察报告类型守卫 ──────────────────────────────────────

interface InsightReportData {
  reportType: string;
  title?: string;
  activity?: Record<string, unknown>;
  content?: Record<string, unknown>;
  summary?: string;
}

function isInsightReport(content: unknown): content is InsightReportData {
  if (typeof content !== "object" || content === null) return false;
  const obj = content as Record<string, unknown>;
  return (
    typeof obj.reportType === "string" &&
    typeof obj.activity === "object" &&
    typeof obj.content === "object"
  );
}

// ── 周期报告格式化 ─────────────────────────────────────────

const PERIOD_ICONS: Record<string, string> = {
  daily: "📅",
  weekly: "📊",
  monthly: "📈",
  quarterly: "📉",
};

function formatPeriodicReport(data: PeriodicReportData): string {
  const lines: string[] = [];
  const icon = PERIOD_ICONS[data.period] || "📊";

  // 标题
  lines.push(`## ${icon} ${data.title}`);
  lines.push("");

  // 时间范围
  if (data.dateRange) {
    lines.push(`> 📅 ${data.dateRange.start} ~ ${data.dateRange.end}`);
    lines.push("");
  }

  // 摘要
  if (data.summary) {
    lines.push(data.summary);
    lines.push("");
  }

  // 统计概览
  lines.push("### 📊 统计概览");
  lines.push("");
  lines.push(`- 新增收藏: **${data.stats.newBookmarks}** 条`);
  lines.push(`- 活跃天数: **${data.stats.activeDays}** 天`);
  lines.push(`- 日均收藏: **${data.stats.dailyAverage.toFixed(1)}** 条`);
  if (data.stats.estimatedReadingTime) {
    lines.push(`- 预计阅读时长: **${data.stats.estimatedReadingTime}** 分钟`);
  }
  if (data.stats.mostActiveDay) {
    lines.push(`- 最活跃日: **${data.stats.mostActiveDay}**`);
  }
  if (data.stats.mostActiveHour !== undefined) {
    lines.push(`- 最活跃时段: **${data.stats.mostActiveHour}:00**`);
  }
  lines.push("");

  // 历史对比
  if (data.comparison) {
    lines.push("### 📈 与上期对比");
    lines.push("");
    const bc = data.comparison.bookmarksChange;
    const trendIcon =
      bc.trend === "up" ? "🔼" : bc.trend === "down" ? "🔽" : "➡️";
    const sign = bc.changeRate >= 0 ? "+" : "";
    lines.push(
      `- 收藏变化: ${trendIcon} ${sign}${bc.changeRate.toFixed(0)}%（本期 ${bc.current} 条 vs 上期 ${bc.previous} 条）`,
    );

    if (data.comparison.activityChange) {
      const ac = data.comparison.activityChange;
      const acIcon =
        ac.trend === "up" ? "🔼" : ac.trend === "down" ? "🔽" : "➡️";
      const acSign = ac.changeRate >= 0 ? "+" : "";
      lines.push(
        `- 活跃度变化: ${acIcon} ${acSign}${ac.changeRate.toFixed(0)}%（本期 ${ac.current} 天 vs 上期 ${ac.previous} 天）`,
      );
    }

    if (
      data.comparison.platformChanges &&
      data.comparison.platformChanges.length > 0
    ) {
      lines.push("");
      lines.push("**平台分布变化：**");
      lines.push("");
      for (const pc of data.comparison.platformChanges) {
        const pcSign = pc.changeRate >= 0 ? "+" : "";
        lines.push(
          `- ${pc.platform}: ${pc.current} 条（${pcSign}${pc.changeRate.toFixed(0)}%）`,
        );
      }
    }
    lines.push("");
  }

  // 亮点推荐
  if (data.highlights.length > 0) {
    lines.push("### ✨ 本期亮点");
    lines.push("");
    for (const h of data.highlights.slice(0, 5)) {
      lines.push(`- **${h.title}**`);
      lines.push(`  ${h.reason}`);
      if (h.url) {
        lines.push(`  🔗 [查看原文](${h.url})`);
      }
    }
    lines.push("");
  }

  // 洞察
  if (data.insights.length > 0) {
    lines.push("### 💡 洞察");
    lines.push("");
    for (const insight of data.insights.slice(0, 4)) {
      lines.push(`${insight.icon} **${insight.title}**`);
      lines.push(`   ${insight.description}`);
      lines.push("");
    }
  }

  // 建议
  if (data.suggestions && data.suggestions.length > 0) {
    lines.push("### 🎯 建议");
    lines.push("");
    for (const suggestion of data.suggestions) {
      lines.push(`- ${suggestion}`);
    }
    lines.push("");
  }

  // 生成时间
  if (data.generatedAt) {
    const date = new Date(data.generatedAt);
    lines.push("---");
    lines.push(
      `*报告生成于 ${date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}*`,
    );
  }

  return lines.join("\n");
}

// ── 洞察报告格式化 ─────────────────────────────────────────

function formatInsightReport(data: InsightReportData): string {
  const lines: string[] = [];

  if (data.title) {
    lines.push(`## 📋 ${data.title}`);
    lines.push("");
  }

  if (data.summary) {
    lines.push(data.summary);
    lines.push("");
  }

  // 对于洞察报告的嵌套对象，递归格式化为可读文本
  if (data.content && typeof data.content === "object") {
    lines.push(formatObjectAsMarkdown(data.content, 3));
  }

  return lines.join("\n");
}

// ── 通用对象格式化 ─────────────────────────────────────────

function formatObjectAsMarkdown(
  obj: Record<string, unknown>,
  headingLevel: number = 2,
): string {
  const lines: string[] = [];
  const prefix = "#".repeat(Math.min(headingLevel, 6));

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;

    const label = formatKey(key);

    if (Array.isArray(value)) {
      lines.push(`${prefix} ${label}`);
      lines.push("");
      for (const item of value) {
        if (typeof item === "string") {
          lines.push(`- ${item}`);
        } else if (typeof item === "object" && item !== null) {
          const itemObj = item as Record<string, unknown>;
          // 尝试提取 title/name + description 模式
          const title = itemObj.title || itemObj.name || itemObj.label || "";
          const desc =
            itemObj.description || itemObj.summary || itemObj.reason || "";
          if (title) {
            lines.push(`- **${title}**${desc ? `: ${desc}` : ""}`);
          } else {
            lines.push(`- ${JSON.stringify(item)}`);
          }
        } else {
          lines.push(`- ${String(value)}`);
        }
      }
      lines.push("");
    } else if (typeof value === "object") {
      lines.push(`${prefix} ${label}`);
      lines.push("");
      lines.push(
        formatObjectAsMarkdown(
          value as Record<string, unknown>,
          headingLevel + 1,
        ),
      );
    } else {
      lines.push(`- **${label}**: ${String(value)}`);
    }
  }

  return lines.join("\n");
}

/** 将 camelCase/snake_case key 转为可读标签 */
function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\s/, "")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ── 主入口 ────────────────────────────────────────────────

/**
 * 将交付物内容转换为可读的 Markdown 文本
 *
 * 用于"保存到笔记"和"复制"操作，替代直接 JSON.stringify。
 * 根据交付物类型和内容结构智能选择格式化策略。
 */
export function deliverableToMarkdown(
  content: unknown,
  type: DeliverableType,
  metadata?: Record<string, unknown>,
): string {
  // 字符串内容直接返回
  if (typeof content === "string") {
    return content;
  }

  const skillId = metadata?.skillId as string | undefined;

  // 1. 周期报告
  if (skillId === "periodic_report" || isPeriodicReport(content)) {
    return formatPeriodicReport(content as PeriodicReportData);
  }

  // 2. 洞察���告
  if (skillId === "insight_report" || isInsightReport(content)) {
    return formatInsightReport(content as InsightReportData);
  }

  // 3. 列表类型
  if (type === "list" && Array.isArray(content)) {
    return content
      .map((item, i) =>
        typeof item === "string"
          ? `${i + 1}. ${item}`
          : `${i + 1}. ${JSON.stringify(item)}`,
      )
      .join("\n");
  }

  // 4. 通用对象 → 结构化 Markdown
  if (typeof content === "object" && content !== null) {
    // 如果对象有 title/summary 等常见字段，优先提取
    const obj = content as Record<string, unknown>;
    const lines: string[] = [];

    if (obj.title) {
      lines.push(`## ${obj.title}`);
      lines.push("");
    }
    if (obj.summary && typeof obj.summary === "string") {
      lines.push(obj.summary);
      lines.push("");
    }

    // 格式化剩余字段
    const skipKeys = new Set(["title", "summary"]);
    const remaining: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!skipKeys.has(k)) remaining[k] = v;
    }
    if (Object.keys(remaining).length > 0) {
      lines.push(formatObjectAsMarkdown(remaining, 3));
    }

    return lines.join("\n");
  }

  // 5. fallback
  return JSON.stringify(content, null, 2);
}
