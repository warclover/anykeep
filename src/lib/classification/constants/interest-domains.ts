/**
 * Preset interest domains configuration
 */

import type { PresetInterestDomain, PresetInterestId } from "../types";

/**
 * Preset interest domains (12 domains)
 * Covers common knowledge areas for mainstream users
 */
export const PRESET_INTEREST_DOMAINS: Record<
  PresetInterestId,
  PresetInterestDomain
> = {
  // Technology (4)
  tech_frontend: {
    name: "前端开发",
    icon: "🖥️",
    category: "tech",
    keywords: [
      "React",
      "Vue",
      "CSS",
      "JavaScript",
      "TypeScript",
      "Next.js",
      "Tailwind",
    ],
    suggestedFolders: ["前端学习", "框架教程", "组件库"],
  },
  tech_backend: {
    name: "后端开发",
    icon: "⚙️",
    category: "tech",
    keywords: ["Node.js", "Python", "Java", "Go", "数据库", "API", "微服务"],
    suggestedFolders: ["后端技术", "API设计", "架构模式"],
  },
  tech_ai: {
    name: "AI/机器学习",
    icon: "🤖",
    category: "tech",
    keywords: ["ChatGPT", "大模型", "深度学习", "Prompt", "LLM", "AI工具"],
    suggestedFolders: ["AI工具", "学习资料", "论文收藏"],
  },
  tech_mobile: {
    name: "移动开发",
    icon: "📱",
    category: "tech",
    keywords: ["iOS", "Android", "Flutter", "React Native", "Swift", "Kotlin"],
    suggestedFolders: ["移动开发", "App设计"],
  },

  // Design (2)
  design_ui: {
    name: "UI/UX设计",
    icon: "🎨",
    category: "design",
    keywords: ["Figma", "界面设计", "用户体验", "交互", "设计系统", "原型"],
    suggestedFolders: ["设计灵感", "设计规范", "工具资源"],
  },
  design_graphic: {
    name: "平面设计",
    icon: "🖼️",
    category: "design",
    keywords: ["海报", "品牌", "Logo", "配色", "排版", "插画"],
    suggestedFolders: ["视觉设计", "品牌案例"],
  },

  // Business (2)
  product: {
    name: "产品经理",
    icon: "📊",
    category: "business",
    keywords: ["需求", "原型", "用户研究", "数据分析", "PRD", "竞品分析"],
    suggestedFolders: ["产品方法论", "竞品分析", "数据报告"],
  },
  marketing: {
    name: "营销运营",
    icon: "📈",
    category: "business",
    keywords: ["增长", "转化", "内容营销", "社群", "SEO", "投放"],
    suggestedFolders: ["营销案例", "运营工具", "增长策略"],
  },

  // Lifestyle/Learning (4)
  reading: {
    name: "阅读写作",
    icon: "📚",
    category: "lifestyle",
    keywords: ["书籍", "文章", "写作技巧", "知识管理", "笔记", "博客"],
    suggestedFolders: ["书单", "好文收藏", "写作素材"],
  },
  investment: {
    name: "投资理财",
    icon: "💰",
    category: "lifestyle",
    keywords: ["股票", "基金", "理财", "财经", "投资", "经济"],
    suggestedFolders: ["投资学习", "市场分析", "理财工具"],
  },
  lifestyle: {
    name: "生活方式",
    icon: "🌟",
    category: "lifestyle",
    keywords: ["美食", "旅行", "健康", "穿搭", "家居", "运动"],
    suggestedFolders: ["生活灵感", "好物推荐"],
  },
  learning: {
    name: "学习提升",
    icon: "🎓",
    category: "lifestyle",
    keywords: ["课程", "教程", "技能", "认证", "学习方法", "效率"],
    suggestedFolders: ["学习资料", "课程收藏", "教程笔记"],
  },
} as const;

/**
 * Get all preset interest IDs
 */
export function getAllPresetInterestIds(): PresetInterestId[] {
  return Object.keys(PRESET_INTEREST_DOMAINS) as PresetInterestId[];
}

/**
 * Get interests by category
 */
export function getInterestsByCategory(
  category: "tech" | "design" | "business" | "lifestyle",
): PresetInterestId[] {
  return (
    Object.entries(PRESET_INTEREST_DOMAINS) as [
      PresetInterestId,
      PresetInterestDomain,
    ][]
  )
    .filter(([, domain]) => domain.category === category)
    .map(([id]) => id);
}

/**
 * Get suggested folders for selected interests
 */
export function getSuggestedFolders(interestIds: PresetInterestId[]): string[] {
  const folders = new Set<string>();
  for (const id of interestIds) {
    const domain = PRESET_INTEREST_DOMAINS[id];
    if (domain) {
      domain.suggestedFolders.forEach((f) => folders.add(f));
    }
  }
  return Array.from(folders);
}

/**
 * Get all keywords for selected interests
 */
export function getKeywordsForInterests(
  interestIds: PresetInterestId[],
): string[] {
  const keywords = new Set<string>();
  for (const id of interestIds) {
    const domain = PRESET_INTEREST_DOMAINS[id];
    if (domain) {
      domain.keywords.forEach((k) => keywords.add(k));
    }
  }
  return Array.from(keywords);
}

/**
 * Default folders when user skips interest selection
 */
export const DEFAULT_FOLDERS = ["学习资料", "稍后阅读", "收藏夹"] as const;
