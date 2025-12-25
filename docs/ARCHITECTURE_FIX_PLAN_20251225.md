# AnyKeep 架构修复执行计划

**创建日期**: 2025-12-25
**目标版本**: v2.5.0
**预估周期**: 4 周（22.5 人天）

---

## 执行摘要

| 指标       | 目标                 |
| ---------- | -------------------- |
| 代码质量   | 所有文件 < 500 行    |
| 测试覆盖率 | > 85%                |
| 测试通过率 | 单元 100%，E2E > 95% |
| 技术债务   | 0 个未追踪的 TODO    |

---

## Week 1：超大服务类拆分（P0）

### 任务 1.1：拆分 tiered-classification.service.ts（1589 行）

**优先级**: 🔴 P0
**预估工时**: 2 天
**负责人**: 高级后端工程师

**当前结构**:

```
src/lib/classification/services/advanced/
└── tiered-classification.service.ts (1589 行)
```

**目标结构**:

```
src/lib/classification/services/advanced/
├── tiered-classification.service.ts (~350 行, 协调器)
├── tier-classifier.ts (~400 行)
├── label-generator.ts (~350 行)
└── validation.ts (~300 行)
```

**执行步骤**:

1. [ ] 分析现有代码，识别 4 个功能模块边界
2. [ ] 创建 `tier-classifier.ts`，迁移分层逻辑
3. [ ] 创建 `label-generator.ts`，迁移标签生成逻辑
4. [ ] 创建 `validation.ts`，迁移验证逻辑
5. [ ] 精简 `tiered-classification.service.ts` 为协调器
6. [ ] 更新所有导入路径
7. [ ] 运行测试验证：`npm test -- tiered-classification`

**验收标准**:

- [ ] 每个新文件 < 500 行
- [ ] 原有测试全部通过
- [ ] 无循环依赖

---

### 任务 1.2：拆分 ai-actions/executor.ts（1210 行）

**优先级**: 🔴 P0
**预估工时**: 2.5 天

**目标结构**:

```
src/lib/ai-skills/ai-actions/
├── executor.ts (~250 行, 协调器)
├── base-action.strategy.ts (~100 行)
└── strategies/
    ├── tag-action.strategy.ts (~200 行)
    ├── folder-action.strategy.ts (~200 行)
    ├── archive-action.strategy.ts (~150 行)
    └── delete-action.strategy.ts (~150 行)
```

**执行步骤**:

1. [ ] 定义 `BaseActionStrategy` 抽象基类
2. [ ] 实现 4 个具体策略类
3. [ ] 重构 `executor.ts` 使用策略模式
4. [ ] 更新测试

---

### 任务 1.3：拆分 batch-organize.skill.ts（1404 行）

**优先级**: 🔴 P0
**预估工时**: 2 天

**目标结构**:

```
src/lib/ai-skills/skills/batch-organize/
├── batch-organize.skill.ts (~300 行, 编排器)
└── steps/
    ├── analyze.step.ts (~200 行)
    ├── categorize.step.ts (~250 行)
    ├── tag.step.ts (~200 行)
    ├── deduplicate.step.ts (~180 行)
    ├── archive.step.ts (~150 行)
    └── verify.step.ts (~180 行)
```

---

### 任务 1.4：拆分 smart-sorting.service.ts（944 行）

**优先级**: 🟡 P1
**预估工时**: 1.5 天

**目标结构**:

```
src/lib/classification/services/
├── smart-sorting.service.ts (~250 行)
└── algorithms/
    ├── relevance-scorer.ts (~300 行)
    ├── time-decay-calculator.ts (~200 行)
    └── diversity-ranker.ts (~250 行)
```

---

### 任务 1.5：拆分 periodic-report.skill.ts（929 行）

**优先级**: 🟡 P1
**预估工时**: 1.5 天

**目标结构**:

```
src/lib/ai-skills/skills/periodic-report/
├── periodic-report.skill.ts (~250 行)
├── collectors/
│   ├── activity-collector.ts (~200 行)
│   ├── trend-collector.ts (~200 行)
│   └── insight-collector.ts (~180 行)
└── formatters/
    └── report-formatter.ts (~150 行)
```

