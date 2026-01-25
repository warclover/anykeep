import { logger } from "@/lib/logger";
import type { UnifiedEngineConfig, EngineExecuteOptions } from "../types";

/**
 * 引擎配置管理器
 *
 * 职责：
 * - 管理 UnifiedEngineConfig 状态
 * - 处理配置初始化（合并默认值）
 * - 提供类型安全的配置属性访问
 */
export class EngineConfigManager {
  private config: Required<UnifiedEngineConfig>;

  constructor(config: UnifiedEngineConfig = {}) {
    this.config = {
      enabled: true,
      debug: false,
      includeRoutingInfo: false,
      enableMemory: true,
      enablePrediction: true,
      defaultOptions: {},
      ...config,
    };
  }

  /**
   * 获取完整配置
   */
  get(): Required<UnifiedEngineConfig> {
    return this.config;
  }

  /**
   * 更新配置
   */
  update(config: Partial<UnifiedEngineConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    logger.debug({ config }, "EngineConfigManager: Configuration updated");
  }

  // 便捷访问器

  get debug(): boolean {
    return this.config.debug;
  }

  get enabled(): boolean {
    return this.config.enabled;
  }

  get enableMemory(): boolean {
    return this.config.enableMemory;
  }

  get enablePrediction(): boolean {
    return this.config.enablePrediction;
  }

  get includeRoutingInfo(): boolean {
    return this.config.includeRoutingInfo;
  }

  get defaultOptions(): EngineExecuteOptions {
    return this.config.defaultOptions;
  }
}
