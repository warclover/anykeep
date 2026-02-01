/**
 * 输入预处理器
 *
 * 对用户输入进行预处理，包括：
 * - 指代词解析
 * - 上下文增强
 * - 消息规范化
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { UnifiedRequest } from "../types";
import type { PreprocessResult } from "./types";

// ============================================
// 配置
// ============================================

/**
 * 预处理器配置
 */
export interface InputPreprocessorConfig {
  /** 是否启用指代词解析 */
  enablePronounResolution?: boolean;
  /** 是否启用上下文增强 */
  enableContextEnrichment?: boolean;
  /** 最大历史消息数 */
  maxHistoryMessages?: number;
  /** 调试模式 */
  debug?: boolean;
}

const DEFAULT_CONFIG: Required<InputPreprocessorConfig> = {
  enablePronounResolution: true,
  enableContextEnrichment: true,
  maxHistoryMessages: 5,
  debug: false,
};

// ============================================
// InputPreprocessor 类
// ============================================

/**
 * 输入预处理器
 */
export class InputPreprocessor {
  private config: Required<InputPreprocessorConfig>;

  constructor(config: InputPreprocessorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 处理用户输入
   */
  async process(request: UnifiedRequest): Promise<PreprocessResult> {
    const startTime = performance.now();
    let message = request.message.trim();
    let modified = false;

    // 1. 基础规范化
    message = this.normalize(message);
    if (message !== request.message.trim()) {
      modified = true;
    }

    // 2. 指代词解析（如果启用）
    if (
      this.config.enablePronounResolution &&
      request.context?.recentMessages
    ) {
      const resolved = this.resolvePronoun(
        message,
        request.context.recentMessages,
      );
      if (resolved !== message) {
        message = resolved;
        modified = true;
      }
    }

    // 3. 提取结构化信息
    const selectedBookmarks = this.extractBookmarkIds(message);
    const folderId = this.extractFolderId(message);

    return {
      message,
      originalMessage: request.message,
      modified,
      selectedBookmarks:
        selectedBookmarks.length > 0 ? selectedBookmarks : undefined,
      folderId,
      recentMessages: request.context?.recentMessages?.slice(
        -this.config.maxHistoryMessages,
      ),
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  /**
   * 基础规范化
   */
  private normalize(message: string): string {
    // 移除多余空白
    let normalized = message.replace(/\s+/g, " ").trim();

    // 统一标点符号
    normalized = normalized
      .replace(/，/g, ",")
      .replace(/。/g, ".")
      .replace(/？/g, "?")
      .replace(/！/g, "!");

    return normalized;
  }

  /**
   * 指代词解析
   *
   * 解析 "它"、"这个"、"那个" 等指代词
   */
  private resolvePronoun(
    message: string,
    history: Array<{ role: string; content: string }>,
  ): string {
    // 指代词模式
    const pronounPatterns = [
      /^(它|这个|那个|这些|那些)$/,
      /^(它|这个|那个|这些|那些)(是|的|怎么|干嘛)/,
    ];

    const hasPronouns = pronounPatterns.some((p) => p.test(message));
    if (!hasPronouns) {
      return message;
    }

    // 从历史中查找最近提到的实体
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === "assistant") {
        // 尝试提取标题或主题
        const titleMatch = msg.content.match(/《(.+?)》|「(.+?)」|"(.+?)"/);
        if (titleMatch) {
          const title = titleMatch[1] || titleMatch[2] || titleMatch[3];
          return message.replace(/它|这个|那个|这些|那些/, title);
        }
      }
    }

    return message;
  }

  /**
   * 提取书签 ID
   */
  private extractBookmarkIds(message: string): number[] {
    const ids: number[] = [];

    // 匹配 #123 格式
    const hashMatches = message.matchAll(/#(\d+)/g);
    for (const match of hashMatches) {
      ids.push(parseInt(match[1], 10));
    }

    // 匹配 bookmark:123 格式
    const prefixMatches = message.matchAll(/bookmark:(\d+)/gi);
    for (const match of prefixMatches) {
      ids.push(parseInt(match[1], 10));
    }

    return [...new Set(ids)]; // 去重
  }

  /**
   * 提取文件夹 ID
   */
  private extractFolderId(message: string): number | undefined {
    // 匹配 folder:123 格式
    const match = message.match(/folder:(\d+)/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    return undefined;
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建预处理器实例
 */
export function createInputPreprocessor(
  config?: InputPreprocessorConfig,
): InputPreprocessor {
  return new InputPreprocessor(config);
}
