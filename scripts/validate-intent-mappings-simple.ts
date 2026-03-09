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
 *
 * 规则格式（多行）：
 * {
 *   pattern: /regex/,
 *   type: "learn",
 *   subType: "path",
 *   complexity: "complex",
 *   weight: 95,
 * }
 */
function extractIntentRules(): Array<{ type: string; subType?: string }> {
  const filePath = join(
    __dirname,
    "../src/lib/ai-skills/router/intent-classifier.ts",
  );
  const content = readFileSync(filePath, "utf-8");

  const rules: Array<{ type: string; subType?: string }> = [];
  const seen = new Set<string>();

  // 多行匹配：查找 { ... type: "xxx", ... subType: "yyy" ... } 块
  // 支持跨行匹配
  const ruleBlockPattern =
    /\{\s*(?:[^{}]*?)type:\s*"(\w+)"[^{}]*?subType:\s*"(\w+)"[^{}]*?\}/gs;
  let match: RegExpExecArray | null;

  while ((match = ruleBlockPattern.exec(content)) !== null) {
    const type = match[1]!;
    const subType = match[2]!;
    const key = `${type}:${subType}`;

    // 去重
    if (!seen.has(key)) {
      seen.add(key);
      rules.push({ type, subType });
    }
  }

  // 如果上面没有匹配到，尝试更宽松的逐行匹配
  if (rules.length === 0) {
    // 备用模式：分别匹配 type 和 subType 行
    const typeMatches = [...content.matchAll(/type:\s*"(\w+)"/g)];
    const subTypeMatches = [...content.matchAll(/subType:\s*"(\w+)"/g)];

    // 假设 type 和 subType 成对出现
    const minLen = Math.min(typeMatches.length, subTypeMatches.length);
    for (let i = 0; i < minLen; i++) {
      const type = typeMatches[i]![1]!;
      const subType = subTypeMatches[i]![1]!;
      const key = `${type}:${subType}`;
      if (!seen.has(key)) {
        seen.add(key);
        rules.push({ type, subType });
      }
    }
  }

  return rules;
}

/**
 * 从文件中提取 Skill 映射
 *
 * 映射格式（多行）：
 * {
 *   key: "organize:cleanup",
 *   skillId: "organize_cleanup",
 *   name: "智能整理",
 *   mode: "orchestration",
 *   ...
 * }
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

  // 多行匹配：查找包含 key, skillId, mode 的对象块
  // 使用 's' 标志使 . 匹配换行符
  const mappingBlockPattern =
    /\{\s*key:\s*"([^"]+)"[^}]*?skillId:\s*"([^"]+)"[^}]*?mode:\s*"([^"]+)"[^}]*?\}/gs;
  let match: RegExpExecArray | null;

  while ((match = mappingBlockPattern.exec(content)) !== null) {
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
    // 只添加有 subType 的规则
    if (rule.subType) {
      const key = `${rule.type}:${rule.subType}`;
      intentKeys.add(key);
    }
  }

  const unmappedIntents: string[] = [];
  for (const intentKey of intentKeys) {
    const [type] = intentKey.split(":");
    const exactKey = intentKey; // 直接使用原始 key
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
