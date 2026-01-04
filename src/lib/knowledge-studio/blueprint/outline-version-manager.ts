/**
 * 大纲版本管理器 (Story 2.5)
 * @module knowledge-studio/blueprint
 *
 * 支持大纲版本历史管理：
 * - 创建版本快照
 * - 最多保留 5 个版本
 * - 版本历史列表
 * - 恢复到历史版本
 */

import { createLogger } from "@/lib/logger";
import type { BlueprintOutline } from "./types";

// ============================================================
// Logger
// ============================================================

const logger = createLogger("blueprint:outline-version-manager");

// ============================================================
// Constants
// ============================================================

/** 最大保留版本数 */
export const MAX_VERSIONS = 5;

/** localStorage 存储键前缀 */
const STORAGE_KEY_PREFIX = "knowledge-studio:outline-versions:";

// ============================================================
// Types
// ============================================================

/**
 * 大纲版本快照
 */
export interface OutlineVersion {
  /** 版本 ID */
  id: string;
  /** 版本号（从 1 开始） */
  version: number;
  /** 创建时间戳 */
  timestamp: number;
  /** 大纲快照 */
  outline: BlueprintOutline;
  /** 变更描述（可选） */
  description?: string;
}

/**
 * 版本管理器状态
 */
export interface OutlineVersionState {
  /** 当前版本索引 */
  currentIndex: number;
  /** 版本列表（按时间倒序） */
  versions: OutlineVersion[];
}

/**
 * 版本管理器配置
 */
export interface OutlineVersionManagerConfig {
  /** 最大版本数 */
  maxVersions?: number;
  /** 会话 ID（用于存储隔离） */
  sessionId?: string;
}

// ============================================================
// OutlineVersionManager
// ============================================================

/**
 * 大纲版本管理器
 *
 * 管理大纲的版本历史，支持创建快照、恢复历史版本。
 *
 * @example
 * ```typescript
 * const manager = new OutlineVersionManager({ sessionId: 'session-123' });
 *
 * // 保存版本
 * manager.saveVersion(outline, '初始版本');
 *
 * // 获取历史列表
 * const history = manager.getVersionHistory();
 *
 * // 恢复版本
 * const restored = manager.restoreVersion('version-id');
 * ```
 */
export class OutlineVersionManager {
  private state: OutlineVersionState;
  private maxVersions: number;
  private sessionId: string;

  constructor(config: OutlineVersionManagerConfig = {}) {
    this.maxVersions = config.maxVersions ?? MAX_VERSIONS;
    this.sessionId = config.sessionId ?? "default";
    this.state = this.loadState();
  }

  /**
   * 保存新版本
   *
   * @param outline - 要保存的大纲
   * @param description - 版本描述（可选）
   * @returns 新创建的版本
   */
  saveVersion(outline: BlueprintOutline, description?: string): OutlineVersion {
    const version: OutlineVersion = {
      id: this.generateVersionId(),
      version: this.getNextVersionNumber(),
      timestamp: Date.now(),
      outline: this.deepCloneOutline(outline),
      description,
    };

    // 添加到列表头部（最新版本在前）
    this.state.versions.unshift(version);
    this.state.currentIndex = 0;

    // 限制版本数量
    if (this.state.versions.length > this.maxVersions) {
      const removed = this.state.versions.splice(this.maxVersions);
      logger.debug(
        { removedCount: removed.length },
        "Removed old versions to stay within limit",
      );
    }

    this.persistState();

    logger.info(
      {
        versionId: version.id,
        versionNumber: version.version,
        totalVersions: this.state.versions.length,
      },
      "Saved new outline version",
    );

    return version;
  }

  /**
   * 获取版本历史列表
   *
   * @returns 版本列表（按时间倒序）
   */
  getVersionHistory(): OutlineVersion[] {
    return [...this.state.versions];
  }

  /**
   * 获取当前版本
   *
   * @returns 当前版本，如果没有版本则返回 undefined
   */
  getCurrentVersion(): OutlineVersion | undefined {
    return this.state.versions[this.state.currentIndex];
  }

