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
    pattern:
      "周报|月报|报告|总结报告|这周.{0,5}(收藏|添加)|本周.{0,5}(收藏|添加)|最近.{0,5}收藏了",
    weight: 85,
    complexity: "complex",
    description: "生成周期报告",
  },
  {
    type: "analyze",
    subType: "insight",
    pattern: "分析|洞察|趋势|数据分析|规律|特点",
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
  // Skills v1.1.0 新增（2025-01-08）
  // ============================================
  {
    // InboxTriageSkill - 收件箱智能分拣
    type: "action",
    subType: "inbox_triage",
    pattern:
      "整理.*(收件箱|inbox)|收件箱.*整理|(帮我|自动).*(分类|分拣|归档).*(未读|未整理|新)|清理.*未分类",
    weight: 85,
    complexity: "complex",
    description: "收件箱智能分拣",
  },
  {
    // FolderRecommendSkill - 文件夹智能推荐
    type: "query",
    subType: "folder_recommend",
    pattern:
      "推荐.*(文件夹|目录|分类)|(建议|应该).*创建.*(文件夹|目录)|(文件夹|目录).*建议",
    weight: 85,
    complexity: "simple",
    description: "文件夹智能推荐",
  },
  {
    // SearchOptimizeSkill - 搜索优化助手
    type: "query",
    subType: "search_optimize",
    pattern: "优化.*搜索|搜索.*优化|(改进|提高).*搜索|搜索.*建议",
    weight: 82,
    complexity: "simple",
    description: "搜索优化助手",
  },
  {
    // KnowledgeGraphExploreSkill - 知识图谱探索
    type: "analyze",
    subType: "knowledge_graph_explore",
    pattern: "探索.*图谱|图谱.*探索|知识.*关联|关联.*分析",
    weight: 83,
    complexity: "complex",
    description: "知识图谱探索",
  },
  {
    // FolderHealthCheckSkill - 文件夹健康检查
    type: "analyze",
    subType: "folder_health_check",
    pattern: "文件夹.*(健康|检查|诊断)|(健康|检查|诊断).*文件夹",
    weight: 84,
    complexity: "complex",
    description: "文件夹健康检查",
  },
  {
    // SnapshotCompareSkill - 快照对比分析
    type: "analyze",
    subType: "snapshot_compare",
    pattern: "(快照|版本|页面).*(对比|比较|变化)|对比.*(快照|版本)",
    weight: 81,
    complexity: "simple",
    description: "快照对比分析",
  },

  // ============================================
  // 创建类（权重 60-75）
  // ============================================
  {
    // TTS 语音朗读 - Phase 1 新增
    // 使用负向后行断言排除"阅读"中的"读"
    type: "create",
    subType: "tts",
    pattern: "(?<!阅|已)读|朗读|播放|听|语音|念|tts",
    weight: 75,
    complexity: "simple",
    description: "语音朗读内容",
  },
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
  // 查询类（权重 45-78）
  // ============================================
  {
    // 搜索 + P2 口语化增强
    // "搜索 React"、"有没有什么编程相关的"、"有什么 Python 的"
    type: "query",
    subType: "search",
    pattern: "搜索|搜|找|查|检索|有没有.{0,15}(的|相关)|有什么.{0,15}(的|相关)",
    weight: 78,
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
    pattern: "删除|移除|清除|删掉|不要了|不想要",
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
    // Phase 1 增强：口语化标签操作
    // 示例："给这个加个标签"、"加标签"、"打个标签"
    type: "action",
    subType: "tag",
    pattern: "加.{0,3}标签|打.{0,3}标签|给.{0,10}标签|标记|贴标签",
    weight: 60,
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
  // 智能列表类（权重 55-65）
  // ============================================
  {
    type: "create",
    subType: "smart_list",
    pattern: "创建智能列表|新建智能列表|添加智能列表|建个智能列表",
    weight: 65,
    complexity: "medium",
    description: "创建智能列表",
  },
  {
    type: "query",
    subType: "smart_list",
    pattern: "我的智能列表|有哪些智能列表|智能列表有什么|查看智能列表",
    weight: 55,
    complexity: "simple",
    description: "查看智能列表",
  },
  {
    type: "action",
    subType: "smart_list",
    pattern: "编辑智能列表|修改智能列表|更新智能列表|删除智能列表",
    weight: 58,
    complexity: "simple",
    description: "管理智能列表",
  },

  // ============================================
  // MD 收藏类（权重 60-72）
  // ============================================
  {
    type: "create",
    subType: "md_collection",
    pattern:
      "保存.{0,5}收藏|存.{0,5}笔记|保存.{0,5}MD|创建.{0,5}笔记|存到收藏|存一个笔记|记一下|记录一下",
    weight: 72,
    complexity: "medium",
    description: "创建 MD 收藏",
  },
  {
    type: "query",
    subType: "md_collection",
    pattern: "我的笔记|MD收藏|笔记收藏|查看笔记|有哪些笔记",
    weight: 55,
    complexity: "simple",
    description: "查看 MD 收藏",
  },
  {
    type: "action",
    subType: "md_collection",
    pattern: "编辑笔记|修改笔记|更新笔记|删除笔记",
    weight: 58,
    complexity: "simple",
    description: "管理 MD 收藏",
  },

  // ============================================
  // 导入类（权重 60-68）
  // ============================================
  {
    type: "create",
    subType: "import",
    pattern: "导入书签|导入收藏|从.{0,10}导入|import",
    weight: 68,
    complexity: "medium",
    description: "导入书签/收藏",
  },
  {
    type: "create",
    subType: "import_browser",
    pattern:
      "导入浏览器书签|导入Chrome|导入Edge|导入Firefox|导入Safari|从浏览器导入",
    weight: 70,
    complexity: "medium",
    description: "导入浏览器书签",
  },
  {
    type: "create",
    subType: "import_wechat",
    pattern: "导入微信|从微信导入|导入公众号",
    weight: 65,
    complexity: "medium",
    description: "导入微信文章",
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
  const cached = patternCache.get(pattern);
  if (cached) {
    return cached;
  }
  const compiled = new RegExp(pattern, "i");
  patternCache.set(pattern, compiled);
  return compiled;
}

/**
 * 清除模式缓存（测试用）
 */
export function clearPatternCache(): void {
  patternCache.clear();
}
