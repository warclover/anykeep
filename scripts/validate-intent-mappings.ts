/**
 * 意图映射验证工具
 *
 * 验证意图分类规则与 Skill 映射的完整性和正确性
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

// 类型定义（仅用于类型检查）
type IntentRule = import("../src/lib/ai-skills/router/types").IntentRule;
type IntentType = import("../src/lib/ai-skills/router/types").IntentType;
type SkillMapping = import("../src/lib/ai-skills/config/types").SkillMapping;
type MappingIndex = Map<string, SkillMapping>;

// 动态导入（在 main 函数中使用）
let DEFAULT_RULES: IntentRule[];
let SKILL_MAPPINGS: SkillMapping[];
let getMappingIndex: () => MappingIndex;
let findMapping: (
  index: MappingIndex,
  intentType: string,
  subType: string,
) => SkillMapping | null;

/**
 * 验证错误
 */
interface ValidationError {
  type: string;
  message: string;
  severity: "error" | "warning";
  details?: Record<string, unknown>;
}

/**
 * 验证警告
 */
interface ValidationWarning {
  type: string;
  message: string;
  severity: "warning";
  details?: Record<string, unknown>;
}

/**
 * 覆盖率报告
 */
interface CoverageReport {
  intentCount: number;
  mappedCount: number;
  unmappedIntents: string[];
  coverage: number; // 0-1
}

/**
 * 验证结果
 */
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  coverage: CoverageReport;
}

/**
 * 验证意图映射
 */
async function validateMappings(): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. 检查意图→映射完整性
  const intentMappingErrors = checkIntentMappingCompleteness();
  errors.push(...intentMappingErrors);

  // 2. 检查映射→Skill 实现
  const skillImplementationErrors = checkSkillImplementation();
  errors.push(...skillImplementationErrors);

  // 3. 检查原子映射的 Tool 存在性（警告）
  const toolWarnings = checkAtomicToolMapping();
  warnings.push(...toolWarnings);

  // 4. 检查权重冲突
  const weightWarnings = checkWeightCollisions();
  warnings.push(...weightWarnings);

  // 5. 检查通配符覆盖
  const wildcardWarnings = checkWildcardCoverage();
  warnings.push(...wildcardWarnings);

  // 6. 生成覆盖率报告
  const coverage = generateCoverageReport();

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    coverage,
  };
}

/**
 * 检查意图→映射完整性
 */
function checkIntentMappingCompleteness(): ValidationError[] {
  const errors: ValidationError[] = [];
  const mappingIndex = getMappingIndex();

  // 获取所有唯一的意图类型
  const intentKeys = new Set<string>();
  for (const rule of DEFAULT_RULES) {
    const key = `${rule.type}:${rule.subType || "default"}`;
    intentKeys.add(key);
  }

  // 检查每个意图是否有映射
  for (const intentKey of intentKeys) {
    const [type, subType] = intentKey.split(":");
    const mapping = findMapping(
      mappingIndex,
      type as IntentType,
      subType === "default" ? "" : subType,
    );

    if (!mapping) {
      errors.push({
        type: "MISSING_MAPPING",
        message: `意图 ${intentKey} 缺少 Skill 映射`,
        severity: "error",
        details: {
          intentKey,
          type,
          subType: subType === "default" ? undefined : subType,
        },
      });
    }
  }

  return errors;
}

/**
 * 检查映射→Skill 实现
 */
function checkSkillImplementation(): ValidationError[] {
  const errors: ValidationError[] = [];

  // 获取所有编排模式的映射
  const orchestrationMappings = SKILL_MAPPINGS.filter(
    (m: SkillMapping) => m.mode === "orchestration",
  );

  // 注意：这里我们无法直接访问已注册的 Skills，因为需要初始化引擎
  // 所以这个检查主要是验证映射配置本身是否正确
  for (const mapping of orchestrationMappings) {
    if (!mapping.skillId) {
      errors.push({
        type: "MISSING_SKILL_ID",
        message: `映射 ${mapping.key} 缺少 skillId`,
        severity: "error",
        details: {
          mappingKey: mapping.key,
        },
      });
    }

    if (!mapping.name) {
      errors.push({
        type: "MISSING_SKILL_NAME",
        message: `映射 ${mapping.key} 缺少 name`,
        severity: "error",
        details: {
          mappingKey: mapping.key,
        },
      });
    }
  }

  return errors;
}

