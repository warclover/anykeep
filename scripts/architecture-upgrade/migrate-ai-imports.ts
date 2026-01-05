/**
 * AI 模块导入迁移脚本
 *
 * 使用 ts-morph 自动更新所有消费 AI 模块的导入路径和类型引用
 *
 * 执行方式：
 * npx ts-node scripts/architecture-upgrade/migrate-ai-imports.ts [--dry-run]
 *
 * @version 1.0.0
 * @date 2026-01-05
 */

import { Project, SyntaxKind, SourceFile } from "ts-morph";
import * as path from "path";

// ============================================================================
// 配置
// ============================================================================

interface MigrationConfig {
  // 模块路径映射（旧路径 -> 新路径）
  modulePathMap: Record<string, string>;
  // 类型/类名映射（旧名称 -> 新名称，null 表示删除）
  symbolMap: Record<string, string | null>;
  // 方法重命名映射
  methodMap: Record<string, string>;
}

const MIGRATION_CONFIG: MigrationConfig = {
  modulePathMap: {
    // Phase 1: AI 路由层合并
    "@/lib/ai-skills/router/intent-classifier":
      "@/lib/ai-skills/router/intent-analyzer",
    "@/lib/ai-skills/router/complexity-evaluator":
      "@/lib/ai-skills/router/intent-analyzer",
    "@/lib/ai-skills/router/mode-selector":
      "@/lib/ai-skills/router/intent-analyzer",
    "@/lib/ai-skills/router/disambiguation-rules":
      "@/lib/ai-skills/router/intent-analyzer",

    // Phase 2: 模块整合
    "@/lib/source-profile": "@/lib/user-profile/source",
    "@/lib/interest-profile": "@/lib/user-profile/interest",
    "@/lib/ai-snapshot": "@/lib/snapshot/ai",
    "@/lib/ai-feedback": "@/lib/ai-learning/feedback",
    "@/lib/ai-notes": "@/lib/ai-learning/notes",
  },

  symbolMap: {
    // 类重命名
    IntentClassifier: "IntentAnalyzer",
    ClassificationResult: "AnalysisResult",

    // 删除的类（合并到 IntentAnalyzer）
    ComplexityEvaluator: null,
    ModeSelector: null,
    DisambiguationRules: null,

    // 类型重命名
    IntentClassification: "IntentAnalysis",
    ComplexityLevel: "AnalysisComplexity",
  },

  methodMap: {
    // 方法重命名
    classify: "analyze",
    evaluateComplexity: "analyze",
    selectMode: "analyze",
    getDisambiguationRules: "getAnalysisRules",
  },
};

// ============================================================================
// 迁移逻辑
// ============================================================================

interface MigrationResult {
  file: string;
  importsUpdated: number;
  symbolsUpdated: number;
  methodsUpdated: number;
  warnings: string[];
}

class AIMigrator {
  private project: Project;
  private dryRun: boolean;
  private results: MigrationResult[] = [];

  constructor(tsConfigPath: string, dryRun: boolean = false) {
    this.project = new Project({
      tsConfigFilePath: tsConfigPath,
    });
    this.dryRun = dryRun;
  }

  async migrate(): Promise<MigrationResult[]> {
    const sourceFiles = this.project.getSourceFiles();

    console.log(`\n📁 发现 ${sourceFiles.length} 个源文件\n`);

    for (const sourceFile of sourceFiles) {
      // 跳过 node_modules 和测试文件
      const filePath = sourceFile.getFilePath();
      if (filePath.includes("node_modules")) continue;

      const result = this.migrateFile(sourceFile);
      if (
        result.importsUpdated > 0 ||
        result.symbolsUpdated > 0 ||
        result.methodsUpdated > 0
      ) {
        this.results.push(result);
      }
    }

    // 保存更改
    if (!this.dryRun) {
      await this.project.save();
      console.log("\n💾 已保存所有更改\n");
    } else {
      console.log("\n🔍 Dry-run 模式，未保存任何更改\n");
    }

    return this.results;
  }

