#!/usr/bin/env ts-node
/**
 * folderId 类型一致性检测脚本
 *
 * 检测项目中 folderId: string 的使用，确保统一为 number 类型
 * 在 CI 中运行，发现 string 类型则失败
 *
 * @usage
 *   npx ts-node scripts/check-folder-id-types.ts
 *   npm run check:folder-id-types
 */

import { execSync } from "child_process";
import * as path from "path";

// 允许使用 string 的白名单文件（如 API 路由的动态参数）
const WHITELIST_PATTERNS = [
  // 动态路由参数天然是 string，需要在运行时转换
  "src/app/api/classification/v5/folder-profile/\\[folderId\\]",
  // 类型定义文件中的注释
  "src/lib/shared/types/folder.ts",
];

// 检测模式
const DETECTION_PATTERNS = [
  // 接口/类型定义中的 folderId: string
  "folderId:\\s*string",
  // 函数参数中的 folderId: string
  "folderId:\\s*string\\s*[,)]",
  // 泛型中的 folderId: string
  "folderId:\\s*string\\s*[|>]",
];

function main(): void {
  console.log("🔍 检测 folderId 类型一致性...\n");

  const srcPath = path.resolve(__dirname, "../src");
  const scriptsPath = path.resolve(__dirname, ".");

  let hasErrors = false;
  const findings: Array<{ file: string; line: number; content: string }> = [];

  for (const pattern of DETECTION_PATTERNS) {
    try {
      // 使用 grep 搜索 src 目录
      const srcResult = execSync(
        `grep -rn "${pattern}" "${srcPath}" --include="*.ts" --include="*.tsx" 2>/dev/null || true`,
        { encoding: "utf-8" },
      );

      // 使用 grep 搜索 scripts 目录
      const scriptsResult = execSync(
        `grep -rn "${pattern}" "${scriptsPath}" --include="*.ts" 2>/dev/null || true`,
        { encoding: "utf-8" },
      );

      const results = (srcResult + scriptsResult).trim();

      if (results) {
        const lines = results.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          // 检查是否在白名单中
          const isWhitelisted = WHITELIST_PATTERNS.some((whitelistPattern) =>
            line.includes(
              whitelistPattern.replace(/\\\[/g, "[").replace(/\\\]/g, "]"),
            ),
          );

          if (!isWhitelisted) {
            // 解析文件路径和行号
            const match = line.match(/^(.+):(\d+):(.+)$/);
            if (match) {
              findings.push({
                file: match[1],
                line: parseInt(match[2], 10),
                content: match[3].trim(),
              });
            }
          }
        }
      }
    } catch (error) {
      // grep 没找到匹配时返回非零退出码，忽略这种情况
      if ((error as NodeJS.ErrnoException).status !== 1) {
        console.error(`执行 grep 时出错: ${error}`);
      }
    }
  }

  // 去重
  const uniqueFindings = findings.filter(
    (finding, index, self) =>
      index ===
      self.findIndex((f) => f.file === finding.file && f.line === finding.line),
  );

  if (uniqueFindings.length > 0) {
    hasErrors = true;
    console.error("❌ 发现 folderId: string 类型使用:\n");

    // 按文件分组显示
    const byFile = new Map<string, typeof uniqueFindings>();
    for (const finding of uniqueFindings) {
      const existing = byFile.get(finding.file) || [];
      existing.push(finding);
      byFile.set(finding.file, existing);
    }

    for (const [file, fileFindings] of byFile) {
      const relativePath = file.replace(
        path.resolve(__dirname, "..") + path.sep,
        "",
      );
      console.error(`  📄 ${relativePath}`);
      for (const finding of fileFindings) {
        console.error(`     Line ${finding.line}: ${finding.content}`);
      }
      console.error("");
    }

    console.error(`\n共发现 ${uniqueFindings.length} 处需要修复。`);
    console.error("\n💡 修复建议:");
    console.error("   1. 将 folderId: string 改为 folderId: number");
    console.error("   2. 对于可空场景使用 folderId: number | null");
    console.error(
      "   3. 导入统一类型: import type { FolderId } from '@/lib/shared/types'",
    );
  } else {
    console.log("✅ 所有 folderId 类型均为 number，符合规范！");
  }

  // 统计信息
  console.log("\n📊 统计信息:");
  console.log(`   检测目录: src/, scripts/`);
  console.log(`   白名单文件: ${WHITELIST_PATTERNS.length} 个模式`);
  console.log(`   检测模式: ${DETECTION_PATTERNS.length} 个`);
  console.log(`   发现问题: ${uniqueFindings.length} 处`);

  process.exit(hasErrors ? 1 : 0);
}

main();
