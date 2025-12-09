/**
 * 智能分类调试工具 - Mock 用户场景
 *
 * 提供不同用户阶段的模拟数据，用于测试分类效果
 */

import type { DebugScenario, MockScenarioData } from "../types/debugger.types";

/**
 * Mock 场景数据集
 */
export const MOCK_SCENARIOS: Record<DebugScenario, MockScenarioData> = {
  /**
   * 冷启动用户 - 无任何历史数据
   */
  "cold-start": {
    userId: "debug-user-cold-start",
    description: "新用户，无历史数据，完全依赖通用分类和 AI 推理",
    folders: [],
    classificationHistory: [],
    profile: {
      scenario: "cold_start",
      totalBookmarks: 0,
    },
  },

  /**
   * 学习期用户 - 少量数据，正在学习偏好
   */
  learning: {
    userId: "debug-user-learning",
    description: "学习期用户，有少量文件夹和历史，偏好尚未完全建立",
    folders: [
      {
        id: "mock-folder-1",
        name: "前端开发",
        bookmarkCount: 8,
        topTags: ["React", "JavaScript", "CSS"],
      },
      {
        id: "mock-folder-2",
        name: "后端技术",
        bookmarkCount: 5,
        topTags: ["Node.js", "API", "数据库"],
      },
      {
        id: "mock-folder-3",
        name: "人工智能",
        bookmarkCount: 3,
        topTags: ["机器学习", "深度学习", "AI"],
      },
      {
        id: "mock-folder-4",
        name: "设计资源",
        bookmarkCount: 2,
        topTags: ["UI", "设计", "Figma"],
      },
    ],
    classificationHistory: [
      {
        title: "React 18 新特性详解",
        folderId: "mock-folder-1",
        confidence: 85,
      },
      {
        title: "TypeScript 入门指南",
        folderId: "mock-folder-1",
        confidence: 78,
      },
      { title: "Node.js 性能优化", folderId: "mock-folder-2", confidence: 82 },
      { title: "GPT-4 技术解析", folderId: "mock-folder-3", confidence: 88 },
      { title: "Tailwind CSS 实践", folderId: "mock-folder-1", confidence: 75 },
    ],
    profile: {
      scenario: "learning",
      totalBookmarks: 18,
      mainInterests: ["前端开发", "后端技术"],
    },
  },

  /**
   * 成熟用户 - 丰富数据，偏好明确
   */
  mature: {
    userId: "debug-user-mature",
    description: "成熟用户，有丰富的文件夹和历史，偏好清晰稳定",
    folders: [
      {
        id: "mock-folder-1",
        name: "React 生态",
        bookmarkCount: 45,
        topTags: ["React", "Next.js", "Redux", "Hooks"],
      },
      {
        id: "mock-folder-2",
        name: "Node.js 后端",
        bookmarkCount: 32,
        topTags: ["Node.js", "Express", "NestJS", "TypeScript"],
      },
      {
        id: "mock-folder-3",
        name: "AI & 机器学习",
        bookmarkCount: 28,
        topTags: ["机器学习", "深度学习", "PyTorch", "LLM"],
      },
      {
        id: "mock-folder-4",
        name: "DevOps 工具",
        bookmarkCount: 22,
        topTags: ["Docker", "Kubernetes", "CI/CD", "云服务"],
      },
      {
        id: "mock-folder-5",
        name: "数据库技术",
        bookmarkCount: 18,
        topTags: ["PostgreSQL", "MongoDB", "Redis", "SQL"],
      },
      {
        id: "mock-folder-6",
        name: "产品设计",
        bookmarkCount: 15,
        topTags: ["产品", "设计", "用户体验", "原型"],
      },
      {
        id: "mock-folder-7",
        name: "阅读收藏",
        bookmarkCount: 25,
        topTags: ["文章", "思考", "行业"],
      },
      {
        id: "mock-folder-8",
        name: "工具资源",
        bookmarkCount: 35,
        topTags: ["工具", "效率", "开发工具"],
      },
    ],
    classificationHistory: [
      {
        title: "React Server Components 深度解析",
        folderId: "mock-folder-1",
        confidence: 92,
      },
      {
        title: "Next.js 14 App Router 最佳实践",
        folderId: "mock-folder-1",
        confidence: 95,
      },
      {
        title: "NestJS 微服务架构设计",
        folderId: "mock-folder-2",
        confidence: 88,
      },
      {
        title: "Transformer 模型详解",
        folderId: "mock-folder-3",
        confidence: 90,
      },
      {
        title: "Claude API 使用指南",
        folderId: "mock-folder-3",
        confidence: 87,
      },
      {
        title: "Kubernetes 生产环境部署",
        folderId: "mock-folder-4",
        confidence: 91,
      },
      {
        title: "PostgreSQL 性能调优",
        folderId: "mock-folder-5",
        confidence: 89,
      },
      {
        title: "产品需求文档撰写指南",
        folderId: "mock-folder-6",
        confidence: 85,
      },
      {
        title: "VS Code 插件推荐 2024",
        folderId: "mock-folder-8",
        confidence: 82,
      },
      { title: "技术团队管理心得", folderId: "mock-folder-7", confidence: 78 },
    ],
    profile: {
      scenario: "mature",
      totalBookmarks: 220,
      mainInterests: ["React 生态", "Node.js 后端", "AI & 机器学习"],
    },
  },

  /**
   * 只读真实数据 - 使用当前用户数据但不写入
   */
  "real-readonly": {
    userId: "__CURRENT_USER__", // 特殊标记，运行时替换为实际用户 ID
    description: "使用当前登录用户的真实数据，但不写入数据库",
    folders: [], // 运行时从数据库读取
    classificationHistory: [], // 运行时从数据库读取
    profile: {
      scenario: "mature", // 运行时检测
      totalBookmarks: 0, // 运行时计算
    },
    useRealData: true,
    dryRun: true, // 强制只读
  },
};

/**
 * 获取场景数据
 */
export function getScenarioData(scenario: DebugScenario): MockScenarioData {
  return MOCK_SCENARIOS[scenario];
}

/**
 * 获取场景列表（用于 UI 选择）
 */
export function getScenarioList(): Array<{
  key: DebugScenario;
  name: string;
  description: string;
}> {
  const scenarioNames: Record<DebugScenario, string> = {
    "cold-start": "冷启动用户",
    learning: "学习期用户",
    mature: "成熟用户",
    "real-readonly": "真实数据（只读）",
  };

  return (Object.keys(MOCK_SCENARIOS) as DebugScenario[]).map((key) => ({
    key,
    name: scenarioNames[key],
    description: MOCK_SCENARIOS[key].description,
  }));
}

/**
 * 检查是否需要使用真实数据
 */
export function needsRealData(scenario: DebugScenario): boolean {
  return MOCK_SCENARIOS[scenario].useRealData === true;
}
