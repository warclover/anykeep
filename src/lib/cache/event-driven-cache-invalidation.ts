/**
 * 事件驱动的缓存失效服务
 *
 * 监听 EventBus 事件，自动触发相关缓存失效
 * 实现事件与缓存的解耦
 *
 * @version 1.0.0
 * @since 2026-01-06
 */

import { eventBus } from "@/lib/shared/event-bus";
import {
  ClassificationEvents,
  OrganizationEvents,
  SummaryEvents,
  AISkillsEvents,
  type BookmarkClassifiedEvent,
  type BatchClassificationCompletedEvent,
  type FolderCreatedEvent,
  type FoldersMergedEvent,
  type FolderSplitEvent,
  type SummaryCompletedEvent,
  type SkillExecutionCompletedEvent,
} from "@/lib/shared/event-bus/event-types";
import { dataCache } from "./data-cache";
import { CACHE_KEYS } from "./cache-config";
import { invalidateFolderCache } from "./folder-cache-invalidation";
import { logger } from "@/lib/logger";

// ============================================
// 类型定义
// ============================================

/** 缓存失效规则 */
export interface CacheInvalidationRule {
  /** 规则 ID */
  id: string;
  /** 规则描述 */
  description: string;
  /** 触发事件 */
  events: string[];
  /** 失效处理函数 */
  handler: (event: unknown) => void;
  /** 是否启用 */
  enabled: boolean;
}

/** 缓存失效服务配置 */
export interface CacheInvalidationServiceConfig {
  /** 是否启用 */
  enabled?: boolean;
  /** 是否启用调试日志 */
  debug?: boolean;
}

// ============================================
// 缓存失效服务类
// ============================================

/**
 * 事件驱动的缓存失效服务
 *
 * 自动监听事件并触发缓存失效
 *
 * @example
 * ```typescript
 * // 初始化服务
 * cacheInvalidationService.initialize();
 *
 * // 添加自定义规则
 * cacheInvalidationService.addRule({
 *   id: 'custom-rule',
 *   description: '自定义缓存失效规则',
 *   events: ['custom:event'],
 *   handler: (event) => { ... },
 *   enabled: true,
 * });
 *
 * // 关闭服务
 * cacheInvalidationService.shutdown();
 * ```
 */
class CacheInvalidationService {
  private config: Required<CacheInvalidationServiceConfig>;
  private rules: Map<string, CacheInvalidationRule> = new Map();
  private unsubscribers: Array<() => void> = [];
  private initialized = false;

