/**
 * 分发适配器注册表
 *
 * @module distribution/core
 * @description 管理所有分发适配器的注册和获取
 */

import type { IDistributionAdapter, AdapterMetadata } from "../interfaces";
import type { DistributionTargetType, SupportedPlatform } from "../types";
import { AdapterNotFoundError } from "../errors";

/**
 * 分发适配器注册表
 *
 * 用于注册、获取和管理所有分发适配器
 *
 * @example
 * ```typescript
 * const registry = new DistributionRegistry();
 *
 * // 注册适配器
 * registry.register(new ObsidianAdapter());
 * registry.register(new NotionAdapter());
 *
 * // 获取适配器
 * const adapter = registry.get('obsidian');
 *
 * // 获取所有适配器元数据
 * const allMetadata = registry.getAllMetadata();
 * ```
 */
export class DistributionRegistry {
  private adapters: Map<DistributionTargetType, IDistributionAdapter> =
    new Map();

  /**
   * 注册适配器
   *
   * @param adapter - 要注册的适配器实例
   * @throws 如果适配器类型已存在，则抛出错误
   */
  register(adapter: IDistributionAdapter): void {
    if (this.adapters.has(adapter.type)) {
      throw new Error(
        `适配器已存在: ${adapter.type}。如需覆盖，请先调用 unregister()`,
      );
    }
    this.adapters.set(adapter.type, adapter);
  }

  /**
   * 注销适配器
   *
   * @param type - 适配器类型
   * @returns 是否成功注销
   */
  unregister(type: DistributionTargetType): boolean {
    const adapter = this.adapters.get(type);
    if (adapter) {
      // 调用 dispose 清理资源
      adapter.dispose?.();
      return this.adapters.delete(type);
    }
    return false;
  }

  /**
   * 获取适配器
   *
   * @param type - 适配器类型
   * @returns 适配器实例
   * @throws AdapterNotFoundError 如果适配器不存在
   */
  get(type: DistributionTargetType): IDistributionAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new AdapterNotFoundError(type);
    }
    return adapter;
  }

  /**
   * 尝试获取适配器（不抛出错误）
   *
   * @param type - 适配器类型
   * @returns 适配器实例或 undefined
   */
  tryGet(type: DistributionTargetType): IDistributionAdapter | undefined {
    return this.adapters.get(type);
  }

  /**
   * 检查适配器是否已注册
   *
   * @param type - 适配器类型
   * @returns 是否已注册
   */
  has(type: DistributionTargetType): boolean {
    return this.adapters.has(type);
  }

  /**
   * 获取所有已注册的适配器类型
   *
   * @returns 适配器类型列表
   */
  getTypes(): DistributionTargetType[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * 获取所有已注册的适配器
   *
   * @returns 适配器实例列表
   */
  getAll(): IDistributionAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * 获取所有适配器的元数据
   *
   * @returns 适配器元数据列表
   */
  getAllMetadata(): AdapterMetadata[] {
    return this.getAll().map((adapter) => ({
      type: adapter.type,
      displayName: adapter.displayName,
      description: adapter.description,
      supportedPlatforms: adapter.supportedPlatforms,
    }));
  }

  /**
   * 获取支持指定平台的适配器
   *
   * @param platform - 平台类型
   * @returns 支持该平台的适配器列表
   */
  getByPlatform(platform: SupportedPlatform): IDistributionAdapter[] {
    return this.getAll().filter((adapter) =>
      adapter.supportedPlatforms.includes(platform),
    );
  }

  /**
   * 获取支持指定平台的适配器元数据
   *
   * @param platform - 平台类型
   * @returns 支持该平台的适配器元数据列表
   */
  getMetadataByPlatform(platform: SupportedPlatform): AdapterMetadata[] {
    return this.getByPlatform(platform).map((adapter) => ({
      type: adapter.type,
      displayName: adapter.displayName,
      description: adapter.description,
      supportedPlatforms: adapter.supportedPlatforms,
    }));
  }

  /**
   * 获取已注册的适配器数量
   *
   * @returns 适配器数量
   */
  get size(): number {
    return this.adapters.size;
  }

  /**
   * 清空所有适配器
   *
   * 会调用每个适配器的 dispose 方法
   */
  async clear(): Promise<void> {
    const disposePromises = this.getAll()
      .filter((adapter) => adapter.dispose)
      .map((adapter) => adapter.dispose!());

    await Promise.allSettled(disposePromises);
    this.adapters.clear();
  }
}
