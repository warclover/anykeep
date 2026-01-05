/**
 * BlueprintInitializer - 蓝图初始化模块
 * @module knowledge-studio/blueprint
 *
 * 负责在应用启动时或首次访问时注册所有蓝图到 BlueprintRegistry。
 * 使用幂等设计，多次调用不会重复注册。
 *
 * 蓝图分类：
 * - geek: 极客蓝图 (4个) - 论文解码、技术教程、PRD、系统设计
 * - creator: 创作者蓝图 (3个) - 视频编剧、周刊策展、访谈准备
 * - business: 商业蓝图 (3个) - 竞品侦察、尽调专家、故事线
 * - professional: 专业蓝图 (4个) - 技术决策、文献矩阵、SEO、课程设计
 *
 * 总计：14 个蓝图
 */

import { createLogger } from "@/lib/logger";
import { BlueprintRegistry } from "./blueprint-registry";
import type { EnhancedBlueprintEngine } from "./enhanced-blueprint-engine";
import type { StructuredOutput } from "./types";
import { getAllGeekBlueprints } from "./blueprints/geek";
import { getAllCreatorBlueprints } from "./blueprints/creator";
import { getAllBusinessBlueprints } from "./blueprints/business";
import { getAllProfessionalBlueprints } from "./blueprints/professional";

const logger = createLogger("knowledge-studio:blueprint:initializer");

// ============================================================
// State
// ============================================================

/**
 * 初始化状态标记
 * 确保蓝图只被注册一次
 */
let initialized = false;

// ============================================================
// Public API
// ============================================================

/**
 * 初始化所有蓝图
 *
 * 将所有分类的蓝图注册到 BlueprintRegistry 单例中。
 * 此函数是幂等的，多次调用不会重复注册。
 *
 * @returns 注册的蓝图数量（首次调用返回实际数量，后续调用返回 0）
 *
 * @example
 * ```typescript
 * // 在 API 端点或应用启动时调用
 * const count = initializeBlueprints();
 * console.log(`Registered ${count} blueprints`);
 *
 * // 后续调用返回 0（已初始化）
 * const count2 = initializeBlueprints(); // 0
 * ```
 */
export function initializeBlueprints(): number {
  // 幂等检查
  if (initialized) {
    logger.debug("Blueprints already initialized, skipping");
    return 0;
  }

  const registry = BlueprintRegistry.getInstance();

  // 检查注册表是否已有蓝图（可能由其他初始化路径填充）
  if (registry.size > 0) {
    logger.debug(
      { existingCount: registry.size },
      "Registry already has blueprints, marking as initialized",
    );
    initialized = true;
    return 0;
  }

  // 收集所有蓝图（使用类型断言统一为基础类型）
  const allBlueprints: EnhancedBlueprintEngine<StructuredOutput>[] = [
    ...getAllGeekBlueprints(),
    ...getAllCreatorBlueprints(),
    ...getAllBusinessBlueprints(),
    ...getAllProfessionalBlueprints(),
  ] as EnhancedBlueprintEngine<StructuredOutput>[];

  // 注册所有蓝图
  let registeredCount = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const blueprint of allBlueprints) {
    try {
      registry.register(blueprint);
      registeredCount++;
      logger.debug(
        { blueprintId: blueprint.blueprintId },
        "Blueprint registered",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push({
        id: blueprint.blueprintId,
        error: errorMessage,
      });
      logger.warn(
        { blueprintId: blueprint.blueprintId, error: errorMessage },
        "Failed to register blueprint",
      );
    }
  }

  // 标记初始化完成
  initialized = true;

  // 日志汇总
  if (errors.length > 0) {
    logger.warn(
      {
        total: allBlueprints.length,
        registered: registeredCount,
        failed: errors.length,
        errors,
      },
      "Blueprint initialization completed with errors",
    );
  } else {
    logger.info(
      { count: registeredCount },
      "All blueprints initialized successfully",
    );
  }

  return registeredCount;
}

/**
 * 确保蓝图已初始化
 *
 * 这是推荐的调用方式，语义更清晰。
 * 内部调用 initializeBlueprints()。
 *
 * @example
 * ```typescript
 * // 在 API handler 开头调用
 * export async function GET(request: NextRequest) {
 *   ensureBlueprintsInitialized();
 *   // ... 其他逻辑
 * }
 * ```
 */
export function ensureBlueprintsInitialized(): void {
  initializeBlueprints();
}

/**
 * 重置初始化状态（仅用于测试）
 *
 * @internal
 */
export function resetBlueprintInitialization(): void {
  initialized = false;
  BlueprintRegistry.resetInstance();
}

/**
 * 检查蓝图是否已初始化
 *
 * @returns 初始化状态
 */
export function isBlueprintsInitialized(): boolean {
  return initialized;
}

// ============================================================
// Statistics
// ============================================================

/**
 * 获取蓝图统计信息
 *
 * @returns 蓝图统计对象
 */
export function getBlueprintStats(): {
  initialized: boolean;
  totalCount: number;
  byCategory: Record<string, number>;
  byTier: Record<string, number>;
} {
  const registry = BlueprintRegistry.getInstance();
  const all = registry.getAll();

  const byCategory: Record<string, number> = {};
  const byTier: Record<string, number> = {};

  for (const bp of all) {
    // By category
    const category = bp.category ?? "uncategorized";
    byCategory[category] = (byCategory[category] || 0) + 1;

    // By tier
    const tier = bp.tier;
    byTier[tier] = (byTier[tier] || 0) + 1;
  }

  return {
    initialized,
    totalCount: all.length,
    byCategory,
    byTier,
  };
}