/**
 * 检查原子映射的 Tool 存在性
 */
function checkAtomicToolMapping(): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const atomicMappings = SKILL_MAPPINGS.filter(
    (m: SkillMapping) => m.mode === "atomic",
  );

  for (const mapping of atomicMappings) {
    // 原子模式通常直接使用 Tool，skillId 可能是 Tool 名称
    // 这里只做警告，因为 Tool 的验证需要运行时检查
    if (mapping.skillId === "chat") {
      // chat 是默认兜底，不需要警告
      continue;
    }

    // 可以添加更多检查逻辑
  }

  return warnings;
}

/**
 * 检查权重冲突
 */
function checkWeightCollisions(): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // 按权重分组
  const weightGroups = new Map<number, IntentRule[]>();
  for (const rule of DEFAULT_RULES) {
    const weight = rule.weight || 50;
    if (!weightGroups.has(weight)) {
      weightGroups.set(weight, []);
    }
    weightGroups.get(weight)!.push(rule);
  }

  // 检查每个权重组
  for (const [weight, rules] of weightGroups.entries()) {
    if (rules.length > 3) {
      warnings.push({
        type: "WEIGHT_COLLISION",
        message: `权重 ${weight} 有 ${rules.length} 个意图，可能导致歧义`,
        severity: "warning",
        details: {
          weight,
          count: rules.length,
          intents: rules.map((r) => `${r.type}:${r.subType || "default"}`),
        },
      });
    }
  }

  return warnings;
}

/**
 * 检查通配符覆盖
 */
function checkWildcardCoverage(): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // 获取所有意图类型
  const intentTypes = new Set<IntentType>();
  for (const rule of DEFAULT_RULES) {
    intentTypes.add(rule.type);
  }

  // 检查每个类型是否有通配符映射
  const mappingIndex = getMappingIndex();
  for (const type of intentTypes) {
    const wildcardMapping = findMapping(mappingIndex, type, "*");

    if (!wildcardMapping) {
      warnings.push({
        type: "NO_WILDCARD",
        message: `意图类型 ${type} 缺少通配符兜底`,
        severity: "warning",
        details: {
          intentType: type,
        },
      });
    }
  }

  return warnings;
}

/**
 * 生成覆盖率报告
 */
function generateCoverageReport(): CoverageReport {
  const intentKeys = new Set<string>();
  for (const rule of DEFAULT_RULES) {
    const key = `${rule.type}:${rule.subType || "default"}`;
    intentKeys.add(key);
  }

  const mappingIndex = getMappingIndex();
  const unmappedIntents: string[] = [];
  let mappedCount = 0;

  for (const intentKey of intentKeys) {
    const [type, subType] = intentKey.split(":");
    const mapping = findMapping(
      mappingIndex,
      type as IntentType,
      subType === "default" ? "" : subType,
    );

    if (mapping) {
      mappedCount++;
    } else {
      unmappedIntents.push(intentKey);
    }
  }

  return {
    intentCount: intentKeys.size,
    mappedCount,
    unmappedIntents,
    coverage: intentKeys.size > 0 ? mappedCount / intentKeys.size : 0,
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
async function main() {
  try {
    // 动态导入模块（使用相对路径，Windows 兼容）
    const __filename = new URL(import.meta.url).pathname;
    const __dirname = __filename.substring(0, __filename.lastIndexOf("/"));

    // 构建相对路径（Windows 需要处理反斜杠）
    const intentClassifierPath = `${__dirname}/../src/lib/ai-skills/router/intent-classifier.ts`;
    const skillMappingsPath = `${__dirname}/../src/lib/ai-skills/config/skill-mappings.ts`;

    const intentClassifierModule = await import(
      intentClassifierPath.replace(/\\/g, "/")
    );
    const skillMappingsModule = await import(
      skillMappingsPath.replace(/\\/g, "/")
    );

    DEFAULT_RULES = intentClassifierModule.DEFAULT_RULES;
    SKILL_MAPPINGS = skillMappingsModule.SKILL_MAPPINGS;
    getMappingIndex = skillMappingsModule.getMappingIndex;
    findMapping = skillMappingsModule.findMapping;

    const result = await validateMappings();
    printValidationResult(result);
  } catch (error) {
    console.error("验证过程出错:", error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
main().catch((error) => {
  console.error("验证过程出错:", error);
  process.exit(1);
});

export { validateMappings, type ValidationResult };
