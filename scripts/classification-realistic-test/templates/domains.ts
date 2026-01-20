/**
 * 领域模板定义
 */

import type { Domain, DomainTemplate } from "../types";

/**
 * 20+ 领域模板
 */
export const DOMAIN_TEMPLATES: Record<Domain, DomainTemplate> = {
  frontend: {
    domain: "frontend",
    titleTemplates: [
      "{framework} {topic} {action}",
      "{topic} {framework} {level}",
      "{action} {framework} {topic}",
      "{framework} {level} {topic}",
    ],
    summaryTemplates: [
      "深入讲解 {topic} 在 {framework} 中的应用",
      "从零开始学习 {framework} {topic}",
      "{framework} {topic} 最佳实践",
      "掌握 {framework} {topic} 的核心概念",
    ],
    tagSets: [
      ["react", "hooks", "前端"],
      ["vue", "组件", "开发"],
      ["typescript", "类型", "安全"],
      ["javascript", "es6", "现代"],
      ["css", "样式", "布局"],
    ],
    folderNames: [
      "React学习",
      "Vue开发",
      "前端框架",
      "JavaScript进阶",
      "CSS技巧",
      "TypeScript",
      "前端工具",
    ],
    keywords: [
      "react",
      "vue",
      "angular",
      "typescript",
      "css",
      "html",
      "javascript",
    ],
  },

  backend: {
    domain: "backend",
    titleTemplates: [
      "{framework} {topic} {action}",
      "{topic} {framework} {level}",
      "{action} {language} {topic}",
    ],
    summaryTemplates: [
      "学习 {framework} {topic} 开发",
      "{language} {topic} 实战教程",
      "{framework} {topic} 最佳实践",
    ],
    tagSets: [
      ["nodejs", "后端", "服务器"],
      ["python", "django", "flask"],
      ["java", "spring", "企业级"],
      ["go", "高性能", "并发"],
    ],
    folderNames: [
      "Node.js开发",
      "Python后端",
      "Java企业级",
      "Go语言",
      "API设计",
      "数据库",
    ],
    keywords: ["nodejs", "python", "java", "go", "api", "server", "database"],
  },

  design: {
    domain: "design",
    titleTemplates: [
      "{tool} {topic} {action}",
      "{topic} 设计 {level}",
      "{action} {style} 设计",
    ],
    summaryTemplates: [
      "{tool} {topic} 设计教程",
      "学习 {style} 设计风格",
      "{topic} 设计最佳实践",
    ],
    tagSets: [
      ["figma", "ui", "设计"],
      ["sketch", "原型", "交互"],
      ["配色", "色彩", "视觉"],
      ["排版", "字体", "布局"],
    ],
    folderNames: ["Figma设计", "UI设计", "设计系统", "配色方案", "设计灵感"],
    keywords: ["figma", "sketch", "ui", "ux", "design", "color", "typography"],
  },

  product: {
    domain: "product",
    titleTemplates: [
      "{topic} {action}",
      "{action} {topic} {level}",
      "{method} {topic}",
    ],
    summaryTemplates: [
      "产品 {topic} 方法论",
      "{method} 在产品中的应用",
      "{topic} 实战案例",
    ],
    tagSets: [
      ["产品", "需求", "分析"],
      ["用户研究", "体验", "调研"],
      ["竞品", "分析", "对比"],
      ["原型", "设计", "交互"],
    ],
    folderNames: ["产品分析", "用户研究", "竞品分析", "产品设计", "需求文档"],
    keywords: ["product", "user", "research", "analysis", "prototype"],
  },

  research: {
    domain: "research",
    titleTemplates: [
      "{topic} {method} {action}",
      "{action} {topic} {field}",
      "{field} {topic} 研究",
    ],
    summaryTemplates: [
      "{topic} 研究方法",
      "{field} {topic} 最新进展",
      "{method} 在 {topic} 中的应用",
    ],
    tagSets: [
      ["论文", "研究", "学术"],
      ["实验", "方法", "数据"],
      ["理论", "模型", "分析"],
    ],
    folderNames: ["论文资料", "实验方法", "研究笔记", "数据分析", "理论文献"],
    keywords: ["research", "paper", "experiment", "method", "theory"],
  },

  // 其他领域...
  mobile: {
    domain: "mobile",
    titleTemplates: ["{platform} {topic} {action}"],
    summaryTemplates: ["{platform} {topic} 开发教程"],
    tagSets: [
      ["ios", "swift", "移动"],
      ["android", "kotlin", "开发"],
    ],
    folderNames: ["iOS开发", "Android开发", "移动应用"],
    keywords: ["ios", "android", "mobile", "app"],
  },

  devops: {
    domain: "devops",
    titleTemplates: ["{tool} {topic} {action}"],
    summaryTemplates: ["{tool} {topic} 实践指南"],
    tagSets: [
      ["docker", "容器", "部署"],
      ["kubernetes", "编排", "云"],
    ],
    folderNames: ["Docker", "Kubernetes", "CI/CD", "运维"],
    keywords: ["docker", "kubernetes", "ci", "cd", "devops"],
  },

  ai_ml: {
    domain: "ai_ml",
    titleTemplates: ["{topic} {method} {action}"],
    summaryTemplates: ["{method} 在 {topic} 中的应用"],
    tagSets: [
      ["机器学习", "算法", "ai"],
      ["深度学习", "神经网络", "模型"],
    ],
    folderNames: ["机器学习", "深度学习", "AI应用"],
    keywords: ["ml", "ai", "deep learning", "neural network"],
  },

  data_science: {
    domain: "data_science",
    titleTemplates: ["{topic} {tool} {action}"],
    summaryTemplates: ["使用 {tool} 进行 {topic}"],
    tagSets: [
      ["数据分析", "python", "pandas"],
      ["可视化", "图表", "统计"],
    ],
    folderNames: ["数据分析", "数据可视化", "统计方法"],
    keywords: ["data", "analysis", "visualization", "statistics"],
  },

  writing: {
    domain: "writing",
    titleTemplates: ["{topic} {action}"],
    summaryTemplates: ["{topic} 写作技巧"],
    tagSets: [
      ["写作", "技巧", "方法"],
      ["文案", "营销", "创意"],
    ],
    folderNames: ["写作技巧", "文案素材", "创意灵感"],
    keywords: ["writing", "copywriting", "content"],
  },

  photography: {
    domain: "photography",
    titleTemplates: ["{topic} {action}"],
    summaryTemplates: ["{topic} 摄影技巧"],
    tagSets: [
      ["摄影", "技巧", "构图"],
      ["后期", "调色", "修图"],
    ],
    folderNames: ["摄影技巧", "后期处理", "作品集"],
    keywords: ["photography", "camera", "editing"],
  },

  cooking: {
    domain: "cooking",
    titleTemplates: ["{cuisine} {dish} {action}"],
    summaryTemplates: ["{dish} 制作方法"],
    tagSets: [
      ["菜谱", "烹饪", "美食"],
      ["烘焙", "甜点", "技巧"],
    ],
    folderNames: ["家常菜", "烘焙", "美食灵感"],
    keywords: ["cooking", "recipe", "food"],
  },

  travel: {
    domain: "travel",
    titleTemplates: ["{destination} {topic}"],
    summaryTemplates: ["{destination} 旅行攻略"],
    tagSets: [
      ["旅行", "攻略", "景点"],
      ["酒店", "美食", "交通"],
    ],
    folderNames: ["旅行攻略", "目的地", "旅行计划"],
    keywords: ["travel", "tourism", "destination"],
  },

  finance: {
    domain: "finance",
    titleTemplates: ["{topic} {action}"],
    summaryTemplates: ["{topic} 理财指南"],
    tagSets: [
      ["理财", "投资", "基金"],
      ["股票", "保险", "规划"],
    ],
    folderNames: ["理财规划", "投资", "财务"],
    keywords: ["finance", "investment", "money"],
  },

  health: {
    domain: "health",
    titleTemplates: ["{topic} {action}"],
    summaryTemplates: ["{topic} 健康指南"],
    tagSets: [
      ["健康", "运动", "饮食"],
      ["养生", "医疗", "保健"],
    ],
    folderNames: ["健康生活", "运动健身", "养生"],
    keywords: ["health", "fitness", "wellness"],
  },

  education: {
    domain: "education",
    titleTemplates: ["{subject} {level} {action}"],
    summaryTemplates: ["{subject} {level} 学习资源"],
    tagSets: [
      ["学习", "课程", "教程"],
      ["考试", "复习", "资料"],
    ],
    folderNames: ["学习资料", "课程笔记", "考试复习"],
    keywords: ["education", "learning", "course"],
  },

  business: {
    domain: "business",
    titleTemplates: ["{topic} {action}"],
    summaryTemplates: ["{topic} 商业策略"],
    tagSets: [
      ["商业", "管理", "策略"],
      ["创业", "营销", "运营"],
    ],
    folderNames: ["商业分析", "管理", "创业"],
    keywords: ["business", "management", "strategy"],
  },

  entertainment: {
    domain: "entertainment",
    titleTemplates: ["{topic} {action}"],
    summaryTemplates: ["{topic} 娱乐内容"],
    tagSets: [
      ["电影", "音乐", "游戏"],
      ["综艺", "娱乐", "休闲"],
    ],
    folderNames: ["电影", "音乐", "游戏"],
    keywords: ["entertainment", "movie", "music"],
  },

  sports: {
    domain: "sports",
    titleTemplates: ["{sport} {topic}"],
    summaryTemplates: ["{sport} {topic} 技巧"],
    tagSets: [
      ["运动", "健身", "技巧"],
      ["比赛", "训练", "装备"],
    ],
    folderNames: ["运动技巧", "训练计划", "运动装备"],
    keywords: ["sports", "fitness", "training"],
  },

  other: {
    domain: "other",
    titleTemplates: ["{topic} {action}"],
    summaryTemplates: ["{topic} 相关内容"],
    tagSets: [["其他", "杂项", "未分类"]],
    folderNames: ["其他", "未分类"],
    keywords: ["other", "misc"],
  },
};
