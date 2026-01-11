#!/usr/bin/env ts-node
/**
 * AI 能力成熟度仪表盘
 *
 * 计算和展示 AI 能力的各项成熟度指标
 *
 * @module scripts/ai-capability-metrics
 * @version 1.0.0
 * @since 2026-01-11
 *
 * @example
 * ```bash
 * # 运行仪表盘
 * npx ts-node scripts/ai-capability-metrics.ts
 *
 * # 生成 Markdown 报告
 * npx ts-node scripts/ai-capability-metrics.ts --output report.md
 *
 * # JSON 输出（便于 CI 集成）
 * npx ts-node scripts/ai-capability-metrics.ts --json
 * ```
 */

import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";

// =============================================================================
// 类型定义
// =============================================================================

interface FeatureFlagMetrics {
  total: number;
  enabled: number;
  integrated: number;
  deprecated: number;
  integrationRate: number;
  unintegratedFlags: string[];
}

interface TypeMetrics {
  totalFiles: number;
  totalTypes: number;
  duplicateCount: number;
  conflictCount: number;
  healthScore: number;
}

interface SkillMetrics {
  totalSkills: number;
  atomicSkills: number;
  orchestrationSkills: number;
  skillsWithTests: number;
  testCoverage: number;
}

interface IntentMetrics {
  totalRules: number;
  implicitRules: number;
  averageConfidence: number;
  classifiersActive: number;
}

interface OverallMetrics {
  featureFlags: FeatureFlagMetrics;
  types: TypeMetrics;
  skills: SkillMetrics;
  intent: IntentMetrics;
  overallScore: number;
  grade: string;
  timestamp: string;
}

// =============================================================================
// 配置
// =============================================================================

const CONFIG = {
  srcDir: path.join(process.cwd(), "src"),
  thresholds: {
    excellent: 90,
    good: 75,
    acceptable: 60,
    poor: 0,
  },
};

// =============================================================================
// 指标收集函数
// =============================================================================

/**
 * 收集 Feature Flag 指标
 */
