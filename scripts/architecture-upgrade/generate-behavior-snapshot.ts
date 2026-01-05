/**
 * 行为快照生成脚本
 *
 * 在架构升级前运行此脚本，生成当前意图分类器的行为基线
 * 升级后使用 verify-behavior-snapshot.ts 验证行为一致性
 *
 * 执行方式：
 * npx ts-node scripts/architecture-upgrade/generate-behavior-snapshot.ts
 *
 * @version 1.0.0
 * @date 2026-01-05
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// 测试用例配置
// ============================================================================

interface TestCase {
  id: string;
  category: string;
  input: string;
  context: {
    bookmarkCount: number;
    selectedBookmarks?: number;
    hasActiveTags?: boolean;
    recentPlatform?: string;
  };
}

/**
 * 测试用例集
 * 覆盖所有意图类型和边缘情况
 */
const TEST_CASES: TestCase[] = [
  // ============================================================================
  // 搜索类意图 (search)
  // ============================================================================
  {
    id: "search-001",
    category: "search",
    input: "搜索 AI 相关文章",
    context: { bookmarkCount: 100 },
  },
  {
    id: "search-002",
    category: "search",
    input: "找一下上周收藏的",
    context: { bookmarkCount: 100 },
  },
  {
    id: "search-003",
    category: "search",
    input: "有没有关于 React 的收藏",
    context: { bookmarkCount: 200 },
  },
  {
    id: "search-004",
    category: "search",
    input: "查找技术博客",
    context: { bookmarkCount: 50 },
  },
  {
    id: "search-005",
    category: "search",
    input: "我之前收藏过一篇讲 TypeScript 的",
    context: { bookmarkCount: 300 },
  },
  {
    id: "search-006",
    category: "search",
    input: "找找微信公众号的文章",
    context: { bookmarkCount: 150, recentPlatform: "wechat" },
  },
  {
    id: "search-007",
    category: "search",
    input: "搜索带有'机器学习'标签的",
    context: { bookmarkCount: 100, hasActiveTags: true },
  },
  {
    id: "search-008",
    category: "search",
    input: "哪些是今天收藏的",
    context: { bookmarkCount: 80 },
  },
  {
    id: "search-009",
    category: "search",
    input: "显示所有 B 站视频",
    context: { bookmarkCount: 200, recentPlatform: "bilibili" },
  },
  {
    id: "search-010",
    category: "search",
    input: "我要找之前看过的那个教程",
    context: { bookmarkCount: 100 },
  },

  // ============================================================================
  // 管理类意图 (manage)
  // ============================================================================
  {
    id: "manage-001",
    category: "manage",
    input: "整理书签",
    context: { bookmarkCount: 500 },
  },
  {
    id: "manage-002",
    category: "manage",
    input: "删除重复的",
    context: { bookmarkCount: 500 },
  },
  {
    id: "manage-003",
    category: "manage",
    input: "把这些移动到技术文件夹",
    context: { bookmarkCount: 100, selectedBookmarks: 5 },
  },
  {
    id: "manage-004",
    category: "manage",
    input: "给选中的添加标签",
    context: { bookmarkCount: 200, selectedBookmarks: 10 },
  },
  {
    id: "manage-005",
    category: "manage",
    input: "清理失效链接",
    context: { bookmarkCount: 300 },
  },
  {
    id: "manage-006",
    category: "manage",
    input: "批量删除这些",
    context: { bookmarkCount: 100, selectedBookmarks: 20 },
  },
  {
    id: "manage-007",
    category: "manage",
    input: "归档三个月前的收藏",
    context: { bookmarkCount: 500 },
  },
  {
    id: "manage-008",
    category: "manage",
    input: "创建一个新文件夹",
    context: { bookmarkCount: 100 },
  },
  {
    id: "manage-009",
    category: "manage",
    input: "重命名这个标签",
    context: { bookmarkCount: 100, hasActiveTags: true },
  },
  {
    id: "manage-010",
    category: "manage",
    input: "合并相似的标签",
    context: { bookmarkCount: 200, hasActiveTags: true },
  },

  // ============================================================================
  // 分析类意图 (analyze)
  // ============================================================================
  {
    id: "analyze-001",
    category: "analyze",
    input: "分析我的收藏趋势",
    context: { bookmarkCount: 200 },
  },
  {
    id: "analyze-002",
    category: "analyze",
    input: "生成阅读报告",
    context: { bookmarkCount: 200 },
  },
  {
    id: "analyze-003",
    category: "analyze",
    input: "看看我最常收藏哪类内容",
    context: { bookmarkCount: 300 },
  },
  {
    id: "analyze-004",
    category: "analyze",
    input: "统计各平台收藏数量",
    context: { bookmarkCount: 150 },
  },
  {
    id: "analyze-005",
    category: "analyze",
    input: "分析标签使用情况",
    context: { bookmarkCount: 200, hasActiveTags: true },
  },
  {
    id: "analyze-006",
    category: "analyze",
    input: "生成周报",
    context: { bookmarkCount: 100 },
  },
  {
    id: "analyze-007",
    category: "analyze",
    input: "我的阅读习惯是什么",
    context: { bookmarkCount: 250 },
  },
  {
    id: "analyze-008",
    category: "analyze",
    input: "哪些收藏从来没看过",
    context: { bookmarkCount: 400 },
  },
  {
    id: "analyze-009",
    category: "analyze",
    input: "分析内容质量",
    context: { bookmarkCount: 150 },
  },
  {
    id: "analyze-010",
    category: "analyze",
    input: "推荐我接下来应该看什么",
    context: { bookmarkCount: 200 },
  },

  // ============================================================================
  // 导出类意图 (export)
  // ============================================================================
  {
    id: "export-001",
    category: "export",
    input: "导出书签",
    context: { bookmarkCount: 100 },
  },
  {
    id: "export-002",
    category: "export",
    input: "备份到 Obsidian",
    context: { bookmarkCount: 200 },
  },
  {
    id: "export-003",
    category: "export",
    input: "导出为 CSV",
    context: { bookmarkCount: 150 },
  },
  {
    id: "export-004",
    category: "export",
    input: "下载选中的收藏",
    context: { bookmarkCount: 100, selectedBookmarks: 15 },
  },
  {
    id: "export-005",
    category: "export",
    input: "生成 Markdown 文件",
    context: { bookmarkCount: 80 },
  },
  {
    id: "export-006",
    category: "export",
    input: "导出这个文件夹",
    context: { bookmarkCount: 50 },
  },
  {
    id: "export-007",
    category: "export",
    input: "打包所有 AI 相关收藏",
    context: { bookmarkCount: 200 },
  },
  {
    id: "export-008",
    category: "export",
    input: "分享给朋友",
    context: { bookmarkCount: 30 },
  },
  {
    id: "export-009",
    category: "export",
    input: "导出浏览器书签格式",
    context: { bookmarkCount: 100 },
  },
  {
    id: "export-010",
    category: "export",
    input: "保存为 JSON",
    context: { bookmarkCount: 120 },
  },

  // ============================================================================
  // 查询类意图 (query)
  // ============================================================================
  {
    id: "query-001",
    category: "query",
    input: "我有多少收藏",
    context: { bookmarkCount: 100 },
  },
  {
    id: "query-002",
    category: "query",
    input: "统计标签数量",
    context: { bookmarkCount: 150, hasActiveTags: true },
  },
  {
    id: "query-003",
    category: "query",
    input: "最近收藏了几篇",
    context: { bookmarkCount: 80 },
  },
  {
    id: "query-004",
    category: "query",
    input: "有多少个文件夹",
    context: { bookmarkCount: 200 },
  },
  {
    id: "query-005",
    category: "query",
    input: "微信公众号收藏占比多少",
    context: { bookmarkCount: 300, recentPlatform: "wechat" },
  },
  {
    id: "query-006",
    category: "query",
    input: "这周收藏了多少",
    context: { bookmarkCount: 100 },
  },
  {
    id: "query-007",
    category: "query",
    input: "我的存储空间使用情况",
    context: { bookmarkCount: 500 },
  },
  {
    id: "query-008",
    category: "query",
    input: "哪个平台收藏最多",
    context: { bookmarkCount: 250 },
  },
  {
    id: "query-009",
    category: "query",
    input: "未分类的有多少",
    context: { bookmarkCount: 200 },
  },
  {
    id: "query-010",
    category: "query",
    input: "显示收藏数量趋势",
    context: { bookmarkCount: 300 },
  },

  // ============================================================================
  // 创建类意图 (create)
  // ============================================================================
  {
    id: "create-001",
    category: "create",
    input: "添加新收藏",
    context: { bookmarkCount: 100 },
  },
  {
    id: "create-002",
    category: "create",
    input: "收藏这个链接",
    context: { bookmarkCount: 150 },
  },
  {
    id: "create-003",
    category: "create",
    input: "帮我收藏 https://example.com",
    context: { bookmarkCount: 80 },
  },
  {
    id: "create-004",
    category: "create",
    input: "新建标签",
    context: { bookmarkCount: 100 },
  },
  {
    id: "create-005",
    category: "create",
    input: "创建智能列表",
    context: { bookmarkCount: 200 },
  },

  // ============================================================================
  // 学习类意图 (learn)
  // ============================================================================
  {
    id: "learn-001",
    category: "learn",
    input: "开始复习",
    context: { bookmarkCount: 100 },
  },
  {
    id: "learn-002",
    category: "learn",
    input: "今日复习计划",
    context: { bookmarkCount: 150 },
  },
  {
    id: "learn-003",
    category: "learn",
    input: "生成学习路径",
    context: { bookmarkCount: 200 },
  },
  {
    id: "learn-004",
    category: "learn",
    input: "提取知识点",
    context: { bookmarkCount: 80 },
  },
  {
    id: "learn-005",
    category: "learn",
    input: "帮我整理这些知识",
    context: { bookmarkCount: 100, selectedBookmarks: 8 },
  },

  // ============================================================================
  // 设置类意图 (settings)
  // ============================================================================
  {
    id: "settings-001",
    category: "settings",
    input: "修改偏好设置",
    context: { bookmarkCount: 100 },
  },
  {
    id: "settings-002",
    category: "settings",
    input: "调整 AI 模式",
    context: { bookmarkCount: 100 },
  },
  {
    id: "settings-003",
    category: "settings",
    input: "切换信任模式",
    context: { bookmarkCount: 100 },
  },
  {
    id: "settings-004",
    category: "settings",
    input: "设置默认分类",
    context: { bookmarkCount: 150 },
  },
  {
    id: "settings-005",
    category: "settings",
    input: "关闭自动同步",
    context: { bookmarkCount: 100 },
  },

  // ============================================================================
  // 边缘情况
  // ============================================================================
  {
    id: "edge-001",
    category: "ambiguous",
    input: "帮帮我",
    context: { bookmarkCount: 100 },
  },
  {
    id: "edge-002",
    category: "ambiguous",
    input: "不知道",
    context: { bookmarkCount: 100 },
  },
  {
    id: "edge-003",
    category: "ambiguous",
    input: "那个",
    context: { bookmarkCount: 100 },
  },
  {
    id: "edge-004",
    category: "ambiguous",
    input: "继续",
    context: { bookmarkCount: 100 },
  },
  {
    id: "edge-005",
    category: "ambiguous",
    input: "",
    context: { bookmarkCount: 100 },
  },
  {
    id: "edge-006",
    category: "mixed",
    input: "搜索并整理 AI 相关文章",
    context: { bookmarkCount: 200 },
  },
  {
    id: "edge-007",
    category: "mixed",
    input: "分析后导出报告",
    context: { bookmarkCount: 150 },
  },
  {
    id: "edge-008",
    category: "mixed",
    input: "找到重复的并删除",
    context: { bookmarkCount: 300 },
  },
  {
    id: "edge-009",
    category: "complex",
    input: "帮我把所有微信公众号的技术文章按时间整理到一个新文件夹，并打上标签",
    context: { bookmarkCount: 500, recentPlatform: "wechat" },
  },
  {
    id: "edge-010",
    category: "complex",
    input: "生成一份包含最近一个月所有 AI 相关收藏的周报，并导出为 Markdown",
    context: { bookmarkCount: 200 },
  },
];

