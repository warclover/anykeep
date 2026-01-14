# AnyKeep 架构升级实施方案

> **版本**: v2.0.0
> **日期**: 2026-01-05
> **架构师**: Winston
> **状态**: ✅ 已批准（一次性升级策略）

---

## 执行摘要

本方案针对 AnyKeep 项目识别的 4 个核心架构风险，采用**「分支隔离 + 自动迁移」组合策略**实现一次性升级：

| 风险点 | 严重性 | 预期收益 | 工作量 |
|--------|--------|----------|--------|
| 🔴 AI 调用链复杂度 (8-10层) | Critical | 性能 ↑ 20-30%，代码 ↓ 40% | 5 天 |
| 🔴 模块数量爆炸 (54→40) | Critical | 认知负担 ↓ 40% | 3 天 |
| 🟡 数据库迁移碎片化 (185个) | Medium | 部署时间 ↓ 60% | 1 天 |
| 🟡 缺乏分层边界 | Medium | 长期可维护性 ↑ | 延后 |

**总工期**: 10 天（紧凑执行，无版本共存）

### 升级策略选择 ✅

**已采纳方案**: 分支隔离 + 自动迁移

| 策略 | 说明 | 优势 |
|------|------|------|
| 分支隔离 | `feature/architecture-upgrade` 独立分支 | 主分支不受影响 |
| 自动迁移 | ts-morph AST 转换脚本 | 零遗漏更新消费者 |
| 行为快照 | 升级前后行为一致性验证 | 防止意外变更 |
| 一次合并 | 完成所有变更后统一合并 | 无中间态风险 |

---

## Phase 0: 准备阶段 (Day 1-2)

### 0.1 分支与环境准备

```bash
# 创建升级分支
git checkout feature/classification-v4.2
git checkout -b feature/architecture-upgrade

# 安装迁移工具依赖
npm install -D ts-morph @types/node
```

### 0.2 自动迁移脚本

**文件**: `scripts/migrate-ai-imports.ts`

```typescript
import { Project, SyntaxKind } from "ts-morph";

const MIGRATION_MAP = {
  // 模块路径映射
  "@/lib/ai-skills/router/intent-classifier": "@/lib/ai-skills/router/intent-analyzer",
  "@/lib/ai-skills/router/complexity-evaluator": "@/lib/ai-skills/router/intent-analyzer",
  "@/lib/ai-skills/router/mode-selector": "@/lib/ai-skills/router/intent-analyzer",

  // 类型/类名映射
  "IntentClassifier": "IntentAnalyzer",
  "ComplexityEvaluator": null,  // null = 删除导入
  "ModeSelector": null,
  "ClassificationResult": "AnalysisResult",
  "evaluateComplexity": "analyze",  // 方法重命名
  "selectMode": "analyze",
};

async function migrateImports() {
  const project = new Project({ tsConfigFilePath: "./tsconfig.json" });
  let filesModified = 0;
  let importsUpdated = 0;

  for (const sourceFile of project.getSourceFiles()) {
    let modified = false;

    // 1. 更新导入路径
    sourceFile.getImportDeclarations().forEach(imp => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      const newPath = MIGRATION_MAP[moduleSpecifier];
      if (newPath) {
        imp.setModuleSpecifier(newPath);
        modified = true;
        importsUpdated++;
      }
    });

    // 2. 更新类型引用
    sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).forEach(id => {
      const newName = MIGRATION_MAP[id.getText()];
      if (newName) {
        id.replaceWithText(newName);
        modified = true;
      } else if (newName === null) {
        // 标记为需要手动处理
        console.warn(`⚠️ 需要手动处理: ${sourceFile.getFilePath()}:${id.getStartLineNumber()}`);
      }
    });

    if (modified) {
      await sourceFile.save();
      filesModified++;
    }
  }

  console.log(`✅ 迁移完成: ${filesModified} 文件, ${importsUpdated} 导入`);
}

migrateImports().catch(console.error);
```

### 0.3 行为快照生成

**文件**: `scripts/generate-behavior-snapshot.ts`

