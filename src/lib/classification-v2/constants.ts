/**
 * Classification V2 - 常量定义
 *
 * 禁止词表、命名规则、停用词等静态数据。
 * 从旧系统 constants/naming-rules.ts 完整迁移。
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

// ============================================================================
// A 类：绝对禁止的文件夹名称
// ============================================================================

export const FORBIDDEN_NAMES = new Set([
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
  // 无意义
  "无标题",
  "Untitled",
  "新建",
  "New",
  "临时",
  "Temp",
  "无名称",
  "Unnamed",
  "分类",
]);

// ============================================================================
// B 类：不推荐的命名模式
// ============================================================================

/** 废话后缀 */
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
] as const;

/** 过度概括词（单独使用时等于没说） */
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
] as const;

/** 动词前缀 */
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
  "发现",
  "掌握",
  "深入",
  "理解",
  "实践",
  "尝试",
  "使用",
] as const;

/** 口水词 */
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
] as const;

/** 冗余修饰词 */
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
] as const;

// ============================================================================
// C 类：上下文依赖词（单独使用禁止，组合使用允许）
// ============================================================================

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
// 中文停用词（用于关键词提取）
// ============================================================================

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
  "必看",
  "必读",
  "干货",
  "分享",
  "总结",
  "整理",
]);

// ============================================================================
// Prompt 模板
// ============================================================================

/** 文件夹命名规则（用于 LLM prompt） */
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
// 通用分类体系（从 V1 迁移）
// ============================================================================

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
  // 技术开发（7 个）
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
  // 产品设计（4 个）
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
  // 商业财经（4 个）
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
  // 内容创作（4 个）
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
  // 生活方式（5 个）
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
  // 学习成长（4 个）
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
  // 其他（2 个）
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

// ============================================================================
// 辅助函数
// ============================================================================

/** 检查名称是否在 A 类黑名单中 */
export function isForbiddenName(name: string): boolean {
  return FORBIDDEN_NAMES.has(name.trim());
}

/** 检查名称是否为上下文依赖词（单独使用） */
export function isContextualWord(name: string): boolean {
  return CONTEXTUAL_WORDS.has(name.trim());
}

/** 检查名称是否为过度概括词（单独使用） */
export function isVagueWord(name: string): boolean {
  return (VAGUE_WORDS as readonly string[]).includes(name.trim());
}

/**
 * 计算名称有效长度
 * - 中文按 1 计
 * - 英文单词按 2 计
 */
export function calculateEffectiveLength(name: string): number {
  let length = 0;
  let inEnglishWord = false;

  for (const char of name) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      if (inEnglishWord) {
        length += 2;
        inEnglishWord = false;
      }
      length += 1;
    } else if (/[a-zA-Z0-9]/.test(char)) {
      inEnglishWord = true;
    } else {
      if (inEnglishWord) {
        length += 2;
        inEnglishWord = false;
      }
    }
  }

  if (inEnglishWord) length += 2;
  return length;
}