  private migrateFile(sourceFile: SourceFile): MigrationResult {
    const result: MigrationResult = {
      file: sourceFile.getFilePath(),
      importsUpdated: 0,
      symbolsUpdated: 0,
      methodsUpdated: 0,
      warnings: [],
    };

    // 1. 更新导入路径
    this.updateImportPaths(sourceFile, result);

    // 2. 更新符号引用
    this.updateSymbolReferences(sourceFile, result);

    // 3. 更新方法调用
    this.updateMethodCalls(sourceFile, result);

    return result;
  }

  private updateImportPaths(
    sourceFile: SourceFile,
    result: MigrationResult,
  ): void {
    const imports = sourceFile.getImportDeclarations();

    for (const imp of imports) {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      const newPath = MIGRATION_CONFIG.modulePathMap[moduleSpecifier];

      if (newPath) {
        if (!this.dryRun) {
          imp.setModuleSpecifier(newPath);
        }
        result.importsUpdated++;
        console.log(
          `  📦 ${path.basename(result.file)}: ${moduleSpecifier} → ${newPath}`,
        );
      }
    }
  }

  private updateSymbolReferences(
    sourceFile: SourceFile,
    result: MigrationResult,
  ): void {
    // 获取所有标识符
    const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);

    for (const id of identifiers) {
      const name = id.getText();
      const newName = MIGRATION_CONFIG.symbolMap[name];

      if (newName !== undefined) {
        if (newName === null) {
          // 需要删除的引用
          result.warnings.push(
            `⚠️ ${path.basename(result.file)}:${id.getStartLineNumber()} - ` +
              `'${name}' 已被移除，需要手动处理`,
          );
        } else {
          if (!this.dryRun) {
            id.replaceWithText(newName);
          }
          result.symbolsUpdated++;
        }
      }
    }
  }

  private updateMethodCalls(
    sourceFile: SourceFile,
    result: MigrationResult,
  ): void {
    // 获取所有属性访问表达式
    const propertyAccesses = sourceFile.getDescendantsOfKind(
      SyntaxKind.PropertyAccessExpression,
    );

    for (const access of propertyAccesses) {
      const methodName = access.getName();
      const newMethodName = MIGRATION_CONFIG.methodMap[methodName];

      if (newMethodName) {
        if (!this.dryRun) {
          access.getNameNode().replaceWithText(newMethodName);
        }
        result.methodsUpdated++;
      }
    }
  }

  printSummary(): void {
    console.log("\n" + "=".repeat(60));
    console.log("📊 迁移汇总");
    console.log("=".repeat(60));

    let totalImports = 0;
    let totalSymbols = 0;
    let totalMethods = 0;
    const allWarnings: string[] = [];

    for (const result of this.results) {
      totalImports += result.importsUpdated;
      totalSymbols += result.symbolsUpdated;
      totalMethods += result.methodsUpdated;
      allWarnings.push(...result.warnings);
    }

    console.log(`\n✅ 修改的文件数: ${this.results.length}`);
    console.log(`   - 导入路径更新: ${totalImports}`);
    console.log(`   - 符号引用更新: ${totalSymbols}`);
    console.log(`   - 方法调用更新: ${totalMethods}`);

    if (allWarnings.length > 0) {
      console.log(`\n⚠️ 需要手动处理的问题 (${allWarnings.length}):`);
      allWarnings.forEach((w) => console.log(`   ${w}`));
    }

    console.log("\n" + "=".repeat(60));
  }
}

// ============================================================================
// 主入口
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("\n🚀 AI 模块导入迁移脚本");
  console.log("=".repeat(60));

  if (dryRun) {
    console.log("🔍 运行模式: Dry-run (不会保存任何更改)");
  } else {
    console.log("⚡ 运行模式: 实际执行 (将保存所有更改)");
  }

  const tsConfigPath = path.resolve(process.cwd(), "tsconfig.json");
  console.log(`📄 TSConfig: ${tsConfigPath}`);

  try {
    const migrator = new AIMigrator(tsConfigPath, dryRun);
    await migrator.migrate();
    migrator.printSummary();

    console.log("\n✅ 迁移完成！");
    console.log("\n下一步:");
    console.log("  1. 运行 npm run type-check 检查类型错误");
    console.log("  2. 运行 npm run test:ai 验证测试通过");
    console.log("  3. 手动处理上述警告中标记的问题");
  } catch (error) {
    console.error("\n❌ 迁移失败:", error);
    process.exit(1);
  }
}

main();