---

### 任务 1.6：拆分 operation-log.service.ts（903 行）

**优先级**: 🟡 P1
**预估工时**: 1.5 天

**目标结构**:

```
src/lib/classification/services/
├── operation-log.service.ts (~200 行, 服务门面)
├── persistence/
│   └── log-repository.ts (~300 行)
└── business/
    ├── log-analyzer.ts (~250 行)
    └── log-formatter.ts (~200 行)
```

---

## Week 2：测试修复与稳定性提升

### 任务 2.1：修复 mode-selector.test.ts ✅

**优先级**: 🔴 P0
**状态**: ✅ 已完成（2025-12-25）

**验证结果**: 17 个测试全部通过

---

### 任务 2.2：修复 Supabase Mock 问题 ✅

**优先级**: 🔴 P0
**状态**: ✅ 已完成（2025-12-25）

**验证结果**: folder-tools 50 个测试全部通过

**解决方案**:

```typescript
// 新建：src/lib/__tests__/mocks/supabase-mock.ts
export function createSupabaseMock() {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return { from: vi.fn(() => mockQuery) };
}
```

---

### 任务 2.3：增强 E2E 测试稳定性 ✅

**优先级**: 🟡 P1
**状态**: ✅ 已完成（2025-12-25）

**验证结果**: E2E test-utils.ts 已包含完整稳定性增强：

- TIMEOUTS 配置（navigation: 30s, action: 10s, assertion: 5s）
- withRetry 重试机制
- waitForPageReady / waitForElementStable 智能等待
- safeNavigate 安全导航
- smoke.spec.ts 配置 retries: 2

---

### 任务 2.4：提升测试覆盖率到 85% 🚧

**优先级**: 🟡 P1
**状态**: 🚧 进行中

**当前进度**:

- [x] 修复 flaky benchmark 测试（fast-path.benchmark.test.ts）
- [x] SimpleClassificationService 测试（27 个测试，覆盖率 98.44%）
- [ ] AI Skills 核心路径（intent-router, unified-engine）
- [ ] smart-sorting 服务
- [ ] 错误处理分支

**当前测试状态**: 1988 通过，1 跳过，91 套件

---

## Week 3：技术债务清理与模块优化

### 任务 3.1：技术债务清理

**优先级**: 🟡 P1
**预估工时**: 1.5 天

**执行步骤**:

```bash
# 1. 扫描所有 TODO/FIXME
grep -rn "TODO\|FIXME\|XXX\|HACK" src/lib/ > tech-debt.txt

# 2. 分类处理
# - 简单修复（< 30 分钟）：直接修复
# - 复杂问题：创建 GitHub Issue
```

**验收标准**:

- [ ] 所有 TODO 关联到 Issue 或已修复
- [ ] tech-debt.txt 归档到 docs/

---

### 任务 3.2：优化模块导出结构

**优先级**: 🟡 P1
**预估工时**: 2 天

**策略**: 仅导出顶层 API

**改进前**:

```typescript
// src/lib/ai-skills/index.ts (导出 200+ 符号)
export * from "./core/types";
export * from "./router";
export * from "./output";
// ...
```

**改进后**:

```typescript
// src/lib/ai-skills/index.ts (导出 < 30 符号)

// 核心引擎
export { UnifiedEngine, createUnifiedEngine } from "./engine";

// Skill 基类
export { BaseSkill, OrchestrationSkill } from "./core";
export { SkillRegistry, skillRegistry } from "./core/registry";

// 类型定义
export type {
  SkillContext,
  SkillResult,
  SkillDefinition,
  StreamChunk,
} from "./core/types";

// 已注册的 Skills
export { KnowledgeReviewSkill } from "./skills/knowledge-review";
export { DataExportSkill } from "./skills/data-export";
export { InsightReportSkill } from "./skills/insight-report";
export { BatchOrganizeSkill } from "./skills/batch-organize";
```

---

### 任务 3.3：代码风格统一

**优先级**: 🟢 P2
**预估工时**: 1 天

**执行步骤**:

