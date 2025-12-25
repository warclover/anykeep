/**
 * 响应风格配置
 *
 * 定义 AI 响应的风格规范，去除机械感，增加自然表达
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { IntentType } from "../router/types";

// ============================================
// 1.3.2 禁用短语列表
// ============================================

/**
 * 禁用短语列表
 *
 * 这些短语会让 AI 响应显得机械化，应当避免使用
 */
export const BANNED_PHRASES: string[] = [
  // 服务式开场白
  "根据您的请求",
  "根据你的请求",
  "我将为您",
  "我将为你",
  "我已经为您",
  "我已经为你",
  "请问您是否需要",
  "请问你是否需要",
  "如您所愿",
  "如你所愿",

  // 过度礼貌
  "我来帮您",
  "我来帮你",
  "好的，我",
  "没问题，我",
  "当然可以",
  "当然，我",
  "很高兴为您",
  "很高兴为你",

  // 身份声明
  "作为AI助手",
  "作为AI",
  "作为人工智能",
  "作为您的助手",

  // 冗余表达
  "让我来",
  "现在让我",
  "接下来我将",
  "首先，我需要",
];

/**
 * 检测文本是否包含禁用短语
 *
 * @param text - 要检测的文本
 * @returns 包含的禁用短语列表
 */
export function detectBannedPhrases(text: string): string[] {
  return BANNED_PHRASES.filter((phrase) => text.includes(phrase));
}

/**
 * 移除禁用短语
 *
 * @param text - 原始文本
 * @returns 清理后的文本
 */
export function removeBannedPhrases(text: string): string {
  let result = text;
  for (const phrase of BANNED_PHRASES) {
    result = result.replace(new RegExp(phrase, "g"), "");
  }
  // 清理多余的空格和换行
  return result.replace(/\s+/g, " ").trim();
}

// ============================================
// 1.3.3 直接响应模板
// ============================================

/**
 * 响应模板类型
 */
export interface ResponseTemplate {
  /** 模板 ID */
  id: string;
  /** 适用的意图类型 */
  intentType: IntentType;
  /** 适用的子类型（可选） */
  subType?: string;
  /** 模板文本，支持 {变量} 插值 */
  template: string;
  /** 适用条件描述 */
  condition?: string;
}

/**
 * 直接响应模板
 *
 * 这些模板提供直接、简洁的响应格式
 */
export const RESPONSE_TEMPLATES: ResponseTemplate[] = [
  // ============================================
  // 查询类模板
  // ============================================
  {
    id: "search-results",
    intentType: "query",
    subType: "search",
    template: "找到 {count} 篇相关内容：",
  },
  {
    id: "search-no-results",
    intentType: "query",
    subType: "search",
    template: "没有找到相关内容",
    condition: "count === 0",
  },
  {
    id: "list-results",
    intentType: "query",
    subType: "list",
    template: "最近的 {count} 条收藏：",
  },
  {
    id: "count-results",
    intentType: "query",
    subType: "count",
    template: "共 {count} 条收藏",
  },
  {
    id: "count-with-filter",
    intentType: "query",
    subType: "count",
    template: "{filter}共 {count} 条",
    condition: "hasFilter",
  },

  // ============================================
  // 操作类模板
  // ============================================
  {
    id: "move-success",
    intentType: "action",
    subType: "move",
    template: "已将 {count} 条移动到「{folder}」",
  },
  {
    id: "delete-success",
    intentType: "action",
    subType: "delete",
    template: "已删除 {count} 条",
  },
  {
    id: "tag-success",
    intentType: "action",
    subType: "tag",
    template: "已为 {count} 条添加标签「{tag}」",
  },

  // ============================================
  // 分析类模板
  // ============================================
  {
    id: "stats-summary",
    intentType: "analyze",
    subType: "insight",
    template: "{period}收藏了 {count} 篇，{topTopic}主题最多（{topCount} 篇）",
  },
  {
    id: "report-ready",
    intentType: "analyze",
    subType: "report",
    template: "报告已生成",
  },

  // ============================================
  // 创建类模板
  // ============================================
  {
    id: "digest-ready",
    intentType: "create",
    subType: "digest",
    template: "摘要已生成",
  },
  {
    id: "note-saved",
    intentType: "create",
    subType: "note",
    template: "笔记已保存",
  },

  // ============================================
  // 整理类模板
  // ============================================
  {
    id: "organize-preview",
    intentType: "organize",
    subType: "cleanup",
    template: "整理方案：将移动 {moveCount} 条，合并 {mergeCount} 条",
  },
  {
    id: "dedupe-results",
    intentType: "organize",
    subType: "dedupe",
    template: "发现 {count} 组重复内容",
  },

  // ============================================
  // 学习类模板
  // ============================================
  {
    id: "review-ready",
    intentType: "learn",
    subType: "review",
    template: "为你准备了 {count} 个复习要点",
  },
  {
    id: "path-ready",
    intentType: "learn",
    subType: "path",
    template: "学习路径已规划",
  },
];

/**
 * 获取匹配的响应模板
 *
 * @param intentType - 意图类型
 * @param subType - 子类型
 * @returns 匹配的模板，如果没有匹配返回 null
 */
export function getResponseTemplate(
  intentType: IntentType,
  subType?: string,
): ResponseTemplate | null {
  // 优先匹配带 subType 的模板
  if (subType) {
    const exactMatch = RESPONSE_TEMPLATES.find(
      (t) => t.intentType === intentType && t.subType === subType,
    );
    if (exactMatch) {
      return exactMatch;
    }
  }

  // 回退到只匹配 intentType 的模板
  return (
    RESPONSE_TEMPLATES.find((t) => t.intentType === intentType && !t.subType) ||
    null
  );
}