  /**
   * 获取指定版本
   *
   * @param versionId - 版本 ID
   * @returns 指定版本，如果不存在则返回 undefined
   */
  getVersion(versionId: string): OutlineVersion | undefined {
    return this.state.versions.find((v) => v.id === versionId);
  }

  /**
   * 恢复到指定版本
   *
   * @param versionId - 要恢复的版本 ID
   * @returns 恢复的大纲，如果版本不存在则返回 undefined
   */
  restoreVersion(versionId: string): BlueprintOutline | undefined {
    const index = this.state.versions.findIndex((v) => v.id === versionId);

    if (index === -1) {
      logger.warn({ versionId }, "Version not found for restore");
      return undefined;
    }

    this.state.currentIndex = index;
    this.persistState();

    const version = this.state.versions[index];

    logger.info(
      {
        versionId,
        versionNumber: version.version,
      },
      "Restored outline to version",
    );

    return this.deepCloneOutline(version.outline);
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

    logger.info(
      { sessionId: this.sessionId },
      "Cleared outline version history",
    );
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
  ): OutlineVersionDiff | undefined {
    const v1 = this.getVersion(versionId1);
    const v2 = this.getVersion(versionId2);

    if (!v1 || !v2) {
      return undefined;
    }

    return {
      titleChanged: v1.outline.title !== v2.outline.title,
      summaryChanged: v1.outline.summary !== v2.outline.summary,
      nodeCountDiff:
        countNodes(v2.outline.nodes) - countNodes(v1.outline.nodes),
      totalWordsDiff:
        v2.outline.totalEstimatedWords - v1.outline.totalEstimatedWords,
    };
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * 生成唯一版本 ID
   */
  private generateVersionId(): string {
    return `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
   * 深度克隆大纲（避免引用问题）
   */
  private deepCloneOutline(outline: BlueprintOutline): BlueprintOutline {
    return JSON.parse(JSON.stringify(outline));
  }

  /**
   * 获取存储键
   */
  private getStorageKey(): string {
    return `${STORAGE_KEY_PREFIX}${this.sessionId}`;
  }

  /**
   * 从 localStorage 加载状态
   */
  private loadState(): OutlineVersionState {
    if (typeof window === "undefined") {
      return { currentIndex: 0, versions: [] };
    }

    try {
      const stored = localStorage.getItem(this.getStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored) as OutlineVersionState;
        logger.debug(
          { sessionId: this.sessionId, versionCount: parsed.versions.length },
          "Loaded outline version state",
        );
        return parsed;
      }
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : "Unknown error" },
        "Failed to load outline version state",
      );
    }

    return { currentIndex: 0, versions: [] };
  }

  /**
   * 持久化状态到 localStorage
   */
  private persistState(): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.state));
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : "Unknown error" },
        "Failed to persist outline version state",
      );
    }
  }
}

// ============================================================
// Types (Additional)
// ============================================================

/**
 * 版本差异信息
 */
export interface OutlineVersionDiff {
  /** 标题是否变更 */
  titleChanged: boolean;
  /** 摘要是否变更 */
  summaryChanged: boolean;
  /** 节点数量差异 */
  nodeCountDiff: number;
  /** 总字数差异 */
  totalWordsDiff: number;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 统计大纲节点总数
 */
function countNodes(nodes: BlueprintOutline["nodes"]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    if (node.children) {
      count += countNodes(node.children);
    }
  }
  return count;
}

/**
 * 格式化版本时间戳为可读字符串
 *
 * @param timestamp - 时间戳
 * @returns 格式化的时间字符串
 */
export function formatVersionTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return "刚刚";
  } else if (diffMins < 60) {
    return `${diffMins} 分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours} 小时前`;
  } else if (diffDays < 7) {
    return `${diffDays} 天前`;
  } else {
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

/**
 * 创建大纲版本管理器实例
 *
 * @param sessionId - 会话 ID
 * @returns 版本管理器实例
 */
export function createOutlineVersionManager(
  sessionId?: string,
): OutlineVersionManager {
  return new OutlineVersionManager({ sessionId });
}