1. [ ] 运行 `npm run lint:fix`
2. [ ] 手动修复剩余问题
3. [ ] 补全函数 TSDoc 注释

---

## Week 4：回归测试与文档完善

### 任务 4.1：全量回归测试 ✅

**优先级**: 🔴 P0
**状态**: ✅ 已完成（2025-12-25）

**执行结果**:

```
✅ TypeScript 类型检查：通过
✅ ESLint：0 错误，2 警告（可接受）
✅ 单元测试：91 套件，1988 通过，1 跳过
✅ 生产构建：成功
```

**验收标准**:

- [x] 单元测试通过率 100%（1988/1989，1 个有意跳过）
- [x] 无 TypeScript 错误
- [ ] E2E 测试通过率 > 95%（待执行）

---

### 任务 4.2：更新 CLAUDE.md

**优先级**: 🟡 P1
**预估工时**: 0.5 天

**更新内容**:

- [ ] 更新模块结构图
- [ ] 添加 AI Skills 模块说明
- [ ] 更新文件索引

---

### 任务 4.3：发布 v2.5.0

**优先级**: 🟡 P1
**预估工时**: 0.5 天

**执行步骤**:

1. [ ] 更新 `package.json` 版本号
2. [ ] 编写 CHANGELOG.md 条目
3. [ ] 创建 Git 标签 `v2.5.0`
4. [ ] 合并到 main 分支

---

## 风险管理

| 风险           | 影响  | 概率 | 缓解措施                          |
| -------------- | ----- | ---- | --------------------------------- |
| 拆分后测试失败 | 🔴 高 | 中   | 增量提交，每次拆分后立即运行测试  |
| E2E 仍不稳定   | 🟡 中 | 高   | 添加 retry(3)，容忍 5% 失败率     |
| 工期延误       | 🟡 中 | 中   | Week 3-4 可并行，预留 2 天 buffer |

---

## 验收标准汇总

### 代码质量

- [ ] 所有文件 < 500 行
- [ ] ESLint 无错误/警告
- [ ] TypeScript 严格模式编译通过
- [ ] 无循环依赖

### 测试质量

- [ ] 单元测试覆盖率 > 85%
- [ ] E2E 测试通过率 > 95%
- [ ] 测试运行时间 < 10 分钟

### 文档质量

- [ ] CLAUDE.md 已更新
- [ ] 所有公共 API 有 TSDoc 注释

---

## 进度追踪

| 周次   | 任务                                | 状态      | 完成日期   |
| ------ | ----------------------------------- | --------- | ---------- |
| Week 1 | 任务 1.1 tiered-classification 拆分 | ✅ 已完成 | 2025-12-25 |
| Week 1 | 任务 1.2 executor 拆分              | ✅ 已完成 | 2025-12-25 |
| Week 1 | 任务 1.3 batch-organize 拆分        | ✅ 已完成 | 2025-12-25 |
| Week 1 | 任务 1.4 smart-sorting 拆分         | ✅ 已完成 | 2025-12-25 |
| Week 1 | 任务 1.5 periodic-report 拆分       | ✅ 已完成 | 2025-12-25 |
| Week 1 | 任务 1.6 operation-log 拆分         | ✅ 已完成 | 2025-12-25 |
| Week 2 | 任务 2.1 mode-selector 修复         | ⬜ 待开始 |            |
| Week 2 | 任务 2.2 Supabase Mock 修复         | ⬜ 待开始 |            |
| Week 2 | 任务 2.3 E2E 增强                   | ⬜ 待开始 |            |
| Week 2 | 任务 2.4 覆盖率提升                 | ⬜ 待开始 |            |
| Week 3 | 任务 3.1 技术债务清理               | ⬜ 待开始 |            |
| Week 3 | 任务 3.2 模块导出优化               | ⬜ 待开始 |            |
| Week 3 | 任务 3.3 代码风格统一               | ⬜ 待开始 |            |
| Week 4 | 任务 4.1 回归测试                   | ⬜ 待开始 |            |
| Week 4 | 任务 4.2 文档更新                   | ⬜ 待开始 |            |
| Week 4 | 任务 4.3 发布 v2.5.0                | ⬜ 待开始 |            |
