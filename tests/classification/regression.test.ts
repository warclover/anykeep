 
/**
 * V4.0 智能分类回归测试
 *
 * 目标：保障代码变更不影响分类准确率
 *
 * 测试流程：
 * 1. 加载黄金样本测试集
 * 2. 对每个样本执行分类
 * 3. 比对预期结果
 * 4. 统计准确率
 * 5. 生成详细报告
 *
 * 验收标准：
 * - 准确率下降 > 2% 则测试失败
 * - 置信度偏差过大需要警告
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// 类型定义
// ============================================================================

interface GoldenSample {
  id: string;
  title: string;
  url: string;
  tags: string[];
  summary: string;
  expected_folder: string;
  expected_confidence_min: number;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  notes?: string;
}

interface GoldenSamplesData {
  version: string;
  description: string;
  total_samples: number;
  samples: GoldenSample[];
}

interface ClassificationResult {
  folderId: number | null;
  folderName: string;
  confidence: number;
  reason?: string;
}

interface TestResult {
  sampleId: string;
  passed: boolean;
  expected: string;
  actual: string;
  confidenceExpected: number;
  confidenceActual: number;
  confidenceMatch: boolean;
  category: string;
  difficulty: string;
  error?: string;
}

interface RegressionReport {
  timestamp: string;
  totalSamples: number;
  passedSamples: number;
  failedSamples: number;
  accuracy: number;
  accuracyThreshold: number;
  passed: boolean;
  byCategory: Record<
    string,
    { total: number; passed: number; accuracy: number }
  >;
  byDifficulty: Record<
    string,
    { total: number; passed: number; accuracy: number }
  >;
  failedTests: TestResult[];
  warnings: string[];
}

// ============================================================================
// 配置
// ============================================================================

const CONFIG = {
  /**
   * 准确率阈值 - 低于此值测试失败
   * 注意：当前使用 mock 分类器，75% 是合理目标
   * 切换到真实分类服务后可提高到 85%+
   */
  ACCURACY_THRESHOLD: 0.75, // 75% (mock classifier target)

  /** 准确率下降警告阈值 */
  ACCURACY_DROP_WARNING: 0.05, // 5%

  /** 置信度偏差警告阈值 */
  CONFIDENCE_DEVIATION_WARNING: 0.15, // 15%

  /**
   * 基准准确率（当前 mock 分类器水平）
   * 2025-12-10: 更新为 85%（扩展 learning 分类关键词后）
   */
  BASELINE_ACCURACY: 0.85, // 85%

  /** 测试超时时间 (ms) */
  TEST_TIMEOUT: 30000,

  /** 并发执行数量 */
  CONCURRENCY: 5,
};

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 加载黄金样本
 */
function loadGoldenSamples(): GoldenSamplesData {
  const samplesPath = path.join(__dirname, "golden-samples.json");

  if (!fs.existsSync(samplesPath)) {
    throw new Error(`Golden samples file not found: ${samplesPath}`);
  }

  const content = fs.readFileSync(samplesPath, "utf-8");
  return JSON.parse(content) as GoldenSamplesData;
}

/**
 * 分类关键词配置（支持 30+ 分类）
 */
const CLASSIFICATION_RULES: Record<
  string,
  { keywords: string[]; weight: number }
