/**
 * Skill 映射配置
 *
 * 定义意图到 Skill 的映射关系
 * 支持精确匹配和通配符匹配
 *
 * @version 2.0.0
 * @since 2025-12-27
 */

import type { SkillMapping, ExplicitToolMapping, MappingIndex } from "./types";

/**
 * 默认 Skill 映射
 *
 * 从 mode-selector.ts 的 DEFAULT_SKILL_MAPPINGS 提取
 *
 * 映射键格式：intentType:subType
 * - 精确匹配：learn:review
 * - 类型通配：learn:*
 */
export const SKILL_MAPPINGS: SkillMapping[] = [
  // ============================================
  // 学习类 → 编排模式
  // ============================================
  {
    key: "learn:review",
    skillId: "knowledge_review",
    name: "知识回顾助手",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
    priority: 100,
  },
  {
    key: "learn:path",
    skillId: "learning_path",
    name: "学习路径规划",
    mode: "orchestration",
    minComplexity: "complex",
    enabled: true,
    priority: 100,
  },
  {
    key: "learn:plan",
    skillId: "reading_planner",
    name: "阅读计划助手",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
    priority: 90,
  },
  // 学习类通配符兜底
  {
    key: "learn:*",
    skillId: "learning_path",
    name: "学习路径规划",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
    priority: 50,
  },

  // ============================================
  // 整理类 → 编排模式
  // ============================================
  {
    key: "organize:cleanup",
    skillId: "batch_organize",
    name: "智能整理助手",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
    priority: 95,
  },
  {
    key: "organize:dedupe",
    skillId: "duplicate_cleanup",
    name: "重复清理助手",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
    priority: 95,
  },
  {
    key: "organize:classify",
    skillId: "smart_tagging",
    name: "智能标签助手",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
    priority: 90,
  },
  {
    key: "organize:tag",
    skillId: "smart_tagging",
    name: "智能标签助手",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
    priority: 85,
  },
  // 整理类通配符兜底
  {
    key: "organize:*",
    skillId: "batch_organize",
    name: "智能整理助手",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
    priority: 50,
  },

  // ============================================
  // 分析类 → 编排模式
  // ============================================
  {
    key: "analyze:report",
    skillId: "periodic_report",
    name: "周期报告生成",
    mode: "orchestration",
    minComplexity: "complex",
    enabled: true,
    priority: 95,
  },
  {
    key: "analyze:insight",
    skillId: "insight_report",
    name: "收藏洞察分析",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
    priority: 90,
  },
  {
    key: "analyze:discover",
    skillId: "related_discovery",
    name: "相关发现助手",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
    priority: 85,
  },
  // 分析类通配符兜底
  {
    key: "analyze:*",
    skillId: "insight_report",
    name: "收藏洞察分析",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
    priority: 50,
  },

  // ============================================
  // 创建类 → 混合模式
  // ============================================
  {
    key: "create:digest",
    skillId: "quick_digest",
    name: "快速摘要生成",
    mode: "orchestration",
    minComplexity: "simple",
    enabled: true,
    priority: 90,
  },
  {
    key: "create:export",
    skillId: "data_export",
    name: "数据导出助手",
    mode: "orchestration",
    minComplexity: "simple",
    enabled: true,
    priority: 90,
  },
  {
    key: "create:share",
    skillId: "share_bundle",
    name: "分享包生成",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
    priority: 85,
  },
  {
    key: "create:extract",
    skillId: "knowledge_extract",
    name: "知识提取",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
    priority: 85,
  },

  // ============================================
  // 查询类 → 原子模式
  // ============================================
  {
    key: "query:search",
    skillId: "search",
    name: "搜索",
    mode: "atomic",
    enabled: true,
    priority: 80,
  },
  {
    key: "query:list",
    skillId: "search",
    name: "列表",
    mode: "atomic",
    enabled: true,
    priority: 75,
  },
  {
    key: "query:count",
    skillId: "search",
    name: "统计",
    mode: "atomic",
    enabled: true,
    priority: 70,
  },
  {
    key: "query:get",
    skillId: "search",
    name: "获取",
    mode: "atomic",
    enabled: true,
    priority: 70,
  },
  // 查询类通配符兜底
  {
    key: "query:*",
    skillId: "search",
    name: "搜索",
    mode: "atomic",
    enabled: true,
    priority: 40,
  },

  // ============================================
  // 操作类 → 原子模式
  // ============================================
  {
    key: "action:delete",
    skillId: "delete",
    name: "删除",
    mode: "atomic",
    enabled: true,
    priority: 80,
  },
  {
    key: "action:move",
    skillId: "move",
    name: "移动",
    mode: "atomic",
    enabled: true,
    priority: 75,
  },
  {
    key: "action:tag",
    skillId: "add_tag",
    name: "打标签",
    mode: "atomic",
    enabled: true,
    priority: 75,
  },
  {
    key: "action:archive",
    skillId: "archive",
    name: "归档",
    mode: "atomic",
    enabled: true,
    priority: 70,
  },
  // 操作类通配符兜底
  {
    key: "action:*",
    skillId: "search",
    name: "操作",
    mode: "atomic",
    enabled: true,
    priority: 30,
  },

  // ============================================
  // 闲聊类 → 原子模式
  // ============================================
  {
    key: "chitchat:*",
    skillId: "chat",
    name: "闲聊",
    mode: "atomic",
    enabled: true,
    priority: 20,
  },
];

