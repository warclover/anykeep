/**
 * Classification Core Interfaces
 * 服务接口定义
 *
 * @version 1.0.0
 * @since 2026-01-24 Phase 2
 */

import type { ClassificationRequest, ClassificationResult } from "./types";

/**
 * 分类策略接口
 */
export interface IClassificationStrategy {
  /**
   * 策略名称
   */
  readonly name: string;

  /**
   * 执行分类
   */
  classify(request: ClassificationRequest): Promise<ClassificationResult>;

  /**
   * 批量分类
   */
  classifyBatch?(
    requests: ClassificationRequest[],
  ): Promise<ClassificationResult[]>;

  /**
   * 仅 T0 快速分类（用于 Optimistic UI）
   */
  classifyT0Only?(
    request: ClassificationRequest,
  ): Promise<ClassificationResult>;
}

/**
 * 策略解析器接口
 */
export interface IStrategyResolver {
  /**
   * 根据用户 ID 解析策略
   */
  resolve(userId: string): Promise<IClassificationStrategy>;
}

/**
 * 分类门面接口
 */
export interface IClassificationFacade {
  /**
   * 统一分类入口
   */
  classify(request: ClassificationRequest): Promise<ClassificationResult>;

  /**
   * 批量分类
   */
  classifyBatch(
    requests: ClassificationRequest[],
  ): Promise<ClassificationResult[]>;

  /**
   * 仅 T0 快速分类
   */
  classifyQuick(request: ClassificationRequest): Promise<ClassificationResult>;
}

/**
 * Feature Flag 服务接口
 */
export interface IFeatureFlagService {
  /**
   * 检查功能是否对用户启用
   */
  isEnabledForUser(userId: string): boolean;

  /**
   * 获取配置值
   */
  get<T>(key: string): T;
}
