/**
 * console.error → logger 自动迁移脚本
 *
 * 功能：
 * - 识别文件类型（客户端/服务端）
 * - 替换 console.error 为对应的 logger
 * - 自动添加 import 语句
 * - 跳过测试文件和已迁移文件
 *
 * 使用方法：
 * npx tsx scripts/migrate-console-error-to-logger.ts [--dry-run]
 */

import * as fs from "fs";
import * as path from "path";
import glob from "glob";

// 配置
const CONFIG = {
  // 源码目录
  srcDir: "src",

  // 跳过的路径模式
  skipPatterns: [
    "**/__tests__/**",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/node_modules/**",
  ],

  // 客户端文件判断规则
  clientPatterns: [
    "src/components/**",
    "src/hooks/**",
    "src/contexts/**",
    "src/features/**",
    "src/app/(main)/**/*.tsx",
    "src/app/(auth)/**/*.tsx",
  ],

  // 服务端文件判断规则
  serverPatterns: [
    "src/app/api/**",
    "src/lib/**",
    "src/services/**",
    "src/jobs/**",
  ],

  // 已有 logger 的文件（跳过）
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

// 修改记录
const changes: Array<{
  file: string;
  type: "client" | "server";
  count: number;
}> = [];

/**
 * 判断文件是否为客户端文件
 */
function isClientFile(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");

  // 明确的服务端文件
  if (normalizedPath.includes("/app/api/")) {
    return false;
  }

  // 检查是否匹配客户端模式
  for (const pattern of CONFIG.clientPatterns) {
    const regex = new RegExp(
      "^" + pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$",
    );
    if (regex.test(normalizedPath)) {
      return true;
    }
  }

  // 检查文件内容是否有 "use client" 指令
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    if (content.includes('"use client"') || content.includes("'use client'")) {
      return true;
    }
  } catch {
    // 忽略读取错误
  }

  // 默认服务端
  return false;
}

/**
 * 检查文件是否应该跳过
 */
function shouldSkip(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");

  // 跳过已有 logger 的文件
  for (const skipFile of CONFIG.alreadyHasLogger) {
    if (normalizedPath.endsWith(skipFile.replace(/\\/g, "/"))) {
      return true;
    }
  }

  // 跳过测试文件
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
 * 获取相对导入路径
 */
function getImportPath(filePath: string, isClient: boolean): string {
  const targetModule = isClient ? "client-logger" : "logger";
  const fileDir = path.dirname(filePath);
  const targetPath = path.join("src", "lib", targetModule);

  // 计算相对路径
  let relativePath = path.relative(fileDir, targetPath).replace(/\\/g, "/");

  // 如果在 src 目录下，使用 @ 别名
  if (filePath.startsWith("src")) {
    return `@/lib/${targetModule}`;
  }

  return relativePath;
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

  // 检查是否有 console.error
  const consoleErrorRegex = /console\.error\s*\(/g;
  const matches = content.match(consoleErrorRegex);

  if (!matches || matches.length === 0) {
    return;
  }

  const isClient = isClientFile(filePath);
  const loggerName = isClient ? "clientLogger" : "logger";
  const importPath = getImportPath(filePath, isClient);

  let newContent = content;

  // 替换 console.error
  newContent = newContent.replace(
    /console\.error\s*\(/g,
    `${loggerName}.error(`,
  );

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

    // 找到合适的位置插入 import
    // 优先在现有 import 语句后插入
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
      // 如果没有 import，在文件开头插入（跳过 "use client" 等指令）
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
  });

  const action = dryRun ? "[DRY-RUN]" : "✅";
  console.log(
    `${action} ${filePath} (${isClient ? "client" : "server"}) - ${matches.length} 处`,
  );
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("═".repeat(60));
  console.log("  console.error → logger 迁移脚本");
  console.log("═".repeat(60));

  if (dryRun) {
    console.log("⚠️  DRY-RUN 模式：不会实际修改文件\n");
  }

  // 查找所有 TypeScript 文件
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

main().catch(console.error);
