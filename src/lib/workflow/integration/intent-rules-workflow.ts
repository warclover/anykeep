/**
 * 工作流触发意图规则
 *
 * 添加到 IntentClassifier 的规则集中
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

/**
 * 工作流意图规则
 */
export interface WorkflowIntentRule {
  /** 规则 ID */
  id: string;
  /** 匹配模式 */
  patterns: string[];
  /** 意图类型 */
  intent: {
    type: "workflow";
    subType: string;
  };
  /** 置信度 */
  confidence: number;
}

/**
 * 工作流触发意图规则
 *
 * 添加到 IntentClassifier 的规则集中
 */
export const workflowIntentRules: WorkflowIntentRule[] = [
  // 书签健康检查
  {
    id: "workflow-bookmark-health",
    patterns: [
      "检查书签健康",
      "书签巡检",
      "检测失效链接",
      "链接检查",
      "书签健康状况",
      "检查死链",
      "死链检测",
    ],
    intent: { type: "workflow", subType: "bookmark_health" },
    confidence: 0.9,
  },

  // 每周整理
  {
    id: "workflow-weekly-organize",
    patterns: [
      "周度整理",
      "每周整理",
      "本周整理",
      "做一下整理",
      "整理一下",
      "帮我整理",
    ],
    intent: { type: "workflow", subType: "weekly_organize" },
    confidence: 0.85,
  },

  // 深度学习
  {
    id: "workflow-deep-learning",
    patterns: [
      "深度学习",
      "系统学习",
      "学习路径",
      "主题深挖",
      "深入学习",
      "专题学习",
    ],
    intent: { type: "workflow", subType: "topic_deep_dive" },
    confidence: 0.8,
  },

  // 数据备份
  {
    id: "workflow-backup",
    patterns: ["备份数据", "导出备份", "定期备份", "全量备份", "备份书签"],
    intent: { type: "workflow", subType: "periodic_backup" },
    confidence: 0.85,
  },

  // 新用户导入整理
  {
    id: "workflow-new-user-onboarding",
    patterns: [
      "整理导入的书签",
      "导入书签整理",
      "帮我整理刚导入的",
      "整理刚导入的",
      "导入后整理",
    ],
    intent: { type: "workflow", subType: "new_user_onboarding" },
    confidence: 0.85,
  },

  // 智能收录
  {
    id: "workflow-smart-intake",
    patterns: ["智能收录", "自动分类", "自动整理", "智能整理", "智能归档"],
    intent: { type: "workflow", subType: "smart_intake" },
    confidence: 0.85,
  },

  // 间隔复习
  {
    id: "workflow-spaced-review",
    patterns: ["间隔复习", "复习计划", "开始复习", "复习队列", "待复习"],
    intent: { type: "workflow", subType: "spaced_review" },
    confidence: 0.85,
  },

  // 运行工作流（通用）
  {
    id: "workflow-run-generic",
    patterns: ["运行工作流", "执行工作流", "启动工作流"],
    intent: { type: "workflow", subType: "run_generic" },
    confidence: 0.75,
  },
];

/**
 * 检查消息是否匹配工作流意图
 *
 * @param message - 用户消息
 * @returns 匹配的规则或 null
 */
export function matchWorkflowIntent(
  message: string,
): WorkflowIntentRule | null {
  const normalizedMessage = message.toLowerCase().trim();

  for (const rule of workflowIntentRules) {
    for (const pattern of rule.patterns) {
      if (normalizedMessage.includes(pattern.toLowerCase())) {
        return rule;
      }
    }
  }

  return null;
}
