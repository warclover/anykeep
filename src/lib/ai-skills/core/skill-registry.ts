/**
 * SkillRegistry - Skills 注册中心
 *
 * 职责：
 * - 管理所有 Skills 的注册和注销
 * - 提供 Skills 查询和过滤
 * - 导出 Tools 供 Agent 使用
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import type { Tool } from "ai";
import { logger } from "@/lib/logger";
import type {
  ISkill,
  SkillCategory,
  SkillContext,
  SkillRegistration,
} from "./types";

/**
 * SkillRegistry 单例类
 *
 * @example
 * ```typescript
 * // 注册 Skill
 * const searchSkill = new SearchSkill();
 * skillRegistry.register(searchSkill);
 *
 * // 获取 Skill
 * const skill = skillRegistry.get('search');
 *
 * // 导出为 Tools
 * const tools = skillRegistry.exportAsTools(['search', 'classify']);
 * ```
 */
export class SkillRegistry {
  private static instance: SkillRegistry;
  private skills: Map<string, SkillRegistration> = new Map();

  /**
   * 私有构造函数
   * 使用 getInstance() 获取单例，或 createInstance() 创建新实例
   */
  private constructor() {
    // 构造函数保持私有，通过工厂方法创建实例
  }

  /**
   * 创建新实例（用于依赖注入容器）
   *
   * 注意：此方法创建独立实例，不影响单例
   * 主要用于测试和容器管理场景
   */
  static createInstance(): SkillRegistry {
    return new SkillRegistry();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): SkillRegistry {
    if (!SkillRegistry.instance) {
      SkillRegistry.instance = new SkillRegistry();
    }
    return SkillRegistry.instance;
  }

  /**
   * 注册 Skill
   *
   * @param skill - 要注册的 Skill 实例
   * @param options - 注册选项
   */
  register(skill: ISkill, options: { enabled?: boolean } = {}): void {
    const { enabled = true } = options;
    const skillId = skill.metadata.id;

    if (this.skills.has(skillId)) {
      logger.warn(
        { skillId },
        `Skill ${skillId} is already registered, overwriting`,
      );
    }

    this.skills.set(skillId, {
      skill,
      registeredAt: new Date(),
      enabled,
    });

    logger.info(
      {
        skillId,
        name: skill.metadata.name,
        category: skill.metadata.category,
        version: skill.metadata.version,
        enabled,
      },
      `Skill registered: ${skillId}`,
    );
  }

  /**
   * 注销 Skill
   */
  unregister(skillId: string): boolean {
    const deleted = this.skills.delete(skillId);
    if (deleted) {
      logger.info({ skillId }, `Skill unregistered: ${skillId}`);
    }
    return deleted;
  }

  /**
   * 获取 Skill
   */
  get(skillId: string): ISkill | undefined {
    const registration = this.skills.get(skillId);
    return registration?.skill;
  }

  /**
   * 检查 Skill 是否已注册
   */
  has(skillId: string): boolean {
    return this.skills.has(skillId);
  }

  /**
   * 获取 Skill 注册信息
   */
  getRegistration(skillId: string): SkillRegistration | undefined {
    return this.skills.get(skillId);
  }