```typescript
import { IntentClassifier } from "@/lib/ai-skills/router/intent-classifier";
import { writeFileSync } from "fs";

const TEST_CASES = [
  // 搜索类
  { input: "搜索 AI 相关文章", context: { bookmarkCount: 100 } },
  { input: "找一下上周收藏的", context: { bookmarkCount: 100 } },
  // 管理类
  { input: "整理书签", context: { bookmarkCount: 500 } },
  { input: "删除重复的", context: { bookmarkCount: 500 } },
  // 分析类
  { input: "分析我的收藏趋势", context: { bookmarkCount: 200 } },
  { input: "生成阅读报告", context: { bookmarkCount: 200 } },
  // ... 100+ 测试用例
];

async function generateSnapshot() {
  const classifier = new IntentClassifier();
  const snapshots = [];

  for (const testCase of TEST_CASES) {
    const result = await classifier.classify(testCase.input, testCase.context);
    snapshots.push({
      input: testCase.input,
      context: testCase.context,
      output: {
        intent: result.intent,
        subType: result.subType,
        confidence: result.confidence,
        suggestedSkill: result.suggestedSkill,
      },
    });
  }

  writeFileSync(
    "snapshots/intent-routing-baseline.json",
    JSON.stringify(snapshots, null, 2)
  );
  console.log(`✅ 生成 ${snapshots.length} 个行为快照`);
}

generateSnapshot().catch(console.error);
```

### 0.4 快照验证脚本

**文件**: `scripts/verify-behavior-snapshot.ts`

```typescript
import baseline from "../snapshots/intent-routing-baseline.json";
import { IntentAnalyzer } from "@/lib/ai-skills/router/intent-analyzer";
import { isDeepStrictEqual } from "util";

async function verifySnapshot() {
  const analyzer = new IntentAnalyzer();
  const mismatches = [];
  const toleranceFields = ["confidence"]; // 允许微小差异的字段

  for (const expected of baseline) {
    const actual = await analyzer.analyze(expected.input, expected.context);

    // 严格字段比较
    if (actual.intent !== expected.output.intent ||
        actual.suggestedSkill !== expected.output.suggestedSkill) {
      mismatches.push({
        input: expected.input,
        expected: expected.output,
        actual: {
          intent: actual.intent,
          suggestedSkill: actual.suggestedSkill,
          confidence: actual.confidence,
        },
      });
    }
  }

  if (mismatches.length > 0) {
    console.error(`❌ 发现 ${mismatches.length} 个行为差异:`);
    mismatches.forEach(m => {
      console.error(`  - "${m.input}": 期望 ${m.expected.intent}, 实际 ${m.actual.intent}`);
    });
    process.exit(1);
  }

  console.log(`✅ 所有 ${baseline.length} 个行为与基线一致`);
}

verifySnapshot().catch(console.error);
```

### 0.5 预检查清单

**文件**: `scripts/pre-upgrade-checklist.ts`

```typescript
import { execSync } from "child_process";

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

async function runChecklist(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1. Git 状态检查
  try {
    const status = execSync("git status --porcelain").toString();
    results.push({
      name: "Git 工作区干净",
      passed: status.trim() === "",
      message: status.trim() === "" ? "工作区无未提交变更" : "请先提交或暂存变更",
    });
  } catch (e) {
    results.push({ name: "Git 工作区干净", passed: false, message: "Git 命令执行失败" });
  }

  // 2. 类型检查
  try {
    execSync("npm run type-check", { stdio: "pipe" });
    results.push({ name: "TypeScript 类型检查", passed: true, message: "无类型错误" });
  } catch (e) {
    results.push({ name: "TypeScript 类型检查", passed: false, message: "存在类型错误" });
  }

  // 3. 测试通过
  try {
    execSync("npm run test:ai", { stdio: "pipe" });
    results.push({ name: "AI 模块测试", passed: true, message: "618 测试全部通过" });
  } catch (e) {
    results.push({ name: "AI 模块测试", passed: false, message: "存在失败测试" });
  }

  // 4. 行为快照存在
  const fs = await import("fs");
  const snapshotExists = fs.existsSync("snapshots/intent-routing-baseline.json");
  results.push({
    name: "行为基线快照",
    passed: snapshotExists,
    message: snapshotExists ? "快照已生成" : "请先运行 generate-behavior-snapshot.ts",
  });

  // 5. 迁移脚本测试运行
  // (dry-run mode)

  // 输出结果
  console.log("\n📋 升级预检查清单\n");
  results.forEach(r => {
    const icon = r.passed ? "✅" : "❌";
    console.log(`${icon} ${r.name}: ${r.message}`);
  });

  const allPassed = results.every(r => r.passed);
  console.log(`\n${allPassed ? "🚀 预检查通过，可以开始升级" : "⛔ 请修复问题后再开始升级"}`);

  return results;
}

runChecklist();
```

