/**
 * 交付物格式化器基类
 *
 * 提供交付物格式化的抽象接口和通用实现
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import type { DeliverableType, OutputFormat } from "../types";

// ============================================
// 类型定义
// ============================================

/**
 * 格式化器配置
 */
export interface FormatterConfig {
  /** 输出格式 */
  outputFormat: OutputFormat;
  /** 是否包含元数据 */
  includeMetadata?: boolean;
  /** 最大长度限制 */
  maxLength?: number;
  /** 是否美化输出 */
  pretty?: boolean;
}

/**
 * 格式化结果
 */
export interface FormatterResult {
  /** 格式化后的内容 */
  content: string;
  /** 输出格式 */
  format: OutputFormat;
  /** 内容长度 */
  length: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 格式化器上下文
 */
export interface FormatterContext {
  /** 交付物类型 */
  type: DeliverableType;
  /** 交付物标题 */
  title: string;
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}

// ============================================
// 抽象基类
// ============================================

/**
 * 交付物格式化器抽象基类
 *
 * @template T - 输入数据类型
 * @template C - 配置类型（默认为 FormatterConfig）
 */
export abstract class BaseFormatter<
  T = unknown,
  C extends FormatterConfig = FormatterConfig,
> {
  protected config: Required<C>;

  constructor(config: Partial<C> = {} as Partial<C>) {
    this.config = {
      outputFormat: "markdown",
      includeMetadata: true,
      maxLength: 10000,
      pretty: true,
      ...config,
    } as Required<C>;
  }

  /**
   * 格式化数据
   *
   * @param data - 原始数据
   * @param context - 格式化上下文
   * @returns 格式化结果
   */
  abstract format(data: T, context: FormatterContext): FormatterResult;

  /**
   * 支持的交付物类型
   */
  abstract get supportedTypes(): DeliverableType[];

  /**
   * 检查是否支持指定类型
   */
  supports(type: DeliverableType): boolean {
    return this.supportedTypes.includes(type);
  }

  /**
   * 截断内容
   */
  protected truncate(content: string): string {
    const maxLength = this.config.maxLength ?? 10000;
    if (content.length <= maxLength) {
      return content;
    }
    return content.slice(0, maxLength - 3) + "...";
  }

  /**
   * 构建元数据头
   */
  protected buildMetadataHeader(context: FormatterContext): string {
    if (!this.config.includeMetadata || !context.metadata) {
      return "";
    }

    const lines: string[] = ["---"];
    for (const [key, value] of Object.entries(context.metadata)) {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
    lines.push("---", "");

    return lines.join("\n");
  }

  /**
   * 转义 Markdown 特殊字符
   */
  protected escapeMarkdown(text: string): string {
    return text.replace(/([*_`~\[\]()#+-])/g, "\\$1");
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<C>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}
