/**
 * 文件夹命名规则常量
 *
 * 统一的命名规范，用于所有文件夹名称生成入口
 * 遵循"人类化"命名原则：像给朋友介绍你的收藏夹一样命名
 *
 * @version 1.0.0
 * @since 2026-02-25
 */

// ============================================================================
// A 类：绝对禁止（系统拦截）
// ============================================================================

/**
 * 绝对禁止的文件夹名称
 * 这些名称完全无意义或属于系统保留
 */
export const FORBIDDEN_NAMES_A = new Set([
  // 系统保留
  "内容分类",
  "标签管理",
  "待整理",
  "收藏夹",
  "默认",
  "其他",
  "未分类",
  "杂项",
  "资料",
  "新建文件夹",
  "New Folder",
  "我的收藏",
  "书签",
  "Bookmark",
  "我的书签",
  // 完全无意义
  "无标题",
  "Untitled",
  "新建",
  "New",
  "临时",
  "Temp",
  "无名称",
  "Unnamed",
  // 时间戳回退前缀
  "分类",
]);

// ============================================================================
// B 类：强烈不推荐（prompt 禁止 + 后处理清洗）
// ============================================================================

/**
 * 废话后缀 - 不提供额外信息
 */
export const FILLER_SUFFIXES = [
  "相关",
  "资料",
  "内容",
  "文章",
  "收藏",
  "合集",
  "精选",
  "汇总",
  "整理",
  "归档",
  "备份",
  "记录",
  "笔记",
  "备忘",
];

/**
 * 过度概括词 - 单独使用时等于没说
 */
export const VAGUE_WORDS = [
  "技术",
  "学习",
  "工作",
  "生活",
  "文档",
  "知识",
  "资源",
  "工具",
  "教程",
  "入门",
  "进阶",
  "高级",
  "基础",
  "实践",
  "理论",
  "应用",
  "研究",
  "分析",
  "总结",
];

/**
 * 动词前缀 - 人类不这样命名文件夹
 */
export const VERB_PREFIXES = [
  "学习",
  "研究",
  "探索",
  "了解",
  "关注",
  "阅读",
  "整理",
  "收集",
  "分析",
  "研究",
  "探索",
  "发现",
  "掌握",
  "深入",
  "理解",
  "实践",
  "尝试",
  "使用",
];

/**
 * 口水词 - 非名词结构
 */
export const FILLER_WORDS = [
  "关于",
  "有关",
  "各种",
  "一些",
  "部分",
  "相关",
  "之类的",
  "等等",
  "及其他",
];

/**
 * 冗余修饰词 - 主观判断词
 */
export const REDUNDANT_MODIFIERS = [
  "优质",
  "精品",
  "推荐",
  "好用的",
  "最佳",
  "实用",
  "必备",
  "常用",
  "经典",
  "权威",
  "完整",
  "全面",
  "详细",
  "深入",
];

/**
 * 所有 B 类模式的合并对象
 */
export const FORBIDDEN_PATTERNS_B = {
  suffixes: FILLER_SUFFIXES,
  vague: VAGUE_WORDS,
  verbPrefixes: VERB_PREFIXES,
  filler: FILLER_WORDS,
  modifiers: REDUNDANT_MODIFIERS,
} as const;

// ============================================================================
// C 类：组合使用时允许，单独使用时禁止
// ============================================================================

/**
 * 上下文依赖词 - 单独使用禁止，组合使用允许
 *
 * 例如：
 * - "技术" ✗ （单独使用禁止）
 * - "前端技术" ✓ （组合使用允许）
 * - "AI 工具" ✓ （组合使用允许）
 */
export const CONTEXTUAL_WORDS = new Set([
  "技术",
  "学习",
  "工具",
  "设计",
  "开发",
  "教程",
  "笔记",
  "入门",
  "进阶",
  "实战",
  "指南",
  "手册",
  "资源",
  "素材",
  "案例",
  "项目",
  "产品",
  "运营",
  "营销",
  "管理",
]);

// ============================================================================
// 长度规则
// ============================================================================

/**
 * 命名长度配置
 */
export const NAME_LENGTH_CONFIG = {
  /** 最佳长度：2-4 个中文字 */
  optimal: { min: 2, max: 4 },
  /** 可接受长度：5-6 个字 */
  acceptable: { min: 5, max: 6 },
  /** 上限长度：8 个字（含空格） */
  max: 8,
  /** 英文单词等效长度（1 个英文单词 ≈ 2 个中文字） */
  englishWordEquivalent: 2,
} as const;

// ============================================================================
// 颗粒度阈值
// ============================================================================

/**
 * 基于用户文件夹数量的颗粒度配置
 */
export const GRANULARITY_CONFIG = {
  /** 少量文件夹：使用大类名称 */
  low: { threshold: 10, description: "大类（宽泛）" },
  /** 中等数量：使用中类名称 */
  medium: { threshold: 30, description: "中类（常规）" },
  /** 大量文件夹：使用细分名称 */
  high: { description: "细分（精确）" },
} as const;

