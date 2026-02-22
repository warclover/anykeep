/**
 * BlueprintRegistry - 蓝图注册表
 * @module knowledge-studio/blueprint
 *
 * Story 1.3 实现：
 * - register(blueprint) 方法注册蓝图
 * - getAll() 方法获取所有蓝图
 * - getById(id) 方法按 ID 获取蓝图
 * - getByTier(tier) 方法按权限层级过滤
 * - getByCategory(category) 方法按分类过滤
 * - 使用单例模式确保全局唯一
 */

import type { EnhancedBlueprintEngine } from "./enhanced-blueprint-engine";
import type {
  BlueprintTier,
  EnhancedBlueprintMetadata,
  StructuredOutput,
} from "./types";
import { isValidBlueprintId } from "./types";

// ============================================================
// Types
// ============================================================

/**
 * 蓝图分类类型
 */
export type BlueprintCategory = NonNullable<
  EnhancedBlueprintMetadata["category"]
>;

/**
 * 注册表条目
 */
interface RegistryEntry<T extends StructuredOutput = StructuredOutput> {
  /** 蓝图实例 */
  blueprint: EnhancedBlueprintEngine<T>;
  /** 注册时间 */
  registeredAt: Date;
}

/**
 * 蓝图访问信息 (Story 1.4)
 */
export interface BlueprintAccessInfo {
  /** 蓝图 ID */
  blueprintId: string;
  /** 是否可访问 */
  canAccess: boolean;
  /** 用户当前等级 */
  currentTier: BlueprintTier;
  /** 蓝图所需等级 */
  requiredTier: BlueprintTier;
  /** 升级提示消息（仅当无法访问时） */
  upgradeMessage?: string;
}

/**
 * 带访问信息的蓝图 (Story 1.4)
 */
export interface BlueprintWithAccessInfo {
  /** 蓝图实例 */
  blueprint: EnhancedBlueprintEngine<StructuredOutput>;
  /** 访问信息 */
  accessInfo: BlueprintAccessInfo;
}

// ============================================================
// BlueprintRegistry Class
// ============================================================

/**
 * 蓝图注册表
 *
 * 管理所有可用蓝图的注册、发现和获取。
 * 使用单例模式确保全局唯一。
 *
 * @example
 * ```typescript
 * // 获取单例实例
 * const registry = BlueprintRegistry.getInstance();
 *
 * // 注册蓝图
 * registry.register(new ArxivDecoderBlueprint());
 *
 * // 获取所有蓝图
 * const all = registry.getAll();
 *
 * // 按 ID 获取
 * const blueprint = registry.getById('arxiv_decoder');
 *
 * // 按权限层级过滤
 * const freeBlueprints = registry.getByTier('free');
 *
 * // 按分类过滤
 * const geekBlueprints = registry.getByCategory('geek');
 * ```
 */
export class BlueprintRegistry {
  // ========== Singleton ==========

  private static instance: BlueprintRegistry | null = null;

  /**
   * 获取注册表单例实例
   */
  public static getInstance(): BlueprintRegistry {
    if (!BlueprintRegistry.instance) {
      BlueprintRegistry.instance = new BlueprintRegistry();
    }
    return BlueprintRegistry.instance;
  }

  /**
   * 重置单例（仅用于测试）
   * @internal
   */
  public static resetInstance(): void {
    BlueprintRegistry.instance = null;
  }

  // ========== Private State ==========

  private readonly blueprints: Map<string, RegistryEntry> = new Map();

  private constructor() {
    // 私有构造函数，确保只能通过 getInstance 创建
  }

  // ========== Public Methods ==========

  /**
   * 注册蓝图
   *
   * @param blueprint - 要注册的蓝图实例
   * @throws 如果蓝图 ID 已存在则抛出错误
   * @throws 如果蓝图 ID 不符合命名规范则抛出错误 (P2 #7)
   */
  public register<T extends StructuredOutput>(
    blueprint: EnhancedBlueprintEngine<T>,
  ): void {
    const id = blueprint.blueprintId;

    // P2 #7: Validate blueprint ID naming convention
    if (!isValidBlueprintId(id)) {
      throw new Error(
        `Blueprint ID "${id}" does not match naming convention. ` +
          `Expected format: {category}-{name} (e.g., geek-arxiv_decoder)`,
      );
    }

    if (this.blueprints.has(id)) {
      throw new Error(`Blueprint with ID "${id}" is already registered`);
    }

    this.blueprints.set(id, {
      blueprint:
        blueprint as unknown as EnhancedBlueprintEngine<StructuredOutput>,
      registeredAt: new Date(),
    });
  }