  constructor(config: CacheInvalidationServiceConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      debug: config.debug ?? false,
    };
  }

  /**
   * 初始化服务
   *
   * 注册默认的缓存失效规则并订阅事件
   */
  initialize(): void {
    if (this.initialized) {
      this.log("Service already initialized");
      return;
    }

    if (!this.config.enabled) {
      this.log("Service is disabled");
      return;
    }

    // 注册默认规则
    this.registerDefaultRules();

    // 订阅事件
    this.subscribeToEvents();

    this.initialized = true;
    this.log("Service initialized with " + this.rules.size + " rules");
  }

  /**
   * 关闭服务
   */
  shutdown(): void {
    // 取消所有订阅
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
    this.rules.clear();
    this.initialized = false;
    this.log("Service shutdown");
  }

  /**
   * 添加自定义规则
   */
  addRule(rule: CacheInvalidationRule): void {
    this.rules.set(rule.id, rule);

    // 如果已初始化，立即订阅事件
    if (this.initialized && rule.enabled) {
      this.subscribeToRuleEvents(rule);
    }
  }

  /**
   * 移除规则
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * 启用/禁用规则
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * 获取所有规则
   */
  getRules(): CacheInvalidationRule[] {
    return Array.from(this.rules.values());
  }

  // ============================================
  // 内部方法
  // ============================================

  /**
   * 注册默认的缓存失效规则
   */
  private registerDefaultRules(): void {
    // 规则 1: 书签分类后失效书签缓存
    this.rules.set("bookmark-classified", {
      id: "bookmark-classified",
      description: "书签分类后失效书签和文件夹缓存",
      events: [ClassificationEvents.BOOKMARK_CLASSIFIED],
      handler: (event: unknown) => {
        const e = event as BookmarkClassifiedEvent;
        this.invalidateBookmarkCache(e.userId);
        if (e.folderId) {
          invalidateFolderCache(e.userId);
        }
      },
      enabled: true,
    });

    // 规则 2: 批量分类后失效缓存
    this.rules.set("batch-classification", {
      id: "batch-classification",
      description: "批量分类后失效书签和文件夹缓存",
      events: [ClassificationEvents.BATCH_COMPLETED],
      handler: (event: unknown) => {
        const e = event as BatchClassificationCompletedEvent;
        this.invalidateBookmarkCache(e.userId);
        invalidateFolderCache(e.userId);
      },
      enabled: true,
    });

    // 规则 3: 文件夹创建后失效缓存
    this.rules.set("folder-created", {
      id: "folder-created",
      description: "文件夹创建后失效文件夹缓存",
      events: [OrganizationEvents.FOLDER_CREATED],
      handler: (event: unknown) => {
        const e = event as FolderCreatedEvent;
        invalidateFolderCache(e.userId);
      },
      enabled: true,
    });

    // 规则 4: 文件夹合并后失效缓存
    this.rules.set("folders-merged", {
      id: "folders-merged",
      description: "文件夹合并后失效文件夹和书签缓存",
      events: [OrganizationEvents.FOLDERS_MERGED],
      handler: (event: unknown) => {
        const e = event as FoldersMergedEvent;
        invalidateFolderCache(e.userId);
        this.invalidateBookmarkCache(e.userId);
      },
      enabled: true,
    });

    // 规则 5: 文件夹分拆后失效缓存
    this.rules.set("folder-split", {
      id: "folder-split",
      description: "文件夹分拆后失效文件夹和书签缓存",
      events: [OrganizationEvents.FOLDER_SPLIT],
      handler: (event: unknown) => {
        const e = event as FolderSplitEvent;
        invalidateFolderCache(e.userId);
        this.invalidateBookmarkCache(e.userId);
      },
      enabled: true,
    });

    // 规则 6: 摘要生成后失效书签缓存
    this.rules.set("summary-completed", {
      id: "summary-completed",
      description: "摘要生成后失效书签详情缓存",
      events: [SummaryEvents.COMPLETED],
      handler: (event: unknown) => {
        const e = event as SummaryCompletedEvent;
        // 失效特定书签的缓存
        dataCache.invalidate(CACHE_KEYS.bookmark(e.userId, e.bookmarkId));
      },
      enabled: true,
    });

    // 规则 7: Skill 执行完成后失效相关缓存
    this.rules.set("skill-execution-completed", {
      id: "skill-execution-completed",
      description: "Skill 执行完成后根据类型失效相关缓存",
      events: [AISkillsEvents.EXECUTION_COMPLETED],
      handler: (event: unknown) => {
        const e = event as SkillExecutionCompletedEvent;

        // 根据 Skill ID 决定失效哪些缓存
        if (e.success) {
          this.handleSkillCompletedCacheInvalidation(e);
        }
      },
      enabled: true,
    });
  }

  /**
   * 处理 Skill 完成后的缓存失效
   */
  private handleSkillCompletedCacheInvalidation(
    event: SkillExecutionCompletedEvent,
  ): void {
    const { userId, skillId } = event;

    switch (skillId) {
      // 批量整理类 Skill
      case "batch_organize":
      case "smart_tagging":
      case "duplicate_cleanup":
        this.invalidateBookmarkCache(userId);
        invalidateFolderCache(userId);
        break;

      // 数据导出类 Skill（不需要失效缓存）
      case "data_export":
        // 导出不改变数据，无需失效
        break;

      // [已移除] reading_planner case (精简重构 2026-03-09)

      // 分析报告类 Skill
      case "insight_report":
      case "periodic_report":
        // 报告生成不改变源数据，无需失效
        break;

      default:
        // 未知 Skill，保守处理：不失效
        this.log(`Unknown skill completed: ${skillId}, no cache invalidation`);
    }
  }

  /**
   * 订阅所有规则的事件
   */
  private subscribeToEvents(): void {
    for (const rule of this.rules.values()) {
      if (rule.enabled) {
        this.subscribeToRuleEvents(rule);
      }
    }
  }

  /**
   * 订阅单个规则的事件
   */
  private subscribeToRuleEvents(rule: CacheInvalidationRule): void {
    for (const eventName of rule.events) {
      // 使用类型断言，因为我们知道事件名称是有效的
      const unsubscribe = eventBus.on(
        eventName as Parameters<typeof eventBus.on>[0],
        (payload) => {
          this.log(`Event ${eventName} triggered rule ${rule.id}`);
          try {
            rule.handler(payload);
          } catch (error) {
            logger.error(
              {
                ruleId: rule.id,
                event: eventName,
                error: error instanceof Error ? error.message : String(error),
              },
              "Cache invalidation rule handler error",
            );
          }
        },
      );
      this.unsubscribers.push(unsubscribe);
    }
  }

  /**
   * 失效书签缓存
   */
  private invalidateBookmarkCache(userId: string): void {
    dataCache.invalidate(CACHE_KEYS.bookmarks(userId));
    // 也失效搜索结果缓存
    dataCache.invalidate(new RegExp(`^search:${userId}:`));
  }

  /**
   * 日志输出
   */
  private log(message: string): void {
    if (this.config.debug) {
      logger.debug({ service: "CacheInvalidationService" }, message);
    }
  }
}

// ============================================
// 导出
// ============================================

/**
 * 缓存失效服务单例
 */
export const cacheInvalidationService = new CacheInvalidationService();

/**
 * 创建缓存失效服务实例（用于测试或隔离场景）
 */
export function createCacheInvalidationService(
  config?: CacheInvalidationServiceConfig,
): CacheInvalidationService {
  return new CacheInvalidationService(config);
}
