/**
 * UnifiedCapabilityRegistry - 统一能力注册适配层
 *
 * 提供 Tool 和 Skill 的统一查询接口，用于：
 * - 统一能力发现和搜索
 * - 能力统计和分析
 * - UI 展示统一数据源
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import {
  toolRegistry,
  type ToolRegistry,
} from "@/lib/ai-agent/tools/tool-registry";
import { skillRegistry } from "@/lib/ai-skills/core/skill-registry";

// ============================================
// 类型定义
// ============================================

/**
 * 统一能力接口
 */
export interface UnifiedCapability {
  /** 能力 ID */
  id: string;
  /** 能力名称 */
  name: string;
  /** 能力描述 */
  description: string;
  /** 来源类型 */
  source: "tool" | "skill";
  /** 分类 */
  category: string;
  /** 能力标签（仅 Skill 有） */
  capabilities?: string[];
  /** 版本号（仅 Skill 有） */
  version?: string;
  /** 是否需要确认 */
  requiresConfirmation: boolean;
  /** 是否启用（Tool 始终为 true） */
  enabled: boolean;
}

/**
 * 统一注册表统计信息
 */
export interface UnifiedRegistryStats {
  /** Tool 统计 */
  tools: {
    total: number;
    byCategory: Record<string, number>;
  };
  /** Skill 统计 */
  skills: {
    total: number;
    enabled: number;
    disabled: number;
    byCategory: Record<string, number>;
  };
  /** 合并统计 */
  combined: {
    total: number;
  };
}

/**
 * 查询选项
 */
export interface FindOptions {
  /** 按来源筛选 */
  source?: "tool" | "skill";
  /** 按分类筛选 */
  category?: string;
  /** 按启用状态筛选（仅对 Skill 有效） */
  enabled?: boolean;
}

// ============================================
// UnifiedCapabilityRegistry 实现
// ============================================

/**
 * 统一能力注册表
 *
 * @example
 * ```typescript
 * // 查询所有能力
 * const all = unifiedRegistry.findAll();
 *
 * // 按来源筛选
 * const tools = unifiedRegistry.findAll({ source: 'tool' });
 * const skills = unifiedRegistry.findAll({ source: 'skill' });
 *
 * // 按 ID 查找
 * const cap = unifiedRegistry.findById('search');
 *
 * // 搜索
 * const results = unifiedRegistry.search('书签');
 *
 * // 获取统计
 * const stats = unifiedRegistry.getStats();
 * ```
 */
export class UnifiedCapabilityRegistry {
  constructor(
    private toolReg: ToolRegistry = toolRegistry,
    private skillReg: typeof skillRegistry = skillRegistry,
  ) {}

  /**
   * 查询所有能力
   *
   * @param options - 查询选项
   * @returns 统一能力列表
   */
  findAll(options?: FindOptions): UnifiedCapability[] {
    const results: UnifiedCapability[] = [];

    // 收集 Tools
    if (!options?.source || options.source === "tool") {
      const toolSummaries = this.toolReg.getSummaries();
      for (const tool of toolSummaries) {
        // 按分类筛选
        if (options?.category && tool.category !== options.category) continue;

        results.push({
          id: tool.name,
          name: tool.name,
          description: tool.description,
          source: "tool",
          category: tool.category,
          requiresConfirmation: tool.requiresConfirmation ?? false,
          enabled: true, // Tools 始终启用
        });
      }
    }

    // 收集 Skills
    if (!options?.source || options.source === "skill") {
      // 构建 listMetadata 的选项
      const skillListOptions: { enabledOnly?: boolean } = {};
      if (options?.enabled !== undefined) {
        skillListOptions.enabledOnly = options.enabled;
      }

      const skillMetadata = this.skillReg.listMetadata(skillListOptions);

      for (const skill of skillMetadata) {
        // 按分类筛选
        if (options?.category && skill.category !== options.category) continue;

        // 获取完整注册信息以获取 enabled 状态
        const registration = this.skillReg.getRegistration(skill.id);

        results.push({
          id: skill.id,
          name: skill.name,
          description: skill.description,
          source: "skill",
          category: skill.category,
          capabilities: skill.capabilities,
          version: skill.version,
          requiresConfirmation: skill.requiresConfirmation ?? false,
          enabled: registration?.enabled ?? true,
        });
      }
    }

    return results;
  }

