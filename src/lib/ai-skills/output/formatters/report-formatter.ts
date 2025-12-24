/**
 * 报告格式化器
 *
 * 将结构化数据格式化为报告文档
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import type { DeliverableType } from "../types";
import {
  BaseFormatter,
  type FormatterConfig,
  type FormatterContext,
  type FormatterResult,
} from "./base-formatter";

// ============================================
// 类型定义
// ============================================

/**
 * 报告章节
 */
export interface ReportSection {
  /** 章节标题 */
  title: string;
  /** 章节内容 */
  content: string | ReportSection[];
  /** 章节类型 */
  type?: "text" | "list" | "table" | "quote" | "code";
  /** 额外数据 */
  data?: unknown;
}

/**
 * 报告数据
 */
export interface ReportData {
  /** 报告摘要 */
  summary?: string;
  /** 报告章节 */
  sections: ReportSection[];
  /** 结论 */
  conclusion?: string;
  /** 参考资料 */
  references?: string[];
}

/**
 * 报告格式化器配置
 */
export interface ReportFormatterConfig extends FormatterConfig {
  /** 是否显示目录 */
  showToc?: boolean;
  /** 是否显示摘要 */
  showSummary?: boolean;
  /** 是否显示结论 */
  showConclusion?: boolean;
  /** 是否显示参考资料 */
  showReferences?: boolean;
  /** 标题级别偏移 */
  headingOffset?: number;
}

// ============================================
// 实现
// ============================================

/**
 * 报告格式化器
 */
export class ReportFormatter extends BaseFormatter<
  ReportData,
  ReportFormatterConfig