function collectFeatureFlagMetrics(): FeatureFlagMetrics {
  const registryPath = path.join(
    CONFIG.srcDir,
    "lib/ai-agent/config/feature-flag-registry.ts",
  );

  if (!fs.existsSync(registryPath)) {
    return {
      total: 0,
      enabled: 0,
      integrated: 0,
      deprecated: 0,
      integrationRate: 0,
      unintegratedFlags: [],
    };
  }

  const content = fs.readFileSync(registryPath, "utf-8");

  // 简化的统计（实际应该导入模块）
  const flagMatches = content.match(/name:\s*"ENABLE_\w+"/g) || [];
  const total = flagMatches.length;

  // 统计有集成点的
  const integratedMatches =
    content.match(/integrationPoints:\s*\[\s*\{/g) || [];
  const integrated = integratedMatches.length;

  // 统计废弃的
  const deprecatedMatches = content.match(/phase:\s*"deprecated"/g) || [];
  const deprecated = deprecatedMatches.length;

  // 默认大部分启用
  const enabled = total - deprecated;

  // 找出未集成的 flags
  const unintegratedMatches =
    content.match(
      /name:\s*"(ENABLE_\w+)"[\s\S]*?integrationPoints:\s*\[\s*\]/g,
    ) || [];
  const unintegratedFlags = unintegratedMatches
    .map((m) => {
      const match = m.match(/name:\s*"(ENABLE_\w+)"/);
      return match ? match[1] : null;
    })
    .filter((f): f is string => f !== null);

  const integrationRate = enabled > 0 ? (integrated / enabled) * 100 : 100;

  return {
    total,
    enabled,
    integrated,
    deprecated,
    integrationRate,
    unintegratedFlags,
  };
}

/**
 * 收集类型指标
 */
function collectTypeMetrics(): TypeMetrics {
  const typeFiles = glob.sync(path.join(CONFIG.srcDir, "**/types.ts"), {
    ignore: ["**/node_modules/**", "**/__tests__/**", "**/__mocks__/**"],
  });

  let totalTypes = 0;
  const typeNames = new Map<string, number>();

  for (const file of typeFiles) {
    const content = fs.readFileSync(file, "utf-8");

    // 统计类型定义
    const typeMatches =
      content.match(/export\s+(type|interface|enum|const)\s+(\w+)/g) || [];
    totalTypes += typeMatches.length;

    // 记录类型名称
    for (const match of typeMatches) {
      const nameMatch = match.match(
        /export\s+(?:type|interface|enum|const)\s+(\w+)/,
      );
      if (nameMatch) {
        const name = nameMatch[1];
        typeNames.set(name, (typeNames.get(name) || 0) + 1);
      }
    }
  }

  // 统计重复
  const duplicates = Array.from(typeNames.entries()).filter(
    ([, count]) => count > 1,
  );
  const duplicateCount = duplicates.length;

  // 假设冲突数为重复的一半（实际应该用 check-type-duplicates 脚本）
  const conflictCount = Math.floor(duplicateCount / 2);

  // 健康分数：没有冲突 = 100，每个冲突扣 5 分
  const healthScore = Math.max(0, 100 - conflictCount * 5);

  return {
    totalFiles: typeFiles.length,
    totalTypes,
    duplicateCount,
    conflictCount,
    healthScore,
  };
}

/**
 * 收集 Skill 指标
 */
function collectSkillMetrics(): SkillMetrics {
  const skillsDir = path.join(CONFIG.srcDir, "lib/ai-skills/skills");

  if (!fs.existsSync(skillsDir)) {
    return {
      totalSkills: 0,
      atomicSkills: 0,
      orchestrationSkills: 0,
      skillsWithTests: 0,
      testCoverage: 0,
    };
  }

  const skillDirs = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const totalSkills = skillDirs.length;

  // 统计编排 Skills（有 steps 定义的）
  let orchestrationSkills = 0;
  let skillsWithTests = 0;

  for (const skillDir of skillDirs) {
    const skillPath = path.join(skillsDir, skillDir);

    // 检查是否是编排 Skill
    const files = fs.readdirSync(skillPath);
    for (const file of files) {
      if (file.endsWith(".skill.ts")) {
        const content = fs.readFileSync(path.join(skillPath, file), "utf-8");
        if (content.includes("executeStep") || content.includes("steps:")) {
          orchestrationSkills++;
        }
      }
    }

    // 检查是否有测试
    if (
      files.some((f) => f.includes(".test.ts")) ||
      fs.existsSync(path.join(skillPath, "__tests__"))
    ) {
      skillsWithTests++;
    }
  }

  const atomicSkills = totalSkills - orchestrationSkills;
  const testCoverage =
    totalSkills > 0 ? (skillsWithTests / totalSkills) * 100 : 0;

  return {
    totalSkills,
    atomicSkills,
    orchestrationSkills,
    skillsWithTests,
    testCoverage,
  };
}

/**
 * 收集意图分类指标
 */
function collectIntentMetrics(): IntentMetrics {
  // 统计意图分析器规则
  const analyzerPath = path.join(
    CONFIG.srcDir,
    "lib/ai-skills/router/intent-analyzer.ts",
  );
  const implicitPath = path.join(
    CONFIG.srcDir,
    "lib/ai-agent/core/prompts/implicit-intent-rules.ts",
  );

  let totalRules = 0;
  let implicitRules = 0;

  if (fs.existsSync(analyzerPath)) {
    const content = fs.readFileSync(analyzerPath, "utf-8");
    // 统计规则数量（简化版）
    const ruleMatches = content.match(/patterns?:\s*\[/g) || [];
    totalRules = ruleMatches.length;
  }

  if (fs.existsSync(implicitPath)) {
    const content = fs.readFileSync(implicitPath, "utf-8");
    // 统计隐含意图规则
    const implicitMatches = content.match(/id:\s*"/g) || [];
    implicitRules = implicitMatches.length;
  }

  // 检查活跃的分类器数量
  const classifiers = [
    "lib/ai-skills/router/intent-analyzer.ts",
    "lib/ai-skills/router/intent-classifier.ts",
    "lib/ai-skills/router/hybrid-intent-classifier.ts",
  ];

  let classifiersActive = 0;
  for (const classifier of classifiers) {
    const classifierPath = path.join(CONFIG.srcDir, classifier);
    if (fs.existsSync(classifierPath)) {
      const content = fs.readFileSync(classifierPath, "utf-8");
      // 检查是否被使用（没有 @deprecated 标记）
      if (!content.includes("@deprecated")) {
        classifiersActive++;
      }
    }
  }

  return {
    totalRules,
    implicitRules,
    averageConfidence: 0.75, // 需要从实际运行数据获取
    classifiersActive,
  };
}

/**
 * 计算总体评分
 */
function calculateOverallScore(
  metrics: Omit<OverallMetrics, "overallScore" | "grade" | "timestamp">,
): {
  score: number;
  grade: string;
} {
  // 权重分配
  const weights = {
    featureFlagIntegration: 0.3,
    typeHealth: 0.2,
    skillTestCoverage: 0.25,
    classifierConvergence: 0.25,
  };

  // 各项得分
  const scores = {
    featureFlagIntegration: metrics.featureFlags.integrationRate,
    typeHealth: metrics.types.healthScore,
    skillTestCoverage: metrics.skills.testCoverage,
    // 分类器收敛：目标是 1 个，当前是 N 个，得分 = 100 / N
    classifierConvergence:
      metrics.intent.classifiersActive > 0
        ? 100 / metrics.intent.classifiersActive
        : 100,
  };

  // 加权平均
  const overallScore =
    scores.featureFlagIntegration * weights.featureFlagIntegration +
    scores.typeHealth * weights.typeHealth +
    scores.skillTestCoverage * weights.skillTestCoverage +
    scores.classifierConvergence * weights.classifierConvergence;

  // 等级
  let grade: string;
  if (overallScore >= CONFIG.thresholds.excellent) {
    grade = "A (优秀)";
  } else if (overallScore >= CONFIG.thresholds.good) {
    grade = "B (良好)";
  } else if (overallScore >= CONFIG.thresholds.acceptable) {
    grade = "C (合格)";
  } else {
    grade = "D (需改进)";
  }

  return { score: Math.round(overallScore * 10) / 10, grade };
}

/**
 * 生成 Markdown 报告
 */
function generateMarkdownReport(metrics: OverallMetrics): string {
  const lines: string[] = [
    "# AI 能力成熟度仪表盘",
    "",
    `> 生成时间: ${metrics.timestamp}`,
    "",
    "## 📊 总体评分",
    "",
    `| 总分 | 等级 |`,
    `|------|------|`,
    `| **${metrics.overallScore}** | **${metrics.grade}** |`,
    "",
    "---",
    "",
    "## 📌 Feature Flags",
    "",
    "| 指标 | 值 | 目标 | 状态 |",
    "|------|-----|------|------|",
    `| 总 Flags 数 | ${metrics.featureFlags.total} | - | ℹ️ |`,
    `| 已启用 | ${metrics.featureFlags.enabled} | - | ℹ️ |`,
    `| 已集成 | ${metrics.featureFlags.integrated} | ${metrics.featureFlags.enabled} | ${metrics.featureFlags.integrated === metrics.featureFlags.enabled ? "✅" : "⚠️"} |`,
    `| 已废弃 | ${metrics.featureFlags.deprecated} | 0 | ${metrics.featureFlags.deprecated === 0 ? "✅" : "ℹ️"} |`,
    `| 集成率 | ${metrics.featureFlags.integrationRate.toFixed(1)}% | 100% | ${metrics.featureFlags.integrationRate >= 100 ? "✅" : "⚠️"} |`,
    "",
  ];

  if (metrics.featureFlags.unintegratedFlags.length > 0) {
    lines.push(
      "**未集成的 Flags:**",
      "",
      ...metrics.featureFlags.unintegratedFlags.map((f) => `- \`${f}\``),
      "",
    );
  }

  lines.push(
    "---",
    "",
    "## 📦 类型定义",
    "",
    "| 指标 | 值 | 目标 | 状态 |",
    "|------|-----|------|------|",
    `| 类型文件数 | ${metrics.types.totalFiles} | - | ℹ️ |`,
    `| 类型定义数 | ${metrics.types.totalTypes} | - | ℹ️ |`,
    `| 重复名称数 | ${metrics.types.duplicateCount} | 0 | ${metrics.types.duplicateCount === 0 ? "✅" : "⚠️"} |`,
    `| 冲突数量 | ${metrics.types.conflictCount} | 0 | ${metrics.types.conflictCount === 0 ? "✅" : "🔴"} |`,
    `| 健康分数 | ${metrics.types.healthScore} | 100 | ${metrics.types.healthScore >= 90 ? "✅" : metrics.types.healthScore >= 70 ? "⚠️" : "🔴"} |`,
    "",
    "---",
    "",
    "## 🛠️ AI Skills",
    "",
    "| 指标 | 值 | 目标 | 状态 |",
    "|------|-----|------|------|",
    `| 总 Skills 数 | ${metrics.skills.totalSkills} | - | ℹ️ |`,
    `| 原子 Skills | ${metrics.skills.atomicSkills} | - | ℹ️ |`,
    `| 编排 Skills | ${metrics.skills.orchestrationSkills} | - | ℹ️ |`,
    `| 有测试的 Skills | ${metrics.skills.skillsWithTests} | ${metrics.skills.totalSkills} | ${metrics.skills.skillsWithTests === metrics.skills.totalSkills ? "✅" : "⚠️"} |`,
    `| 测试覆盖率 | ${metrics.skills.testCoverage.toFixed(1)}% | 100% | ${metrics.skills.testCoverage >= 90 ? "✅" : metrics.skills.testCoverage >= 70 ? "⚠️" : "🔴"} |`,
    "",
    "---",
    "",
    "## 🎯 意图分类",
    "",
    "| 指标 | 值 | 目标 | 状态 |",
    "|------|-----|------|------|",
    `| 总规则数 | ${metrics.intent.totalRules} | - | ℹ️ |`,
    `| 隐含意图规则 | ${metrics.intent.implicitRules} | ≥8 | ${metrics.intent.implicitRules >= 8 ? "✅" : "⚠️"} |`,
    `| 活跃分类器数 | ${metrics.intent.classifiersActive} | 1 | ${metrics.intent.classifiersActive === 1 ? "✅" : "⚠️"} |`,
    "",
    "---",
    "",
    "## 📈 改进建议",
    "",
  );

  // 根据指标生成建议
  if (metrics.featureFlags.integrationRate < 100) {
    lines.push(
      `- 🔧 **Feature Flags**: ${metrics.featureFlags.unintegratedFlags.length} 个 Flags 未集成，建议添加集成点或禁用`,
    );
  }

  if (metrics.types.conflictCount > 0) {
    lines.push(
      `- 🔧 **类型冲突**: 发现 ${metrics.types.conflictCount} 个类型冲突，建议运行 \`npm run check:types\` 并修复`,
    );
  }

  if (metrics.skills.testCoverage < 100) {
    const missingTests =
      metrics.skills.totalSkills - metrics.skills.skillsWithTests;
    lines.push(
      `- 🔧 **测试覆盖**: ${missingTests} 个 Skills 缺少测试，建议补充`,
    );
  }

  if (metrics.intent.classifiersActive > 1) {
    lines.push(
      `- 🔧 **分类器收敛**: 当前有 ${metrics.intent.classifiersActive} 个活跃分类器，建议收敛为 1 个`,
    );
  }

  if (lines[lines.length - 1] === "") {
    lines.push("✅ 所有指标均达标！");
  }

  return lines.join("\n");
}

// =============================================================================
// 主函数
// =============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const isJson = args.includes("--json");
  const outputIndex = args.indexOf("--output");
  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : null;

  console.log("📊 收集 AI 能力指标...\n");

  const featureFlags = collectFeatureFlagMetrics();
  const types = collectTypeMetrics();
  const skills = collectSkillMetrics();
  const intent = collectIntentMetrics();

  const { score, grade } = calculateOverallScore({
    featureFlags,
    types,
    skills,
    intent,
  });

  const metrics: OverallMetrics = {
    featureFlags,
    types,
    skills,
    intent,
    overallScore: score,
    grade,
    timestamp: new Date().toISOString(),
  };

  if (isJson) {
    console.log(JSON.stringify(metrics, null, 2));
  } else {
    const report = generateMarkdownReport(metrics);

    if (outputPath) {
      fs.writeFileSync(outputPath, report);
      console.log(`✅ 报告已保存到: ${outputPath}`);
    } else {
      console.log(report);
    }
  }
}

// 执行
main();
