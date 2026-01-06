/**
 * Draft Version Manager - 草稿版本管理器
 * @module knowledge-studio/iteration
 *
 * 管理生成草稿的版本历史：
 * - 创建版本快照
 * - 最多保留 3 个版本
 * - 版本历史列表
 * - 恢复到历史版本
 */

import { createLogger } from "@/lib/logger";
import {
  MAX_DRAFT_VERSIONS,
  DRAFT_STORAGE_KEY_PREFIX,
  type DraftVersion,
  type DraftVersionState,
  type DraftVersionManagerConfig,
  type DraftVersionDiff,
  type DraftSource,
  type DraftFeedback,
} from "./types";

// ============================================================
// Logger
// ============================================================

const logger = createLogger("knowledge-studio:draft-version-manager");

// ============================================================
// DraftVersionManager
// ============================================================

/**
 * 草稿版本管理器
 *
 * 管理生成草稿的版本历史，支持创建快照、恢复历史版本。
 *
 * @example
 * ```typescript
 * const manager = new DraftVersionManager({ sessionId: 'report-123' });
 *
 * // 保存初始版本
 * manager.saveVersion(content, 'initial');
 *
 * // 保存精简版本
 * manager.saveVersion(condensedContent, 'condense', '精简到 1500 字');
 *
 * // 获取历史列表
 * const history = manager.getVersionHistory();
 *
 * // 恢复版本
 * const restored = manager.restoreVersion('version-id');
 * ```
 */
export class DraftVersionManager {
  private state: DraftVersionState;
  private maxVersions: number;
  private sessionId: string;

  constructor(config: DraftVersionManagerConfig = {}) {
    this.maxVersions = config.maxVersions ?? MAX_DRAFT_VERSIONS;
    this.sessionId = config.sessionId ?? "default";
    this.state = this.loadState();
  }

  /**
   * 保存新版本
   *
   * @param content - 草稿内容
   * @param source - 来源类型
   * @param sourceDescription - 来源描述（可选）
   * @param feedback - 用户反馈（可选）
   * @returns 新创建的版本
   */
  saveVersion(
    content: string,
    source: DraftSource,
    sourceDescription?: string,
    feedback?: DraftFeedback,
  ): DraftVersion {
    const wordCount = this.countWords(content);

    const version: DraftVersion = {
      id: this.generateVersionId(),
      version: this.getNextVersionNumber(),
      timestamp: Date.now(),
      content,
      wordCount,
      source,
      sourceDescription,
      feedback,
    };

    // 添加到列表头部（最新版本在前）
    this.state.versions.unshift(version);
    this.state.currentIndex = 0;

    // 限制版本数量
    if (this.state.versions.length > this.maxVersions) {
      const removed = this.state.versions.splice(this.maxVersions);
      logger.debug(
        { removedCount: removed.length },
        "Removed old draft versions to stay within limit",
      );
    }

    this.persistState();

    logger.info(
      {
        versionId: version.id,
        versionNumber: version.version,
        wordCount,
        source,
        totalVersions: this.state.versions.length,
      },
      "Saved new draft version",
    );

    return version;
  }

  /**
   * 获取版本历史列表
   *
   * @returns 版本列表（按时间倒序）
   */
  getVersionHistory(): DraftVersion[] {
    return [...this.state.versions];
  }

  /**
   * 获取当前版本
   *
   * @returns 当前版本，如果没有版本则返回 undefined
   */
  getCurrentVersion(): DraftVersion | undefined {
    return this.state.versions[this.state.currentIndex];
  }

  /**
   * 获取指定版本
   *
   * @param versionId - 版本 ID
   * @returns 指定版本，如果不存在则返回 undefined
   */
  getVersion(versionId: string): DraftVersion | undefined {
    return this.state.versions.find((v) => v.id === versionId);
  }

  /**
   * 恢复到指定版本
   *
   * @param versionId - 要恢复的版本 ID
   * @returns 恢复的内容，如果版本不存在则返回 undefined
   */
  restoreVersion(versionId: string): string | undefined {
    const index = this.state.versions.findIndex((v) => v.id === versionId);

    if (index === -1) {
      logger.warn({ versionId }, "Draft version not found for restore");
      return undefined;
    }

    this.state.currentIndex = index;
    this.persistState();

    const version = this.state.versions[index];

    logger.info(
      {
        versionId,
        versionNumber: version.version,
        wordCount: version.wordCount,
      },
      "Restored draft to version",
    );

    return version.content;
  }

  /**
   * 检查是否有版本历史
   */
  hasVersions(): boolean {
    return this.state.versions.length > 0;
  }