### 0.6 Phase 0 验收标准

- [ ] 分支 `feature/architecture-upgrade` 已创建
- [ ] ts-morph 依赖已安装
- [ ] 迁移脚本编写完成并测试
- [ ] 行为基线快照已生成 (100+ 用例)
- [ ] 预检查脚本通过

---

## Phase 1: AI 调用链简化 (优先级: P0)

### 1.1 问题现状

```
当前调用链（8-10 层）:
API → UnifiedEngine (1007行) → InputPreprocessor (213行)
    → IntentRouter (340行) → IntentClassifier (1231行)
    → ComplexityEvaluator (386行) → ModeSelector (458行)
    → ExecutionCoordinator (387行) → OrchestrationEngine (268行)
    → OutputEnhancer (474行) → 返回

总计: 4,764 行路由相关代码
```

### 1.2 目标架构

```
简化后调用链（4-5 层）:
API → UnifiedEngine → IntentAnalyzer (合并3层)
    → ExecutionCoordinator (精简) → Skill执行 → 返回

目标: 2,800 行（-41%）
```

### 1.3 具体任务

#### Task 1.1: 合并 IntentClassifier 规则系统
- **目标**: 1231 行 → 600 行 (-51%)
- **文件**: `src/lib/ai-skills/router/intent-classifier.ts`
- **操作**:
  1. 合并 DEFAULT_RULES + DISAMBIGUATION_RULES 为单一规则集
  2. 删除 `disambiguation-rules.ts` (517行)
  3. 将 LLM 分类改为 fallback 模式
- **工作量**: 2 天
- **风险**: 低

#### Task 1.2: 合并路由三层为 IntentAnalyzer
- **目标**: 创建新的 `IntentAnalyzer` 类
- **合并文件**:
  - `intent-classifier.ts` (精简版)
  - `complexity-evaluator.ts` (内联)
  - `mode-selector.ts` (内联)
- **输出**: 新增 `src/lib/ai-skills/router/intent-analyzer.ts` (~550行)
- **工作量**: 3 天
- **风险**: 中（需要充分测试）

#### Task 1.3: 精简 ExecutionCoordinator
- **目标**: 387 行 → 250 行 (-35%)
- **文件**: `src/lib/ai-skills/engine/execution-coordinator.ts`
- **操作**: 合并 atomic/orchestration 执行入口
- **工作量**: 1 天
- **风险**: 低

#### Task 1.4: 拆分 OutputEnhancer
- **目标**: 474 行 → 150 行 + 3个小模块
- **文件**: `src/lib/ai-skills/engine/output-enhancer.ts`
- **新增**:
  - `suggestion-injector.ts` (~100行)
  - `memory-recorder.ts` (~80行)
- **工作量**: 1 天
- **风险**: 低

### 1.4 验收标准

- [ ] 所有 618 个 AI 测试通过
- [ ] 路由延迟 P99 < 100ms (当前 ~150ms)
- [ ] 调用链深度 ≤ 5 层
- [ ] 代码行数减少 ≥ 1,500 行

### 1.5 关键文件清单

```
修改:
- src/lib/ai-skills/router/intent-classifier.ts (1231行)
- src/lib/ai-skills/router/intent-router.ts (340行)
- src/lib/ai-skills/engine/execution-coordinator.ts (387行)
- src/lib/ai-skills/engine/output-enhancer.ts (474行)
- src/lib/ai-skills/engine/unified-engine.ts (1007行)

删除:
- src/lib/ai-skills/router/disambiguation-rules.ts (517行)
- src/lib/ai-skills/router/complexity-evaluator.ts (386行)

新增:
- src/lib/ai-skills/router/intent-analyzer.ts (~550行)
- src/lib/ai-skills/engine/suggestion-injector.ts (~100行)
- src/lib/ai-skills/engine/memory-recorder.ts (~80行)
```

