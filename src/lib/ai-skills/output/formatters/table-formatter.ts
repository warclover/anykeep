/**
 * 表格格式化器
 *
 * 将结构化数据格式化为表格输出
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
 * 表格列定义
 */
export interface TableColumn {
  /** 列键 */
  key: string;
  /** 列标题 */
  label: string;
  /** 对齐方式 */
  align?: "left" | "center" | "right";
  /** 格式化函数 */
  formatter?: (value: unknown) => string;
  /** 最大宽度 */
  maxWidth?: number;
}

/**
 * 表格格式化器配置
 */
export interface TableFormatterConfig extends FormatterConfig {
  /** 列定义（可选，不提供则自动推断） */
  columns?: TableColumn[];
  /** 是否显示表头 */
  showHeader?: boolean;
  /** 是否显示行号 */
  showRowNumbers?: boolean;
  /** 最大行数 */
  maxRows?: number;
  /** 列分隔符（纯文本模式） */
  columnSeparator?: string;
}

// ============================================
// 实现
// ============================================

/**
 * 表格格式化器
 */
export class TableFormatter extends BaseFormatter<Record<string, unknown>[]> {
  protected override config: Required<TableFormatterConfig>;

  constructor(config: Partial<TableFormatterConfig> = {}) {
    super(config);
    this.config = {
      outputFormat: config.outputFormat ?? "markdown",
      includeMetadata: config.includeMetadata ?? true,
      maxLength: config.maxLength ?? 10000,
      pretty: config.pretty ?? true,
      columns: config.columns ?? [],
      showHeader: config.showHeader ?? true,
      showRowNumbers: config.showRowNumbers ?? false,
      maxRows: config.maxRows ?? 100,
      columnSeparator: config.columnSeparator ?? " | ",
    };
  }

  get supportedTypes(): DeliverableType[] {
    return ["table"];
  }

  format(
    data: Record<string, unknown>[],
    context: FormatterContext,
  ): FormatterResult {
    const rows = data.slice(0, this.config.maxRows);
    const columns = this.resolveColumns(rows);

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
        content += this.formatMarkdown(rows, columns);
        break;
      case "html":
        content += this.formatHtml(rows, columns);
        break;
      case "json":
        content += this.formatJson(rows);
        break;
      default:
        content += this.formatPlain(rows, columns);
    }

    // 截断处理
    content = this.truncate(content);

    return {
      content,
      format: this.config.outputFormat,
      length: content.length,
      metadata: {
        totalRows: data.length,
        displayedRows: rows.length,
        columns: columns.length,
        truncated: data.length > this.config.maxRows,
      },
    };
  }

  /**
   * 解析列定义
   */
  private resolveColumns(data: Record<string, unknown>[]): TableColumn[] {
    if (this.config.columns.length > 0) {
      return this.config.columns;
    }

    // 自动推断列
    if (data.length === 0) {
      return [];
    }

    const keys = Object.keys(data[0]);
    return keys.map((key) => ({
      key,
      label: this.formatColumnLabel(key),
      align: "left" as const,
    }));
  }

  /**
   * 格式化列标题
   */
  private formatColumnLabel(key: string): string {
    return key
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Markdown 格式
   */
  private formatMarkdown(
    rows: Record<string, unknown>[],
    columns: TableColumn[],
  ): string {
    if (columns.length === 0) {
      return "*无数据*";
    }

    const lines: string[] = [];

    // 表头
    if (this.config.showHeader) {
      const headers = columns.map((col) => col.label);
      if (this.config.showRowNumbers) {
        headers.unshift("#");
      }
      lines.push(`| ${headers.join(" | ")} |`);

      // 分隔行
      const separators = columns.map((col) => {
        const align = col.align || "left";
        if (align === "center") return ":---:";
        if (align === "right") return "---:";
        return "---";
      });
      if (this.config.showRowNumbers) {
        separators.unshift("---");
      }
      lines.push(`| ${separators.join(" | ")} |`);
    }

    // 数据行
    rows.forEach((row, index) => {
      const cells = columns.map((col) => this.formatCell(row[col.key], col));
      if (this.config.showRowNumbers) {
        cells.unshift(String(index + 1));
      }
      lines.push(`| ${cells.join(" | ")} |`);
    });

    return lines.join("\n");
  }

  /**
   * HTML 格式
   */
  private formatHtml(
    rows: Record<string, unknown>[],
    columns: TableColumn[],
  ): string {
    if (columns.length === 0) {
      return "<p><em>无数据</em></p>";
    }

    const lines: string[] = ['<table class="deliverable-table">'];

    // 表头
    if (this.config.showHeader) {
      lines.push("<thead><tr>");
      if (this.config.showRowNumbers) {
        lines.push("<th>#</th>");
      }
      columns.forEach((col) => {
        const align = col.align ? ` style="text-align: ${col.align}"` : "";
        lines.push(`<th${align}>${this.escapeHtml(col.label)}</th>`);
      });
      lines.push("</tr></thead>");
    }

    // 数据行
    lines.push("<tbody>");
    rows.forEach((row, index) => {
      lines.push("<tr>");
      if (this.config.showRowNumbers) {
        lines.push(`<td>${index + 1}</td>`);
      }
      columns.forEach((col) => {
        const value = this.formatCell(row[col.key], col);
        const align = col.align ? ` style="text-align: ${col.align}"` : "";
        lines.push(`<td${align}>${this.escapeHtml(value)}</td>`);
      });
      lines.push("</tr>");
    });
    lines.push("</tbody>");

    lines.push("</table>");
    return lines.join("\n");
  }

  /**
   * JSON 格式
   */
  private formatJson(rows: Record<string, unknown>[]): string {
    return JSON.stringify(rows, null, this.config.pretty ? 2 : 0);
  }

  /**
   * 纯文本格式
   */
  private formatPlain(
    rows: Record<string, unknown>[],
    columns: TableColumn[],
  ): string {
    if (columns.length === 0) {
      return "无数据";
    }

    const sep = this.config.columnSeparator;
    const lines: string[] = [];

    // 表头
    if (this.config.showHeader) {
      const headers = columns.map((col) => col.label);
      if (this.config.showRowNumbers) {
        headers.unshift("#");
      }
      lines.push(headers.join(sep));
      lines.push("-".repeat(headers.join(sep).length));
    }

    // 数据行
    rows.forEach((row, index) => {
      const cells = columns.map((col) => this.formatCell(row[col.key], col));
      if (this.config.showRowNumbers) {
        cells.unshift(String(index + 1));
      }
      lines.push(cells.join(sep));
    });

    return lines.join("\n");
  }

  /**
   * 格式化单元格
   */
  private formatCell(value: unknown, column: TableColumn): string {
    if (value === null || value === undefined) {
      return "-";
    }

    let text: string;

    if (column.formatter) {
      text = column.formatter(value);
    } else if (typeof value === "object") {
      text = JSON.stringify(value);
    } else {
      text = String(value);
    }

    // 截断
    if (column.maxWidth && text.length > column.maxWidth) {
      text = text.slice(0, column.maxWidth - 3) + "...";
    }

    return text;
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
 * 创建表格格式化器
 */
export function createTableFormatter(
  config?: Partial<TableFormatterConfig>,
): TableFormatter {
  return new TableFormatter(config);
}
