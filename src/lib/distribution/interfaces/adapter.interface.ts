/**
 * 分发适配器接口
 *
 * @module distribution/interfaces
 * @description 定义所有分发目标必须实现的适配器接口
 */

import type {
  DistributionTarget,
  DistributionTargetType,
  DistributionResult,
  ValidationResult,
  TestConnectionResult,
  SupportedPlatform,
  DistributionBookmark,
} from "../types";

/**
 * 分发适配器接口
 *
 * 所有目标平台（Obsidian、Notion、Webhook、RSS、手动导出）必须实现此接口
 *
 * @example
 * ```typescript
 * export class ObsidianAdapter implements IDistributionAdapter {
 *   readonly type = 'obsidian' as const;
 *   readonly displayName = 'Obsidian 本地同步';
 *   readonly supportedPlatforms = ['desktop'] as const;
 *
 *   async distribute(bookmarks, config) {
 *     // 实现分发逻辑
 *   }
 * }
 * ```
 */
export interface IDistributionAdapter {
  /**
   * 适配器唯一标识
   * 必须与 DistributionTargetType 中的值匹配
   */
  readonly type: DistributionTargetType;

  /**
   * 适配器显示名称（用于 UI 展示）
   */
  readonly displayName: string;

  /**
   * 适配器描述
   */
  readonly description?: string;

  /**
   * 支持的平台列表
   * - web: 浏览器 Web 端
   * - mobile: 移动端（Capacitor）
   * - desktop: 桌面端（Electron）
   */
  readonly supportedPlatforms: readonly SupportedPlatform[];

  /**
   * 初始化适配器
   *
   * 用于执行一次性设置，如 OAuth 连接验证
   *
   * @param config - 分发目标配置
   */
  initialize(config: DistributionTarget): Promise<void>;

  /**
   * 执行分发
   *
   * 将书签列表分发到目标平台
   *
   * @param bookmarks - 待分发的书签列表
   * @param config - 分发目标配置
   * @returns 分发结果
   */
  distribute(
    bookmarks: DistributionBookmark[],
    config: DistributionTarget,
  ): Promise<DistributionResult>;

  /**
   * 验证配置是否有效
   *
   * 在保存配置前调用，确保配置完整且有效
   *
   * @param config - 分发目标配置
   * @returns 验证结果
   */
  validateConfig(config: DistributionTarget): Promise<ValidationResult>;

  /**
   * 测试连接
   *
   * 验证目标平台是否可达且配置正确
   *
   * @param config - 分发目标配置
   * @returns 测试结果
   */
  testConnection(config: DistributionTarget): Promise<TestConnectionResult>;

  /**
   * 获取默认配置
   *
   * 返回该适配器的默认目标配置
   */
  getDefaultConfig?(): Record<string, unknown>;

  /**
   * 清理资源
   *
   * 在适配器不再使用时调用，用于清理资源
   */
  dispose?(): Promise<void>;
}

/**
 * 适配器构造函数类型
 */
export type AdapterConstructor = new (
  ...args: unknown[]
) => IDistributionAdapter;

/**
 * 适配器元数据
 */
export interface AdapterMetadata {
  /** 适配器类型 */
  type: DistributionTargetType;
  /** 显示名称 */
  displayName: string;
  /** 描述 */
  description?: string;
  /** 支持的平台 */
  supportedPlatforms: readonly SupportedPlatform[];
  /** 图标名称（用于 UI） */
  icon?: string;
  /** 是否需要 OAuth */
  requiresOAuth?: boolean;
  /** 是否为 Beta 功能 */
  isBeta?: boolean;
}
