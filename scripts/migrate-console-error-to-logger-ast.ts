/**
 * console.error → logger AST 迁移脚本
 *
 * 使用 ts-morph 进行 AST 级别的代码转换，安全处理所有语法情况
 *
 * 使用方法：
 * npx tsx scripts/migrate-console-error-to-logger-ast.ts [--dry-run]
 */

import { Project, SyntaxKind, CallExpression, SourceFile } from "ts-morph";
import * as path from "path";

// 配置
const CONFIG = {
  skipPatterns: [
    "**/__tests__/**",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/node_modules/**",
  ],
  clientPatterns: [
    /^src\/components\//,
    /^src\/hooks\//,
    /^src\/contexts\//,
    /^src\/features\//,
    /^src\/app\/\(main\)\/.*\.tsx$/,
    /^src\/app\/\(auth\)\/.*\.tsx$/,
  ],
  skipFiles: [
    "src/lib/logger.ts",
    "src/lib/client-logger.ts",
    "src/lib/workflow-lite/core/logger.ts",
    "src/lib/classification/infrastructure/shared-services/logger/logger.service.ts",
  ],
};

// 统计
const stats = {
  scanned: 0,
  modified: 0,
  skipped: 0,
  errors: 0,
  replacements: 0,
};

const changes: Array<{
  file: string;
  type: "client" | "server";
  count: number;
}> = [];

/**
 * 判断文件是否为客户端文件
 */
function isClientFile(filePath: string, sourceFile: SourceFile): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");

  // 明确的服务端文件
  if (normalizedPath.includes("/app/api/")) {
    return false;
  }

  // 检查是否匹配客户端模式
  for (const pattern of CONFIG.clientPatterns) {
    if (pattern.test(normalizedPath)) {
      return true;
    }
  }

  // 检查文件内容是否有 "use client" 指令
  const firstStatement = sourceFile.getStatements()[0];
  if (firstStatement) {
    const text = firstStatement.getText();
    if (text.includes('"use client"') || text.includes("'use client'")) {
      return true;
    }
  }

  return false;
}

/**
 * 检查文件是否应该跳过
 */
function shouldSkip(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");

  for (const skipFile of CONFIG.skipFiles) {
    if (normalizedPath.endsWith(skipFile)) {
      return true;
    }
  }

  for (const pattern of CONFIG.skipPatterns) {
    const regex = new RegExp(
      pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"),
    );
    if (regex.test(normalizedPath)) {
      return true;
    }
  }

  return false;
}

/**
 * 检查是否为 console.error 调用
 */
function isConsoleErrorCall(callExpr: CallExpression): boolean {
  const expression = callExpr.getExpression();
  return expression.getText() === "console.error";
}

/**
 * 判断参数是否为字符串字面量
 */
function isStringLiteral(text: string): boolean {
  const trimmed = text.trim();
  return (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith("`") && trimmed.endsWith("`"))
  );
}

/**
 * 判断参数是否为对象字面量
 */
function isObjectLiteral(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}");
}

/**
 * 提取变量名用于对象属性
 */
function extractVarName(text: string): string {
  const trimmed = text.trim();

  // 如果是成员访问，取最后一部分
  if (trimmed.includes(".") && !trimmed.includes("(")) {
    const parts = trimmed.split(".");
    return parts[parts.length - 1].replace(/[^a-zA-Z0-9_]/g, "");
  }

  // 如果是函数调用，取函数名
  if (trimmed.includes("(")) {
    const match = trimmed.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
    if (match) {
      return match[1];
    }
  }

  // 清理非法字符
  const cleaned = trimmed.replace(/[^a-zA-Z0-9_]/g, "");
  return cleaned || "data";
}

/**
 * 转换 console.error 调用
 */
function transformConsoleError(
  callExpr: CallExpression,
  loggerName: string,
): string {
  const args = callExpr.getArguments();

  if (args.length === 0) {
    return `${loggerName}.error("Unknown error")`;
  }

  const argTexts = args.map((arg) => arg.getText());

  if (args.length === 1) {
    const argText = argTexts[0];

    if (isStringLiteral(argText)) {
      // console.error("message") → logger.error("message")
      return `${loggerName}.error(${argText})`;
    }

    if (isObjectLiteral(argText)) {
      // console.error({ ... }) → logger.error({ ... }, "Error occurred")
      return `${loggerName}.error(${argText}, "Error occurred")`;
    }

    // console.error(error) → logger.error({ error }, "Error occurred")
    const varName = extractVarName(argText);
    // 避免变量名冲突
    if (varName === argText.trim()) {
      return `${loggerName}.error({ ${varName} }, "Error occurred")`;
    }
    return `${loggerName}.error({ ${varName}: ${argText} }, "Error occurred")`;
  }

  // 多参数情况
  const firstArgText = argTexts[0];
  const restArgTexts = argTexts.slice(1);

  if (isStringLiteral(firstArgText)) {
    // console.error("message", data1, data2) → logger.error({ data1, data2 }, "message")
    const contextParts: string[] = [];

    for (const argText of restArgTexts) {
      if (isObjectLiteral(argText)) {
        // 展开对象
        contextParts.push(`...${argText}`);
      } else {
        const varName = extractVarName(argText);
        if (varName === argText.trim()) {
          contextParts.push(varName);
        } else {
          contextParts.push(`${varName}: ${argText}`);
        }
      }
    }

    const contextObj = `{ ${contextParts.join(", ")} }`;
    return `${loggerName}.error(${contextObj}, ${firstArgText})`;
  }

  // 第一个参数不是字符串，查找最后一个字符串参数作为消息
  const lastStringIndex = argTexts.map(isStringLiteral).lastIndexOf(true);

  if (lastStringIndex > 0) {
    const message = argTexts[lastStringIndex];
    const dataArgs = [
      ...argTexts.slice(0, lastStringIndex),
      ...argTexts.slice(lastStringIndex + 1),
    ];

    const contextParts: string[] = [];
    for (const argText of dataArgs) {
      if (isObjectLiteral(argText)) {
        contextParts.push(`...${argText}`);
      } else {
        const varName = extractVarName(argText);
        if (varName === argText.trim()) {
          contextParts.push(varName);
        } else {
          contextParts.push(`${varName}: ${argText}`);
        }
      }
    }

    const contextObj = `{ ${contextParts.join(", ")} }`;
    return `${loggerName}.error(${contextObj}, ${message})`;
  }

  // 没有字符串参数，全是数据
  const contextParts: string[] = [];
  for (const argText of argTexts) {
    if (isObjectLiteral(argText)) {
      contextParts.push(`...${argText}`);
    } else {
      const varName = extractVarName(argText);
      if (varName === argText.trim()) {
        contextParts.push(varName);
      } else {
        contextParts.push(`${varName}: ${argText}`);
      }
    }
  }

  const contextObj = `{ ${contextParts.join(", ")} }`;
  return `${loggerName}.error(${contextObj}, "Error occurred")`;
}

