/**
 * 平台解析器接口定义
 *
 * 为不同内容平台（微信、B站、小红书、知乎等）提供统一的解析接口
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

/**
 * 解析后的内容结构
 */
export interface ParsedContent {
  /** 提取的正文（Markdown 格式，保留结构） */
  content: string;
  /** 文档标题层级列表 */
  headings?: Array<{ level: number; text: string }>;
  /** 有效图片数量 */
  imageCount?: number;
  /** 字数统计 */
  wordCount: number;
  /** 平台名称 */
  platform: string;
  /** 解析置信度 0-1 */
  confidence: number;
  /** 平台特有元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 平台解析器接口
 *
 * 各平台实现此接口，提供定制化的 HTML 正文提取逻辑
 */
export interface IPlatformParser {
  /** 解析器名称 */
  readonly name: string;
  /** 支持的域名列表 */
  readonly supportedDomains: string[];
  /** 判断此解析器是否适用于给定 URL */
  canParse(url: string): boolean;
  /** 解析 HTML，提取结构化正文 */
  parse(html: string, url: string): ParsedContent;
}