  /**
   * 获取所有已注册的蓝图
   *
   * @returns 所有蓝图实例数组，按优先级排序
   */
  public getAll(): EnhancedBlueprintEngine<StructuredOutput>[] {
    const blueprints = Array.from(this.blueprints.values()).map(
      (entry) => entry.blueprint,
    );

    // 按 priority 排序（数字越小越靠前，undefined 排最后）
    return blueprints.sort((a, b) => {
      const priorityA = a.priority ?? Number.MAX_SAFE_INTEGER;
      const priorityB = b.priority ?? Number.MAX_SAFE_INTEGER;
      return priorityA - priorityB;
    });
  }

  /**
   * 按 ID 获取蓝图
   *
   * @param id - 蓝图 ID
   * @returns 蓝图实例，如果不存在则返回 undefined
   */
  public getById(
    id: string,
  ): EnhancedBlueprintEngine<StructuredOutput> | undefined {
    return this.blueprints.get(id)?.blueprint;
  }

  /**
   * 按权限层级过滤蓝图
   *
   * @param tier - 权限层级
   * @returns 符合条件的蓝图数组
   */
  public getByTier(
    tier: BlueprintTier,
  ): EnhancedBlueprintEngine<StructuredOutput>[] {
    return this.getAll().filter((blueprint) => blueprint.tier === tier);
  }

  /**
   * 按分类过滤蓝图
   *
   * @param category - 蓝图分类
   * @returns 符合条件的蓝图数组
   */
  public getByCategory(
    category: BlueprintCategory,
  ): EnhancedBlueprintEngine<StructuredOutput>[] {
    return this.getAll().filter((blueprint) => blueprint.category === category);
  }

  // ========== Story 1.4: 蓝图权限分层 ==========

  /**
   * 获取用户可访问的蓝图
   *
   * 根据用户会员等级返回可使用的蓝图：
   * - free 用户：只能使用 tier=free 的蓝图
   * - pro 用户：可以使用 tier=free 和 tier=pro 的蓝图
   * - enterprise 用户：可以使用所有蓝图
   *
   * @param userTier - 用户会员等级
   * @returns 用户可访问的蓝图数组
   */
  public getAccessibleBlueprints(
    userTier: BlueprintTier,
  ): EnhancedBlueprintEngine<StructuredOutput>[] {
    const accessibleTiers = this.getAccessibleTiers(userTier);
    return this.getAll().filter((blueprint) =>
      accessibleTiers.includes(blueprint.tier),
    );
  }

  /**
   * 获取用户无法访问（锁定）的蓝图
   *
   * 返回需要升级才能使用的蓝图，用于展示升级提示。
   *
   * @param userTier - 用户会员等级
   * @returns 锁定的蓝图数组
   */
  public getLockedBlueprints(
    userTier: BlueprintTier,
  ): EnhancedBlueprintEngine<StructuredOutput>[] {
    const accessibleTiers = this.getAccessibleTiers(userTier);
    return this.getAll().filter(
      (blueprint) => !accessibleTiers.includes(blueprint.tier),
    );
  }

  /**
   * 检查用户是否可以访问指定蓝图
   *
   * @param blueprintId - 蓝图 ID
   * @param userTier - 用户会员等级
   * @returns 是否可访问
   */
  public canAccess(blueprintId: string, userTier: BlueprintTier): boolean {
    const blueprint = this.getById(blueprintId);
    if (!blueprint) return false;

    const accessibleTiers = this.getAccessibleTiers(userTier);
    return accessibleTiers.includes(blueprint.tier);
  }

  /**
   * 获取蓝图访问信息
   *
   * 返回蓝图的访问状态和升级提示信息。
   *
   * @param blueprintId - 蓝图 ID
   * @param userTier - 用户会员等级
   * @returns 访问信息对象
   */
  public getAccessInfo(
    blueprintId: string,
    userTier: BlueprintTier,
  ): BlueprintAccessInfo | undefined {
    const blueprint = this.getById(blueprintId);
    if (!blueprint) return undefined;

    const canAccess = this.canAccess(blueprintId, userTier);
    const requiredTier = blueprint.tier;

    return {
      blueprintId,
      canAccess,
      currentTier: userTier,
      requiredTier,
      upgradeMessage: canAccess
        ? undefined
        : this.getUpgradeMessage(userTier, requiredTier),
    };
  }

