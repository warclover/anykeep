/**
 * V3.0 通用分类体系
 *
 * 30 个预设分类 + ~150 个同义词
 * 用于冷启动场景和兜底分类
 *
 * 设计原则：
 * - 覆盖 90%+ 的收藏内容场景
 * - 语义重叠 < 10%
 * - 同义词精准，避免歧义
 */

/**
 * 通用分类定义
 */
export interface UniversalCategory {
  /** 分类 ID（唯一标识） */
  id: string;
  /** 分类名称（中文） */
  name: string;
  /** 同义词列表（用于匹配） */
  synonyms: string[];
  /** 分类组 */
  group: CategoryGroup;
  /** 推荐的文件夹名称 */
  suggestedFolderName: string;
  /** 图标（emoji） */
  icon: string;
}

/**
 * 分类组
 */
export type CategoryGroup =
  | "tech" // 技术开发
  | "design" // 产品设计
  | "business" // 商业财经
  | "content" // 内容创作
  | "lifestyle" // 生活方式
  | "learning" // 学习成长
  | "other"; // 其他

/**
 * 30 个通用分类定义
 */
export const UNIVERSAL_CATEGORIES: UniversalCategory[] = [
  // ═══════════════════════════════════════════════════════════════
  // 技术开发（7 个）
  // ═══════════════════════════════════════════════════════════════
  {
    id: "tech/frontend",
    name: "前端开发",
    synonyms: [
      "React",
      "Vue",
      "Angular",
      "Svelte",
      "Next.js",
      "Nuxt",
      "CSS",
      "Tailwind",
      "JavaScript",
      "TypeScript",
      "HTML",
      "前端",
      "Web开发",
      "网页开发",
      "UI组件",
      "响应式",
    ],
    group: "tech",
    suggestedFolderName: "前端开发",
    icon: "🌐",
  },
  {
    id: "tech/backend",
    name: "后端开发",
    synonyms: [
      "Node.js",
      "Python",
      "Java",
      "Go",
      "Rust",
      "PHP",
      "Spring",
      "Django",
      "FastAPI",
      "Express",
      "NestJS",
      "后端",
      "服务端",
      "API",
      "微服务",
      "数据库",
    ],
    group: "tech",
    suggestedFolderName: "后端开发",
    icon: "⚙️",
  },
  {
    id: "tech/mobile",
    name: "移动开发",
    synonyms: [
      "iOS",
      "Android",
      "Flutter",
      "React Native",
      "Swift",
      "Kotlin",
      "移动端",
      "App开发",
      "小程序",
      "跨平台",
      "原生开发",
    ],
    group: "tech",
    suggestedFolderName: "移动开发",
    icon: "📱",
  },
  {
    id: "tech/ai",
    name: "AI/机器学习",
    synonyms: [
      "LLM",
      "GPT",
      "Claude",
      "ChatGPT",
      "深度学习",
      "神经网络",
      "NLP",
      "AIGC",
      "大模型",
      "Prompt",
      "RAG",
      "向量数据库",
      "机器学习",
      "人工智能",
      "AI",
      "ML",
      "Computer Vision",
    ],
    group: "tech",
    suggestedFolderName: "AI 技术",
    icon: "🤖",
  },
  {
    id: "tech/data",
    name: "数据工程",
    synonyms: [
      "数据库",
      "SQL",
      "MySQL",
      "PostgreSQL",
      "MongoDB",
      "Redis",
      "ETL",
      "数据分析",
      "BI",
      "数仓",
      "数据治理",
      "大数据",
      "Spark",
      "Flink",
      "数据可视化",
      "Tableau",
    ],
    group: "tech",
    suggestedFolderName: "数据工程",
    icon: "📊",
  },
  {
    id: "tech/devops",
    name: "运维/云原生",
    synonyms: [
      "Docker",
      "Kubernetes",
      "K8s",
      "CI/CD",
      "Linux",
      "AWS",
      "微服务",
      "Serverless",
      "云计算",
      "容器化",
      "DevOps",
      "Jenkins",
      "GitHub Actions",
      "Terraform",
      "监控",
    ],
    group: "tech",
    suggestedFolderName: "运维云原生",
    icon: "☁️",
  },
  {
    id: "tech/security",
    name: "网络安全",
    synonyms: [
      "渗透测试",
      "加密",
      "漏洞",
      "安全",
      "防护",
      "CTF",
      "逆向",
      "Web安全",
      "密码学",
      "身份认证",
      "OAuth",
    ],
    group: "tech",
    suggestedFolderName: "网络安全",
    icon: "🔐",
  },

  // ═══════════════════════════════════════════════════════════════
  // 产品设计（4 个）
  // ═══════════════════════════════════════════════════════════════
  {
    id: "design/ui",
    name: "UI/视觉设计",
    synonyms: [
      "Figma",
      "Sketch",
      "UI设计",
      "视觉设计",
      "界面设计",
      "配色",
      "图标",
      "组件库",
      "设计系统",
      "Design System",
    ],
    group: "design",
    suggestedFolderName: "UI 设计",
    icon: "🎨",
  },
  {
    id: "design/ux",
    name: "用户体验",
    synonyms: [
      "UX",
      "交互设计",
      "用研",
      "可用性",
      "用户旅程",
      "原型",
      "体验设计",
      "信息架构",
      "用户测试",
    ],
    group: "design",
    suggestedFolderName: "用户体验",
    icon: "✨",
  },
  {
    id: "design/product",
    name: "产品思维",
    synonyms: [
      "PRD",
      "产品需求",
      "产品经理",
      "竞品分析",
      "用户故事",
      "产品设计",
      "MVP",
      "需求分析",
      "产品规划",
      "商业分析",
    ],
    group: "design",
    suggestedFolderName: "产品思维",
    icon: "💡",
  },
  {
    id: "design/creative",
    name: "创意设计",
    synonyms: [
      "品牌设计",
      "平面设计",
      "插画",
      "动效",
      "3D",
      "视频剪辑",
      "Motion",
      "海报",
      "Logo",
      "VI",
    ],
    group: "design",
    suggestedFolderName: "创意设计",
    icon: "🎭",
  },

  // ═══════════════════════════════════════════════════════════════
  // 商业财经（4 个）
  // ═══════════════════════════════════════════════════════════════
  {
    id: "business/startup",
    name: "创业/商业",
    synonyms: [
      "创业",
      "融资",
      "商业模式",
      "创始人",
      "VC",
      "增长黑客",
      "PMF",
      "赛道",
      "商业计划书",
    ],
    group: "business",
    suggestedFolderName: "创业商业",
    icon: "🚀",
  },
  {
    id: "business/marketing",
    name: "营销增长",
    synonyms: [
      "营销",
      "增长",
      "运营",
      "SEO",
      "SEM",
      "私域",
      "品牌营销",
      "内容营销",
      "社群运营",
      "用户增长",
    ],
    group: "business",
    suggestedFolderName: "营销增长",
    icon: "📈",
  },
  {
    id: "business/investment",
    name: "投资理财",
    synonyms: [
      "投资",
      "理财",
      "股票",
      "基金",
      "ETF",
      "财务自由",
      "资产配置",
      "定投",
      "复利",
      "财报分析",
    ],
    group: "business",
    suggestedFolderName: "投资理财",
    icon: "💰",
  },
  {
    id: "business/management",
    name: "管理/领导力",
    synonyms: [
      "管理",
      "领导力",
      "团队管理",
      "OKR",
      "绩效",
      "招聘",
      "组织架构",
      "企业文化",
      "向上管理",
    ],
    group: "business",
    suggestedFolderName: "管理领导力",
    icon: "👔",
  },

  // ═══════════════════════════════════════════════════════════════
  // 内容创作（4 个）
  // ═══════════════════════════════════════════════════════════════
  {
    id: "content/writing",
    name: "写作/文案",
    synonyms: [
      "写作",
      "文案",
      "公众号",
      "自媒体",
      "内容创作",
      "文章",
      "爆款",
      "标题党",
      "写作技巧",
      "文笔",
    ],
    group: "content",
    suggestedFolderName: "写作文案",
    icon: "✍️",
  },
  {
    id: "content/video",
    name: "视频创作",
    synonyms: [
      "视频",
      "剪辑",
      "Premiere",
      "Final Cut",
      "达芬奇",
      "B站",
      "抖音",
      "Vlog",
      "短视频",
      "直播",
    ],
    group: "content",
    suggestedFolderName: "视频创作",
    icon: "🎬",
  },
  {
    id: "content/audio",
    name: "音频/播客",
    synonyms: [
      "播客",
      "Podcast",
      "音频",
      "小宇宙",
      "喜马拉雅",
      "声音",
      "录音",
      "音乐制作",
      "混音",
    ],
    group: "content",
    suggestedFolderName: "音频播客",
    icon: "🎙️",
  },
  {
    id: "content/knowledge",
    name: "知识管理",
    synonyms: [
      "笔记",
      "Notion",
      "Obsidian",
      "知识库",
      "第二大脑",
      "PKM",
      "卡片笔记",
      "知识图谱",
      "信息管理",
    ],
    group: "content",
    suggestedFolderName: "知识管理",
    icon: "🧠",
  },

  // ═══════════════════════════════════════════════════════════════
  // 生活方式（5 个）
  // ═══════════════════════════════════════════════════════════════
  {
    id: "lifestyle/health",
    name: "健康/健身",
    synonyms: [
      "健身",
      "减肥",
      "健康",
      "运动",
      "跑步",
      "瑜伽",
      "饮食",
      "营养",
      "睡眠",
      "冥想",
      "心理健康",
    ],
    group: "lifestyle",
    suggestedFolderName: "健康健身",
    icon: "💪",
  },
  {
    id: "lifestyle/travel",
    name: "旅行/出行",
    synonyms: [
      "旅行",
      "旅游",
      "攻略",
      "酒店",
      "机票",
      "自驾",
      "签证",
      "目的地",
      "探店",
      "民宿",
    ],
    group: "lifestyle",
    suggestedFolderName: "旅行出行",
    icon: "✈️",
  },
  {
    id: "lifestyle/food",
    name: "美食/烹饪",
    synonyms: [
      "美食",
      "烹饪",
      "菜谱",
      "食谱",
      "做饭",
      "烘焙",
      "餐厅",
      "探店",
      "饮品",
      "咖啡",
    ],
    group: "lifestyle",
    suggestedFolderName: "美食烹饪",
    icon: "🍳",
  },
  {
    id: "lifestyle/home",
    name: "家居/装修",
    synonyms: [
      "家居",
      "装修",
      "室内设计",
      "收纳",
      "整理",
      "智能家居",
      "软装",
      "家电",
      "绿植",
    ],
    group: "lifestyle",
    suggestedFolderName: "家居生活",
    icon: "🏠",
  },
  {
    id: "lifestyle/hobby",
    name: "兴趣爱好",
    synonyms: [
      "爱好",
      "摄影",
      "绘画",
      "音乐",
      "电影",
      "游戏",
      "阅读",
      "手工",
      "收藏",
      "养宠",
    ],
    group: "lifestyle",
    suggestedFolderName: "兴趣爱好",
    icon: "🎯",
  },

  // ═══════════════════════════════════════════════════════════════
  // 学习成长（4 个）
  // ═══════════════════════════════════════════════════════════════
  {
    id: "learning/language",
    name: "语言学习",
    synonyms: [
      "英语",
      "日语",
      "语言学习",
      "口语",
      "听力",
      "词汇",
      "语法",
      "外语",
      "雅思",
      "托福",
    ],
    group: "learning",
    suggestedFolderName: "语言学习",
    icon: "🗣️",
  },
  {
    id: "learning/career",
    name: "职业发展",
    synonyms: [
      "职业",
      "求职",
      "面试",
      "简历",
      "跳槽",
      "晋升",
      "职场",
      "副业",
      "转行",
      "职业规划",
    ],
    group: "learning",
    suggestedFolderName: "职业发展",
    icon: "📋",
  },
  {
    id: "learning/skill",
    name: "技能提升",
    synonyms: [
      "技能",
      "学习",
      "课程",
      "教程",
      "培训",
      "认证",
      "考试",
      "自学",
      "在线课程",
    ],
    group: "learning",
    suggestedFolderName: "技能提升",
    icon: "📚",
  },
  {
    id: "learning/thinking",
    name: "思维/效率",
    synonyms: [
      "思维",
      "效率",
      "时间管理",
      "GTD",
      "番茄钟",
      "心智模型",
      "批判性思维",
      "决策",
      "习惯",
    ],
    group: "learning",
    suggestedFolderName: "思维效率",
    icon: "⚡",
  },

  // ═══════════════════════════════════════════════════════════════
  // 其他（2 个）
  // ═══════════════════════════════════════════════════════════════
  {
    id: "other/tools",
    name: "工具/资源",
    synonyms: [
      "工具",
      "软件",
      "App",
      "网站",
      "资源",
      "插件",
      "Chrome扩展",
      "效率工具",
      "免费资源",
    ],
    group: "other",
    suggestedFolderName: "工具资源",
    icon: "🔧",
  },
  {
    id: "other/news",
    name: "新闻/资讯",
    synonyms: [
      "新闻",
      "资讯",
      "热点",
      "趋势",
      "行业动态",
      "科技新闻",
      "产品发布",
      "快讯",
    ],
    group: "other",
    suggestedFolderName: "资讯动态",
    icon: "📰",
  },
];

