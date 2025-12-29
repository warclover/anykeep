/**
 * 意图模式配置
 *
 * 定义用户输入的意图识别规则
 * 按权重排序，高权重优先匹配
 *
 * @version 2.0.0
 * @since 2025-12-27
 */

import type { IntentPattern } from "./types";

/**
 * 默认意图模式
 *
 * 从 intent-classifier.ts 的 DEFAULT_RULES 提取并优化
 *
 * 权重分布：
 * - 90-95: Active Recall 类（Brain-Sync 主动复习）
 * - 85-90: 学习类（高价值、明确意图）
 * - 75-85: 整理/分析类（中高复杂度）
 * - 60-75: 创建类（中等复杂度）
 * - 40-55: 查询/操作类（简单任务）
 */
export const INTENT_PATTERNS: IntentPattern[] = [
  // ============================================
  // Active Recall 主动复习类（权重 90-95，v2.5.0 新增）
  // ============================================
  {
    type: "learn",
    subType: "active_recall_start",
    pattern:
      "开始复习|今日复习|知识同步|脑回路同步|看看要复习什么|有什么要复习",
    weight: 95,
    complexity: "complex",
    description: "开始 Brain-Sync 主动复习会话",
  },
  {
    type: "query",
    subType: "mastery_stats",
    pattern: "复习进度|我学了什么|掌握了多少|内化率|记忆曲线|复习统计|掌握度",
    weight: 85,
    complexity: "simple",
    description: "查看复习掌握度统计",
  },
  {
    type: "action",
    subType: "review_preferences",
    pattern: "设置复习|复习偏好|调整复习频率|关闭复习|开启复习|复习设置",
    weight: 82,
    complexity: "simple",
    description: "配置复习偏好设置",
  },

  // ============================================
  // 学习类（权重 80-90）
  // ============================================
  {
    type: "learn",
    subType: "review",
    pattern: "复习|回顾|巩固|温习|重温",
    weight: 90,
    complexity: "complex",
    description: "知识复习回顾",
  },
  {
    type: "learn",
    subType: "path",
    pattern: "学习路径|学习计划|怎么学|学习规划|系统学",
    weight: 85,
    complexity: "complex",
    description: "制定学习路径",
  },
  {
    type: "learn",
    subType: "plan",
    pattern: "阅读计划|读书计划|每日阅读",
    weight: 80,
    complexity: "medium",
    description: "制定阅读计划",
  },

  // ============================================
  // 整理类（权重 75-88）
  // ============================================
  {
    type: "organize",
    subType: "dedupe",
    pattern: "去重|重复|删除重复|清除重复|合并重复",
    weight: 88,
    complexity: "complex",
    description: "清理重复收藏",
  },
  {
    type: "organize",
    subType: "cleanup",
    pattern: "整理|清理|规整|梳理|收拾",
    weight: 82,
    complexity: "complex",
    description: "智能整理收藏",
  },
  {
    type: "organize",
    subType: "classify",
    pattern: "分类|归类|分组|按.*分",
    weight: 78,
    complexity: "medium",
    description: "自动分类",
  },
  {
    type: "organize",
    subType: "tag",
    pattern: "打标签|加标签|自动标签|智能标签",
    weight: 75,
    complexity: "medium",
    description: "智能打标签",
  },

  // ============================================
  // 分析类（权重 75-85）
  // ============================================
  {
    type: "analyze",
    subType: "report",
    pattern: "周报|月报|报告|总结报告",
    weight: 85,
    complexity: "complex",
    description: "生成周期报告",
  },
  {
    type: "analyze",
    subType: "insight",
    pattern: "分析|洞察|趋势|数据分析",
    weight: 80,
    complexity: "complex",
    description: "收藏洞察分析",
  },
  {
    type: "analyze",
    subType: "discover",
    pattern: "发现|推荐|相关|关联",
    weight: 75,
    complexity: "medium",
    description: "相关内容发现",
  },

  // ============================================
  // 创建类（权重 60-75）
  // ============================================
  {
    type: "create",
    subType: "digest",
    pattern: "摘要|总结|速览|概要|提炼",
    weight: 72,
    complexity: "medium",
    description: "生成内容摘要",
  },
  {
    type: "create",
    subType: "export",
    pattern: "导出|下载|保存为|输出",
    weight: 68,
    complexity: "simple",
    description: "导出收藏数据",
  },
  {
    type: "create",
    subType: "share",
    pattern: "分享|发送|转发",
    weight: 65,
    complexity: "medium",
    description: "分享收藏内容",
  },
  {
    type: "create",
    subType: "extract",
    pattern: "提取|抽取|知识点",
    weight: 60,
    complexity: "medium",
    description: "知识提取",
  },

  // ============================================
  // 查询类（权重 45-55）
  // ============================================
  {
    type: "query",
    subType: "search",
    pattern: "搜索|搜|找|查|检索",
    weight: 55,
    complexity: "simple",
    description: "关键词搜索",
  },
  {
    type: "query",
    subType: "list",
    pattern: "列出|列表|显示|看看|有哪些",
    weight: 50,
    complexity: "simple",
    description: "列出收藏",
  },
  {
    type: "query",
    subType: "count",
    pattern: "有多少|数量|统计|计数",
    weight: 48,
    complexity: "simple",
    description: "统计数量",
  },
  {
    type: "query",
    subType: "get",
    pattern: "获取|得到|拿到",
    weight: 45,
    complexity: "simple",
    description: "获取内容",
  },

  // ============================================
  // 操作类（权重 48-55）
  // ============================================
  {
    type: "action",
    subType: "delete",
    pattern: "删除|移除|清除|删掉",
    weight: 55,
    complexity: "simple",
    description: "删除收藏",
  },
  {
    type: "action",
    subType: "move",
    pattern: "移动|移到|放到|转移",
    weight: 52,
    complexity: "simple",
    description: "移动收藏",
  },
  {
    type: "action",
    subType: "tag",
    pattern: "标记|加标签|打上",
    weight: 50,
    complexity: "simple",
    description: "添加标签",
  },
  {
    type: "action",
    subType: "archive",
    pattern: "归档|存档|收纳",
    weight: 48,
    complexity: "simple",
    description: "归档收藏",
  },

  // ============================================
  // 闲聊类（权重 30-40）
  // ============================================
  {
    type: "chitchat",
    subType: "greeting",
    pattern: "你好|hi|hello|嗨",
    weight: 40,
    complexity: "simple",
    description: "问候",
  },
  {
    type: "chitchat",
    subType: "help",
    pattern: "帮助|怎么用|能做什么|有什么功能",
    weight: 38,
    complexity: "simple",
    description: "帮助请求",
  },
  {
    type: "chitchat",
    subType: "thanks",
    pattern: "谢谢|感谢|多谢",
    weight: 35,
    complexity: "simple",
    description: "感谢",
  },
];

/**
 * 按权重排序的模式索引
 */
export const SORTED_PATTERNS = [...INTENT_PATTERNS].sort(
  (a, b) => b.weight - a.weight,
);

/**
 * 编译正则表达式缓存
 */
const patternCache = new Map<string, RegExp>();

/**
 * 获取编译后的正则表达式
 */
export function getCompiledPattern(pattern: string): RegExp {
  if (!patternCache.has(pattern)) {
    patternCache.set(pattern, new RegExp(pattern, "i"));
  }
  return patternCache.get(pattern)!;
}

/**
 * 清除模式缓存（测试用）
 */
export function clearPatternCache(): void {
  patternCache.clear();
}