---

## Phase 2: 模块整合 (优先级: P1)

### 2.1 问题现状

- `src/lib/` 下有 **54 个顶级模块**
- **9 个模块** < 5 个文件（应合并）
- **3 个空模块** 需清理
- 命名混乱（11 个 `ai-*` 前缀模块）

### 2.2 整合计划

#### 阶段 2A: 立即清理 (Day 1)

| 操作 | 目标 | 工作量 |
|------|------|--------|
| 删除 `src/lib/ai/` | 仅 1 个文件，功能迁移 | 10 min |
| 删除 `src/lib/ai-context/` | 空目录 | 5 min |
| 重命名 `telemetry/metrics-collector.ts` | 解决命名冲突 | 30 min |

#### 阶段 2B: P1 模块整合 (Week 1)

##### 整合 1: 用户档案模块
```
source-profile (2文件) + interest-profile (4文件) + user-profile (1文件)
    ↓
user-profile/ (统一)
├── services/
│   ├── user-profile.service.ts
│   ├── interest-profile.service.ts
│   └── source-profile.service.ts
├── types/
└── client/
```
- **工作量**: 1 天
- **风险**: 低

##### 整合 2: AI 快照模块
```
snapshot (11文件) + ai-snapshot (3文件)
    ↓
snapshot/ (统一)
├── core/
├── ai/
├── processors/
└── services/
```
- **工作量**: 1 天
- **风险**: 低

##### 整合 3: AI 学习反馈模块
```
ai-feedback (3文件) + ai-notes (3文件) + ai-learning (10文件)
    ↓
ai-learning/ (统一)
├── feedback/
├── notes/
├── core/
└── integration/
```
- **工作量**: 1 天
- **风险**: 低

#### 阶段 2C: P2 模块整合 (Week 2)

##### 整合 4: 监控可观测性
```
monitoring (10文件) + telemetry (13文件) + observability (1文件)
    ↓
observability/ (统一)
├── core/
├── tracing/
├── monitoring/
└── index.ts
```
- **工作量**: 2 天
- **风险**: 中

##### 整合 5: AI 提供商配置
```
ai-providers (6文件) → ai-agent/config/
```
- **工作量**: 0.5 天
- **风险**: 低

### 2.3 验收标准

- [ ] `src/lib/` 模块数从 54 减少到 ≤ 42
- [ ] 无空模块存在
- [ ] 所有导入路径更新完成
- [ ] 类型检查通过
- [ ] 1851+ 测试通过

### 2.4 关键文件清单

```
删除:
- src/lib/ai/ (整个目录)
- src/lib/ai-context/ (整个目录)
- src/lib/source-profile/ (合并后)
- src/lib/interest-profile/ (合并后)
- src/lib/ai-feedback/ (合并后)
- src/lib/ai-notes/ (合并后)
- src/lib/ai-snapshot/ (合并后)

重构:
- src/lib/user-profile/ (新结构)
- src/lib/snapshot/ (新结构)
- src/lib/ai-learning/ (新结构)
- src/lib/observability/ (新结构)

保留兼容层:
- 各旧模块的 index.ts 保留 re-export + @deprecated 注释
```

---

## Phase 3: 数据库迁移治理 (优先级: P1)

### 3.1 问题现状

| 指标 | 当前值 | 问题 |
|------|--------|------|
| 总迁移数 | 185 | 过多，部署慢 |
| 时间戳冲突 | 24 个文件 (9组) | 执行顺序混乱 |
| 修复迁移占比 | 14% (26个) | 初始设计不完善 |
| 非 SQL 文件 | 2 个 | 不应存在 |
| bookmarks 表修改 | 22 次 | 严重碎片化 |

### 3.2 治理计划

#### 阶段 3A: 修复时间戳冲突 (必做)

