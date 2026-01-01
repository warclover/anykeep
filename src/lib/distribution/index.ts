/**
 * 知识分发中心模块
 *
 * @module distribution
 * @description 统一管理内容分发到 Obsidian、Notion、Webhook、RSS 等目标平台
 *
 * @example
 * ```typescript
 * import {
 *   DistributionService,
 *   DistributionEventBus,
 *   DistributionRegistry,
 *   ManualExportAdapter,
 * } from '@/lib/distribution';
 *
 * // 创建事件总线
 * const eventBus = new DistributionEventBus();
 *
 * // 创建注册表并注册适配器
 * const registry = new DistributionRegistry();
 * registry.register(new ManualExportAdapter());
 *
 * // 创建分发服务
 * const service = new DistributionService(registry, supabase);
 *
 * // 执行分发
 * const result = await service.distribute(targetId, bookmarkIds);
 * ```
 */

// ==================== 类型导出 ====================
export * from "./types";

// ==================== 接口导出 ====================
export * from "./interfaces";

// ==================== 核心服务导出 ====================
export {
  DistributionRegistry,
  DistributionService,
  DistributionEventBus,
  type DistributionServiceConfig,
  type CreateTargetInput,
  type UpdateTargetInput,
  type EventBusConfig,
} from "./core";

// 后续 Story 实现后添加
// export { DistributionScheduler } from './core/distribution.scheduler';

// ==================== 适配器导出 ====================
export { ManualExportAdapter, ObsidianAdapter } from "./adapters";

// 后续 Story 实现后添加
// export { NotionAdapter } from './adapters/notion.adapter';
// export { WebhookAdapter } from './adapters/webhook.adapter';
// export { RssFeedAdapter } from './adapters/rss.adapter';

// ==================== 错误类型 ====================
export * from "./errors";
