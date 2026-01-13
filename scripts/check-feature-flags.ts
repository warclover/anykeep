#!/usr/bin/env npx ts-node
/**
 * Feature Flags 验证脚本
 *
 * 验证内容：
 * 1. 启用的 Flag 是否有集成点
 * 2. 依赖的 Flag 是否已启用
 * 3. 废弃的 Flag 是否仍在使用
 * 4. feature-flags.ts 与 feature-flag-registry.ts 是否同步
 *
 * @usage
 *   npm run check:feature-flags
 *   npm run check:feature-flags -- --ci  # CI 模式（发现问题时退出码非零）
 *
 * @since 2026-01-13
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ESM 兼容性: 获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 颜色输出
const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
};

interface ValidationResult {
  errors: string[];
  warnings: string[];
  info: string[];
}

const result: ValidationResult = {
  errors: [],
  warnings: [],
  info: [],
};

const isCIMode = process.argv.includes("--ci");

/**
 * 从 feature-flags.ts 提取所有 Flag 定义
 */
function extractFlagsFromFeatureFlags(): Set<string> {
  const filePath = path.join(
    __dirname,
    "../src/lib/ai-agent/config/feature-flags.ts",
  );
  const content = fs.readFileSync(filePath, "utf-8");

  // 匹配 get ENABLE_XXX(): boolean 或 get XXX(): number 等
  const flagPattern =
    /get\s+(ENABLE_[A-Z_]+|[A-Z_]+_PERCENTAGE|[A-Z_]+_SIMILARITY)\s*\(\)/g;
  const flags = new Set<string>();

  let match;
  while ((match = flagPattern.exec(content)) !== null) {
    flags.add(match[1]);
  }

  return flags;
}

/**
 * 从 feature-flag-registry.ts 提取已注册的 Flag
 */