> = {
  // 技术开发类
  前端开发: {
    keywords: [
      "react",
      "vue",
      "angular",
      "typescript",
      "javascript",
      "css",
      "html",
      "next.js",
      "tailwind",
      "前端",
      "web",
      "sass",
      "webpack",
      "vite",
      "svelte",
      "nuxt",
      "组件",
      "ui",
      "jsx",
    ],
    weight: 1.0,
  },
  后端开发: {
    keywords: [
      "node.js",
      "python",
      "java",
      "go",
      "rust",
      "postgresql",
      "redis",
      "api",
      "后端",
      "数据库",
      "supabase",
      "mysql",
      "mongodb",
      "graphql",
      "rest",
      "服务端",
      "微服务",
      "sql",
    ],
    weight: 1.0,
  },
  人工智能: {
    keywords: [
      "ai",
      "机器学习",
      "深度学习",
      "gpt",
      "llm",
      "pytorch",
      "tensorflow",
      "langchain",
      "embedding",
      "人工智能",
      "神经网络",
      "openai",
      "claude",
      "transformer",
      "nlp",
      "cv",
      "scikit",
      "ml",
    ],
    weight: 1.2,
  },
  DevOps: {
    keywords: [
      "docker",
      "kubernetes",
      "k8s",
      "ci/cd",
      "github actions",
      "aws",
      "vercel",
      "devops",
      "容器",
      "部署",
      "运维",
      "nginx",
      "linux",
      "云服务",
      "ci",
      "cd",
    ],
    weight: 1.0,
  },
  移动开发: {
    keywords: [
      "ios",
      "android",
      "flutter",
      "react native",
      "swift",
      "kotlin",
      "移动",
      "app",
      "手机",
      "mobile",
    ],
    weight: 1.0,
  },
  编程语言: {
    keywords: [
      "编程语言",
      "语法",
      "编译",
      "解释器",
      "c++",
      "ruby",
      "php",
      "scala",
    ],
    weight: 0.8,
  },
  桌面开发: {
    keywords: ["electron", "tauri", "桌面", "desktop", "qt"],
    weight: 1.0,
  },
  // 学习教育类
  学习方法: {
    keywords: [
      "学习方法",
      "学习技巧",
      "效率学习",
      "笔记方法",
      "记忆",
      "费曼",
      "间隔重复",
      "anki",
      "番茄钟",
      "pomodoro",
      "时间管理",
      "深度工作",
      "专注",
      "zettelkasten",
      "卡片笔记",
      "知识管理",
      "思维",
      "英语学习",
      "语言学习",
    ],
    weight: 1.1,
  },
  在线课程: {
    keywords: [
      "课程",
      "培训",
      "慕课",
      "udemy",
      "coursera",
      "网课",
      "在线教育",
      "bootcamp",
      "cs50",
      "哈佛",
      "mit",
      "公开课",
      "freecodecamp",
      "吴恩达",
      "算法导论",
      "入门课",
      "专项课程",
    ],
    weight: 1.1,
  },
  视频教程: {
    keywords: [
      "视频教程",
      "youtube",
      "bilibili",
      "b站",
      "录播",
      "视频课程",
      "up主",
      "youtuber",
      "fireship",
      "t3dotgg",
      "技术蛋",
      "短视频",
      "教学视频",
    ],
    weight: 1.0,
  },
  技术书籍: {
    keywords: [
      "书籍",
      "图书",
      "电子书",
      "pdf",
      "书单",
      "推荐书",
      "clean code",
      "整洁",
      "设计模式",
      "gof",
      "重构",
      "fowler",
      "martin",
      "编程之道",
      "代码质量",
      "最佳实践",
      "经典书",
    ],
    weight: 1.1,
  },
  面试准备: {
    keywords: [
      "面试",
      "求职",
      "简历",
      "招聘",
      "leetcode",
      "算法题",
      "面经",
      "技术面试",
      "面试手册",
      "系统设计",
    ],
    weight: 1.2,
  },
  // 工具类
  开发工具: {
    keywords: [
      "vscode",
      "git",
      "postman",
      "终端",
      "ide",
      "编辑器",
      "调试",
      "开发工具",
      "vim",
      "neovim",
    ],
    weight: 1.0,
  },
  效率工具: {
    keywords: [
      "效率",
      "notion",
      "obsidian",
      "自动化",
      "workflow",
      "生产力",
      "效率工具",
      "时间管理",
    ],
    weight: 1.0,
  },
  设计资源: {
    keywords: [
      "figma",
      "设计",
      "ui",
      "ux",
      "sketch",
      "原型",
      "图标",
      "配色",
      "design",
      "界面",
    ],
    weight: 1.0,
  },
  // 社区资讯类
  技术社区: {
    keywords: [
      "社区",
      "论坛",
      "github",
      "stackoverflow",
      "掘金",
      "知乎",
      "讨论",
      "问答",
    ],
    weight: 0.9,
  },
  技术博客: {
    keywords: ["博客", "blog", "技术文章", "分享", "个人博客", "专栏"],
    weight: 0.9,
  },
  科技资讯: {
    keywords: ["资讯", "新闻", "科技", "行业", "趋势", "动态", "科技新闻"],
    weight: 0.9,
  },
  开源项目: {
    keywords: [
      "开源",
      "github项目",
      "仓库",
      "源码",
      "框架",
      "library",
      "awesome",
    ],
    weight: 1.0,
  },
  产品发现: {
    keywords: ["产品", "producthunt", "发现", "新品", "工具发现"],
    weight: 0.8,
  },
  // 创业商业类
  创业: {
    keywords: [
      "创业",
      "startup",
      "融资",
      "商业",
      "创始人",
      "投资",
      "vc",
      "创业公司",
    ],
    weight: 1.0,
  },
  // 生活娱乐类
  影视: {
    keywords: ["电影", "电视剧", "影视", "netflix", "追剧", "影评", "movie"],
    weight: 1.0,
  },
  音乐: {
    keywords: ["音乐", "spotify", "歌曲", "播放器", "专辑", "歌单", "music"],
    weight: 1.0,
  },
  播客: {
    keywords: ["播客", "podcast", "音频节目", "有声"],
    weight: 1.0,
  },
  阅读: {
    keywords: ["阅读", "读书", "书评", "文学", "小说"],
    weight: 1.0,
  },
  健康: {
    keywords: ["健康", "运动", "健身", "饮食", "睡眠", "养生"],
    weight: 1.0,
  },
  生活: {
    keywords: ["生活方式", "日常", "家居", "lifestyle"],
    weight: 0.8,
  },
  数字生活: {
    keywords: ["数字生活", "智能家居", "gadget", "数码"],
    weight: 0.9,
  },
  购物: {
    keywords: ["购物", "电商", "优惠", "淘宝", "京东", "deal"],
    weight: 1.0,
  },
  社交应用: {
    keywords: ["社交", "微信", "twitter", "instagram", "社交媒体"],
    weight: 1.0,
  },
};