```sql
-- 重新编号冲突文件示例
20251226000001_add_token_usage_logs.sql          -- 保持
20251226000101_fix_intent_corrections_table.sql  -- 重编号

20251228000001_add_persona_settings.sql          -- 保持
20251228000101_add_plugin_authorization.sql      -- 重编号
20251228000102_add_snapshot_versions.sql         -- 重编号

20251229000001_add_active_recall_tables.sql      -- 保持
20251229000101_add_md_status_update_rpc.sql      -- 重编号
20251229000102_create_synthesis_reports.sql      -- 重编号
20251229000103_create_brain_sync_tables.sql      -- 重编号
20251229000104_create_synthesis_highlights.sql   -- 重编号
```

- **工作量**: 2 小时
- **风险**: 极低（仅重命名）

#### 阶段 3B: 清理非 SQL 文件

```
删除或移动:
- 20251127000005_HOTFIX_NOTES.md → docs/migrations/
- 20251127000005_README.md → docs/migrations/
- 20251127000005_test_script.sql → 删除
- 20251127000005_rollback.sql → 归档
```

- **工作量**: 30 分钟
- **风险**: 极低

#### 阶段 3C: 可选迁移合并 (推荐)

##### Brain-Sync 系统合并
```
原始 4 个迁移:
- 20251229000001_add_active_recall_tables.sql
- 20251229000002_create_brain_sync_tables.sql
- 20251229000003_create_brain_sync_functions.sql
- 相关修复迁移

合并为:
- 20251229000005_create_brain_sync_system.sql
```

- **工作量**: 3 小时
- **风险**: 低

### 3.3 验收标准

- [ ] 时间戳冲突 = 0
- [ ] 非 SQL 文件 = 0
- [ ] 迁移执行顺序正确
- [ ] `supabase db push` 成功
- [ ] 本地 + 远程环境验证通过

### 3.4 关键文件清单

```
重命名 (16 个文件):
- supabase/migrations/20251226000001_fix_intent_corrections_table.sql
  → 20251226000101_fix_intent_corrections_table.sql
- supabase/migrations/20251226000002_fix_embedding_dimension.sql
  → 20251226000102_fix_embedding_dimension.sql
- ... (其余 14 个按同样规则)

删除/移动 (4 个文件):
- supabase/migrations/20251127000005_HOTFIX_NOTES.md
- supabase/migrations/20251127000005_README.md
- supabase/migrations/20251127000005_test_script.sql
- supabase/migrations/20251127000005_rollback.sql
```

---

## Phase 4: 架构分层引入 (优先级: P2)

### 4.1 目标架构

```
src/
├── domains/                    # 业务领域层 (新)
│   ├── bookmark/
│   ├── ai-agent/
│   ├── classification/
│   └── knowledge-studio/
│
├── application/               # 应用服务层 (新)
│   ├── use-cases/
│   └── dtos/
│
├── infrastructure/            # 基础设施层 (重组)
│   ├── supabase/
│   ├── ai-providers/
│   └── cache/
│
├── presentation/              # 表现层 (现有)
│   ├── app/
│   ├── components/
│   └── hooks/
│
└── shared/                    # 共享内核 (重组)
    ├── types/
    ├── utils/
    └── constants/
```

### 4.2 实施策略

**渐进式迁移**：不一次性重构，而是：
1. 新代码按新结构组织
2. 逐步迁移现有高频修改模块
3. 保持向后兼容的 re-export

### 4.3 第一批迁移候选

| 模块 | 原路径 | 新路径 | 优先级 |
|------|--------|--------|--------|
| Supabase | `src/lib/supabase/` | `src/infrastructure/supabase/` | P2 |
| 缓存 | `src/lib/cache/` | `src/infrastructure/cache/` | P2 |
| 工具函数 | `src/lib/utils/` | `src/shared/utils/` | P2 |

### 4.4 本阶段暂不执行

此阶段为**长期规划**，Phase 1-3 完成后再考虑。

---

## 实施时间表（紧凑 10 天）