/**
 * 处理单个文件
 */
function processFile(sourceFile: SourceFile, dryRun: boolean): void {
  const filePath = sourceFile.getFilePath();
  const relativePath = path
    .relative(process.cwd(), filePath)
    .replace(/\\/g, "/");

  stats.scanned++;

  if (shouldSkip(relativePath)) {
    stats.skipped++;
    return;
  }

  const isClient = isClientFile(relativePath, sourceFile);
  const loggerName = isClient ? "clientLogger" : "logger";
  const importPath = "@/lib/" + (isClient ? "client-logger" : "logger");

  // 查找所有 console.error 调用
  const callExpressions = sourceFile.getDescendantsOfKind(
    SyntaxKind.CallExpression,
  );

  const consoleErrorCalls = callExpressions.filter(isConsoleErrorCall);

  if (consoleErrorCalls.length === 0) {
    return;
  }

  // 从后向前替换，避免位置偏移
  for (let i = consoleErrorCalls.length - 1; i >= 0; i--) {
    const callExpr = consoleErrorCalls[i];
    const transformed = transformConsoleError(callExpr, loggerName);
    callExpr.replaceWithText(transformed);
  }

  // 添加 import 语句
  const existingImports = sourceFile.getImportDeclarations();
  const hasLoggerImport = existingImports.some((imp) => {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    return (
      moduleSpecifier === importPath ||
      moduleSpecifier === "@/lib/logger" ||
      moduleSpecifier === "@/lib/client-logger"
    );
  });

  if (!hasLoggerImport) {
    sourceFile.addImportDeclaration({
      namedImports: [loggerName],
      moduleSpecifier: importPath,
    });
  }

  if (!dryRun) {
    sourceFile.saveSync();
  }

  stats.modified++;
  stats.replacements += consoleErrorCalls.length;
  changes.push({
    file: relativePath,
    type: isClient ? "client" : "server",
    count: consoleErrorCalls.length,
  });

  const action = dryRun ? "[DRY-RUN]" : "✅";
  console.log(
    `${action} ${relativePath} (${isClient ? "client" : "server"}) - ${consoleErrorCalls.length} 处`,
  );
}

/**
 * 主函数
 */
function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("═".repeat(60));
  console.log("  console.error → logger AST 迁移脚本");
  console.log("═".repeat(60));

  if (dryRun) {
    console.log("⚠️  DRY-RUN 模式：不会实际修改文件\n");
  }

  // 创建项目
  const project = new Project({
    tsConfigFilePath: "tsconfig.json",
    skipAddingFilesFromTsConfig: true,
  });

  // 添加源文件
  project.addSourceFilesAtPaths([
    "src/**/*.ts",
    "src/**/*.tsx",
    "!src/**/__tests__/**",
    "!src/**/*.test.ts",
    "!src/**/*.test.tsx",
    "!src/**/*.spec.ts",
    "!src/**/*.spec.tsx",
  ]);

  const sourceFiles = project.getSourceFiles();
  console.log(`📁 扫描 ${sourceFiles.length} 个文件...\n`);

  for (const sourceFile of sourceFiles) {
    try {
      processFile(sourceFile, dryRun);
    } catch (error) {
      console.error(`❌ 处理文件失败: ${sourceFile.getFilePath()}`);
      console.error(error);
      stats.errors++;
    }
  }

  // 输出统计
  console.log("\n" + "═".repeat(60));
  console.log("  迁移统计");
  console.log("═".repeat(60));
  console.log(`📊 扫描文件: ${stats.scanned}`);
  console.log(`✅ 修改文件: ${stats.modified}`);
  console.log(`🔄 替换次数: ${stats.replacements}`);
  console.log(`⏭️  跳过文件: ${stats.skipped}`);
  console.log(`❌ 错误: ${stats.errors}`);

  if (changes.length > 0) {
    console.log("\n📝 修改详情:");
    const clientChanges = changes.filter((c) => c.type === "client");
    const serverChanges = changes.filter((c) => c.type === "server");

    if (clientChanges.length > 0) {
      console.log(
        `\n  🖥️  客户端文件 (clientLogger): ${clientChanges.length} 个`,
      );
    }
    if (serverChanges.length > 0) {
      console.log(`\n  🖧  服务端文件 (logger): ${serverChanges.length} 个`);
    }
  }

  if (dryRun && stats.modified > 0) {
    console.log("\n💡 移除 --dry-run 参数以实际执行迁移");
  }
}

main();