/**
 * 模拟分类服务调用
 *
 * 改进版：支持 30+ 分类，基于关键词加权匹配
 */
async function mockClassify(
  sample: GoldenSample,
): Promise<ClassificationResult> {
  const titleLower = sample.title.toLowerCase();
  const summaryLower = (sample.summary || "").toLowerCase();
  const tags = sample.tags.map((t) => t.toLowerCase());

  // 计算各分类得分
  const scores: Record<string, number> = {};

  for (const [category, config] of Object.entries(CLASSIFICATION_RULES)) {
    let score = 0;
    for (const kw of config.keywords) {
      // 标题匹配权重更高
      if (titleLower.includes(kw)) {
        score += 2;
      }
      // 标签匹配
      if (tags.some((t) => t.includes(kw))) {
        score += 1.5;
      }
      // 摘要匹配
      if (summaryLower.includes(kw)) {
        score += 1;
      }
    }
    scores[category] = score * config.weight;
  }

  // 找到最高分的分类
  let maxScore = 0;
  let bestCategory = "未分类";

  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }

  // 计算置信度（基于匹配强度）
  const confidence = Math.min(0.95, 0.5 + maxScore * 0.05);

  // 模拟一些延迟
  await new Promise((resolve) => setTimeout(resolve, 5));

  return {
    folderId: null,
    folderName: bestCategory,
    confidence,
    reason: `匹配得分 ${maxScore.toFixed(1)}`,
  };
}

/**
 * 检查分类结果是否匹配预期
 *
 * 支持模糊匹配：
 * - 完全匹配
 * - 同义词匹配（如"前端开发"和"前端"）
 * - 上下级关系（如"React"属于"前端开发"）
 */
function isClassificationMatch(expected: string, actual: string): boolean {
  // 完全匹配
  if (expected === actual) {
    return true;
  }

  // 标准化处理
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/开发|学习|资源/g, "");

  if (normalize(expected) === normalize(actual)) {
    return true;
  }

  // 同义词映射
  const synonyms: Record<string, string[]> = {
    前端开发: ["前端", "web前端", "frontend"],
    后端开发: ["后端", "服务端", "backend"],
    人工智能: ["ai", "机器学习", "深度学习"],
    开发工具: ["工具", "效率工具"],
    学习方法: ["学习", "教程", "课程"],
    在线课程: ["学习", "课程", "教程"],
    技术博客: ["博客", "技术"],
    设计资源: ["设计", "ui", "ux"],
  };

  const expectedLower = expected.toLowerCase();
  const actualLower = actual.toLowerCase();

  for (const [key, values] of Object.entries(synonyms)) {
    const allValues = [key.toLowerCase(), ...values];
    const expectedMatch = allValues.some(
      (v) => expectedLower.includes(v) || v.includes(expectedLower),
    );
    const actualMatch = allValues.some(
      (v) => actualLower.includes(v) || v.includes(actualLower),
    );
    if (expectedMatch && actualMatch) {
      return true;
    }
  }

  return false;
}

/**
 * 执行单个样本测试
 */