```
Phase 0: 准备阶段 (Day 1-2)
├── Day 1 上午: 创建分支、安装依赖
├── Day 1 下午: 编写自动迁移脚本
├── Day 2 上午: 生成行为基线快照 (100+ 用例)
└── Day 2 下午: 预检查脚本 + 验证

Phase 1: AI 调用链简化 (Day 3-7)
├── Day 3: Task 1.1 合并规则系统 + 运行迁移脚本
├── Day 4: Task 1.2 创建 IntentAnalyzer (上)
├── Day 5: Task 1.2 创建 IntentAnalyzer (下) + 类型检查
├── Day 6: Task 1.3 精简 ExecutionCoordinator
├── Day 6: Task 1.4 拆分 OutputEnhancer
└── Day 7: 运行行为快照验证 + 修复差异

Phase 2: 模块整合 (Day 7-8)
├── Day 7 下午: 阶段 2A 立即清理
├── Day 8 上午: 阶段 2B 用户档案整合
├── Day 8 下午: 阶段 2B AI 快照整合
└── Day 8: 全量类型检查 + 测试

Phase 3: 数据库治理 (Day 9)
├── Day 9 上午: 阶段 3A 修复时间戳冲突
├── Day 9 下午: 阶段 3B 清理非 SQL 文件
└── Day 9: 本地 Supabase 验证

Phase 4: 验证与发布 (Day 10)
├── Day 10 上午: 端到端手动测试
├── Day 10 中午: 性能对比测试
├── Day 10 下午: 合并到 feature/classification-v4.2
└── Day 10 晚上: 部署到 staging 验证
```

### 关键里程碑

| Day | 里程碑 | 验收条件 |
|-----|--------|----------|
| 2 | 准备完成 | 迁移脚本测试通过，快照生成完毕 |
| 5 | IntentAnalyzer 完成 | 新类可用，类型检查通过 |
| 7 | AI 重构完成 | 618 测试通过，行为快照验证通过 |
| 8 | 模块整合完成 | 模块数 54→42，无导入错误 |
| 9 | 数据库治理完成 | 时间戳冲突=0，迁移可执行 |
| 10 | 升级完成 | 合并到主分支，staging 验证通过 |

---

## 风险管理

### 高风险操作

| 操作 | 风险 | 缓解措施 |
|------|------|----------|
| IntentAnalyzer 合并 | 路由行为变化 | 行为快照验证 + 自动迁移脚本 |
| 数据库迁移重命名 | 执行顺序错误 | 本地 + staging 环境验证 |
| 模块删除 | 导入路径断裂 | ts-morph 自动更新所有消费者 |
| 一次性合并 | 合并冲突 | 分支隔离 + 频繁 rebase |

### 回滚策略（一次性升级专用）

**紧急回滚脚本**: `scripts/emergency-rollback.sh`

```bash
#!/bin/bash
# 紧急回滚脚本 - 在发现严重问题时使用

echo "⚠️ 开始紧急回滚..."

# 1. 回滚到合并前的 commit
MERGE_COMMIT=$(git rev-parse HEAD)
PRE_MERGE_COMMIT=$(git rev-parse HEAD^)

echo "当前 commit: $MERGE_COMMIT"
echo "回滚目标: $PRE_MERGE_COMMIT"

# 2. 创建回滚分支保留现场
git checkout -b rollback-$(date +%Y%m%d%H%M%S)

# 3. 回到主分支并重置
git checkout feature/classification-v4.2
git reset --hard $PRE_MERGE_COMMIT

# 4. 强制推送（需确认）
read -p "确认强制推送回滚? (yes/no): " confirm
if [ "$confirm" = "yes" ]; then
  git push --force-with-lease origin feature/classification-v4.2
  echo "✅ 回滚完成"
else
  echo "❌ 回滚已取消"
fi
```

**回滚触发条件**:
1. staging 验证发现严重功能缺失
2. 生产环境错误率 > 1%
3. 关键 AI 功能完全不可用

**回滚时间窗口**: 合并后 24 小时内

### 监控指标

```typescript
// 关键监控点
const metrics = {
  // Phase 1 验证
  'ai.routing.latency_p99': '< 100ms',
  'ai.routing.error_rate': '< 0.1%',

  // Phase 2 验证
  'build.time': '< 60s',
  'test.pass_rate': '> 98%',

  // Phase 3 验证
  'db.migration.time': '< 30s',
  'db.connection.errors': '0',
};
```

---

## 成功指标汇总

