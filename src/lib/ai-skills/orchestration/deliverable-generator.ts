/**
 * DeliverableGenerator - 交付物生成器
 *
 * 职责：
 * - 生成各种类型的交付物（报告、列表、卡片、文档等）
 * - 支持多种输出格式（Markdown、HTML、JSON、Cards）
 * - 提供格式转换能力
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import type {
  DeliverableType,
  OutputFormat,
  DeliverableAction,
} from "../output/types";
import type { Deliverable } from "./types";

/**
 * 交付物生成器配置
 */
interface DeliverableGeneratorConfig {
  /** 默认输出格式 */
  defaultFormat?: OutputFormat;
  /** 是否默认可下载 */
  defaultDownloadable?: boolean;
  /** 是否默认可分享 */
  defaultShareable?: boolean;
}

/**
 * 报告数据结构
 */
interface ReportData {
  /** 报告标题 */
  title: string;
  /** 报告摘要 */
  summary?: string;
  /** 报告章节 */
  sections: Array<{
    title: string;
    content: string;
    data?: unknown;
  }>;
  /** 统计数据 */
  stats?: Record<string, number | string>;
  /** 生成时间 */
  generatedAt: Date;
}

/**
 * 列表数据结构
 */
interface ListData<T = unknown> {
  /** 列表标题 */
  title: string;
  /** 列表项 */
  items: T[];
  /** 总数 */
  total: number;
  /** 分页信息 */
  pagination?: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/**
 * 卡片数据结构
 */
interface CardData {
  /** 卡片 ID */
  id: string | number;
  /** 卡片标题 */
  title: string;
  /** 卡片描述 */
  description?: string;
  /** 卡片内容 */
  content?: string;
  /** 卡片图片 */
  image?: string;
  /** 卡片链接 */
  url?: string;
  /** 卡片标签 */
  tags?: string[];
  /** 卡片元数据 */
  metadata?: Record<string, unknown>;
  /** 卡片操作 */
  actions?: Array<{
    label: string;
    action: string;
  }>;
}

/**
 * 交付物生成器
 */
export class DeliverableGenerator {
  private config: Required<DeliverableGeneratorConfig>;
  private idCounter = 0;

  constructor(config: DeliverableGeneratorConfig = {}) {
    this.config = {
      defaultFormat: "markdown",
      defaultDownloadable: true,
      defaultShareable: true,
      ...config,
    };
  }

  /**
   * 生成唯一 ID
   */
  private generateId(type: DeliverableType): string {
    this.idCounter++;
    return `${type}-${Date.now()}-${this.idCounter}`;
  }

  /**
   * 生成报告类交付物
   */
  generateReport(
    data: ReportData,
    options: {
      format?: OutputFormat;
      downloadable?: boolean;
      shareable?: boolean;
    } = {},
  ): Deliverable {
    const format = options.format || this.config.defaultFormat;
    const content = this.formatReport(data, format);

    return {
      id: this.generateId("report"),
      type: "report",
      title: data.title,
      format,
      content,
      downloadable: options.downloadable ?? this.config.defaultDownloadable,
      shareable: options.shareable ?? this.config.defaultShareable,
      metadata: {
        sectionsCount: data.sections.length,
        stats: data.stats,
      },
      createdAt: data.generatedAt || new Date(),
    };
  }

  /**
   * 生成列表类交付物
   */
  generateList<T>(
    data: ListData<T>,
    options: {
      format?: OutputFormat;
      downloadable?: boolean;
      shareable?: boolean;
      itemFormatter?: (item: T, index: number) => string;
    } = {},
  ): Deliverable {
    const format = options.format || this.config.defaultFormat;
    const content = this.formatList(data, format, options.itemFormatter);

    return {
      id: this.generateId("list"),
      type: "list",
      title: data.title,
      format,
      content,
      downloadable: options.downloadable ?? this.config.defaultDownloadable,
      shareable: options.shareable ?? this.config.defaultShareable,
      metadata: {
        itemsCount: data.items.length,
        total: data.total,
        pagination: data.pagination,
      },
      createdAt: new Date(),
    };
  }