  /**
   * 启用 Skill
   */
  enable(skillId: string): boolean {
    const registration = this.skills.get(skillId);
    if (registration) {
      registration.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * 禁用 Skill
   */
  disable(skillId: string): boolean {
    const registration = this.skills.get(skillId);
    if (registration) {
      registration.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * 获取所有 Skills
   *
   * @param options - 过滤选项
   */
  getAll(options: { enabledOnly?: boolean } = {}): ISkill[] {
    const { enabledOnly = false } = options;

    return Array.from(this.skills.values())
      .filter((reg) => !enabledOnly || reg.enabled)
      .map((reg) => reg.skill);
  }

  /**
   * 按分类获取 Skills
   */
  getByCategory(
    category: SkillCategory,
    options: { enabledOnly?: boolean } = {},
  ): ISkill[] {
    return this.getAll(options).filter(
      (skill) => skill.metadata.category === category,
    );
  }

  /**
   * 按能力标签获取 Skills
   */
  getByCapability(
    capability: string,
    options: { enabledOnly?: boolean } = {},
  ): ISkill[] {
    return this.getAll(options).filter((skill) =>
      skill.metadata.capabilities.includes(capability),
    );
  }

  /**
   * 搜索 Skills
   */
  search(query: string, options: { enabledOnly?: boolean } = {}): ISkill[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll(options).filter(
      (skill) =>
        skill.metadata.id.toLowerCase().includes(lowerQuery) ||
        skill.metadata.name.toLowerCase().includes(lowerQuery) ||
        skill.metadata.description.toLowerCase().includes(lowerQuery) ||
        skill.metadata.capabilities.some((cap) =>
          cap.toLowerCase().includes(lowerQuery),
        ),
    );
  }

  /**
   * 导出为 Vercel AI SDK Tools
   *
   * @param skillIds - 要导出的 Skill ID 列表，为空则导出所有启用的 Skills
   * @param contextProvider - 上下文提供函数
   */
  exportAsTools(
    skillIds?: string[],
    contextProvider?: () => SkillContext,
  ): Record<string, Tool> {
    const tools: Record<string, Tool> = {};

    const skillsToExport = skillIds
      ? skillIds
          .map((id) => this.get(id))
          .filter((s): s is ISkill => s !== undefined)
      : this.getAll({ enabledOnly: true });

    for (const skill of skillsToExport) {
      // 检查 skill 是否有 toTool 方法（BaseSkill 实例）
      if ("toTool" in skill && typeof skill.toTool === "function") {
        tools[skill.metadata.id] = (
          skill as ISkill & { toTool: (ctx?: () => SkillContext) => Tool }
        ).toTool(contextProvider);
      }
    }

    logger.debug(
      { toolCount: Object.keys(tools).length, skillIds },
      "Exported skills as tools",
    );

    return tools;
  }

  /**
   * 获取 Skills 统计信息
   */
  getStats(): SkillRegistryStats {
    const all = Array.from(this.skills.values());
    const enabled = all.filter((r) => r.enabled);

    const byCategory: Record<string, number> = {};
    for (const reg of enabled) {
      const category = reg.skill.metadata.category;
      byCategory[category] = (byCategory[category] || 0) + 1;
    }

    return {
      total: all.length,
      enabled: enabled.length,
      disabled: all.length - enabled.length,
      byCategory,
    };
  }

  /**
   * 清空所有注册（主要用于测试）
   */
  clear(): void {
    this.skills.clear();
    logger.info("SkillRegistry cleared");
  }

  /**
   * 获取所有 Skills 的元数据列表（用于展示）
   */
  listMetadata(
    options: { enabledOnly?: boolean } = {},
  ): SkillMetadataSummary[] {
    return this.getAll(options).map((skill) => ({
      id: skill.metadata.id,
      name: skill.metadata.name,
      description: skill.metadata.description,
      category: skill.metadata.category,
      version: skill.metadata.version,
      capabilities: skill.metadata.capabilities,
      requiresConfirmation: skill.metadata.requiresConfirmation ?? false,
    }));
  }
}

/**
 * SkillRegistry 统计信息
 */
export interface SkillRegistryStats {
  total: number;
  enabled: number;
  disabled: number;
  byCategory: Record<string, number>;
}

/**
 * Skill 元数据摘要（用于列表展示）
 */
export interface SkillMetadataSummary {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  version: string;
  capabilities: string[];
  requiresConfirmation: boolean;
}

/**
 * 导出单例实例
 */
export const skillRegistry = SkillRegistry.getInstance();

/**
 * 创建 SkillRegistry 实例（用于依赖注入容器）
 *
 * 向后兼容：现有代码继续使用 skillRegistry 单例
 * 容器场景：使用此函数创建可管理的实例
 */
export function createSkillRegistryInstance(): SkillRegistry {
  return SkillRegistry.createInstance();
}
