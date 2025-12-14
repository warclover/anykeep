/**
 * Link Event Handler
 *
 * 知识关联事件处理器
 * 监听摘要完成事件，触发关联发现
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import { eventBus } from "@/lib/shared/event-bus";
import type {
  SummaryCompletedEvent,
  EntitiesExtractedEvent,
} from "@/lib/shared/event-bus/event-types";
import { getLinkService } from "../services/link.service";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export interface LinkEventHandlerConfig {
  /** 是否启用摘要完成时的关联发现 */
  enableOnSummaryCompleted: boolean;

  /** 是否启用实体提取完成时的关联发现 */
  enableOnEntitiesExtracted: boolean;

  /** 处理延迟 (ms)，确保数据已持久化 */
  processingDelayMs: number;

  /** 是否启用调试日志 */
  debug: boolean;
}

const DEFAULT_CONFIG: LinkEventHandlerConfig = {
  enableOnSummaryCompleted: true,
  enableOnEntitiesExtracted: true,
  processingDelayMs: 1000,
  debug: false,
};

// ============================================================================
// Handler Implementation
// ============================================================================

/**
 * 知识关联事件处理器
 */
export class LinkEventHandler {
  private config: LinkEventHandlerConfig;
  private isRegistered = false;
  private unsubscribers: Array<() => void> = [];

  constructor(config?: Partial<LinkEventHandlerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 注册事件监听器
   */
  register(): void {
    if (this.isRegistered) {
      // Already registered, skip silently
      return;
    }

    this.log("Registering event handlers...");

    // 监听摘要完成事件
    if (this.config.enableOnSummaryCompleted) {
      const unsubSummary = eventBus.on(
        "summary:completed",
        this.handleSummaryCompleted.bind(this),
      );
      this.unsubscribers.push(unsubSummary);
      this.log("Registered summary:completed handler");
    }

    // 监听实体提取完成事件
    if (this.config.enableOnEntitiesExtracted) {
      const unsubEntities = eventBus.on(
        "summary:entities_extracted",
        this.handleEntitiesExtracted.bind(this),
      );
      this.unsubscribers.push(unsubEntities);
      this.log("Registered summary:entities_extracted handler");
    }

    this.isRegistered = true;
    this.log("Event handlers registered successfully");
  }

  /**
   * 注销事件监听器
   */
  unregister(): void {
    if (!this.isRegistered) {
      return;
    }

    this.log("Unregistering event handlers...");

    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
    this.isRegistered = false;

    this.log("Event handlers unregistered");
  }

  /**
   * 处理摘要完成事件
   */
  private async handleSummaryCompleted(
    event: SummaryCompletedEvent,
  ): Promise<void> {
    this.log(
      `Received summary:completed for bookmark ${event.bookmarkId}, mode: ${event.summaryMode || "standard"}`,
    );

    // 如果是标准模式且提取了实体，已经会触发 entities_extracted 事件
    // 为避免重复处理，只在非增强模式时处理
    if (event.summaryMode === "enhanced" && event.entitiesExtracted) {
      this.log(
        "Skipping summary:completed for enhanced mode (will process on entities_extracted)",
      );
      return;
    }

    // 延迟执行，确保数据已持久化
    setTimeout(async () => {
      await this.processLinkDiscovery(event.bookmarkId, event.userId);
    }, this.config.processingDelayMs);
  }

  /**
   * 处理实体提取完成事件
   */
  private async handleEntitiesExtracted(
    event: EntitiesExtractedEvent,
  ): Promise<void> {
    this.log(
      `Received summary:entities_extracted for bookmark ${event.bookmarkId}, entities: ${event.entityCount}`,
    );

    // 只在需要关联处理时执行
    if (!event.needsLinkProcessing) {
      this.log("Link processing not needed, skipping");
      return;
    }

    // 立即执行（实体数据已经持久化）
    await this.processLinkDiscovery(event.bookmarkId, event.userId);
  }

  /**
   * 执行关联发现
   */
  private async processLinkDiscovery(
    bookmarkId: number,
    userId: string,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      this.log(`Starting link discovery for bookmark ${bookmarkId}`);

      const linkService = getLinkService();
      await linkService.processNewBookmark(bookmarkId, userId);

      const processingTimeMs = Date.now() - startTime;
      this.log(
        `Link discovery completed for bookmark ${bookmarkId} in ${processingTimeMs}ms`,
      );

      // 发布关联发现完成事件
      // 注意：这里简化处理，实际应该从 processNewBookmark 返回统计信息
      eventBus.emit("link:discovered", {
        userId,
        bookmarkId,
        linksDiscovered: 0, // 实际值应从服务返回
        linksByType: {
          semantic: 0,
          entity: 0,
          tag: 0,
          topic: 0,
        },
        processingTimeMs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        `[LinkEventHandler] Failed to process link discovery for bookmark ${bookmarkId}:`,
        error,
      );
    }
  }

  /**
   * 调试日志
   */
  private log(message: string): void {
    if (this.config.debug) {
      logger.debug({ handler: "LinkEventHandler" }, message);
    }
  }
}

// ============================================================================
// Singleton & Factory
// ============================================================================

let linkEventHandlerInstance: LinkEventHandler | null = null;

/**
 * 获取 LinkEventHandler 单例
 */
export function getLinkEventHandler(): LinkEventHandler {
  if (!linkEventHandlerInstance) {
    linkEventHandlerInstance = new LinkEventHandler();
  }
  return linkEventHandlerInstance;
}

/**
 * 初始化并注册事件处理器
 */
export function initializeLinkEventHandler(
  config?: Partial<LinkEventHandlerConfig>,
): LinkEventHandler {
  if (linkEventHandlerInstance) {
    linkEventHandlerInstance.unregister();
  }

  linkEventHandlerInstance = new LinkEventHandler(config);
  linkEventHandlerInstance.register();

  return linkEventHandlerInstance;
}

/**
 * 重置单例（用于测试）
 */
export function resetLinkEventHandler(): void {
  if (linkEventHandlerInstance) {
    linkEventHandlerInstance.unregister();
    linkEventHandlerInstance = null;
  }
}
