/**
 * ExtractionFormatter - 萃取结果格式化器
 *
 * 将知识萃取结果格式化为不同格式：
 * - summary: 快速了解（TL;DR + 要点 + 结论）
 * - memo: 学习纪要（完整结构化）
 * - outline: 大纲（层级结构）
 *
 * @module ai-skills/skills/knowledge-extract
 * @version 1.0.0
 */

import type {
  KnowledgeExtraction,
  ExtractionFormat,
  KeyPoint,
  ConceptDefinition,
  SourceInfo,
} from "./types";

// ============================================
// ExtractionFormatter 类
// ============================================

export class ExtractionFormatter {
  /**
   * 格式化萃取结果
   */
  format(extraction: KnowledgeExtraction, format: ExtractionFormat): string {
    switch (format) {
      case "summary":
        return this.formatSummary(extraction);
      case "memo":
        return this.formatMemo(extraction);
      case "outline":
        return this.formatOutline(extraction);
      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }

  /**
   * Summary 格式（快速了解）
   *
   * 特点：
   * - TL;DR 开头
   * - 核心要点 + 来源标注
   * - 简洁结论
   * - 来源列表
   */
  private formatSummary(e: KnowledgeExtraction): string {
    const tldr = this.extractTLDR(e.conclusion);

    const lines: string[] = [
      `# ${e.title}`,
      "",
      `> **TL;DR**: ${tldr}`,
      "",
      "## 核心要点",
      "",
      ...this.formatKeyPointsList(e.keyPoints),
      "",
      "## 结论",
      "",
      e.conclusion,
      "",
      "---",
      `**来源** (${e.sources.length} 篇)`,
      ...this.formatSourceList(e.sources),
    ];

    return lines.join("\n");
  }

  /**
   * Memo 格式（学习纪要）
   *
   * 特点：
   * - 元数据头部
   * - 主题概览
   * - 核心要点（带详细来源）
   * - 核心概念表格
   * - 学习建议
   * - 完整来源
   */
  private formatMemo(e: KnowledgeExtraction): string {
    const dateStr = e.metadata.extractedAt.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const lines: string[] = [
      `# ${e.title}`,
      "",
      `> 整理日期：${dateStr}`,
      `> 来源：${e.sources.length} 篇收藏`,
      `> 主题：${e.topic}`,
      "",
      "## 主题概览",
      "",
      e.conclusion,
      "",
      "## 核心要点",
      "",
      ...this.formatKeyPointsDetailed(e.keyPoints, e.sources),
      "",
    ];

    // 概念表格（如果有）
    if (e.concepts.length > 0) {
      lines.push(
        "## 核心概念",
        "",
        "| 概念 | 定义 | 来源 |",
        "|-----|------|-----|",
        ...this.formatConceptsTable(e.concepts),
        "",
      );
    }

    // 学习建议（如果有）
    if (e.actionItems && e.actionItems.length > 0) {
      lines.push(
        "## 学习建议",
        "",
        ...e.actionItems.map((item, i) => `${i + 1}. ${item}`),
        "",
      );
    }

    lines.push(
      "---",
      "## 来源文档",
      "",
      ...this.formatSourceListDetailed(e.sources),
    );

    return lines.join("\n");
  }

  /**
   * Outline 格式（大纲）
   *
   * 特点：
   * - 层级结构
   * - 简洁明了
   * - 适合快速浏览
   */
  private formatOutline(e: KnowledgeExtraction): string {
    const lines: string[] = [
      `# ${e.title}`,
      "",
      "## 一、主题概述",
      `- 主题：${e.topic}`,
      `- 来源：${e.sources.length} 篇收藏`,
      "",
      "## 二、核心要点",
      ...e.keyPoints.map((kp, i) => {
        const citations = kp.citations.map((c) => `[${c.id}]`).join("");
        return `  ${i + 1}. ${kp.content} ${citations}`;
      }),
      "",
    ];

    // 关键概念
    if (e.concepts.length > 0) {
      lines.push(
        "## 三、关键概念",
        ...e.concepts.map((c) => `  - **${c.term}**: ${c.definition}`),
        "",
      );
    }

    // 结论
    lines.push("## 四、结论", `- ${e.conclusion}`, "");

    // 行动项
    if (e.actionItems && e.actionItems.length > 0) {
      lines.push(
        "## 五、行动项",
        ...e.actionItems.map((item, i) => `  ${i + 1}. ${item}`),
        "",
      );
    }

    // 来源简列
    lines.push(
      "---",
      `来源: ${e.sources.map((s) => `[${s.index}]`).join(" ")}`,
    );

    return lines.join("\n");
  }

  // ============================================
  // 辅助方法
  // ============================================

  /**
   * 提取 TL;DR（结论的前 100 字）
   */
  private extractTLDR(conclusion: string): string {
    if (conclusion.length <= 100) return conclusion;
    return conclusion.substring(0, 100) + "...";
  }

  /**
   * 格式化要点列表（带引用标注）
   */
  private formatKeyPointsList(keyPoints: KeyPoint[]): string[] {
    return keyPoints.map((kp) => {
      const citations = kp.citations.map((c) => `[${c.id}]`).join("");
      const marker = kp.importance === "high" ? "⭐ " : "• ";
      return `${marker}${kp.content} ${citations}`;
    });
  }

  /**
   * 格式化要点详细（带来源标题）
   */
  private formatKeyPointsDetailed(
    keyPoints: KeyPoint[],
    sources: SourceInfo[],
  ): string[] {
    const lines: string[] = [];

    keyPoints.forEach((kp, i) => {
      const prefix = kp.importance === "high" ? "### " : "### ";
      const firstPart = kp.content.split("，")[0].substring(0, 30);

      lines.push(`${prefix}${i + 1}. ${firstPart}`);
      lines.push("");
      lines.push(kp.content);
      lines.push("");

      // 来源标注
      const sourceNames = kp.citations
        .map((c) => {
          const source = sources.find((s) => s.index === c.id);
          return source ? `[${source.title}]` : `[来源${c.id}]`;
        })
        .join("、");

      if (kp.synthesized) {
        lines.push(`> 📚 综合来源：${sourceNames}`);
      } else {
        lines.push(`> 来源：${sourceNames}`);
      }
      lines.push("");
    });

    return lines;
  }

  /**
   * 格式化概念表格
   */
  private formatConceptsTable(concepts: ConceptDefinition[]): string[] {
    return concepts.map((c) => {
      const sourceRefs = c.sourceIds.map((id) => `[${id}]`).join("");
      return `| **${c.term}** | ${c.definition} | ${sourceRefs} |`;
    });
  }

  /**
   * 格式化来源列表（简洁）
   */
  private formatSourceList(sources: SourceInfo[]): string[] {
    return sources.map((s) => `[${s.index}]. [${s.title}](${s.url})`);
  }

  /**
   * 格式化来源列表（详细）
   */
  private formatSourceListDetailed(sources: SourceInfo[]): string[] {
    return sources.map((s) => {
      const dateStr = s.savedAt.toLocaleDateString("zh-CN");
      return `${s.index}. [${s.title}](${s.url}) - ${s.platform} - ${dateStr}`;
    });
  }
}

// ============================================
// 导出
// ============================================

export const extractionFormatter = new ExtractionFormatter();

/**
 * 快捷格式化函数
 */
export function formatExtraction(
  extraction: KnowledgeExtraction,
  format: ExtractionFormat,
): string {
  return extractionFormatter.format(extraction, format);
}
