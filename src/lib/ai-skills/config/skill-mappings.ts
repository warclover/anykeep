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
  // Active Recall 主动复习类（v2.5.0 新增）
  // ============================================
  {
    key: "learn:active_recall_start",
    skillId: "active_recall",
    name: "Brain-Sync 主动复习",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
    priority: 105,
  },
  {
    key: "query:mastery_stats",
    skillId: "get_mastery_stats",
    name: "复习掌握度统计",
    mode: "atomic",
    enabled: true,
    priority: 85,
  },
  {
    key: "action:review_preferences",
    skillId: "update_review_preferences",
    name: "复习偏好设置",
    mode: "atomic",
    enabled: true,
    priority: 82,
  },

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
    key: "create:tts",
    skillId: "tts_synthesis",
    name: "语音朗读助手",
    mode: "orchestration",
    minComplexity: "simple",
    enabled: true,
    priority: 90,
  },
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
  // 智能列表类 → 原子模式（直接调用 Tools）
  // ============================================
  {
    key: "create:smart_list",
    skillId: "search",
    name: "创建智能列表",
    mode: "atomic",
    enabled: true,
    priority: 65,
  },
  {
    key: "query:smart_list",
    skillId: "search",
    name: "查看智能列表",
    mode: "atomic",
    enabled: true,
    priority: 55,
  },
  {
    key: "action:smart_list",
    skillId: "search",
    name: "管理智能列表",
    mode: "atomic",
    enabled: true,
    priority: 58,
  },

  // ============================================
  // MD 收藏类 → 原子模式（直接调用 Tools）
  // ============================================
  {
    key: "create:md_collection",
    skillId: "search",
    name: "创建 MD 收藏",
    mode: "atomic",
    enabled: true,
    priority: 72,
  },
  {
    key: "query:md_collection",
    skillId: "search",
    name: "查看 MD 收藏",
    mode: "atomic",
    enabled: true,
    priority: 55,
  },
  {
    key: "action:md_collection",
    skillId: "search",
    name: "管理 MD 收藏",
    mode: "atomic",
    enabled: true,
    priority: 58,
  },

  // ============================================
  // 导入类 → 原子模式（直接调用 Tools）
  // ============================================
  {
    key: "create:import",
    skillId: "search",
    name: "导入书签",
    mode: "atomic",
    enabled: true,
    priority: 68,
  },
  {
    key: "create:import_browser",
    skillId: "search",
    name: "导入浏览器书签",
    mode: "atomic",
    enabled: true,
    priority: 70,
  },
  {
    key: "create:import_wechat",
    skillId: "search",
    name: "导入微信文章",
    mode: "atomic",
    enabled: true,
    priority: 65,
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
  // 注意：对于未被其他规则匹配的 action 意图，交由 AI Agent 直接处理
  {
    key: "action:*",
    skillId: "chat",
    name: "操作",
    mode: "atomic",
    enabled: true,
    priority: 30,
  },

  // ============================================
  // 过滤/筛选类 → 原子模式
  // 注意：refine 意图用于对搜索结果的二次筛选，
  // 需要上下文中有 lastSearchResults，UnifiedEngine 会自动注入上下文
  // ============================================
  {
    key: "refine:*",
    skillId: "search",
    name: "筛选结果",
    mode: "atomic",
    enabled: true,
    priority: 25,
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
  {
    toolId: "tts",
    skillId: "tts_synthesis",
    mode: "orchestration",
    icon: "Volume2",
  },
  // Active Recall / Brain-Sync 显式工具（v2.5.0 新增）
  {
    toolId: "brain-sync",
    skillId: "active_recall",
    mode: "orchestration",
    icon: "Brain",
  },
  {
    toolId: "active-recall",
    skillId: "active_recall",
    mode: "orchestration",
    icon: "Brain",
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
  const exactMatch = index.get(exactKey);
  if (exactMatch) {
    return exactMatch;
  }

  // 2. 通配符匹配
  const wildcardKey = `${intentType}:*`;
  const wildcardMatch = index.get(wildcardKey);
  if (wildcardMatch) {
    return wildcardMatch;
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