  /**
   * 获取所有蓝图的访问信息（用于 UI 展示）
   *
   * @param userTier - 用户会员等级
   * @returns 所有蓝图的访问信息数组
   */
  public getAllWithAccessInfo(
    userTier: BlueprintTier,
  ): BlueprintWithAccessInfo[] {
    return this.getAll().map((blueprint) => {
      const accessInfo = this.getAccessInfo(blueprint.blueprintId, userTier);
      return {
        blueprint,
        accessInfo: accessInfo ?? {
          blueprintId: blueprint.blueprintId,
          canAccess: false,
          currentTier: userTier,
          requiredTier: "pro" as BlueprintTier,
          upgradeMessage: "需要升级才能使用此模板",
        },
      };
    });
  }

  /**
   * 获取用户等级可访问的所有层级
   *
   * @param userTier - 用户会员等级
   * @returns 可访问的层级数组
   */
  private getAccessibleTiers(userTier: BlueprintTier): BlueprintTier[] {
    switch (userTier) {
      case "free":
        return ["free"];
      case "pro":
        return ["free", "pro"];
      case "enterprise":
        return ["free", "pro", "enterprise"];
      default:
        return ["free"];
    }
  }

  /**
   * 生成升级提示消息
   *
   * @param currentTier - 当前用户等级
   * @param requiredTier - 所需等级
   * @returns 升级提示消息
   */
  private getUpgradeMessage(
    currentTier: BlueprintTier,
    requiredTier: BlueprintTier,
  ): string {
    const tierNames: Record<BlueprintTier, string> = {
      free: "免费版",
      pro: "专业版",
      enterprise: "企业版",
    };

    return `此模板需要 ${tierNames[requiredTier]} 会员。升级即可解锁更多高级功能！`;
  }

  /**
   * 获取蓝图总数
   */
  public get size(): number {
    return this.blueprints.size;
  }

  /**
   * 检查蓝图是否已注册
   *
   * @param id - 蓝图 ID
   * @returns 是否已注册
   */
  public has(id: string): boolean {
    return this.blueprints.has(id);
  }

  /**
   * 注销蓝图
   *
   * @param id - 蓝图 ID
   * @returns 是否成功注销
   */
  public unregister(id: string): boolean {
    return this.blueprints.delete(id);
  }

  /**
   * 清空所有注册的蓝图（仅用于测试）
   * @internal
   */
  public clear(): void {
    this.blueprints.clear();
  }

  /**
   * 获取所有蓝图的元数据
   *
   * @returns 所有蓝图元数据数组
   */
  public getAllMetadata(): EnhancedBlueprintMetadata[] {
    return this.getAll().map((blueprint) => blueprint.getBlueprintMetadata());
  }

  /**
   * 按多个条件过滤蓝图
   *
   * @param filters - 过滤条件
   * @returns 符合条件的蓝图数组
   */
  public filter(filters: {
    tier?: BlueprintTier;
    category?: BlueprintCategory;
    isNew?: boolean;
  }): EnhancedBlueprintEngine<StructuredOutput>[] {
    let result = this.getAll();

    if (filters.tier !== undefined) {
      result = result.filter((bp) => bp.tier === filters.tier);
    }

    if (filters.category !== undefined) {
      result = result.filter((bp) => bp.category === filters.category);
    }

    if (filters.isNew !== undefined) {
      result = result.filter((bp) => bp.isNew === filters.isNew);
    }

    return result;
  }
}

// ============================================================
// Export
// ============================================================

/**
 * 懒加载初始化标记
 * 用于确保蓝图只被初始化一次
 */
let lazyInitialized = false;

/**
 * 获取蓝图注册表实例的快捷方式
 *
 * 此函数会自动确保蓝图已初始化（懒加载模式）。
 * 首次调用时会注册所有蓝图，后续调用直接返回实例。
 *
 * @returns BlueprintRegistry 实例（已填充蓝图）
 */
export function getBlueprintRegistry(): BlueprintRegistry {
  const registry = BlueprintRegistry.getInstance();

  // 懒加载初始化：确保蓝图已注册
  if (!lazyInitialized && registry.size === 0) {
    // 动态导入避免循环依赖
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initializeBlueprints } = require("./blueprint-initializer");
    initializeBlueprints();
    lazyInitialized = true;
  }

  return registry;
}

/**
 * 重置懒加载状态（仅用于测试）
 * @internal
 */
export function resetLazyInitialization(): void {
  lazyInitialized = false;
}