/**
 * 渲染模板
 *
 * @param template - 模板文本
 * @param variables - 变量映射
 * @returns 渲染后的文本
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string | number>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  }
  return result;
}

// ============================================
// 1.3.4 跟进建议模板
// ============================================

/**
 * 跟进建议
 */
export interface FollowUpSuggestion {
  /** 显示文本 */
  text: string;
  /** 点击后发送的消息 */
  action: string;
  /** 可选图标（emoji） */
  icon?: string;
}

/**
 * 跟进建议配置
 */
export interface FollowUpConfig {
  /** 适用的意图类型 */
  intentType: IntentType;
  /** 适用的子类型（可选） */
  subType?: string;
  /** 建议列表 */
  suggestions: FollowUpSuggestion[];
}

/**
 * 跟进建议配置列表
 */
export const FOLLOW_UP_CONFIGS: FollowUpConfig[] = [
  // ============================================
  // 查询类跟进
  // ============================================
  {
    intentType: "query",
    subType: "search",
    suggestions: [
      { text: "继续找", action: "还有其他相关的吗？", icon: "🔍" },
      { text: "看详情", action: "展开第一篇的摘要", icon: "📖" },
      { text: "整理这些", action: "把这些整理到一个文件夹", icon: "📁" },
    ],
  },
  {
    intentType: "query",
    subType: "list",
    suggestions: [
      { text: "看更多", action: "再显示 10 条", icon: "📋" },
      { text: "筛选", action: "只看本周的", icon: "🔍" },
      { text: "整理", action: "整理这些收藏", icon: "📁" },
    ],
  },
  {
    intentType: "query",
    subType: "count",
    suggestions: [
      { text: "看详情", action: "列出这些收藏", icon: "📋" },
      { text: "分析趋势", action: "分析我的收藏趋势", icon: "📊" },
    ],
  },

  // ============================================
  // 整理类跟进
  // ============================================
  {
    intentType: "organize",
    subType: "cleanup",
    suggestions: [
      { text: "执行整理", action: "确认执行整理方案", icon: "✅" },
      { text: "调整方案", action: "修改整理方案", icon: "✏️" },
      { text: "取消", action: "取消整理", icon: "❌" },
    ],
  },
  {
    intentType: "organize",
    subType: "dedupe",
    suggestions: [
      { text: "合并重复", action: "自动合并所有重复内容", icon: "🔄" },
      { text: "逐个处理", action: "让我逐个确认", icon: "👀" },
    ],
  },

  // ============================================
  // 分析类跟进
  // ============================================
  {
    intentType: "analyze",
    subType: "insight",
    suggestions: [
      { text: "生成报告", action: "生成完整的阅读报告", icon: "📊" },
      { text: "看详情", action: "展开具体数据", icon: "📈" },
    ],
  },
  {
    intentType: "analyze",
    subType: "report",
    suggestions: [
      { text: "导出", action: "导出报告为 Markdown", icon: "📤" },
      { text: "分享", action: "生成分享链接", icon: "🔗" },
    ],
  },

  // ============================================
  // 创建类跟进
  // ============================================
  {
    intentType: "create",
    subType: "digest",
    suggestions: [
      { text: "保存笔记", action: "保存为笔记", icon: "📝" },
      { text: "导出", action: "导出摘要", icon: "📤" },
      { text: "重新生成", action: "用不同风格重新生成", icon: "🔄" },
    ],
  },
  {
    intentType: "create",
    subType: "note",
    suggestions: [
      { text: "编辑", action: "编辑笔记内容", icon: "✏️" },
      { text: "分享", action: "分享笔记", icon: "🔗" },
    ],
  },

  // ============================================
  // 学习类跟进
  // ============================================
  {
    intentType: "learn",
    subType: "review",
    suggestions: [
      { text: "开始复习", action: "开始复习第一个要点", icon: "📚" },
      { text: "生成卡片", action: "生成记忆卡片", icon: "🃏" },
      { text: "导出", action: "导出复习资料", icon: "📤" },
    ],
  },
  {
    intentType: "learn",
    subType: "path",
    suggestions: [
      { text: "开始学习", action: "开始第一阶段学习", icon: "🚀" },
      { text: "调整计划", action: "调整学习计划", icon: "✏️" },
    ],
  },

  // ============================================
  // 默认跟进
  // ============================================
  {
    intentType: "chitchat",
    suggestions: [
      { text: "搜索收藏", action: "搜索我的收藏", icon: "🔍" },
      { text: "整理收藏", action: "整理我的收藏", icon: "📁" },
      { text: "查看统计", action: "我有多少收藏", icon: "📊" },
    ],
  },
];

/**
 * 获取跟进建议
 *
 * @param intentType - 意图类型
 * @param subType - 子类型
 * @returns 跟进建议列表
 */
export function getFollowUpSuggestions(
  intentType: IntentType,
  subType?: string,
): FollowUpSuggestion[] {
  // 优先匹配带 subType 的配置
  if (subType) {
    const exactMatch = FOLLOW_UP_CONFIGS.find(
      (c) => c.intentType === intentType && c.subType === subType,
    );
    if (exactMatch) {
      return exactMatch.suggestions;
    }
  }

  // 回退到只匹配 intentType 的配置
  const fallback = FOLLOW_UP_CONFIGS.find(
    (c) => c.intentType === intentType && !c.subType,
  );
  if (fallback) {
    return fallback.suggestions;
  }

  // 默认返回闲聊的建议
  const defaultConfig = FOLLOW_UP_CONFIGS.find(
    (c) => c.intentType === "chitchat",
  );
  return defaultConfig?.suggestions || [];
}
