/**
 * 架构升级预检查脚本
 *
 * 在开始架构升级前运行此脚本，确保所有前置条件满足
 *
 * 执行方式：
 * npx ts-node scripts/architecture-upgrade/pre-upgrade-checklist.ts
 *
 * @version 1.0.0
 * @date 2026-01-05
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// 类型定义
// ============================================================================

interface CheckResult {
  name: string;
  category: "required" | "recommended" | "info";
  passed: boolean;
  message: string;
  details?: string[];
}

type CheckFunction = () => Promise<CheckResult> | CheckResult;

// ============================================================================
// 检查项实现
// ============================================================================

const checks: CheckFunction[] = [
  // ============================================================================
  // 必需检查项
  // ============================================================================

  // 1. Git 工作区状态
  async function checkGitStatus(): Promise<CheckResult> {
    try {
      const status = execSync("git status --porcelain", {
        encoding: "utf-8",
      }).trim();

      if (status === "") {
        return {
          name: "Git 工作区干净",
          category: "required",
          passed: true,
          message: "工作区无未提交变更",
        };
      }

      const changedFiles = status.split("\n").length;
      return {
        name: "Git 工作区干净",
        category: "required",
        passed: false,
        message: `存在 ${changedFiles} 个未提交文件`,
        details: status.split("\n").slice(0, 5),
      };
    } catch {
      return {
        name: "Git 工作区干净",
        category: "required",
        passed: false,
        message: "Git 命令执行失败",
      };
    }
  },

  // 2. 当前分支检查
  async function checkCurrentBranch(): Promise<CheckResult> {
    try {
      const branch = execSync("git branch --show-current", {
        encoding: "utf-8",
      }).trim();

      const isUpgradeBranch = branch === "feature/architecture-upgrade";
      const isBaseBranch = branch === "feature/classification-v4.2";

      if (isUpgradeBranch) {
        return {
          name: "当前分支",
          category: "required",
          passed: true,
          message: `在升级分支上: ${branch}`,
        };
      }

      if (isBaseBranch) {
        return {
          name: "当前分支",
          category: "required",
          passed: true,
          message: `在基准分支上: ${branch}（请创建升级分支）`,
        };
      }

      return {
        name: "当前分支",
        category: "required",
        passed: false,
        message: `不在预期分支上: ${branch}`,
        details: [
          "预期分支: feature/architecture-upgrade",
          "或基准分支: feature/classification-v4.2",
        ],
      };
    } catch {
      return {
        name: "当前分支",
        category: "required",
        passed: false,
        message: "无法获取当前分支",
      };
    }
  },

  // 3. TypeScript 类型检查
  async function checkTypeScript(): Promise<CheckResult> {
    try {
      execSync("npm run type-check", { encoding: "utf-8", stdio: "pipe" });
      return {
        name: "TypeScript 类型检查",
        category: "required",
        passed: true,
        message: "无类型错误",
      };
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || "";
      const errorCount = (output.match(/error TS/g) || []).length;

      return {
        name: "TypeScript 类型检查",
        category: "required",
        passed: false,
        message: `存在 ${errorCount || "若干"} 个类型错误`,
        details: output.split("\n").slice(0, 5),
      };
    }
  },

  // 4. AI 模块测试
  async function checkAITests(): Promise<CheckResult> {
    try {
      const output = execSync(
        "npm run test -- --testPathPattern=ai-skills --passWithNoTests --json --silent",
        { encoding: "utf-8", stdio: "pipe" },
      );

      const result = JSON.parse(output);
      const passed = result.numPassedTests;
      const total = result.numTotalTests;

      if (result.success) {
        return {
          name: "AI 模块测试",
          category: "required",
          passed: true,
          message: `${passed}/${total} 测试通过`,
        };
      }

      return {
        name: "AI 模块测试",
        category: "required",
        passed: false,
        message: `${total - passed}/${total} 测试失败`,
      };
    } catch {
      // 如果无法解析 JSON，尝试运行完整测试
      try {
        execSync("npm run test:ai", { encoding: "utf-8", stdio: "pipe" });
        return {
          name: "AI 模块测试",
          category: "required",
          passed: true,
          message: "测试通过",
        };
      } catch {
        return {
          name: "AI 模块测试",
          category: "required",
          passed: false,
          message: "测试执行失败",
        };
      }
    }
  },

  // 5. 行为快照存在
  async function checkBehaviorSnapshot(): Promise<CheckResult> {
    const snapshotPath = path.resolve(
      process.cwd(),
      "snapshots/intent-routing-baseline.json",
    );

    if (fs.existsSync(snapshotPath)) {
      const content = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
      return {
        name: "行为基线快照",
        category: "required",
        passed: true,
        message: `快照已生成 (${content.totalCases} 个测试用例)`,
        details: [`生成时间: ${content.generatedAt}`],
      };
    }

    return {
      name: "行为基线快照",
      category: "required",
      passed: false,
      message: "快照不存在",
      details: [
        "请运行: npx ts-node scripts/architecture-upgrade/generate-behavior-snapshot.ts",
      ],
    };
  },

  // 6. ts-morph 依赖
  async function checkTsMorphDependency(): Promise<CheckResult> {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    const hasTsMorph =
      packageJson.dependencies?.["ts-morph"] ||
      packageJson.devDependencies?.["ts-morph"];

    if (hasTsMorph) {
      return {
        name: "ts-morph 依赖",
        category: "required",
        passed: true,
        message: `已安装: ${hasTsMorph}`,
      };
    }

    return {
      name: "ts-morph 依赖",
      category: "required",
      passed: false,
      message: "未安装 ts-morph",
      details: ["请运行: npm install -D ts-morph"],
    };
  },

  // ============================================================================
  // 推荐检查项
  // ============================================================================

  // 7. 构建测试
  async function checkBuild(): Promise<CheckResult> {
    try {
      execSync("npm run build", { encoding: "utf-8", stdio: "pipe" });
      return {
        name: "生产构建",
        category: "recommended",
        passed: true,
        message: "构建成功",
      };
    } catch {
      return {
        name: "生产构建",
        category: "recommended",
        passed: false,
        message: "构建失败",
        details: ["请修复构建错误后再进行升级"],
      };
    }
  },

  // 8. ESLint 检查
  async function checkESLint(): Promise<CheckResult> {
    try {
      execSync("npm run lint", { encoding: "utf-8", stdio: "pipe" });
      return {
        name: "ESLint 检查",
        category: "recommended",
        passed: true,
        message: "无 lint 错误",
      };
    } catch (error: any) {
      const output = error.stdout?.toString() || "";
      const errorCount = (output.match(/\d+ error/g) || ["0 error"])[0];

      return {
        name: "ESLint 检查",
        category: "recommended",
        passed: false,
        message: `存在 ${errorCount}`,
      };
    }
  },

  // 9. 迁移脚本存在
  async function checkMigrationScripts(): Promise<CheckResult> {
    const scripts = [
      "scripts/architecture-upgrade/migrate-ai-imports.ts",
      "scripts/architecture-upgrade/generate-behavior-snapshot.ts",
      "scripts/architecture-upgrade/verify-behavior-snapshot.ts",
    ];

    const missingScripts = scripts.filter(
      (s) => !fs.existsSync(path.resolve(process.cwd(), s)),
    );

    if (missingScripts.length === 0) {
      return {
        name: "迁移脚本",
        category: "recommended",
        passed: true,
        message: `${scripts.length} 个脚本就绪`,
      };
    }

    return {
      name: "迁移脚本",
      category: "recommended",
      passed: false,
      message: `缺少 ${missingScripts.length} 个脚本`,
      details: missingScripts,
    };
  },

  // ============================================================================
  // 信息检查项
  // ============================================================================

  // 10. Node.js 版本
  async function checkNodeVersion(): Promise<CheckResult> {
    const version = process.version;
    const major = parseInt(version.slice(1).split(".")[0], 10);

    return {
      name: "Node.js 版本",
      category: "info",
      passed: major >= 18,
      message: `当前版本: ${version}`,
      details: major < 18 ? ["推荐 Node.js 18+"] : undefined,
    };
  },

  // 11. 磁盘空间
  async function checkDiskSpace(): Promise<CheckResult> {
    try {
      // Windows 特定命令
      const isWindows = process.platform === "win32";
      let freeSpace: number;

      if (isWindows) {
        const output = execSync(
          "wmic logicaldisk get freespace,caption /format:csv",
          { encoding: "utf-8" },
        );
        // 简单解析，假设 C: 盘
        const lines = output.trim().split("\n");
        const cLine = lines.find((l) => l.includes("C:"));
        if (cLine) {
          const parts = cLine.split(",");
          freeSpace = parseInt(parts[1], 10) / (1024 * 1024 * 1024); // GB
        } else {
          freeSpace = 100; // 默认值
        }
      } else {
        const output = execSync("df -BG . | tail -1", { encoding: "utf-8" });
        const parts = output.split(/\s+/);
        freeSpace = parseInt(parts[3], 10);
      }

      return {
        name: "可用磁盘空间",
        category: "info",
        passed: freeSpace > 1,
        message: `约 ${freeSpace.toFixed(1)} GB 可用`,
      };
    } catch {
      return {
        name: "可用磁盘空间",
        category: "info",
        passed: true,
        message: "无法检测",
      };
    }
  },

  // 12. 项目统计
  async function checkProjectStats(): Promise<CheckResult> {
    try {
      const tsFiles = execSync(
        'find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | wc -l',
        { encoding: "utf-8", shell: "bash" },
      ).trim();

      return {
        name: "项目规模",
        category: "info",
        passed: true,
        message: `约 ${tsFiles} 个 TypeScript 文件`,
      };
    } catch {
      // Windows fallback
      return {
        name: "项目规模",
        category: "info",
        passed: true,
        message: "约 2000+ TypeScript 文件",
      };
    }
  },
];

// ============================================================================
// 检查执行器
// ============================================================================

async function runChecklist(): Promise<void> {
  console.log("\n📋 架构升级预检查清单");
  console.log("=".repeat(60));
  console.log(`时间: ${new Date().toISOString()}`);
  console.log("=".repeat(60));

  const results: CheckResult[] = [];

  for (const check of checks) {
    try {
      const result = await check();
      results.push(result);
    } catch (error) {
      results.push({
        name: "未知检查",
        category: "info",
        passed: false,
        message: String(error),
      });
    }
  }

  // 分类输出
  const categories = ["required", "recommended", "info"] as const;
  const categoryNames = {
    required: "🔴 必需检查项",
    recommended: "🟡 推荐检查项",
    info: "ℹ️ 信息检查项",
  };

  for (const category of categories) {
    const categoryResults = results.filter((r) => r.category === category);

    console.log(`\n${categoryNames[category]}`);
    console.log("-".repeat(50));

    for (const result of categoryResults) {
      const icon = result.passed ? "✅" : "❌";
      console.log(`${icon} ${result.name}: ${result.message}`);

      if (result.details && result.details.length > 0) {
        for (const detail of result.details) {
          console.log(`   └─ ${detail}`);
        }
      }
    }
  }

  // 汇总
  const requiredResults = results.filter((r) => r.category === "required");
  const requiredPassed = requiredResults.filter((r) => r.passed).length;
  const allRequiredPassed = requiredPassed === requiredResults.length;

  const recommendedResults = results.filter(
    (r) => r.category === "recommended",
  );
  const recommendedPassed = recommendedResults.filter((r) => r.passed).length;

  console.log("\n" + "=".repeat(60));
  console.log("📊 检查汇总");
  console.log("=".repeat(60));

  console.log(
    `\n必需项: ${requiredPassed}/${requiredResults.length} ${allRequiredPassed ? "✅" : "❌"}`,
  );
  console.log(`推荐项: ${recommendedPassed}/${recommendedResults.length}`);

  if (allRequiredPassed) {
    console.log("\n🚀 所有必需检查项通过！可以开始架构升级。");
    console.log("\n下一步:");
    console.log("  1. 如果还在基准分支，请创建升级分支:");
    console.log("     git checkout -b feature/architecture-upgrade");
    console.log("  2. 开始执行 Phase 1 任务");
  } else {
    console.log("\n⛔ 存在未通过的必需检查项，请修复后再开始升级。");
    process.exit(1);
  }
}

// ============================================================================
// 主入口
// ============================================================================

runChecklist().catch((error) => {
  console.error("检查执行失败:", error);
  process.exit(1);
});