> {
  protected override config: Required<ReportFormatterConfig>;

  constructor(config: Partial<ReportFormatterConfig> = {}) {
    super(config);
    this.config = {
      outputFormat: config.outputFormat ?? "markdown",
      includeMetadata: config.includeMetadata ?? true,
      maxLength: config.maxLength ?? 10000,
      pretty: config.pretty ?? true,
      showToc: config.showToc ?? false,
      showSummary: config.showSummary ?? true,
      showConclusion: config.showConclusion ?? true,
      showReferences: config.showReferences ?? true,
      headingOffset: config.headingOffset ?? 0,
    };
  }

  get supportedTypes(): DeliverableType[] {
    return ["report", "document"];
  }

  format(data: ReportData, context: FormatterContext): FormatterResult {
    let content = "";

    // 添加元数据头
    if (this.config.includeMetadata) {
      content += this.buildMetadataHeader(context);
    }

    // 根据输出格式处理
    switch (this.config.outputFormat) {
      case "markdown":
        content += this.formatMarkdown(data, context);
        break;
      case "html":
        content += this.formatHtml(data, context);
        break;
      case "json":
        content += this.formatJson(data);
        break;
      default:
        content += this.formatPlain(data, context);
    }

    // 截断处理
    content = this.truncate(content);

    return {
      content,
      format: this.config.outputFormat,
      length: content.length,
      metadata: {
        sectionCount: data.sections.length,
        hasConclusion: !!data.conclusion,
        referenceCount: data.references?.length || 0,
      },
    };
  }

  /**
   * Markdown 格式
   */
  private formatMarkdown(data: ReportData, context: FormatterContext): string {
    const lines: string[] = [];
    const h = (level: number) => "#".repeat(level + this.config.headingOffset);

    // 标题
    lines.push(`${h(1)} ${context.title}`, "");

    // 目录
    if (this.config.showToc && data.sections.length > 0) {
      lines.push(`${h(2)} 目录`, "");
      data.sections.forEach((section, index) => {
        lines.push(
          `${index + 1}. [${section.title}](#${this.slugify(section.title)})`,
        );
      });
      lines.push("");
    }

    // 摘要
    if (this.config.showSummary && data.summary) {
      lines.push(`${h(2)} 摘要`, "", `> ${data.summary}`, "");
    }

    // 章节
    data.sections.forEach((section) => {
      lines.push(this.formatSectionMarkdown(section, 2));
    });

    // 结论
    if (this.config.showConclusion && data.conclusion) {
      lines.push(`${h(2)} 结论`, "", data.conclusion, "");
    }

    // 参考资料
    if (this.config.showReferences && data.references?.length) {
      lines.push(`${h(2)} 参考资料`, "");
      data.references.forEach((ref, index) => {
        lines.push(`${index + 1}. ${ref}`);
      });
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * 格式化章节（Markdown）
   */
  private formatSectionMarkdown(section: ReportSection, level: number): string {
    const lines: string[] = [];
    const h = (l: number) => "#".repeat(l + this.config.headingOffset);

    lines.push(`${h(level)} ${section.title}`, "");

    if (typeof section.content === "string") {
      switch (section.type) {
        case "quote":
          lines.push(`> ${section.content}`, "");
          break;
        case "code":
          lines.push("```", section.content, "```", "");
          break;
        case "list":
          section.content.split("\n").forEach((item) => {
            lines.push(`- ${item}`);
          });
          lines.push("");
          break;
        default:
          lines.push(section.content, "");
      }
    } else {
      // 嵌套章节
      section.content.forEach((subSection) => {
        lines.push(this.formatSectionMarkdown(subSection, level + 1));
      });
    }

    return lines.join("\n");
  }

  /**
   * HTML 格式
   */
  private formatHtml(data: ReportData, context: FormatterContext): string {
    const lines: string[] = ['<article class="report">'];

    // 标题
    lines.push(`<h1>${this.escapeHtml(context.title)}</h1>`);

    // 摘要
    if (this.config.showSummary && data.summary) {
      lines.push(
        '<section class="summary">',
        "<h2>摘要</h2>",
        `<blockquote>${this.escapeHtml(data.summary)}</blockquote>`,
        "</section>",
      );
    }

    // 章节
    data.sections.forEach((section) => {
      lines.push(this.formatSectionHtml(section, 2));
    });

    // 结论
    if (this.config.showConclusion && data.conclusion) {
      lines.push(
        '<section class="conclusion">',
        "<h2>结论</h2>",
        `<p>${this.escapeHtml(data.conclusion)}</p>`,
        "</section>",
      );
    }

    // 参考资料
    if (this.config.showReferences && data.references?.length) {
      lines.push('<section class="references">', "<h2>参考资料</h2>", "<ol>");
      data.references.forEach((ref) => {
        lines.push(`<li>${this.escapeHtml(ref)}</li>`);
      });
      lines.push("</ol>", "</section>");
    }

    lines.push("</article>");
    return lines.join("\n");
  }

  /**
   * 格式化章节（HTML）
   */
  private formatSectionHtml(section: ReportSection, level: number): string {
    const tag = `h${Math.min(level, 6)}`;
    const lines: string[] = [];

    lines.push("<section>");
    lines.push(`<${tag}>${this.escapeHtml(section.title)}</${tag}>`);

    if (typeof section.content === "string") {
      switch (section.type) {
        case "quote":
          lines.push(
            `<blockquote>${this.escapeHtml(section.content)}</blockquote>`,
          );
          break;
        case "code":
          lines.push(
            `<pre><code>${this.escapeHtml(section.content)}</code></pre>`,
          );
          break;
        case "list":
          lines.push("<ul>");
          section.content.split("\n").forEach((item) => {
            lines.push(`<li>${this.escapeHtml(item)}</li>`);
          });
          lines.push("</ul>");
          break;
        default:
          lines.push(`<p>${this.escapeHtml(section.content)}</p>`);
      }
    } else {
      section.content.forEach((subSection) => {
        lines.push(this.formatSectionHtml(subSection, level + 1));
      });
    }

    lines.push("</section>");
    return lines.join("\n");
  }

  /**
   * JSON 格式
   */
  private formatJson(data: ReportData): string {
    return JSON.stringify(data, null, this.config.pretty ? 2 : 0);
  }

  /**
   * 纯文本格式
   */
  private formatPlain(data: ReportData, context: FormatterContext): string {
    const lines: string[] = [];

    // 标题
    lines.push(context.title);
    lines.push("=".repeat(context.title.length), "");

    // 摘要
    if (this.config.showSummary && data.summary) {
      lines.push("【摘要】", data.summary, "");
    }

    // 章节
    data.sections.forEach((section) => {
      lines.push(this.formatSectionPlain(section, 0));
    });

    // 结论
    if (this.config.showConclusion && data.conclusion) {
      lines.push("【结论】", data.conclusion, "");
    }

    // 参考资料
    if (this.config.showReferences && data.references?.length) {
      lines.push("【参考资料】");
      data.references.forEach((ref, index) => {
        lines.push(`[${index + 1}] ${ref}`);
      });
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * 格式化章节（纯文本）
   */
  private formatSectionPlain(section: ReportSection, indent: number): string {
    const prefix = "  ".repeat(indent);
    const lines: string[] = [];

    lines.push(`${prefix}【${section.title}】`);

    if (typeof section.content === "string") {
      lines.push(`${prefix}${section.content}`, "");
    } else {
      section.content.forEach((subSection) => {
        lines.push(this.formatSectionPlain(subSection, indent + 1));
      });
    }

    return lines.join("\n");
  }

  /**
   * 生成锚点 ID
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u4e00-\u9fa5-]/g, "");
  }

  /**
   * 转义 HTML 特殊字符
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

/**
 * 创建报告格式化器
 */
export function createReportFormatter(
  config?: Partial<ReportFormatterConfig>,
): ReportFormatter {
  return new ReportFormatter(config);
}