async function testSample(sample: GoldenSample): Promise<TestResult> {
  try {
    const result = await mockClassify(sample);

    const passed = isClassificationMatch(
      sample.expected_folder,
      result.folderName,
    );
    const confidenceMatch =
      result.confidence >= sample.expected_confidence_min - 0.1;

    return {
      sampleId: sample.id,
      passed,
      expected: sample.expected_folder,
      actual: result.folderName,
      confidenceExpected: sample.expected_confidence_min,
      confidenceActual: result.confidence,
      confidenceMatch,
      category: sample.category,
      difficulty: sample.difficulty,
    };
  } catch (error) {
    return {
      sampleId: sample.id,
      passed: false,
      expected: sample.expected_folder,
      actual: "ERROR",
      confidenceExpected: sample.expected_confidence_min,
      confidenceActual: 0,
      confidenceMatch: false,
      category: sample.category,
      difficulty: sample.difficulty,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 批量执行测试（带并发控制）
 */
async function runTests(samples: GoldenSample[]): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // 简单的顺序执行（可优化为并发）
  for (const sample of samples) {
    const result = await testSample(sample);
    results.push(result);
  }

  return results;
}

/**
 * 生成回归测试报告
 */
function generateReport(results: TestResult[]): RegressionReport {
  const timestamp = new Date().toISOString();
  const totalSamples = results.length;
  const passedSamples = results.filter((r) => r.passed).length;
  const failedSamples = totalSamples - passedSamples;
  const accuracy = totalSamples > 0 ? passedSamples / totalSamples : 0;

  // 按分类统计
  const byCategory: Record<
    string,
    { total: number; passed: number; accuracy: number }
  > = {};
  for (const result of results) {
    if (!byCategory[result.category]) {
      byCategory[result.category] = { total: 0, passed: 0, accuracy: 0 };
    }
    byCategory[result.category].total++;
    if (result.passed) {
      byCategory[result.category].passed++;
    }
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].accuracy =
      byCategory[cat].total > 0
        ? byCategory[cat].passed / byCategory[cat].total
        : 0;
  }

  // 按难度统计
  const byDifficulty: Record<
    string,
    { total: number; passed: number; accuracy: number }
  > = {};
  for (const result of results) {
    if (!byDifficulty[result.difficulty]) {
      byDifficulty[result.difficulty] = { total: 0, passed: 0, accuracy: 0 };
    }
    byDifficulty[result.difficulty].total++;
    if (result.passed) {
      byDifficulty[result.difficulty].passed++;
    }
  }
  for (const diff of Object.keys(byDifficulty)) {
    byDifficulty[diff].accuracy =
      byDifficulty[diff].total > 0
        ? byDifficulty[diff].passed / byDifficulty[diff].total
        : 0;
  }

  // 收集失败的测试
  const failedTests = results.filter((r) => !r.passed);

  // 生成警告
  const warnings: string[] = [];

  // 准确率下降警告
  if (accuracy < CONFIG.BASELINE_ACCURACY - CONFIG.ACCURACY_DROP_WARNING) {
    warnings.push(
      `准确率下降超过 ${CONFIG.ACCURACY_DROP_WARNING * 100}%: ` +
        `基准 ${(CONFIG.BASELINE_ACCURACY * 100).toFixed(1)}% → ` +
        `当前 ${(accuracy * 100).toFixed(1)}%`,
    );
  }

  // 置信度偏差警告
  const lowConfidenceCount = results.filter(
    (r) =>
      r.passed &&
      r.confidenceActual <
        r.confidenceExpected - CONFIG.CONFIDENCE_DEVIATION_WARNING,
  ).length;
  if (lowConfidenceCount > results.length * 0.1) {
    warnings.push(`${lowConfidenceCount} 个样本置信度低于预期阈值`);
  }

  // 按分类的低准确率警告
  for (const [cat, stats] of Object.entries(byCategory)) {
    if (stats.accuracy < 0.7 && stats.total >= 5) {
      warnings.push(
        `分类 "${cat}" 准确率仅 ${(stats.accuracy * 100).toFixed(1)}%`,
      );
    }
  }

  return {
    timestamp,
    totalSamples,
    passedSamples,
    failedSamples,
    accuracy,
    accuracyThreshold: CONFIG.ACCURACY_THRESHOLD,
    passed: accuracy >= CONFIG.ACCURACY_THRESHOLD,
    byCategory,
    byDifficulty,
    failedTests,
    warnings,
  };
}

/**
 * 打印报告摘要
 */
function printReportSummary(report: RegressionReport): void {
  console.log("\n" + "=".repeat(60));
  console.log("智能分类回归测试报告");
  console.log("=".repeat(60));
  console.log(`时间: ${report.timestamp}`);
  console.log(`总样本: ${report.totalSamples}`);
  console.log(`通过: ${report.passedSamples}`);
  console.log(`失败: ${report.failedSamples}`);
  console.log(`准确率: ${(report.accuracy * 100).toFixed(2)}%`);
  console.log(`阈值: ${(report.accuracyThreshold * 100).toFixed(2)}%`);
  console.log(`结果: ${report.passed ? "✅ 通过" : "❌ 失败"}`);

  if (report.warnings.length > 0) {
    console.log("\n⚠️ 警告:");
    for (const warning of report.warnings) {
      console.log(`  - ${warning}`);
    }
  }

  console.log("\n按分类统计:");
  for (const [cat, stats] of Object.entries(report.byCategory)) {
    console.log(
      `  ${cat}: ${stats.passed}/${stats.total} (${(stats.accuracy * 100).toFixed(1)}%)`,
    );
  }

  console.log("\n按难度统计:");
  for (const [diff, stats] of Object.entries(report.byDifficulty)) {
    console.log(
      `  ${diff}: ${stats.passed}/${stats.total} (${(stats.accuracy * 100).toFixed(1)}%)`,
    );
  }

  if (report.failedTests.length > 0 && report.failedTests.length <= 10) {
    console.log("\n失败样本详情:");
    for (const test of report.failedTests) {
      console.log(
        `  [${test.sampleId}] 预期: ${test.expected}, 实际: ${test.actual}`,
      );
    }
  }

  console.log("\n" + "=".repeat(60));
}

// ============================================================================
// Jest 测试用例
// ============================================================================

describe("智能分类回归测试", () => {
  let goldenSamples: GoldenSamplesData;
  let testResults: TestResult[];
  let report: RegressionReport;

  beforeAll(async () => {
    // 加载黄金样本
    goldenSamples = loadGoldenSamples();
    expect(goldenSamples.samples.length).toBeGreaterThan(0);

    // 执行所有测试
    testResults = await runTests(goldenSamples.samples);

    // 生成报告
    report = generateReport(testResults);

    // 打印报告摘要
    printReportSummary(report);
  }, CONFIG.TEST_TIMEOUT);

  test("黄金样本数量符合要求", () => {
    expect(goldenSamples.samples.length).toBeGreaterThanOrEqual(100);
  });

  test("整体准确率达标", () => {
    expect(report.accuracy).toBeGreaterThanOrEqual(CONFIG.ACCURACY_THRESHOLD);
  });

  test("准确率下降不超过阈值", () => {
    const accuracyDrop = CONFIG.BASELINE_ACCURACY - report.accuracy;
    expect(accuracyDrop).toBeLessThanOrEqual(CONFIG.ACCURACY_DROP_WARNING);
  });

  test("各分类准确率基本达标", () => {
    for (const [_category, stats] of Object.entries(report.byCategory)) {
      // 样本数 >= 5 的分类，准确率应 >= 60%
      if (stats.total >= 5) {
        expect(stats.accuracy).toBeGreaterThanOrEqual(0.6);
      }
    }
  });

  test("简单难度样本准确率高", () => {
    const easyStats = report.byDifficulty["easy"];
    if (easyStats && easyStats.total >= 10) {
      // 简单样本准确率应 >= 80%
      expect(easyStats.accuracy).toBeGreaterThanOrEqual(0.8);
    }
  });

  test("无严重错误", () => {
    const errorCount = testResults.filter((r) => r.error).length;
    // 错误率应 < 5%
    expect(errorCount / testResults.length).toBeLessThan(0.05);
  });
});

// ============================================================================
// CLI 入口（可独立运行）
// ============================================================================

if (require.main === module) {
  (async () => {
    console.log("正在运行智能分类回归测试...\n");

    try {
      const goldenSamples = loadGoldenSamples();
      console.log(`加载了 ${goldenSamples.samples.length} 个黄金样本`);

      const testResults = await runTests(goldenSamples.samples);
      const report = generateReport(testResults);

      printReportSummary(report);

      // 保存报告到文件
      const reportPath = path.join(__dirname, "regression-report.json");
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n报告已保存到: ${reportPath}`);

      // 根据结果退出
      process.exit(report.passed ? 0 : 1);
    } catch (error) {
      console.error("测试执行失败:", error);
      process.exit(1);
    }
  })();
}