// ============================================================================
// 快照结构
// ============================================================================

interface SnapshotEntry {
  testCaseId: string;
  category: string;
  input: string;
  context: TestCase["context"];
  output: {
    intent: string;
    subType?: string;
    confidence: number;
    complexity?: string;
    mode?: string;
    suggestedSkill?: string;
    reason?: string;
  };
  timestamp: string;
}

interface Snapshot {
  version: string;
  generatedAt: string;
  classifierVersion: string;
  totalCases: number;
  entries: SnapshotEntry[];
}

// ============================================================================
// 快照生成器
// ============================================================================

class BehaviorSnapshotGenerator {
  private snapshotDir: string;

  constructor() {
    this.snapshotDir = path.resolve(process.cwd(), "snapshots");
  }

  async generate(): Promise<void> {
    console.log("\n🔄 行为快照生成器");
    console.log("=".repeat(60));

    // 确保目录存在
    if (!fs.existsSync(this.snapshotDir)) {
      fs.mkdirSync(this.snapshotDir, { recursive: true });
    }

    // 动态导入分类器
    console.log("\n📦 加载 IntentClassifier...");

    let classifier: any;
    try {
      // 尝试从源文件导入
      const { IntentClassifier } = await import(
        "../../src/lib/ai-skills/router/intent-classifier"
      );
      classifier = new IntentClassifier();
      console.log("✅ IntentClassifier 加载成功");
    } catch (error) {
      console.error("❌ 无法加载 IntentClassifier:", error);
      console.log("\n⚠️ 请确保:");
      console.log("   1. 项目已编译 (npm run build)");
      console.log("   2. 从项目根目录运行此脚本");
      process.exit(1);
    }

    // 生成快照
    console.log(`\n📝 处理 ${TEST_CASES.length} 个测试用例...`);

    const entries: SnapshotEntry[] = [];
    const categories = new Map<string, number>();

    for (const testCase of TEST_CASES) {
      try {
        // 调用分类器
        const result = await classifier.classify(
          testCase.input,
          testCase.context,
        );

        entries.push({
          testCaseId: testCase.id,
          category: testCase.category,
          input: testCase.input,
          context: testCase.context,
          output: {
            intent: result.intent || result.type,
            subType: result.subType,
            confidence: result.confidence,
            complexity: result.complexity,
            mode: result.mode,
            suggestedSkill: result.suggestedSkill,
            reason: result.reason,
          },
          timestamp: new Date().toISOString(),
        });

        // 统计分类
        const category = testCase.category;
        categories.set(category, (categories.get(category) || 0) + 1);

        // 进度指示
        process.stdout.write(`.`);
      } catch (error) {
        console.error(`\n❌ 测试用例 ${testCase.id} 失败:`, error);
        entries.push({
          testCaseId: testCase.id,
          category: testCase.category,
          input: testCase.input,
          context: testCase.context,
          output: {
            intent: "ERROR",
            confidence: 0,
            reason: String(error),
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    console.log("\n");

    // 构建快照对象
    const snapshot: Snapshot = {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      classifierVersion: "pre-upgrade",
      totalCases: entries.length,
      entries,
    };

    // 写入文件
    const snapshotPath = path.join(
      this.snapshotDir,
      "intent-routing-baseline.json",
    );
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

    // 打印统计
    this.printSummary(snapshot, categories);

    console.log(`\n💾 快照已保存到: ${snapshotPath}`);
  }

  private printSummary(
    snapshot: Snapshot,
    categories: Map<string, number>,
  ): void {
    console.log("\n" + "=".repeat(60));
    console.log("📊 快照统计");
    console.log("=".repeat(60));

    console.log(`\n总测试用例数: ${snapshot.totalCases}`);
    console.log(`生成时间: ${snapshot.generatedAt}`);

    console.log("\n按分类统计:");
    for (const [category, count] of categories.entries()) {
      console.log(`  ${category}: ${count} 个`);
    }

    // 意图分布统计
    const intentCounts = new Map<string, number>();
    for (const entry of snapshot.entries) {
      const intent = entry.output.intent;
      intentCounts.set(intent, (intentCounts.get(intent) || 0) + 1);
    }

    console.log("\n意图分布:");
    for (const [intent, count] of intentCounts.entries()) {
      const percent = ((count / snapshot.totalCases) * 100).toFixed(1);
      console.log(`  ${intent}: ${count} (${percent}%)`);
    }

    // 置信度统计
    const confidences = snapshot.entries.map((e) => e.output.confidence);
    const avgConfidence =
      confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const minConfidence = Math.min(...confidences);
    const maxConfidence = Math.max(...confidences);

    console.log("\n置信度统计:");
    console.log(`  平均: ${(avgConfidence * 100).toFixed(1)}%`);
    console.log(`  最低: ${(minConfidence * 100).toFixed(1)}%`);
    console.log(`  最高: ${(maxConfidence * 100).toFixed(1)}%`);

    console.log("\n" + "=".repeat(60));
  }
}

// ============================================================================
// 主入口
// ============================================================================

async function main(): Promise<void> {
  const generator = new BehaviorSnapshotGenerator();
  await generator.generate();

  console.log("\n✅ 行为快照生成完成！");
  console.log("\n下一步:");
  console.log("  1. 完成架构升级后，运行 verify-behavior-snapshot.ts");
  console.log("  2. 检查是否有行为差异");
  console.log("  3. 分析并修复任何意外的行为变更");
}

main().catch(console.error);
