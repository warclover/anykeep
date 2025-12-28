/**
 * 引用渲染器
 *
 * 生成引用列表（Markdown 格式的脚注）
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type {
  Citation,
  CitationRenderOptions,
  CitationRenderResult,
} from "./types";

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_RENDER_OPTIONS: Required<CitationRenderOptions> = {
  title: "参考来源",
  showPlatform: true,
  showSummary: false,
  maxItems: 10,
  format: "markdown",
};

// ============================================================================
// CitationRenderer 类
// ============================================================================

/**
 * 引用渲染器
 *
 * 将引用列表渲染为各种格式的文本
 */
export class CitationRenderer {
  /**
   * 渲染引用列表
   *
   * @param citations - 引用列表
   * @param options - 渲染选项
   * @returns 渲染结果
   */
  renderReferences(
    citations: Citation[],
    options: CitationRenderOptions = {},
  ): CitationRenderResult {
    const opts = { ...DEFAULT_RENDER_OPTIONS, ...options };

    if (citations.length === 0) {
      return {
        content: "",
        count: 0,
        truncated: false,
      };
    }

    // 按引用编号排序
    const sortedCitations = [...citations].sort((a, b) => a.index - b.index);

    // 截断处理
    const truncated = sortedCitations.length > opts.maxItems;
    const displayCitations = truncated
      ? sortedCitations.slice(0, opts.maxItems)
      : sortedCitations;

    // 根据格式渲染
    let content: string;
    switch (opts.format) {
      case "markdown":
        content = this.renderMarkdown(displayCitations, opts, truncated);
        break;
      case "html":
        content = this.renderHtml(displayCitations, opts, truncated);
        break;
      case "plain":
        content = this.renderPlain(displayCitations, opts, truncated);
        break;
      default:
        content = this.renderMarkdown(displayCitations, opts, truncated);
    }

    return {
      content,
      count: displayCitations.length,
      truncated,
    };
  }

  /**
   * 渲染单个引用
   *
   * @param citation - 引用对象
   * @param format - 输出格式
   * @returns 渲染后的文本
   */
  renderSingleCitation(
    citation: Citation,
    format: "markdown" | "html" | "plain" = "markdown",
  ): string {
    switch (format) {
      case "markdown":
        return this.formatMarkdownCitation(citation, false, false);
      case "html":
        return this.formatHtmlCitation(citation, false, false);
      case "plain":
        return this.formatPlainCitation(citation, false, false);
      default:
        return this.formatMarkdownCitation(citation, false, false);
    }
  }

  // ==========================================================================
  // Markdown 渲染
  // ==========================================================================

  private renderMarkdown(
    citations: Citation[],
    options: Required<CitationRenderOptions>,
    truncated: boolean,
  ): string {
    const lines: string[] = [];

    // 分隔线和标题
    lines.push("");
    lines.push("---");
    lines.push(`**${options.title}**`);
    lines.push("");

    // 引用列表
    for (const citation of citations) {
      lines.push(
        this.formatMarkdownCitation(
          citation,
          options.showPlatform,
          options.showSummary,
        ),
      );
    }

    // 截断提示
    if (truncated) {
      lines.push("");
      lines.push(`*...还有更多来源*`);
    }

    return lines.join("\n");
  }

  private formatMarkdownCitation(
    citation: Citation,
    showPlatform: boolean,
    showSummary: boolean,
  ): string {
    let text = `[^${citation.index}]: [${this.escapeMarkdown(citation.title)}](${citation.url})`;

    if (showPlatform && citation.platform) {
      text += ` (${citation.platform})`;
    }

    if (showSummary && citation.summary) {
      text += `\n    > ${this.truncateText(citation.summary, 100)}`;
    }

    return text;
  }

  // ==========================================================================
  // HTML 渲染
  // ==========================================================================

  private renderHtml(
    citations: Citation[],
    options: Required<CitationRenderOptions>,
    truncated: boolean,
  ): string {
    const lines: string[] = [];

    lines.push("<hr>");
    lines.push(`<h4>${this.escapeHtml(options.title)}</h4>`);
    lines.push("<ol>");

    for (const citation of citations) {
      lines.push(
        this.formatHtmlCitation(
          citation,
          options.showPlatform,
          options.showSummary,
        ),
      );
    }

    lines.push("</ol>");

    if (truncated) {
      lines.push("<p><em>...还有更多来源</em></p>");
    }

    return lines.join("\n");
  }

  private formatHtmlCitation(
    citation: Citation,
    showPlatform: boolean,
    showSummary: boolean,
  ): string {
    let html = `<li id="fn-${citation.index}">`;
    html += `<a href="${this.escapeHtml(citation.url)}" target="_blank" rel="noopener noreferrer">`;
    html += this.escapeHtml(citation.title);
    html += "</a>";

    if (showPlatform && citation.platform) {
      html += ` <span class="platform">(${this.escapeHtml(citation.platform)})</span>`;
    }

    if (showSummary && citation.summary) {
      html += `<blockquote>${this.escapeHtml(this.truncateText(citation.summary, 100))}</blockquote>`;
    }

    html += "</li>";
    return html;
  }

  // ==========================================================================
  // 纯文本渲染
  // ==========================================================================

  private renderPlain(
    citations: Citation[],
    options: Required<CitationRenderOptions>,
    truncated: boolean,
  ): string {
    const lines: string[] = [];

    lines.push("");
    lines.push("─".repeat(40));
    lines.push(options.title);
    lines.push("");

    for (const citation of citations) {
      lines.push(
        this.formatPlainCitation(
          citation,
          options.showPlatform,
          options.showSummary,
        ),
      );
    }

    if (truncated) {
      lines.push("");
      lines.push("...还有更多来源");
    }

    return lines.join("\n");
  }

  private formatPlainCitation(
    citation: Citation,
    showPlatform: boolean,
    showSummary: boolean,
  ): string {
    let text = `[${citation.index}] ${citation.title}`;

    if (showPlatform && citation.platform) {
      text += ` (${citation.platform})`;
    }

    text += `\n    ${citation.url}`;

    if (showSummary && citation.summary) {
      text += `\n    摘要: ${this.truncateText(citation.summary, 80)}`;
    }

    return text;
  }

  // ==========================================================================
  // 辅助方法
  // ==========================================================================

  private escapeMarkdown(text: string): string {
    return text.replace(/([[\]()])/g, "\\$1");
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength - 3) + "...";
  }
}

// ============================================================================
// 单例实例
// ============================================================================

/** 全局引用渲染器实例 */
let globalRenderer: CitationRenderer | null = null;

/**
 * 获取全局引用渲染器实例
 */
export function getCitationRenderer(): CitationRenderer {
  if (!globalRenderer) {
    globalRenderer = new CitationRenderer();
  }
  return globalRenderer;
}
