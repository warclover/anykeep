/**
 * 行为快照验证脚本
 *
 * 在架构升级后运行此脚本，验证新实现与基线行为一致性
 *
 * 执行方式：
 * npx ts-node scripts/architecture-upgrade/verify-behavior-snapshot.ts [--strict]
 *
 * @version 1.0.0
 * @date 2026-01-05
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// 类型定义
// ============================================================================

interface SnapshotEntry {
  testCaseId: string;
  category: string;
  input: string;
  context: {
    bookmarkCount: number;
    selectedBookmarks?: number;
    hasActiveTags?: boolean;
    recentPlatform?: string;
  };
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

interface Mismatch {
  testCaseId: string;
  input: string;
  field: string;
  expected: unknown;
  actual: unknown;
  severity: "critical" | "warning" | "info";
}

interface VerificationResult {
  totalCases: number;
  passed: number;
  failed: number;
  mismatches: Mismatch[];
  warnings: Mismatch[];
}

// ============================================================================
// 验证配置
// ============================================================================

const VERIFICATION_CONFIG = {
  // 严格字段：必须完全匹配
  strictFields: ["intent", "suggestedSkill"],

  // 容忍字段：允许小差异
  tolerantFields: ["confidence"],

  // 信息字段：仅记录差异，不视为失败
  infoFields: ["reason", "complexity"],

  // 置信度容忍阈值
  confidenceTolerance: 0.05, // 5%

  // 新模块路径（升级后）
  newAnalyzerPath: "../../src/lib/ai-skills/router/intent-analyzer",
};

// ============================================================================
// 验证器
// ============================================================================

class BehaviorSnapshotVerifier {
  private snapshotDir: string;
  private strictMode: boolean;

  constructor(strictMode: boolean = false) {
    this.snapshotDir = path.resolve(process.cwd(), "snapshots");
    this.strictMode = strictMode;
  }

  async verify(): Promise<VerificationResult> {
    console.log("\n🔍 行为快照验证器");
    console.log("=".repeat(60));

    if (this.strictMode) {
      console.log("⚡ 运行模式: 严格模式 (所有差异视为失败)");
    } else {
      console.log("🔄 运行模式: 标准模式 (容忍小差异)");
    }

    // 加载基线快照
    const baseline = this.loadBaseline();
    console.log(`\n📂 加载基线快照: ${baseline.totalCases} 个测试用例`);
    console.log(`   生成时间: ${baseline.generatedAt}`);

    // 加载新分析器
    console.log("\n📦 加载 IntentAnalyzer...");

    let analyzer: any;
    try {
      // 首先尝试新模块路径
      const { IntentAnalyzer } = await import(
        VERIFICATION_CONFIG.newAnalyzerPath
      );
      analyzer = new IntentAnalyzer();
      console.log("✅ IntentAnalyzer (新版本) 加载成功");
    } catch {
      try {
        // 回退到旧模块路径（用于调试）
        const { IntentClassifier } = await import(
          "../../src/lib/ai-skills/router/intent-classifier"
        );
        analyzer = new IntentClassifier();
        console.log("⚠️ 回退到 IntentClassifier (旧版本)");
      } catch (error) {
        console.error("❌ 无法加载分析器:", error);
        process.exit(1);
      }
    }

    // 执行验证
    console.log(`\n🔄 验证 ${baseline.entries.length} 个测试用例...`);

    const result: VerificationResult = {
      totalCases: baseline.entries.length,
      passed: 0,
      failed: 0,
      mismatches: [],
      warnings: [],
    };

    for (const entry of baseline.entries) {
      const mismatches = await this.verifyEntry(entry, analyzer);

      if (mismatches.length === 0) {
        result.passed++;
        process.stdout.write(".");
      } else {
        const criticalMismatches = mismatches.filter(
          (m) => m.severity === "critical",
        );
        const warningMismatches = mismatches.filter(
          (m) => m.severity === "warning",
        );

        if (criticalMismatches.length > 0) {
          result.failed++;
          result.mismatches.push(...criticalMismatches);
          process.stdout.write("✗");
        } else {
          result.passed++;
          process.stdout.write("~");
        }

        result.warnings.push(...warningMismatches);
      }
    }

    console.log("\n");

    // 打印结果
    this.printResults(result);

    return result;
  }

  private loadBaseline(): Snapshot {
    const snapshotPath = path.join(
      this.snapshotDir,
      "intent-routing-baseline.json",
    );

    if (!fs.existsSync(snapshotPath)) {
      console.error(`\n❌ 基线快照不存在: ${snapshotPath}`);
      console.error("请先运行 generate-behavior-snapshot.ts");
      process.exit(1);
    }

    return JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
  }

  private async verifyEntry(
    entry: SnapshotEntry,
    analyzer: any,
  ): Promise<Mismatch[]> {
    const mismatches: Mismatch[] = [];

    try {
      // 调用新分析器
      const analyzeMethod = analyzer.analyze || analyzer.classify;
      const actual = await analyzeMethod.call(
        analyzer,
        entry.input,
        entry.context,
      );

      // 比较严格字段
      for (const field of VERIFICATION_CONFIG.strictFields) {
        const expected = entry.output[field as keyof typeof entry.output];
        const actualValue =
          actual[field] ?? actual[field.replace("intent", "type")];

        if (expected !== actualValue) {
          mismatches.push({
            testCaseId: entry.testCaseId,
            input: entry.input,
            field,
            expected,
            actual: actualValue,
            severity: "critical",
          });
        }
      }

      // 比较容忍字段
      for (const field of VERIFICATION_CONFIG.tolerantFields) {
        const expected = entry.output[field as keyof typeof entry.output];
        const actualValue = actual[field];

        if (field === "confidence") {
          const diff = Math.abs((expected as number) - (actualValue as number));
          if (diff > VERIFICATION_CONFIG.confidenceTolerance) {
            mismatches.push({
              testCaseId: entry.testCaseId,
              input: entry.input,
              field,
              expected,
              actual: actualValue,
              severity: this.strictMode ? "critical" : "warning",
            });
          }
        }
      }

      // 比较信息字段
      for (const field of VERIFICATION_CONFIG.infoFields) {
        const expected = entry.output[field as keyof typeof entry.output];
        const actualValue = actual[field];

        if (expected !== actualValue && expected !== undefined) {
          mismatches.push({
            testCaseId: entry.testCaseId,
            input: entry.input,
            field,
            expected,
            actual: actualValue,
            severity: "info",
          });
        }
      }
    } catch (error) {
      mismatches.push({
        testCaseId: entry.testCaseId,
        input: entry.input,
        field: "execution",
        expected: "success",
        actual: String(error),
        severity: "critical",
      });
    }

    return mismatches;
  }

  private printResults(result: VerificationResult): void {
    console.log("\n" + "=".repeat(60));
    console.log("📊 验证结果");
    console.log("=".repeat(60));

    const passRate = ((result.passed / result.totalCases) * 100).toFixed(1);
    const status = result.failed === 0 ? "✅ 通过" : "❌ 失败";

    console.log(`\n总体状态: ${status}`);
    console.log(`通过: ${result.passed}/${result.totalCases} (${passRate}%)`);
    console.log(`失败: ${result.failed}`);
    console.log(`警告: ${result.warnings.length}`);

    if (result.mismatches.length > 0) {
      console.log("\n❌ 关键差异 (必须修复):");
      console.log("-".repeat(60));

      for (const mismatch of result.mismatches) {
        console.log(`\n[${mismatch.testCaseId}] "${mismatch.input}"`);
        console.log(`  字段: ${mismatch.field}`);
        console.log(`  期望: ${JSON.stringify(mismatch.expected)}`);
        console.log(`  实际: ${JSON.stringify(mismatch.actual)}`);
      }
    }

    if (result.warnings.length > 0 && !this.strictMode) {
      console.log("\n⚠️ 警告 (建议检查):");
      console.log("-".repeat(60));

      // 只显示前 10 个警告
      const displayWarnings = result.warnings.slice(0, 10);
      for (const warning of displayWarnings) {
        console.log(`\n[${warning.testCaseId}] ${warning.field}`);
        console.log(`  期望: ${JSON.stringify(warning.expected)}`);
        console.log(`  实际: ${JSON.stringify(warning.actual)}`);
      }

      if (result.warnings.length > 10) {
        console.log(`\n... 还有 ${result.warnings.length - 10} 个警告`);
      }
    }

    console.log("\n" + "=".repeat(60));

    // 保存详细报告
    const reportPath = path.join(
      this.snapshotDir,
      `verification-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(`\n📄 详细报告已保存到: ${reportPath}`);
  }
}

// ============================================================================
// 主入口
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const strictMode = args.includes("--strict");

  const verifier = new BehaviorSnapshotVerifier(strictMode);
  const result = await verifier.verify();

  // 设置退出码
  if (result.failed > 0) {
    console.log("\n⛔ 验证失败！请修复上述关键差异后重新验证。");
    process.exit(1);
  } else if (result.warnings.length > 0) {
    console.log("\n⚠️ 验证通过，但存在警告。建议检查。");
    process.exit(0);
  } else {
    console.log("\n✅ 验证完全通过！行为与基线一致。");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("执行失败:", error);
  process.exit(1);
});