// ============================================================================
// 统一 Prompt 规则段
// ============================================================================

/**
 * 核心命名规则 - 用于所有 Prompt
 *
 * 可直接拼接到任意命名 Prompt 中
 */
export const FOLDER_NAMING_RULES = `## 命名规范
生成一个简洁的中文或中英混合的文件夹名称。

【长度】2-4 个字最佳，不超过 8 个字
【结构】使用名词或名词短语，不使用动词开头
【好名字】独立开发、AI 工具、React、个人理财、远程办公、数据可视化
【坏名字】学习 React、技术文章、各种资料、创业相关、优质内容
【禁止】相关、资料、内容、文章、收藏、合集、学习XX、研究XX、关于XX
【英文】专有名词保留原文（React、Docker），中英间加空格

只返回文件夹名称本身，不加引号、不加解释。`;

// ============================================================================
// 停用词（用于关键词提取）
// ============================================================================

/**
 * 中文停用词 - 用于标题关键词提取
 */
export const CHINESE_STOP_WORDS = new Set([
  "的",
  "和",
  "与",
  "或",
  "及",
  "等",
  "了",
  "在",
  "是",
  "有",
  "如何",
  "怎么",
  "为什么",
  "什么",
  "哪个",
  "哪些",
  "这个",
  "那个",
  "这些",
  "那些",
  "一个",
  "一种",
  "一些",
  "许多",
  "很多",
  "非常",
  "特别",
  "真的",
  "确实",
  "已经",
  "正在",
  "将要",
  "可以",
  "可能",
  "应该",
  "必须",
  "需要",
  "想要",
  "希望",
  "建议",
  "推荐",
  "最好",
  "最新",
  "最全",
  "最火",
  "最热",
  "精选",
  "推荐",
  "必看",
  "必读",
  "干货",
  "分享",
  "总结",
  "整理",
]);

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检查名称是否在 A 类黑名单中
 */
export function isForbiddenNameA(name: string): boolean {
  return FORBIDDEN_NAMES_A.has(name.trim());
}

/**
 * 检查名称是否为 C 类上下文依赖词（单独使用）
 */
export function isContextualWord(name: string): boolean {
  const trimmed = name.trim();
  return CONTEXTUAL_WORDS.has(trimmed);
}

/**
 * 检查名称是否为 B 类过度概括词（单独使用）
 */
export function isVagueWord(name: string): boolean {
  const trimmed = name.trim();
  return VAGUE_WORDS.includes(trimmed);
}

/**
 * 获取推荐的颗粒度级别
 */
export function getGranularityLevel(
  folderCount: number,
): "low" | "medium" | "high" {
  if (folderCount < GRANULARITY_CONFIG.low.threshold) {
    return "low";
  }
  if (folderCount < GRANULARITY_CONFIG.medium.threshold) {
    return "medium";
  }
  return "high";
}

/**
 * 获取颗粒度提示文本
 */
export function getGranularityHint(folderCount: number): string {
  const level = getGranularityLevel(folderCount);

  switch (level) {
    case "low":
      return `用户当前有 ${folderCount} 个文件夹。建议使用大类名称（如：前端、设计、理财）`;
    case "medium":
      return `用户当前有 ${folderCount} 个文件夹。建议使用中类名称（如：React、UI 设计）`;
    case "high":
      return `用户当前有 ${folderCount} 个文件夹。建议使用细分名称（如：React Hooks、CSS 动画）`;
  }
}

/**
 * 计算名称的有效长度
 * - 中文按 1 计算
 * - 英文单词按 2 计算（等效于 1 个中文字）
 */
export function calculateEffectiveLength(name: string): number {
  let length = 0;
  let currentWord = "";

  for (const char of name) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      // 中文：结束当前英文单词，中文按 1 计
      if (currentWord.length > 0) {
        length += NAME_LENGTH_CONFIG.englishWordEquivalent;
        currentWord = "";
      }
      length += 1;
    } else if (/[a-zA-Z0-9]/.test(char)) {
      // 英文/数字：累积到当前单词
      currentWord += char;
    } else {
      // 其他字符（空格、符号）：结束当前单词
      if (currentWord.length > 0) {
        length += NAME_LENGTH_CONFIG.englishWordEquivalent;
        currentWord = "";
      }
    }
  }

  // 处理末尾的英文单词
  if (currentWord.length > 0) {
    length += NAME_LENGTH_CONFIG.englishWordEquivalent;
  }

  return length;
}

/**
 * 检查名称长度是否合规
 */
export function isNameLengthValid(name: string): boolean {
  const effectiveLength = calculateEffectiveLength(name);
  return (
    effectiveLength >= NAME_LENGTH_CONFIG.optimal.min &&
    effectiveLength <= NAME_LENGTH_CONFIG.max
  );
}
