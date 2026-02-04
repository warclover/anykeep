/**
 * console.error → logger 智能迁移脚本 v2
 *
 * 功能：
 * - 识别文件类型（客户端/服务端）
 * - 智能转换调用格式：
 *   console.error("msg", error) → logger.error({ error }, "msg")
 *   console.error("msg:", data) → logger.error({ data }, "msg")
 *   console.error("msg")        → logger.error("msg")
 * - 自动添加 import 语句
 * - 跳过测试文件和已迁移文件
 *
 * 使用方法：
 * npx tsx scripts/migrate-console-error-to-logger-v2.ts [--dry-run]
 */

import * as fs from "fs";
import * as path from "path";
import glob from "glob";

// 配置
const CONFIG = {
  srcDir: "src",
  skipPatterns: [
    "**/__tests__/**",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/node_modules/**",
  ],
  clientPatterns: [
    "src/components/**",
    "src/hooks/**",
    "src/contexts/**",
    "src/features/**",
    "src/app/(main)/**/*.tsx",
    "src/app/(auth)/**/*.tsx",
  ],
  alreadyHasLogger: [
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
  examples: string[];
}> = [];

/**
 * 判断文件是否为客户端文件
 */
function isClientFile(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");

  if (normalizedPath.includes("/app/api/")) {
    return false;
  }

  for (const pattern of CONFIG.clientPatterns) {
    const regex = new RegExp(
      "^" + pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$",
    );
    if (regex.test(normalizedPath)) {
      return true;
    }
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    if (content.includes('"use client"') || content.includes("'use client'")) {
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * 检查文件是否应该跳过
 */
function shouldSkip(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");

  for (const skipFile of CONFIG.alreadyHasLogger) {
    if (normalizedPath.endsWith(skipFile.replace(/\\/g, "/"))) {
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
 * 解析 console.error 调用的参数
 * 返回参数数组，处理嵌套括号和字符串
 */
function parseConsoleErrorArgs(argsString: string): string[] {
  const args: string[] = [];
  let current = "";
  let depth = 0;
  let inString: string | null = null;
  let escaped = false;

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }

    if (inString) {
      current += char;
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      current += char;
      inString = char;
      continue;
    }

    if (char === "(" || char === "[" || char === "{") {
      depth++;
      current += char;
      continue;
    }

    if (char === ")" || char === "]" || char === "}") {
      depth--;
      current += char;
      continue;
    }

    if (char === "," && depth === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

/**
 * 判断参数是否为字符串字面量
 */
function isStringLiteral(arg: string): boolean {
  const trimmed = arg.trim();
  return (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith("`") && trimmed.endsWith("`"))
  );
}

/**
 * 判断参数是否为对象字面量
 */
function isObjectLiteral(arg: string): boolean {
  const trimmed = arg.trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}");
}

/**
 * 提取变量名用于对象属性
 */
function extractVarName(arg: string): string {
  const trimmed = arg.trim();

  // 如果是成员访问，取最后一部分
  if (trimmed.includes(".")) {
    const parts = trimmed.split(".");
    return parts[parts.length - 1].replace(/[^a-zA-Z0-9_]/g, "");
  }

  // 如果是函数调用，取函数名
  if (trimmed.includes("(")) {
    return trimmed.split("(")[0].replace(/[^a-zA-Z0-9_]/g, "");
  }

  // 清理非法字符
  return trimmed.replace(/[^a-zA-Z0-9_]/g, "") || "data";
}

/**
 * 转换 console.error 调用为 logger.error
 */
function transformConsoleError(
  fullMatch: string,
  argsString: string,
  loggerName: string,
): { transformed: string; example: string } {
  const args = parseConsoleErrorArgs(argsString);

  if (args.length === 0) {
    return {
      transformed: `${loggerName}.error("Unknown error")`,
      example: `${fullMatch} → ${loggerName}.error("Unknown error")`,
    };
  }

  if (args.length === 1) {
    const arg = args[0];

    if (isStringLiteral(arg)) {
      // console.error("message") → logger.error("message")
      return {
        transformed: `${loggerName}.error(${arg})`,
        example: `单参数字符串`,
      };
    }

    if (isObjectLiteral(arg)) {
      // console.error({ ... }) → logger.error({ ... }, "Error")
      return {
        transformed: `${loggerName}.error(${arg}, "Error occurred")`,
        example: `单参数对象`,
      };
    }

    // console.error(error) → logger.error({ error }, "Error")
    const varName = extractVarName(arg);
    return {
      transformed: `${loggerName}.error({ ${varName}: ${arg} }, "Error occurred")`,
      example: `单参数变量`,
    };
  }

  // 多参数情况
  const firstArg = args[0];
  const restArgs = args.slice(1);

  if (isStringLiteral(firstArg)) {
    // console.error("message", data1, data2) → logger.error({ data1, data2 }, "message")
    const contextParts: string[] = [];

    for (const arg of restArgs) {
      if (isObjectLiteral(arg)) {
        // 展开对象: { a: 1 } → ...{ a: 1 }
        contextParts.push(`...${arg}`);
      } else {
        const varName = extractVarName(arg);
        if (varName === arg.trim()) {
          // 简写: error → error
          contextParts.push(varName);
        } else {
          // 完整写法: err.message → message: err.message
          contextParts.push(`${varName}: ${arg}`);
        }
      }
    }

    const contextObj = `{ ${contextParts.join(", ")} }`;
    return {
      transformed: `${loggerName}.error(${contextObj}, ${firstArg})`,
      example: `多参数(字符串优先)`,
    };
  }

  // 第一个参数不是字符串，找最后一个字符串作为消息
  const lastStringIndex = args.map(isStringLiteral).lastIndexOf(true);

  if (lastStringIndex > 0) {
    const message = args[lastStringIndex];
    const dataArgs = [
      ...args.slice(0, lastStringIndex),
      ...args.slice(lastStringIndex + 1),
    ];

    const contextParts: string[] = [];
    for (const arg of dataArgs) {
      if (isObjectLiteral(arg)) {
        contextParts.push(`...${arg}`);
      } else {
        const varName = extractVarName(arg);
        if (varName === arg.trim()) {
          contextParts.push(varName);
        } else {
          contextParts.push(`${varName}: ${arg}`);
        }
      }
    }

    const contextObj = `{ ${contextParts.join(", ")} }`;
    return {
      transformed: `${loggerName}.error(${contextObj}, ${message})`,
      example: `多参数(消息在后)`,
    };
  }

  // 没有字符串参数，全是数据
  const contextParts: string[] = [];
  for (const arg of args) {
    if (isObjectLiteral(arg)) {
      contextParts.push(`...${arg}`);
    } else {
      const varName = extractVarName(arg);
      if (varName === arg.trim()) {
        contextParts.push(varName);
      } else {
        contextParts.push(`${varName}: ${arg}`);
      }
    }
  }

  const contextObj = `{ ${contextParts.join(", ")} }`;
  return {
    transformed: `${loggerName}.error(${contextObj}, "Error occurred")`,
    example: `多参数(无字符串)`,
  };
}

/**
 * 处理单个文件
 */
function processFile(filePath: string, dryRun: boolean): void {
  stats.scanned++;

  if (shouldSkip(filePath)) {
    stats.skipped++;
    return;
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(`❌ 读取文件失败: ${filePath}`);
    stats.errors++;
    return;
  }

  // 匹配 console.error(...) 调用
  const consoleErrorRegex = /console\.error\s*\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g;
  const matches = [...content.matchAll(consoleErrorRegex)];

  if (matches.length === 0) {
    return;
  }

  const isClient = isClientFile(filePath);
  const loggerName = isClient ? "clientLogger" : "logger";
  const importPath = "@/lib/" + (isClient ? "client-logger" : "logger");

  let newContent = content;
  const examples: string[] = [];

  // 从后向前替换，避免位置偏移
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const fullMatch = match[0];
    const argsString = match[1];

    const { transformed, example } = transformConsoleError(
      fullMatch,
      argsString,
      loggerName,
    );

    newContent =
      newContent.slice(0, match.index!) +
      transformed +
      newContent.slice(match.index! + fullMatch.length);

    examples.push(example);
  }

  // 检查是否已有 logger import
  const hasLoggerImport =
    newContent.includes(`from "${importPath}"`) ||
    newContent.includes(`from '${importPath}'`) ||
    newContent.includes(`from "@/lib/logger"`) ||
    newContent.includes(`from '@/lib/logger'`) ||
    newContent.includes(`from "@/lib/client-logger"`) ||
    newContent.includes(`from '@/lib/client-logger'`);

  // 添加 import 语句
  if (!hasLoggerImport) {
    const importStatement = `import { ${loggerName} } from "${importPath}";\n`;

    const lastImportMatch = newContent.match(
      /^(import\s+.*?from\s+['"][^'"]+['"];?\s*\n)+/m,
    );

    if (lastImportMatch) {
      const insertPos = lastImportMatch.index! + lastImportMatch[0].length;
      newContent =
        newContent.slice(0, insertPos) +
        importStatement +
        newContent.slice(insertPos);
    } else {
      const directiveMatch = newContent.match(
        /^(['"]use (client|server)['"];?\s*\n)?/,
      );
      if (directiveMatch) {
        const insertPos = directiveMatch[0].length;
        newContent =
          newContent.slice(0, insertPos) +
          importStatement +
          newContent.slice(insertPos);
      } else {
        newContent = importStatement + newContent;
      }
    }
  }

  // 写入文件
  if (!dryRun) {
    try {
      fs.writeFileSync(filePath, newContent, "utf-8");
    } catch (error) {
      console.error(`❌ 写入文件失败: ${filePath}`);
      stats.errors++;
      return;
    }
  }

  stats.modified++;
  stats.replacements += matches.length;
  changes.push({
    file: filePath,
    type: isClient ? "client" : "server",
    count: matches.length,
    examples: [...new Set(examples)],
  });

  const action = dryRun ? "[DRY-RUN]" : "✅";
  console.log(
    `${action} ${filePath} (${isClient ? "client" : "server"}) - ${matches.length} 处`,
  );
}

/**
 * 主函数
 */
function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("═".repeat(60));
  console.log("  console.error → logger 智能迁移脚本 v2");
  console.log("═".repeat(60));

  if (dryRun) {
    console.log("⚠️  DRY-RUN 模式：不会实际修改文件\n");
  }

  const files = glob.sync("src/**/*.{ts,tsx}", {
    ignore: CONFIG.skipPatterns,
  });

  console.log(`📁 扫描 ${files.length} 个文件...\n`);

  for (const file of files) {
    processFile(file, dryRun);
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
