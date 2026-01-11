#!/usr/bin/env ts-node
/**
 * 类型冲突检测脚本
 *
 * 扫描所有 types.ts 文件，检测同名但不同定义的类型
 *
 * @module scripts/check-type-duplicates
 * @version 1.0.0
 * @since 2026-01-11
 *
 * @example
 * ```bash
 * # 运行检测
 * npx ts-node scripts/check-type-duplicates.ts
 *
 * # 生成 JSON 报告
 * npx ts-node scripts/check-type-duplicates.ts --json > type-conflicts.json
 *
 * # CI 模式（发现冲突时退出码为 1）
 * npx ts-node scripts/check-type-duplicates.ts --ci
 * ```
 */

import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";

// =============================================================================
// 类型定义
// =============================================================================

interface TypeDefinition {
  name: string;
  kind: "type" | "interface" | "enum" | "const";
  file: string;
  line: number;
  definition: string;
  hash: string;
}

interface TypeConflict {
  name: string;
  kind: string;
  occurrences: Array<{
    file: string;
    line: number;
    definition: string;
    hash: string;
  }>;
  severity: "error" | "warning";
  suggestion: string;
}

interface ScanResult {
  totalFiles: number;
  totalTypes: number;
  duplicateNames: number;
  conflicts: TypeConflict[];
  warnings: string[];
}

// =============================================================================
// 配置
// =============================================================================

const CONFIG = {
  // 扫描目录
  srcDir: path.join(process.cwd(), "src"),
  // 忽略的目录
  ignoreDirs: ["node_modules", ".next", "dist", "__tests__", "__mocks__"],
  // 类型文件模式
  typeFilePatterns: ["**/types.ts", "**/types/*.ts", "**/types/index.ts"],
  // 已知的统一类型定义位置（这些位置的定义是权威的）
  canonicalPaths: ["src/lib/shared/types/", "src/types/"],
  // 允许的重复（例如：不同模块的同名但不同语义的类型）
  allowedDuplicates: [
    // { name: "Config", files: ["moduleA/types.ts", "moduleB/types.ts"] }
  ],
};

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 简单的字符串哈希函数
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * 标准化类型定义（移除空白字符，便于比较）
 */
function normalizeDefinition(def: string): string {
  return def
    .replace(/\/\/.*$/gm, "") // 移除单行注释
    .replace(/\/\*[\s\S]*?\*\//g, "") // 移除多行注释
    .replace(/\s+/g, " ") // 合并空白
    .trim();
}

/**
 * 提取类型定义
 */
function extractTypeDefinitions(filePath: string): TypeDefinition[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const definitions: TypeDefinition[] = [];

  // 匹配 export type, export interface, export enum, export const
  const patterns = [
    {
      regex: /export\s+type\s+(\w+)\s*=/,
      kind: "type" as const,
    },
    {
      regex: /export\s+interface\s+(\w+)/,
      kind: "interface" as const,
    },
    {
      regex: /export\s+enum\s+(\w+)/,
      kind: "enum" as const,
    },
    {
      regex: /export\s+const\s+(\w+)\s*[=:]/,
      kind: "const" as const,
    },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const { regex, kind } of patterns) {
      const match = line.match(regex);
      if (match) {
        const name = match[1];

        // 提取完整定义（简化版，只取当前行到下一个 export 或文件结束）
        let definition = line;
        let braceCount = 0;
        let j = i;

        // 计算括号平衡
        for (const char of line) {
          if (char === "{" || char === "(") braceCount++;
          if (char === "}" || char === ")") braceCount--;
        }

        // 如果括号不平衡，继续读取后续行
        while (braceCount > 0 && j < lines.length - 1) {
          j++;
          const nextLine = lines[j];
          definition += "\n" + nextLine;

          for (const char of nextLine) {
            if (char === "{" || char === "(") braceCount++;
            if (char === "}" || char === ")") braceCount--;
          }
        }

        const normalizedDef = normalizeDefinition(definition);

        definitions.push({
          name,
          kind,
          file: filePath,
          line: i + 1,
          definition: definition.trim(),
          hash: hashString(normalizedDef),
        });
      }
    }
  }

  return definitions;
}

/**
 * 扫描类型文件
 */
function scanTypeFiles(): TypeDefinition[] {
  const allDefinitions: TypeDefinition[] = [];

  for (const pattern of CONFIG.typeFilePatterns) {
    const files = glob.sync(path.join(CONFIG.srcDir, pattern), {
      ignore: CONFIG.ignoreDirs.map((dir) => `**/${dir}/**`),
    });

    for (const file of files) {
      try {
        const definitions = extractTypeDefinitions(file);
        allDefinitions.push(...definitions);
      } catch (error) {
        console.error(`Error parsing ${file}:`, error);
      }
    }
  }

  return allDefinitions;
}

