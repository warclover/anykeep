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

  // 1. 洞察报告
  if (skillId === "insight_report" || isInsightReport(content)) {
    return formatInsightReport(content as InsightReportData);
  }

  // 2. 列表类型
  if (type === "list" && Array.isArray(content)) {
    return content
      .map((item, i) =>
        typeof item === "string"
          ? `${i + 1}. ${item}`
          : `${i + 1}. ${JSON.stringify(item)}`,
      )
      .join("\n");
  }

  // 3. 通用对象 → 结构化 Markdown
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

  // 4. fallback
  return JSON.stringify(content, null, 2);
}