| 指标 | 当前 | 目标 | 改进 |
|------|------|------|------|
| AI 路由代码行数 | 4,764 | 2,800 | -41% |
| AI 调用链深度 | 8-10 层 | 4-5 层 | -50% |
| AI 路由延迟 P99 | ~150ms | <100ms | -33% |
| src/lib 模块数 | 54 | 42 | -22% |
| 数据库迁移数 | 185 | 169 | -9% |
| 时间戳冲突 | 24 | 0 | -100% |
| 测试通过率 | 98.8% | >98% | 保持 |

---

## 已确认事项 ✅

| 问题 | 用户决策 | 影响 |
|------|----------|------|
| 执行优先级 | **全部按计划执行** | 10 天紧凑实施 |
| 数据库迁移范围 | **全部环境（含生产）** | 需规划维护窗口 |
| 升级策略 | **分支隔离 + 自动迁移** | 一次性升级，无版本共存 |
| Feature Flag | **不使用** | 直接替换实现 |

### 策略决策记录

#### 为什么选择「分支隔离 + 自动迁移」？

| 对比项 | 渐进式 (V1/V2 共存) | 一次性 (分支隔离) |
|--------|---------------------|-------------------|
| 工期 | 5-6 周 | **10 天** |
| 代码复杂度 | 高（维护两套） | **低** |
| 风险窗口 | 长期共存风险 | **一次性风险** |
| 回滚难度 | 容易 | 中等（但有脚本支持） |
| 适合场景 | 大团队、高流量 | **单人/小团队** |

**结论**: 考虑到 AnyKeep 当前是单人开发，一次性升级更高效。

#### 关键保障措施

1. **行为快照验证** - 100+ 测试用例保证行为一致性
2. **ts-morph 自动迁移** - 零遗漏更新所有消费者
3. **紧急回滚脚本** - 24 小时内可快速回滚
4. **staging 验证** - 合并前完整测试

---

## 审核清单

- [x] 整体方案是否符合项目实际情况？
- [x] 时间估算是否合理？
- [x] 风险评估是否充分？
- [x] 是否有遗漏的关键依赖？
- [x] 升级策略已确认：分支隔离 + 自动迁移

---

## 补充：一次性升级保障措施

> **注意**: 由于采用「分支隔离 + 自动迁移」策略，原有的渐进式保障措施已简化。
> 核心脚本已在 Phase 0 中详细定义。

### 保障体系（简化版）

```
┌─────────────────────────────────────────────────────────────┐
│                    第一层：预防措施                          │
├─────────────────────────────────────────────────────────────┤
│ ✓ 行为快照基线（100+ 测试用例）                             │
│ ✓ ts-morph 自动迁移脚本（零遗漏更新）                       │
│ ✓ 分支隔离开发（主分支不受影响）                            │
│ ✓ 预检查脚本门控（阻断不完整状态）                          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    第二层：检测措施                          │
├─────────────────────────────────────────────────────────────┤
│ ✓ TypeScript 类型检查（每次变更必过）                       │
│ ✓ 行为快照验证（升级后 vs 基线对比）                        │
│ ✓ 618 AI 测试用例（全部通过）                               │
│ ✓ staging 环境完整验证                                     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    第三层：恢复措施                          │
├─────────────────────────────────────────────────────────────┤
│ ✓ 紧急回滚脚本（24 小时内可执行）                           │
│ ✓ 升级分支保留（可随时对比分析）                            │
│ ✓ 数据库迁移可逆（文件重命名，非结构变更）                  │
└─────────────────────────────────────────────────────────────┘
```

### 前端组件调整（简化版）

由于一次性升级，无需维护兼容层：

| 组件/Hook | 调整内容 | 工作量 |
|-----------|----------|--------|
| `use-ai-chat.ts` | 直接更新类型导入 | 10 min |
| `use-unified-confirmation.ts` | 删除双确认适配，统一类型 | 20 min |
| `ai-deliverable-card.tsx` | 更新 Skill 类型导入 | 15 min |

### 执行检查点

| 检查点 | 时机 | 阻断条件 |
|--------|------|----------|
| 预检查脚本 | Phase 0 完成 | 任一项失败 |
| 类型检查 | 每次重构后 | 编译错误 > 0 |
| 行为快照验证 | Phase 1 完成 | 差异 > 0 |
| 全量测试 | Day 7 | 通过率 < 98% |
| staging 验证 | Day 10 | 关键功能异常 |

---

**方案已最终确认。准备开始执行。**
