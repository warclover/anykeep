/**
 * 意图映射验证工具（简化版）
 *
 * 直接读取文件内容，避免模块解析问题
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ValidationError {
  type: string;
  message: string;
  severity: "error" | "warning";
  details?: Record<string, unknown>;
}

interface ValidationWarning {
  type: string;
  message: string;
  severity: "warning";
  details?: Record<string, unknown>;
}

interface CoverageReport {
  intentCount: number;
  mappedCount: number;
  unmappedIntents: string[];
  coverage: number;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  coverage: CoverageReport;
}

/**
 * 从文件中提取意图规则
 */
function extractIntentRules(): Array<{ type: string; subType?: string }> {
  const filePath = join(
    __dirname,
    "../src/lib/ai-skills/router/intent-classifier.ts",
  );
  const content = readFileSync(filePath, "utf-8");

  const rules: Array<{ type: string; subType?: string }> = [];
  const rulePattern = /type:\s*"(\w+)",\s*subType:\s*"(\w+)"/g;
  let match: RegExpExecArray | null;

  while ((match = rulePattern.exec(content)) !== null) {
    rules.push({
      type: match[1]!,
      subType: match[2],
    });
  }

  // 也匹配没有 subType 的情况
  const rulePatternNoSubType = /type:\s*"(\w+)",\s*complexity:/g;
  while ((match = rulePatternNoSubType.exec(content)) !== null) {
    if (match) {
      const type = match[1]!;
      if (!rules.some((r) => r.type === type && !r.subType)) {
        rules.push({
          type,
        });
      }
    }
  }

  return rules;
}

/**
 * 从文件中提取 Skill 映射
 */
function extractSkillMappings(): Array<{
  key: string;
  skillId: string;
  mode: string;
}> {
  const filePath = join(
    __dirname,
    "../src/lib/ai-skills/config/skill-mappings.ts",
  );
  const content = readFileSync(filePath, "utf-8");

  const mappings: Array<{ key: string; skillId: string; mode: string }> = [];
  const mappingPattern =
    /key:\s*"([^"]+)",\s*skillId:\s*"([^"]+)",\s*mode:\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = mappingPattern.exec(content)) !== null) {
    mappings.push({
      key: match[1]!,
      skillId: match[2]!,
      mode: match[3]!,
    });
  }

  return mappings;
}

/**
 * 验证意图映射
 */
function validateMappings(): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 提取意图规则和映射
  const rules = extractIntentRules();
  const mappings = extractSkillMappings();

  // 构建映射索引
  const mappingIndex = new Map<string, { skillId: string; mode: string }>();
  for (const mapping of mappings) {
    mappingIndex.set(mapping.key, {
      skillId: mapping.skillId,
      mode: mapping.mode,
    });
  }

  // 1. 检查意图→映射完整性
  const intentKeys = new Set<string>();
  for (const rule of rules) {
    const key = rule.subType
      ? `${rule.type}:${rule.subType}`
      : `${rule.type}:default`;
    intentKeys.add(key);
  }

  const unmappedIntents: string[] = [];
  for (const intentKey of intentKeys) {
    const [type, subType] = intentKey.split(":");
    const exactKey = `${type}:${subType === "default" ? "" : subType}`;
    const wildcardKey = `${type}:*`;

    const hasExactMapping = mappingIndex.has(exactKey);
    const hasWildcardMapping = mappingIndex.has(wildcardKey);

    if (!hasExactMapping && !hasWildcardMapping) {
      errors.push({
        type: "MISSING_MAPPING",
        message: `意图 ${intentKey} 缺少 Skill 映射`,
        severity: "error",
        details: { intentKey },
      });
      unmappedIntents.push(intentKey);
    }
  }

  // 2. 检查通配符覆盖
  const intentTypes = new Set(rules.map((r) => r.type));
  for (const type of intentTypes) {
    const wildcardKey = `${type}:*`;
    if (!mappingIndex.has(wildcardKey)) {
      warnings.push({
        type: "NO_WILDCARD",
        message: `意图类型 ${type} 缺少通配符兜底`,
        severity: "warning",
        details: { intentType: type },
      });
    }
  }

  // 3. 生成覆盖率报告
  const mappedCount = intentKeys.size - unmappedIntents.length;
  const coverage: CoverageReport = {
    intentCount: intentKeys.size,
    mappedCount,
    unmappedIntents,
    coverage: intentKeys.size > 0 ? mappedCount / intentKeys.size : 0,
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    coverage,
  };
}

/**
 * 打印验证结果
 */
function printValidationResult(result: ValidationResult): void {
  console.log("\n" + "=".repeat(60));
  console.log("意图映射验证报告");
  console.log("=".repeat(60) + "\n");

  // 覆盖率
  console.log("📊 覆盖率报告");
  console.log(`  意图总数: ${result.coverage.intentCount}`);
  console.log(`  已映射: ${result.coverage.mappedCount}`);
  console.log(`  覆盖率: ${(result.coverage.coverage * 100).toFixed(1)}%`);
  if (result.coverage.unmappedIntents.length > 0) {
    console.log(`  未映射意图: ${result.coverage.unmappedIntents.join(", ")}`);
  }
  console.log();

  // 错误
  if (result.errors.length > 0) {
    console.log("❌ 错误 (" + result.errors.length + ")");
    for (const error of result.errors) {
      console.log(`  [${error.type}] ${error.message}`);
      if (error.details) {
        console.log(`    详情:`, error.details);
      }
    }
    console.log();
  }

  // 警告
  if (result.warnings.length > 0) {
    console.log("⚠️  警告 (" + result.warnings.length + ")");
    for (const warning of result.warnings) {
      console.log(`  [${warning.type}] ${warning.message}`);
      if (warning.details) {
        console.log(`    详情:`, warning.details);
      }
    }
    console.log();
  }

  // 总结
  if (result.valid) {
    console.log("✅ 验证通过！所有映射配置正确。");
  } else {
    console.log("❌ 验证失败！请修复上述错误。");
    process.exit(1);
  }

  console.log("=".repeat(60) + "\n");
}

/**
 * 主函数
 */
function main() {
  try {
    const result = validateMappings();
    printValidationResult(result);
  } catch (error) {
    console.error("验证过程出错:", error);
    process.exit(1);
  }
}

// 运行
main();

export { validateMappings, type ValidationResult };
