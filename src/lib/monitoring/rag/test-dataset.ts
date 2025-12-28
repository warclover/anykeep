/**
 * RAG 评估测试数据集
 *
 * 包含各类测试用例，覆盖不同查询场景
 *
 * @module monitoring/rag/test-dataset
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { EvaluationTestCase } from "./types";

/**
 * 技术类查询测试用例
 */
export const TECHNICAL_TEST_CASES: EvaluationTestCase[] = [
  {
    id: "tech-001",
    query: "React Hooks 最佳实践",
    expectedKeywords: ["useState", "useEffect", "依赖数组", "自定义 Hook"],
    category: "technical",
    difficulty: "medium",
  },
  {
    id: "tech-002",
    query: "TypeScript 泛型如何使用",
    expectedKeywords: ["泛型", "类型参数", "约束", "推断"],
    category: "technical",
    difficulty: "hard",
  },
  {
    id: "tech-003",
    query: "Next.js 路由怎么配置",
    expectedKeywords: ["App Router", "pages", "动态路由", "layout"],
    category: "technical",
    difficulty: "easy",
  },
  {
    id: "tech-004",
    query: "Docker 容器和镜像的区别",
    expectedKeywords: ["镜像", "容器", "运行时", "层"],
    category: "technical",
    difficulty: "easy",
  },
  {
    id: "tech-005",
    query: "PostgreSQL 索引优化",
    expectedKeywords: ["B-tree", "索引", "EXPLAIN", "查询计划"],
    category: "technical",
    difficulty: "hard",
  },
];

/**
 * 产品/工具类查询测试用例
 */
export const PRODUCT_TEST_CASES: EvaluationTestCase[] = [
  {
    id: "prod-001",
    query: "微信公众号数据分析方法",
    expectedKeywords: ["阅读量", "用户画像", "内容分析", "数据统计"],
    category: "product",
    difficulty: "medium",
  },
  {
    id: "prod-002",
    query: "B站视频怎么下载",
    expectedKeywords: ["下载", "视频", "工具", "缓存"],
    category: "product",
    difficulty: "easy",
  },
  {
    id: "prod-003",
    query: "Notion 和 Obsidian 哪个好",
    expectedKeywords: ["笔记", "对比", "功能", "适合"],
    category: "product",
    difficulty: "medium",
  },
  {
    id: "prod-004",
    query: "小红书运营技巧",
    expectedKeywords: ["流量", "封面", "标题", "互动"],
    category: "product",
    difficulty: "medium",
  },
  {
    id: "prod-005",
    query: "AI 绘画工具推荐",
    expectedKeywords: ["Midjourney", "Stable Diffusion", "DALL-E", "生成"],
    category: "product",
    difficulty: "easy",
  },
];

/**
 * 模糊/口语化查询测试用例
 */
export const FUZZY_TEST_CASES: EvaluationTestCase[] = [
  {
    id: "fuzzy-001",
    query: "那个讲 React 的文章",
    expectedKeywords: ["React"],
    category: "fuzzy",
    difficulty: "hard",
  },
  {
    id: "fuzzy-002",
    query: "上周保存的关于 AI 的",
    expectedKeywords: ["AI", "人工智能"],
    category: "fuzzy",
    difficulty: "hard",
  },
  {
    id: "fuzzy-003",
    query: "Python 爬虫 怎么搞",
    expectedKeywords: ["爬虫", "requests", "BeautifulSoup", "Scrapy"],
    category: "fuzzy",
    difficulty: "medium",
  },
  {
    id: "fuzzy-004",
    query: "前端面试题",
    expectedKeywords: ["面试", "前端", "JavaScript", "CSS"],
    category: "fuzzy",
    difficulty: "easy",
  },
  {
    id: "fuzzy-005",
    query: "那个红色logo的app怎么用来着",
    expectedKeywords: [],
    category: "fuzzy",
    difficulty: "hard",
  },
];

/**
 * 分析/洞察类查询测试用例
 */
export const INSIGHT_TEST_CASES: EvaluationTestCase[] = [
  {
    id: "insight-001",
    query: "我最近收藏最多的是什么类型",
    expectedKeywords: ["统计", "类型", "分析"],
    category: "insight",
    difficulty: "medium",
  },
  {
    id: "insight-002",
    query: "总结一下我关于设计的收藏",
    expectedKeywords: ["设计", "UI", "UX", "总结"],
    category: "insight",
    difficulty: "hard",
  },
  {
    id: "insight-003",
    query: "有多少条收藏没有标签",
    expectedKeywords: ["标签", "统计", "数量"],
    category: "insight",
    difficulty: "easy",
  },
  {
    id: "insight-004",
    query: "这周保存了什么",
    expectedKeywords: ["本周", "最近"],
    category: "insight",
    difficulty: "medium",
  },
  {
    id: "insight-005",
    query: "帮我找出重复的收藏",
    expectedKeywords: ["重复", "去重", "相似"],
    category: "insight",
    difficulty: "medium",
  },
];

/**
 * 长文档定位查询测试用例
 */
export const LONG_DOC_TEST_CASES: EvaluationTestCase[] = [
  {
    id: "longdoc-001",
    query: "那篇文章第三章讲了什么",
    expectedKeywords: ["章节", "第三章"],
    category: "long_document",
    difficulty: "hard",
  },
  {
    id: "longdoc-002",
    query: "教程里关于部署的部分",
    expectedKeywords: ["部署", "教程", "步骤"],
    category: "long_document",
    difficulty: "medium",
  },
  {
    id: "longdoc-003",
    query: "代码示例在哪",
    expectedKeywords: ["代码", "示例", "example"],
    category: "long_document",
    difficulty: "medium",
  },
];

/**
 * 全部测试用例
 */
export const ALL_TEST_CASES: EvaluationTestCase[] = [
  ...TECHNICAL_TEST_CASES,
  ...PRODUCT_TEST_CASES,
  ...FUZZY_TEST_CASES,
  ...INSIGHT_TEST_CASES,
  ...LONG_DOC_TEST_CASES,
];

/**
 * 按难度获取测试用例
 */
export function getTestCasesByDifficulty(
  difficulty: "easy" | "medium" | "hard",
): EvaluationTestCase[] {
  return ALL_TEST_CASES.filter((tc) => tc.difficulty === difficulty);
}

/**
 * 按类别获取测试用例
 */
export function getTestCasesByCategory(category: string): EvaluationTestCase[] {
  return ALL_TEST_CASES.filter((tc) => tc.category === category);
}

/**
 * 获取快速评估测试集（每类各取 1 个）
 */
export function getQuickTestSet(): EvaluationTestCase[] {
  return [
    TECHNICAL_TEST_CASES[0],
    PRODUCT_TEST_CASES[0],
    FUZZY_TEST_CASES[0],
    INSIGHT_TEST_CASES[0],
    LONG_DOC_TEST_CASES[0],
  ];
}
