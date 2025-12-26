/**
 * 隐含意图推断规则
 *
 * 用于从用户模糊表达中推断真正目标
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

/**
 * 隐含意图规则
 */
export interface ImplicitIntentRule {
  /** 规则 ID */
  id: string;
  /** 触发模式 */
  pattern: RegExp;
  /** 隐含目标 */
  implicitGoal: string;
  /** 隐含期望（不要做的事） */
  hiddenExpectation?: string;
  /** 默认行为建议 */
  defaultBehavior: string;
  /** 优先级 */
  priority: number;
}

/**
 * 默认隐含意图规则
 */
export const IMPLICIT_INTENT_RULES: ImplicitIntentRule[] = [
  {
    id: "organize-not-delete",
    pattern: /整理|清理|规整|梳理/,
    implicitGoal: "让收藏更有序、更易管理",
    hiddenExpectation: "不要删除任何内容（除非明确要求）",
    defaultBehavior: "建议标签或文件夹分组",
    priority: 90,
  },
  {
    id: "too-many-not-delete",
    pattern: /太多|好多|很多|一堆/,
    implicitGoal: "减少认知负担，更好地管理",
    hiddenExpectation: "不是要删除，是想分组/筛选",
    defaultBehavior: "提供分类方案或筛选建议",
    priority: 85,
  },
  {
    id: "cant-find-search",
    pattern: /找不到|在哪|哪里|怎么找/,
    implicitGoal: "快速定位目标内容",
    hiddenExpectation: "不需要列出所有，只要最相关的",
    defaultBehavior: "搜索 + 展示最相关结果",
    priority: 80,
  },
  {
    id: "recent-7days",
    pattern: /最近|近期|这几天/,
    implicitGoal: "查看近期活动",
    hiddenExpectation: "通常指7天内，不是全部历史",
    defaultBehavior: "按最近7天筛选",
    priority: 75,
  },
  {
    id: "look-at-overview",
    pattern: /看看|瞅瞅|看下|帮我看/,
    implicitGoal: "了解概况",
    hiddenExpectation: "不是要执行操作，是想看统计/概览",
    defaultBehavior: "展示概况统计",
    priority: 70,
  },
  {
    id: "that-one-context",
    pattern: /那个|那条|刚才那个/,
    implicitGoal: "引用最近交互的内容",
    hiddenExpectation: "需要从上下文推断具体指代",
    defaultBehavior: "检查上下文最近收藏/操作",
    priority: 95,
  },
  {
    id: "these-selected",
    pattern: /这些|这几个|选中的/,
    implicitGoal: "操作当前选中或最近列表",
    hiddenExpectation: "指代会话中的选中项",
    defaultBehavior: "使用会话中的选中项",
    priority: 90,
  },
  {
    id: "all-batch-confirm",
    pattern: /都|全部|所有/,
    implicitGoal: "批量操作",
    hiddenExpectation: "可能范围很大，需要确认",
    defaultBehavior: "先说明范围再执行",
    priority: 85,
  },
];

/**
 * 隐含意图规则 - Prompt 注入部分
 */
export const IMPLICIT_INTENT_RULES_PROMPT = `
### 隐含意图推断规则

| 用户表达 | 隐含意图 | 默认行为 |
|----------|----------|----------|
| "整理 XX" | 分类/打标签，**不是删除** | 建议标签或文件夹分组 |
| "太多了" | 想要筛选/分组，**不是删除** | 提供分类方案或筛选建议 |
| "找不到 XX" | 想快速定位 | 搜索 + 展示最相关结果 |
| "最近的 XX" | 时间范围：7天内 | 按最近7天筛选 |
| "帮我看看" | 统计/概览，**不是操作** | 展示概况统计 |
| "那个" | 指代最近交互的内容 | 检查上下文最近收藏/操作 |
| "这些" | 指当前选中或最近列表 | 使用会话中的选中项 |
| "都" + 操作 | 批量操作，需确认范围 | 先说明范围再执行 |
`;

/**
 * 匹配隐含意图规则
 */
export function matchImplicitIntent(
  message: string,
): ImplicitIntentRule | null {
  const sortedRules = [...IMPLICIT_INTENT_RULES].sort(
    (a, b) => b.priority - a.priority,
  );

  for (const rule of sortedRules) {
    if (rule.pattern.test(message)) {
      return rule;
    }
  }

  return null;
}

/**
 * 获取所有匹配的隐含意图
 */
export function matchAllImplicitIntents(message: string): ImplicitIntentRule[] {
  return IMPLICIT_INTENT_RULES.filter((rule) =>
    rule.pattern.test(message),
  ).sort((a, b) => b.priority - a.priority);
}