  /**
   * 生成卡片组交付物
   */
  generateCards(
    title: string,
    cards: CardData[],
    options: {
      downloadable?: boolean;
      shareable?: boolean;
    } = {},
  ): Deliverable {
    return {
      id: this.generateId("cards"),
      type: "cards",
      title,
      format: "cards",
      content: cards,
      downloadable: options.downloadable ?? this.config.defaultDownloadable,
      shareable: options.shareable ?? this.config.defaultShareable,
      metadata: {
        cardsCount: cards.length,
      },
      createdAt: new Date(),
    };
  }

  /**
   * 生成文档类交付物
   */
  generateDocument(
    title: string,
    content: string,
    options: {
      format?: OutputFormat;
      downloadable?: boolean;
      shareable?: boolean;
      metadata?: Record<string, unknown>;
    } = {},
  ): Deliverable {
    const format = options.format || this.config.defaultFormat;

    return {
      id: this.generateId("document"),
      type: "document",
      title,
      format,
      content,
      downloadable: options.downloadable ?? this.config.defaultDownloadable,
      shareable: options.shareable ?? this.config.defaultShareable,
      metadata: options.metadata,
      createdAt: new Date(),
    };
  }

  /**
   * 生成表格类交付物
   */
  generateTable(
    title: string,
    headers: string[],
    rows: Array<Array<string | number>>,
    options: {
      format?: OutputFormat;
      downloadable?: boolean;
      shareable?: boolean;
    } = {},
  ): Deliverable {
    const format = options.format || this.config.defaultFormat;
    const content = this.formatTable(headers, rows, format);

    return {
      id: this.generateId("table"),
      type: "table",
      title,
      format,
      content,
      downloadable: options.downloadable ?? this.config.defaultDownloadable,
      shareable: options.shareable ?? this.config.defaultShareable,
      metadata: {
        columnsCount: headers.length,
        rowsCount: rows.length,
      },
      createdAt: new Date(),
    };
  }

  /**
   * 格式化报告
   */
  private formatReport(data: ReportData, format: OutputFormat): unknown {
    switch (format) {
      case "markdown":
        return this.reportToMarkdown(data);
      case "html":
        return this.reportToHtml(data);
      case "json":
        return data;
      default:
        return this.reportToMarkdown(data);
    }
  }

  /**
   * 报告转 Markdown
   */
  private reportToMarkdown(data: ReportData): string {
    const lines: string[] = [];

    lines.push(`# ${data.title}\n`);

    if (data.summary) {
      lines.push(`> ${data.summary}\n`);
    }

    if (data.stats && Object.keys(data.stats).length > 0) {
      lines.push("## 概览\n");
      for (const [key, value] of Object.entries(data.stats)) {
        lines.push(`- **${key}**: ${value}`);
      }
      lines.push("");
    }

    for (const section of data.sections) {
      lines.push(`## ${section.title}\n`);
      lines.push(section.content);
      lines.push("");
    }

    lines.push(`---\n*生成时间: ${data.generatedAt.toLocaleString()}*`);

    return lines.join("\n");
  }

  /**
   * 报告转 HTML
   */
  private reportToHtml(data: ReportData): string {
    const sections = data.sections
      .map(
        (s) => `
      <section>
        <h2>${this.escapeHtml(s.title)}</h2>
        <div>${this.escapeHtml(s.content)}</div>
      </section>
    `,
      )
      .join("");

    const stats = data.stats
      ? `
      <div class="stats">
        ${Object.entries(data.stats)
          .map(
            ([k, v]) =>
              `<span><strong>${this.escapeHtml(k)}</strong>: ${this.escapeHtml(String(v))}</span>`,
          )
          .join("")}
      </div>
    `
      : "";

    return `
      <article class="report">
        <h1>${this.escapeHtml(data.title)}</h1>
        ${data.summary ? `<blockquote>${this.escapeHtml(data.summary)}</blockquote>` : ""}
        ${stats}
        ${sections}
        <footer>生成时间: ${data.generatedAt.toLocaleString()}</footer>
      </article>
    `;
  }