/**
 * 检测冲突
 */
function detectConflicts(definitions: TypeDefinition[]): TypeConflict[] {
  const byName = new Map<string, TypeDefinition[]>();

  // 按名称分组
  for (const def of definitions) {
    const key = `${def.kind}:${def.name}`;
    const existing = byName.get(key) || [];
    existing.push(def);
    byName.set(key, existing);
  }

  const conflicts: TypeConflict[] = [];

  for (const [key, defs] of byName) {
    if (defs.length <= 1) continue;

    // 检查是否所有定义都相同
    const hashes = new Set(defs.map((d) => d.hash));

    if (hashes.size > 1) {
      // 存在不同的定义 = 冲突
      const [kind, name] = key.split(":");

      // 检查是否在规范位置有定义
      const hasCanonical = defs.some((d) =>
        CONFIG.canonicalPaths.some((p) => d.file.includes(p)),
      );

      conflicts.push({
        name,
        kind,
        occurrences: defs.map((d) => ({
          file: path.relative(process.cwd(), d.file),
          line: d.line,
          definition:
            d.definition.slice(0, 100) +
            (d.definition.length > 100 ? "..." : ""),
          hash: d.hash,
        })),
        severity: hasCanonical ? "warning" : "error",
        suggestion: hasCanonical
          ? `建议统一导入自 src/lib/shared/types/`
          : `建议将 ${name} 移至 src/lib/shared/types/ 并统一导入`,
      });
    }
  }

  return conflicts;
}

/**
 * 生成报告
 */
function generateReport(result: ScanResult): string {
  const lines: string[] = [
    "# 类型冲突检测报告",
    "",
    `> 扫描时间: ${new Date().toISOString()}`,
    "",
    "## 统计概览",
    "",
    "| 指标 | 值 |",
    "|------|-----|",
    `| 扫描文件数 | ${result.totalFiles} |`,
    `| 发现类型数 | ${result.totalTypes} |`,
    `| 重复名称数 | ${result.duplicateNames} |`,
    `| 冲突数量 | ${result.conflicts.length} |`,
    "",
  ];

  if (result.conflicts.length > 0) {
    lines.push("## 冲突详情", "");

    for (const conflict of result.conflicts) {
      const icon = conflict.severity === "error" ? "🔴" : "🟡";
      lines.push(`### ${icon} ${conflict.kind} \`${conflict.name}\``, "");
      lines.push(`**严重程度**: ${conflict.severity}`, "");
      lines.push(`**建议**: ${conflict.suggestion}`, "");
      lines.push("", "**出现位置**:", "");

      for (const occ of conflict.occurrences) {
        lines.push(`- \`${occ.file}:${occ.line}\` (hash: ${occ.hash})`);
        lines.push("  ```typescript");
        lines.push(`  ${occ.definition}`);
        lines.push("  ```");
      }

      lines.push("");
    }
  } else {
    lines.push("## ✅ 未发现类型冲突", "");
  }

  if (result.warnings.length > 0) {
    lines.push("## 警告", "");
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// =============================================================================
// 主函数
// =============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const isJson = args.includes("--json");
  const isCi = args.includes("--ci");

  console.log("🔍 扫描类型文件...\n");

  const definitions = scanTypeFiles();
  const conflicts = detectConflicts(definitions);

  // 统计重复名称
  const nameCount = new Map<string, number>();
  for (const def of definitions) {
    const key = `${def.kind}:${def.name}`;
    nameCount.set(key, (nameCount.get(key) || 0) + 1);
  }
  const duplicateNames = Array.from(nameCount.values()).filter(
    (c) => c > 1,
  ).length;

  const result: ScanResult = {
    totalFiles: new Set(definitions.map((d) => d.file)).size,
    totalTypes: definitions.length,
    duplicateNames,
    conflicts,
    warnings: [],
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(generateReport(result));

    // 打印统计
    console.log("---");
    console.log(
      `📊 统计: ${result.totalTypes} 个类型, ${result.duplicateNames} 个重复名称, ${result.conflicts.length} 个冲突`,
    );
  }

  // CI 模式：有冲突时返回错误码
  if (isCi && result.conflicts.some((c) => c.severity === "error")) {
    process.exit(1);
  }
}

// 执行
main();