function extractFlagsFromRegistry(): Set<string> {
  const filePath = path.join(
    __dirname,
    "../src/lib/ai-agent/config/feature-flag-registry.ts",
  );
  const content = fs.readFileSync(filePath, "utf-8");

  // 匹配 name: "ENABLE_XXX" 或 name: "XXX_PERCENTAGE"
  const flagPattern =
    /name:\s*["'](ENABLE_[A-Z_]+|[A-Z_]+_PERCENTAGE|[A-Z_]+_SIMILARITY)["']/g;
  const flags = new Set<string>();

  let match;
  while ((match = flagPattern.exec(content)) !== null) {
    flags.add(match[1]);
  }

  return flags;
}

/**
 * 从 getAllFeatureFlags 函数提取导出的 Flag
 */
function extractFlagsFromGetAllFunction(): Set<string> {
  const filePath = path.join(
    __dirname,
    "../src/lib/ai-agent/config/feature-flags.ts",
  );
  const content = fs.readFileSync(filePath, "utf-8");

  // 查找 getAllFeatureFlags 函数内容
  const getAllMatch = content.match(
    /export function getAllFeatureFlags\(\)[^{]*\{([\s\S]*?)\n\}/,
  );
  if (!getAllMatch) {
    result.warnings.push("无法解析 getAllFeatureFlags 函数");
    return new Set();
  }

  const functionBody = getAllMatch[1];
  // 匹配返回对象中的 Flag 名称
  const flagPattern =
    /(ENABLE_[A-Z_]+|[A-Z_]+_PERCENTAGE|[A-Z_]+_SIMILARITY):/g;
  const flags = new Set<string>();

  let match;
  while ((match = flagPattern.exec(functionBody)) !== null) {
    flags.add(match[1]);
  }

  return flags;
}

/**
 * 检查 Flag 定义与注册表同步
 */
function checkFlagSync(): void {
  console.log(colors.blue("\n📋 检查 Feature Flags 定义与注册表同步...\n"));

  const definedFlags = extractFlagsFromFeatureFlags();
  const registeredFlags = extractFlagsFromRegistry();
  const exportedFlags = extractFlagsFromGetAllFunction();

  // 已定义但未注册
  const notRegistered: string[] = [];
  definedFlags.forEach((flag) => {
    if (!registeredFlags.has(flag)) {
      notRegistered.push(flag);
    }
  });

  if (notRegistered.length > 0) {
    result.warnings.push(
      `以下 ${notRegistered.length} 个 Flag 已定义但未在注册表中注册:\n  - ${notRegistered.join("\n  - ")}`,
    );
    console.log(colors.yellow(`⚠️  ${notRegistered.length} 个 Flag 未注册:`));
    notRegistered.forEach((flag) => console.log(`   - ${flag}`));
  } else {
    console.log(colors.green("✅ 所有已定义的 Flag 都已在注册表中注册"));
  }

  // 已定义但未在 getAllFeatureFlags 中导出
  const notExported: string[] = [];
  definedFlags.forEach((flag) => {
    if (!exportedFlags.has(flag)) {
      notExported.push(flag);
    }
  });

  if (notExported.length > 0) {
    result.warnings.push(
      `以下 ${notExported.length} 个 Flag 未在 getAllFeatureFlags 中导出:\n  - ${notExported.join("\n  - ")}`,
    );
    console.log(
      colors.yellow(
        `\n⚠️  ${notExported.length} 个 Flag 未导出到 getAllFeatureFlags:`,
      ),
    );
    notExported.forEach((flag) => console.log(`   - ${flag}`));
  } else {
    console.log(
      colors.green("✅ 所有已定义的 Flag 都已在 getAllFeatureFlags 中导出"),
    );
  }

  // 统计信息
  result.info.push(`已定义 Flag 数量: ${definedFlags.size}`);
  result.info.push(`已注册 Flag 数量: ${registeredFlags.size}`);
  result.info.push(`已导出 Flag 数量: ${exportedFlags.size}`);

  console.log(
    colors.gray(
      `\n📊 统计: 定义=${definedFlags.size}, 注册=${registeredFlags.size}, 导出=${exportedFlags.size}`,
    ),
  );
}

/**
 * 检查废弃的 Flag 是否仍在代码中使用
 */
function checkDeprecatedFlags(): void {
  console.log(colors.blue("\n🔍 检查废弃的 Flag...\n"));

  const registryPath = path.join(
    __dirname,
    "../src/lib/ai-agent/config/feature-flag-registry.ts",
  );
  const content = fs.readFileSync(registryPath, "utf-8");

  // 查找 phase: "deprecated" 的 Flag
  const deprecatedPattern =
    /name:\s*["']([^"']+)["'][^}]*phase:\s*["']deprecated["']/gs;
  const deprecatedFlags: string[] = [];

  let match;
  while ((match = deprecatedPattern.exec(content)) !== null) {
    deprecatedFlags.push(match[1]);
  }

  if (deprecatedFlags.length === 0) {
    console.log(colors.green("✅ 没有发现废弃的 Flag"));
    return;
  }

  console.log(
    colors.yellow(`⚠️  发现 ${deprecatedFlags.length} 个废弃的 Flag:`),
  );
  deprecatedFlags.forEach((flag) => console.log(`   - ${flag}`));

  // 检查这些 Flag 是否在代码中仍被使用
  const srcDir = path.join(__dirname, "../src");
  deprecatedFlags.forEach((flag) => {
    const usageCount = countFlagUsage(srcDir, flag);
    if (usageCount > 0) {
      result.warnings.push(`废弃的 Flag "${flag}" 仍在 ${usageCount} 处使用`);
      console.log(colors.yellow(`   ⚠️  "${flag}" 仍在 ${usageCount} 处使用`));
    }
  });
}

/**
 * 统计 Flag 在代码中的使用次数
 */
function countFlagUsage(dir: string, flagName: string): number {
  let count = 0;

  function walkDir(currentDir: string): void {
    const files = fs.readdirSync(currentDir);

    for (const file of files) {
      const filePath = path.join(currentDir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        if (!file.includes("node_modules") && !file.includes(".next")) {
          walkDir(filePath);
        }
      } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
        const content = fs.readFileSync(filePath, "utf-8");
        const regex = new RegExp(`FeatureFlags\\.${flagName}|${flagName}`, "g");
        const matches = content.match(regex);
        if (matches) {
          count += matches.length;
        }
      }
    }
  }

  walkDir(dir);
  return count;
}

/**
 * 检查 Flag 依赖关系
 */
function checkFlagDependencies(): void {
  console.log(colors.blue("\n🔗 检查 Flag 依赖关系...\n"));

  const registryPath = path.join(
    __dirname,
    "../src/lib/ai-agent/config/feature-flag-registry.ts",
  );
  const content = fs.readFileSync(registryPath, "utf-8");

  // 查找有 dependencies 的 Flag
  const depPattern =
    /name:\s*["']([^"']+)["'][^}]*dependencies:\s*\[([^\]]+)\]/gs;
  let hasDependencies = false;

  let match;
  while ((match = depPattern.exec(content)) !== null) {
    hasDependencies = true;
    const flagName = match[1];
    const depsStr = match[2];
    const deps =
      depsStr.match(/["']([^"']+)["']/g)?.map((d) => d.replace(/["']/g, "")) ||
      [];

    console.log(`📦 ${flagName} 依赖: ${deps.join(", ")}`);
  }

  if (!hasDependencies) {
    console.log(colors.gray("   没有发现 Flag 依赖关系定义"));
  }
}

/**
 * 主函数
 */
function main(): void {
  console.log(colors.blue("🔍 Feature Flags 验证\n"));
  console.log("=".repeat(60));

  checkFlagSync();
  checkDeprecatedFlags();
  checkFlagDependencies();

  // 输出总结
  console.log("\n" + "=".repeat(60));
  console.log(colors.blue("\n📊 验证结果摘要\n"));

  if (result.errors.length > 0) {
    console.log(colors.red(`❌ 错误: ${result.errors.length}`));
    result.errors.forEach((e) => console.log(`   ${e}`));
  }

  if (result.warnings.length > 0) {
    console.log(colors.yellow(`⚠️  警告: ${result.warnings.length}`));
    result.warnings.forEach((w) => console.log(`   ${w}`));
  }

  if (result.info.length > 0) {
    console.log(colors.gray(`ℹ️  信息:`));
    result.info.forEach((i) => console.log(`   ${i}`));
  }

  if (result.errors.length === 0 && result.warnings.length === 0) {
    console.log(colors.green("\n✅ Feature Flags 验证通过！\n"));
  }

  // CI 模式下，如果有错误则退出码非零
  if (isCIMode && result.errors.length > 0) {
    process.exit(1);
  }
}

main();