  /**
   * 获取版本数量
   */
  getVersionCount(): number {
    return this.state.versions.length;
  }

  /**
   * 清除所有版本历史
   */
  clearHistory(): void {
    this.state = {
      currentIndex: 0,
      versions: [],
    };
    this.persistState();

    logger.info({ sessionId: this.sessionId }, "Cleared draft version history");
  }

  /**
   * 比较两个版本的差异
   *
   * @param versionId1 - 第一个版本 ID
   * @param versionId2 - 第二个版本 ID
   * @returns 差异描述
   */
  compareVersions(
    versionId1: string,
    versionId2: string,
  ): DraftVersionDiff | undefined {
    const v1 = this.getVersion(versionId1);
    const v2 = this.getVersion(versionId2);

    if (!v1 || !v2) {
      return undefined;
    }

    const wordCountDiff = v2.wordCount - v1.wordCount;
    const wordCountPercent =
      v1.wordCount > 0 ? Math.round((wordCountDiff / v1.wordCount) * 100) : 0;

    return {
      wordCountDiff,
      wordCountPercent,
      timeDiff: v2.timestamp - v1.timestamp,
    };
  }

  /**
   * 添加反馈到当前版本
   *
   * @param feedback - 用户反馈
   */
  addFeedbackToCurrentVersion(feedback: DraftFeedback): void {
    const current = this.getCurrentVersion();
    if (current) {
      current.feedback = feedback;
      this.persistState();

      logger.info(
        {
          versionId: current.id,
          rating: feedback.rating,
          type: feedback.type,
        },
        "Added feedback to draft version",
      );
    }
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * 生成唯一版本 ID
   */
  private generateVersionId(): string {
    return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 获取下一个版本号
   */
  private getNextVersionNumber(): number {
    if (this.state.versions.length === 0) {
      return 1;
    }
    return Math.max(...this.state.versions.map((v) => v.version)) + 1;
  }

  /**
   * 统计字数（中文按字符计，英文按单词计）
   */
  private countWords(text: string): number {
    if (!text) return 0;

    // 移除空白字符
    const cleaned = text.replace(/\s+/g, " ").trim();

    // 中文字符计数
    const chineseChars = (cleaned.match(/[\u4e00-\u9fff]/g) || []).length;

    // 英文单词计数（移除中文后按空格分割）
    const withoutChinese = cleaned.replace(/[\u4e00-\u9fff]/g, " ");
    const englishWords = withoutChinese
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    return chineseChars + englishWords;
  }

  /**
   * 获取存储键
   */
  private getStorageKey(): string {
    return `${DRAFT_STORAGE_KEY_PREFIX}${this.sessionId}`;
  }

  /**
   * 从 sessionStorage 加载状态
   */
  private loadState(): DraftVersionState {
    if (typeof window === "undefined") {
      return { currentIndex: 0, versions: [] };
    }

    try {
      const stored = sessionStorage.getItem(this.getStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored) as DraftVersionState;
        logger.debug(
          { sessionId: this.sessionId, versionCount: parsed.versions.length },
          "Loaded draft version state",
        );
        return parsed;
      }
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : "Unknown error" },
        "Failed to load draft version state",
      );
    }

    return { currentIndex: 0, versions: [] };
  }

  /**
   * 持久化状态到 sessionStorage
   */
  private persistState(): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      sessionStorage.setItem(this.getStorageKey(), JSON.stringify(this.state));
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : "Unknown error" },
        "Failed to persist draft version state",
      );
    }
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 格式化版本时间戳为可读字符串
 *
 * @param timestamp - 时间戳
 * @returns 格式化的时间字符串
 */
export function formatDraftVersionTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 1) {
    return "刚刚";
  } else if (diffMins < 60) {
    return `${diffMins} 分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours} 小时前`;
  } else {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

/**
 * 获取版本来源的显示文本
 *
 * @param version - 草稿版本
 * @returns 显示文本
 */
export function getDraftSourceLabel(version: DraftVersion): string {
  switch (version.source) {
    case "initial":
      return "首次生成";
    case "condense":
      return version.sourceDescription || "精简版本";
    case "iteration":
      return version.sourceDescription || "迭代优化";
    default:
      return "未知来源";
  }
}

/**
 * 创建草稿版本管理器实例
 *
 * @param sessionId - 会话 ID
 * @returns 版本管理器实例
 */
export function createDraftVersionManager(
  sessionId?: string,
): DraftVersionManager {
  return new DraftVersionManager({ sessionId });
}