  /**
   * 按 ID 查找能力
   *
   * @param id - 能力 ID
   * @returns 统一能力或 undefined
   */
  findById(id: string): UnifiedCapability | undefined {
    // 先查 Tool
    const tool = this.toolReg.get(id);
    if (tool) {
      return {
        id: tool.definition.name,
        name: tool.definition.name,
        description: tool.definition.description,
        source: "tool",
        category: tool.definition.category,
        requiresConfirmation: tool.definition.requiresConfirmation ?? false,
        enabled: true,
      };
    }

    // 再查 Skill
    const skillReg = this.skillReg.getRegistration(id);
    if (skillReg) {
      return {
        id: skillReg.skill.metadata.id,
        name: skillReg.skill.metadata.name,
        description: skillReg.skill.metadata.description,
        source: "skill",
        category: skillReg.skill.metadata.category,
        capabilities: skillReg.skill.metadata.capabilities,
        version: skillReg.skill.metadata.version,
        requiresConfirmation:
          skillReg.skill.metadata.requiresConfirmation ?? false,
        enabled: skillReg.enabled,
      };
    }

    return undefined;
  }

  /**
   * 搜索能力
   *
   * @param query - 搜索关键词
   * @returns 匹配的能力列表
   */
  search(query: string): UnifiedCapability[] {
    const queryLower = query.toLowerCase();
    return this.findAll().filter(
      (cap) =>
        cap.id.toLowerCase().includes(queryLower) ||
        cap.name.toLowerCase().includes(queryLower) ||
        cap.description.toLowerCase().includes(queryLower) ||
        cap.capabilities?.some((c) => c.toLowerCase().includes(queryLower)),
    );
  }

  /**
   * 获取统计信息
   *
   * @returns 统一统计信息
   */
  getStats(): UnifiedRegistryStats {
    const toolStats = this.toolReg.getStats();
    const skillStats = this.skillReg.getStats();

    return {
      tools: {
        total: toolStats.totalTools,
        byCategory: toolStats.byCategory,
      },
      skills: {
        total: skillStats.total,
        enabled: skillStats.enabled,
        disabled: skillStats.disabled,
        byCategory: skillStats.byCategory,
      },
      combined: {
        total: toolStats.totalTools + skillStats.total,
      },
    };
  }

  /**
   * 列出所有能力（findAll 的别名）
   *
   * @returns 所有能力列表
   */
  listAll(): UnifiedCapability[] {
    return this.findAll();
  }

  /**
   * 按分类获取能力
   *
   * @param category - 分类名称
   * @returns 该分类下的能力列表
   */
  findByCategory(category: string): UnifiedCapability[] {
    return this.findAll({ category });
  }

  /**
   * 按能力标签获取（仅匹配 Skill）
   *
   * @param capability - 能力标签
   * @returns 具有该能力的 Skill 列表
   */
  findByCapability(capability: string): UnifiedCapability[] {
    const capLower = capability.toLowerCase();
    return this.findAll({ source: "skill" }).filter((cap) =>
      cap.capabilities?.some((c) => c.toLowerCase().includes(capLower)),
    );
  }

  /**
   * 检查能力是否存在
   *
   * @param id - 能力 ID
   * @returns 是否存在
   */
  has(id: string): boolean {
    return this.toolReg.has(id) || this.skillReg.has(id);
  }
}

// ============================================
// 导出
// ============================================

/**
 * 导出单例实例
 */
export const unifiedRegistry = new UnifiedCapabilityRegistry();
