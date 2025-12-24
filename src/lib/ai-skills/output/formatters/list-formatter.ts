/**
 * 列表格式化器
 *
 * 将数组数据格式化为列表输出
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
 * 列表项
 */
export interface ListItem {
  /** 主要内容 */
  text: string;
  /** 描述（可选） */
  description?: string;
  /** 链接（可选） */
  url?: string;
  /** 标签（可选） */
  tags?: string[];
  /** 额外数据 */
  [key: string]: unknown;
}

/**
 * 列表格式化器配置
 */
export interface ListFormatterConfig extends FormatterConfig {
  /** 列表样式 */
  listStyle?: "bullet" | "numbered" | "checkbox";
  /** 是否显示描述 */
  showDescription?: boolean;
  /** 是否显示链接 */
  showLinks?: boolean;
  /** 是否显示标签 */
  showTags?: boolean;
  /** 每页最大项数 */
  maxItems?: number;
}

// ============================================
// 实现
// ============================================

/**
 * 列表格式化器
 */
export class ListFormatter extends BaseFormatter<
  ListItem[],
  ListFormatterConfig
> {
  protected override config: Required<ListFormatterConfig>;

  constructor(config: Partial<ListFormatterConfig> = {}) {
    super(config);
    this.config = {
      outputFormat: config.outputFormat ?? "markdown",
      includeMetadata: config.includeMetadata ?? true,
      maxLength: config.maxLength ?? 10000,
      pretty: config.pretty ?? true,
      listStyle: config.listStyle ?? "bullet",
      showDescription: config.showDescription ?? true,
      showLinks: config.showLinks ?? true,
      showTags: config.showTags ?? true,
      maxItems: config.maxItems ?? 50,
    };
  }

  get supportedTypes(): DeliverableType[] {
    return ["list"];
  }

  format(data: ListItem[], context: FormatterContext): FormatterResult {
    const items = data.slice(0, this.config.maxItems);

    let content = "";

    // 添加元数据头
    if (this.config.includeMetadata) {
      content += this.buildMetadataHeader(context);
    }

    // 添加标题
    content += `# ${context.title}\n\n`;

    // 根据输出格式处理
    switch (this.config.outputFormat) {
      case "markdown":
        content += this.formatMarkdown(items);
        break;
      case "html":
        content += this.formatHtml(items);
        break;
      case "json":
        content += this.formatJson(items);
        break;
      default:
        content += this.formatPlain(items);
    }

    // 截断处理
    content = this.truncate(content);

    return {
      content,
      format: this.config.outputFormat,
      length: content.length,
      metadata: {
        totalItems: data.length,
        displayedItems: items.length,
        truncated: data.length > this.config.maxItems,
      },
    };
  }

  /**
   * Markdown 格式
   */
  private formatMarkdown(items: ListItem[]): string {
    return items
      .map((item, index) => {
        const prefix = this.getListPrefix(index);
        let line = `${prefix} **${item.text}**`;

        if (this.config.showDescription && item.description) {
          line += `\n  ${item.description}`;
        }

        if (this.config.showLinks && item.url) {
          line += `\n  [链接](${item.url})`;
        }

        if (this.config.showTags && item.tags?.length) {
          line += `\n  ${item.tags.map((t) => `\`${t}\``).join(" ")}`;
        }

        return line;
      })
      .join("\n\n");
  }

  /**
   * HTML 格式
   */
  private formatHtml(items: ListItem[]): string {
    const tag = this.config.listStyle === "numbered" ? "ol" : "ul";
    const listItems = items
      .map((item) => {
        let html = `<li><strong>${this.escapeHtml(item.text)}</strong>`;

        if (this.config.showDescription && item.description) {
          html += `<p>${this.escapeHtml(item.description)}</p>`;
        }

        if (this.config.showLinks && item.url) {
          html += `<a href="${item.url}" target="_blank">链接</a>`;
        }

        if (this.config.showTags && item.tags?.length) {
          html += `<div class="tags">${item.tags.map((t) => `<span class="tag">${this.escapeHtml(t)}</span>`).join("")}</div>`;
        }

        html += "</li>";
        return html;
      })
      .join("\n");

    return `<${tag}>\n${listItems}\n</${tag}>`;
  }

  /**
   * JSON 格式
   */
  private formatJson(items: ListItem[]): string {
    return JSON.stringify(items, null, this.config.pretty ? 2 : 0);
  }

  /**
   * 纯文本格式
   */
  private formatPlain(items: ListItem[]): string {
    return items
      .map((item, index) => {
        const prefix = this.getListPrefix(index);
        let line = `${prefix} ${item.text}`;

        if (this.config.showDescription && item.description) {
          line += `\n   ${item.description}`;
        }

        return line;
      })
      .join("\n");
  }

  /**
   * 获取列表前缀
   */
  private getListPrefix(index: number): string {
    switch (this.config.listStyle) {
      case "numbered":
        return `${index + 1}.`;
      case "checkbox":
        return "- [ ]";
      default:
        return "-";
    }
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
 * 创建列表格式化器
 */
export function createListFormatter(
  config?: Partial<ListFormatterConfig>,
): ListFormatter {
  return new ListFormatter(config);
}