/**
 * 显式工具映射
 *
 * UI 工具直接触发 Skill，跳过意图分类
 * 用于工具栏按钮、快捷键等
 */
export const EXPLICIT_TOOL_MAPPINGS: ExplicitToolMapping[] = [
  {
    toolId: "search",
    skillId: "search",
    mode: "atomic",
    icon: "Search",
    shortcut: "Cmd+K",
  },
  {
    toolId: "organize",
    skillId: "batch_organize",
    mode: "orchestration",
    icon: "Sparkles",
  },
  {
    toolId: "dedupe",
    skillId: "duplicate_cleanup",
    mode: "orchestration",
    icon: "Copy",
  },
  {
    toolId: "tag",
    skillId: "smart_tagging",
    mode: "orchestration",
    icon: "Tag",
  },
  {
    toolId: "stats",
    skillId: "insight_report",
    mode: "orchestration",
    icon: "BarChart2",
  },
  {
    toolId: "review",
    skillId: "knowledge_review",
    mode: "orchestration",
    icon: "BookOpen",
  },
  {
    toolId: "export",
    skillId: "data_export",
    mode: "orchestration",
    icon: "Download",
  },
  {
    toolId: "summarize",
    skillId: "quick_digest",
    mode: "orchestration",
    icon: "FileText",
  },
  {
    toolId: "report",
    skillId: "periodic_report",
    mode: "orchestration",
    icon: "FileBarChart",
  },
];

// ============================================
// 映射索引构建
// ============================================

/**
 * 构建映射索引
 *
 * 预构建 O(1) 查找结构
 */
export function buildMappingIndex(mappings: SkillMapping[]): MappingIndex {
  const index = new Map<string, SkillMapping>();

  // 按优先级排序后添加（高优先级覆盖低优先级）
  const sorted = [...mappings]
    .filter((m) => m.enabled)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  for (const mapping of sorted) {
    // 只保留最高优先级的映射
    if (!index.has(mapping.key)) {
      index.set(mapping.key, mapping);
    }
  }

  return index;
}

/**
 * 查找映射
 *
 * 查找优先级：精确匹配 > 通配符匹配 > 无匹配
 */
export function findMapping(
  index: MappingIndex,
  intentType: string,
  subType: string,
): SkillMapping | null {
  // 1. 精确匹配
  const exactKey = `${intentType}:${subType}`;
  if (index.has(exactKey)) {
    return index.get(exactKey)!;
  }

  // 2. 通配符匹配
  const wildcardKey = `${intentType}:*`;
  if (index.has(wildcardKey)) {
    return index.get(wildcardKey)!;
  }

  // 3. 无匹配
  return null;
}

/**
 * 查找显式工具映射
 */
export function findExplicitTool(
  toolId: string,
): ExplicitToolMapping | undefined {
  return EXPLICIT_TOOL_MAPPINGS.find((t) => t.toolId === toolId);
}

// ============================================
// 预构建索引（单例）
// ============================================

let _mappingIndex: MappingIndex | null = null;

/**
 * 获取映射索引（延迟初始化）
 */
export function getMappingIndex(): MappingIndex {
  if (!_mappingIndex) {
    _mappingIndex = buildMappingIndex(SKILL_MAPPINGS);
  }
  return _mappingIndex;
}

/**
 * 重置映射索引（热更新用）
 */
export function resetMappingIndex(): void {
  _mappingIndex = null;
}