/**
 * 分类组名称映射
 */
export const CATEGORY_GROUP_NAMES: Record<CategoryGroup, string> = {
  tech: "技术开发",
  design: "产品设计",
  business: "商业财经",
  content: "内容创作",
  lifestyle: "生活方式",
  learning: "学习成长",
  other: "其他",
};

/**
 * 获取分类组的所有分类
 */
export function getCategoriesByGroup(
  group: CategoryGroup,
): UniversalCategory[] {
  return UNIVERSAL_CATEGORIES.filter((cat) => cat.group === group);
}

/**
 * 根据 ID 查找分类
 */
export function getCategoryById(id: string): UniversalCategory | undefined {
  return UNIVERSAL_CATEGORIES.find((cat) => cat.id === id);
}

/**
 * 根据关键词匹配分类
 * 返回匹配的分类列表，按匹配度排序
 */
export function matchCategoriesByKeyword(
  keyword: string,
): Array<{ category: UniversalCategory; score: number }> {
  const lowerKeyword = keyword.toLowerCase();
  const results: Array<{ category: UniversalCategory; score: number }> = [];

  for (const category of UNIVERSAL_CATEGORIES) {
    let score = 0;

    // 分类名称完全匹配
    if (category.name.toLowerCase() === lowerKeyword) {
      score = 100;
    }
    // 分类名称包含关键词
    else if (category.name.toLowerCase().includes(lowerKeyword)) {
      score = 80;
    }
    // 同义词完全匹配
    else if (
      category.synonyms.some((syn) => syn.toLowerCase() === lowerKeyword)
    ) {
      score = 90;
    }
    // 同义词包含关键词
    else if (
      category.synonyms.some((syn) => syn.toLowerCase().includes(lowerKeyword))
    ) {
      score = 60;
    }

    if (score > 0) {
      results.push({ category, score });
    }
  }

  // 按匹配度排序
  return results.sort((a, b) => b.score - a.score);
}

/**
 * 获取所有同义词（用于全文搜索索引）
 */
export function getAllSynonyms(): string[] {
  const synonyms = new Set<string>();

  for (const category of UNIVERSAL_CATEGORIES) {
    synonyms.add(category.name);
    for (const syn of category.synonyms) {
      synonyms.add(syn);
    }
  }

  return Array.from(synonyms);
}

/**
 * 统计信息
 */
export const CATEGORY_STATS = {
  totalCategories: UNIVERSAL_CATEGORIES.length,
  totalSynonyms: getAllSynonyms().length,
  byGroup: Object.fromEntries(
    Object.keys(CATEGORY_GROUP_NAMES).map((group) => [
      group,
      getCategoriesByGroup(group as CategoryGroup).length,
    ]),
  ),
};