  /**
   * 格式化列表
   */
  private formatList<T>(
    data: ListData<T>,
    format: OutputFormat,
    itemFormatter?: (item: T, index: number) => string,
  ): unknown {
    const defaultFormatter = (item: T, _index: number) =>
      typeof item === "string" ? item : JSON.stringify(item);
    const formatter = itemFormatter || defaultFormatter;

    switch (format) {
      case "markdown":
        return this.listToMarkdown(data, formatter);
      case "html":
        return this.listToHtml(data, formatter);
      case "json":
        return data;
      default:
        return this.listToMarkdown(data, formatter);
    }
  }

  /**
   * 列表转 Markdown
   */
  private listToMarkdown<T>(
    data: ListData<T>,
    formatter: (item: T, index: number) => string,
  ): string {
    const lines: string[] = [];

    lines.push(`# ${data.title}\n`);
    lines.push(`共 ${data.total} 项\n`);

    data.items.forEach((item, index) => {
      lines.push(`${index + 1}. ${formatter(item, index)}`);
    });

    return lines.join("\n");
  }

  /**
   * 列表转 HTML
   */
  private listToHtml<T>(
    data: ListData<T>,
    formatter: (item: T, index: number) => string,
  ): string {
    const items = data.items
      .map(
        (item, index) => `<li>${this.escapeHtml(formatter(item, index))}</li>`,
      )
      .join("");

    return `
      <div class="list">
        <h1>${this.escapeHtml(data.title)}</h1>
        <p>共 ${data.total} 项</p>
        <ol>${items}</ol>
      </div>
    `;
  }

  /**
   * 格式化表格
   */
  private formatTable(
    headers: string[],
    rows: Array<Array<string | number>>,
    format: OutputFormat,
  ): unknown {
    switch (format) {
      case "markdown":
        return this.tableToMarkdown(headers, rows);
      case "html":
        return this.tableToHtml(headers, rows);
      case "json":
        return { headers, rows };
      default:
        return this.tableToMarkdown(headers, rows);
    }
  }

  /**
   * 表格转 Markdown
   */
  private tableToMarkdown(
    headers: string[],
    rows: Array<Array<string | number>>,
  ): string {
    const lines: string[] = [];

    // 表头
    lines.push(`| ${headers.join(" | ")} |`);
    lines.push(`| ${headers.map(() => "---").join(" | ")} |`);

    // 数据行
    for (const row of rows) {
      lines.push(`| ${row.join(" | ")} |`);
    }

    return lines.join("\n");
  }

  /**
   * 表格转 HTML
   */
  private tableToHtml(
    headers: string[],
    rows: Array<Array<string | number>>,
  ): string {
    const headerHtml = headers
      .map((h) => `<th>${this.escapeHtml(h)}</th>`)
      .join("");

    const rowsHtml = rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${this.escapeHtml(String(cell))}</td>`).join("")}</tr>`,
      )
      .join("");

    return `
      <table>
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * 添加操作到交付物
   */
  addActions(
    deliverable: Deliverable,
    actions: DeliverableAction[],
  ): Deliverable {
    return {
      ...deliverable,
      metadata: {
        ...deliverable.metadata,
        actions,
      },
    };
  }
}

/**
 * 创建交付物生成器
 */
export function createDeliverableGenerator(
  config?: DeliverableGeneratorConfig,
): DeliverableGenerator {
  return new DeliverableGenerator(config);
}

/**
 * 默认交付物生成器实例
 */
export const deliverableGenerator = new DeliverableGenerator();

// 导出类型
export type { ReportData, ListData, CardData };
