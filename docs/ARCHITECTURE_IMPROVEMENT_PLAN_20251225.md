# AnyKeep 架构改进执行方案

**版本**: v1.0.0
**日期**: 2025-12-25
**状态**: 待审核

---

## 执行摘要

本方案基于架构评估报告，将待改进项细化为可落地的执行任务。共分为 3 个阶段，预计总工时 **6-8 周**。

### 优先级划分

| 优先级 | 描述                     | 任务数 | 预估工时 |
| ------ | ------------------------ | ------ | -------- |
| P0     | 阻塞性问题，影响开发效率 | 8      | 2 周     |
| P1     | 重要问题，影响代码质量   | 6      | 2 周     |
| P2     | 优化项，提升可维护性     | 5      | 2 周     |

---

## Phase 1: 超大文件拆分 (P0)

### 目标

将所有 >800 行的文件拆分为 <400 行的专注模块

### 1.1 拆分 `ai-generator.ts` (1775 行)

**当前位置**: `src/lib/utils/ai-generator.ts`

**问题分析**:

- 混合了 prompt 生成、内容生成、元数据处理
- 单文件包含 20+ 个函数，职责不清

**拆分方案**:

```
src/lib/ai-generator/
├── index.ts                    # 统一导出
├── types.ts                    # 类型定义 (~50 行)
├── prompt/
│   ├── index.ts               # Prompt 子模块导出
│   ├── classification-prompt.ts  # 分类 Prompt (~150 行)
│   ├── summary-prompt.ts         # 摘要 Prompt (~150 行)
│   ├── tag-prompt.ts             # 标签 Prompt (~100 行)
│   └── template-utils.ts         # 模板工具 (~100 行)
├── content/
│   ├── index.ts               # 内容子模块导出
│   ├── title-generator.ts     # 标题生成 (~150 行)
│   ├── description-generator.ts # 描述生成 (~150 行)
│   └── metadata-extractor.ts   # 元数据提取 (~200 行)
└── __tests__/
    ├── prompt.test.ts
    └── content.test.ts
```

**执行步骤**:

1. **创建目录结构** (0.5h)

   ```bash
   mkdir -p src/lib/ai-generator/{prompt,content,__tests__}
   ```

2. **提取类型定义** (1h)
   - 从原文件提取所有 interface/type
   - 创建 `types.ts`

3. **拆分 Prompt 相关函数** (3h)
   - 识别所有 `generate*Prompt` 函数
   - 按用途分类到对应文件
   - 更新导入路径

4. **拆分 Content 生成函数** (3h)
   - 识别所有 `generate*Content` 函数
   - 抽取到独立文件

5. **创建统一导出** (0.5h)

   ```typescript
   // src/lib/ai-generator/index.ts
   export * from "./types";
   export * from "./prompt";
   export * from "./content";
   ```

6. **更新所有引用** (2h)
   - 全局搜索 `from '@/lib/utils/ai-generator'`
   - 更新为新路径

7. **迁移并增强测试** (2h)
   - 确保测试覆盖率不下降
   - 为新模块补充测试

**预估工时**: 12h (1.5 天)

**验收标准**:

- [ ] 每个文件 <400 行
- [ ] 类型检查通过
- [ ] 原有测试全部通过
- [ ] 新增测试覆盖拆分后的模块

---

### 1.2 拆分 `duplicate-cleanup.skill.ts` (1133 行)

**当前位置**: `src/lib/ai-skills/skills/duplicate-cleanup/duplicate-cleanup.skill.ts`

**问题分析**:

- 编排 Skill 缺少步骤分离
- 检测逻辑、合并策略、清理执行混杂

**拆分方案**:

```
src/lib/ai-skills/skills/duplicate-cleanup/
├── index.ts                       # 导出
├── types.ts                       # 类型定义 (~80 行)
├── duplicate-cleanup.skill.ts     # 主 Skill 类 (~200 行)
├── steps/
│   ├── index.ts                   # 步骤导出
│   ├── scan-duplicates.step.ts    # 扫描重复 (~150 行)
│   ├── analyze-similarity.step.ts # 相似度分析 (~150 行)
│   ├── suggest-merge.step.ts      # 合并建议 (~150 行)
│   ├── execute-cleanup.step.ts    # 执行清理 (~150 行)
│   └── generate-report.step.ts    # 生成报告 (~100 行)
├── utils/
│   ├── fingerprint.ts             # 指纹算法 (~100 行)
│   └── similarity.ts              # 相似度计算 (~100 行)
└── __tests__/
    ├── duplicate-cleanup.skill.test.ts
    └── steps/
        └── scan-duplicates.step.test.ts
```

**执行步骤**:

1. **分析现有结构** (1h)
   - 识别 `executeStep*` 方法
   - 确定步骤边界

2. **创建步骤接口** (1h)

   ```typescript
   // steps/types.ts
   interface DuplicateCleanupStep {
     name: string;
     execute(context: StepContext): Promise<StepResult>;
   }
   ```

3. **逐个提取步骤** (4h)
   - 每个步骤提取为独立文件
   - 保持接口一致

4. **提取工具函数** (2h)
   - 指纹生成算法
   - 相似度计算逻辑

5. **重构主 Skill 类** (2h)
   - 改为步骤编排器
   - 依赖注入步骤实例

6. **更新测试** (2h)
   - 为每个步骤添加单元测试
   - 保留集成测试

**预估工时**: 12h (1.5 天)

**验收标准**:

- [ ] 主 Skill 文件 <250 行
- [ ] 每个步骤文件 <200 行
- [ ] 步骤可独立测试
- [ ] 原有功能不变

---

### 1.3 拆分 `classification/integration.ts` (1013 行)

**当前位置**: `src/lib/classification/integration.ts`

**问题分析**:

- 集成层承担过多职责
- 包含 API 适配、缓存、重试、日志等

**拆分方案**:

```
src/lib/classification/integration/
├── index.ts                    # 统一导出
├── types.ts                    # 集成类型 (~50 行)
├── classification-facade.ts    # 门面模式入口 (~150 行)
├── adapters/
│   ├── index.ts
│   ├── api-adapter.ts          # API 适配 (~150 行)
│   ├── cache-adapter.ts        # 缓存适配 (~100 行)
│   └── fallback-adapter.ts     # 降级适配 (~100 行)
├── middleware/
│   ├── index.ts
│   ├── retry-middleware.ts     # 重试中间件 (~100 行)
│   ├── logging-middleware.ts   # 日志中间件 (~80 行)
│   └── metrics-middleware.ts   # 指标中间件 (~80 行)
└── __tests__/
    ├── facade.test.ts
    └── adapters/
```

**执行步骤**:

1. **识别职责边界** (1h)
   - API 调用逻辑
   - 缓存逻辑
   - 重试/降级逻辑
   - 日志/指标逻辑

2. **创建适配器层** (3h)
   - 抽象 `ClassificationAdapter` 接口
   - 实现各适配器

3. **创建中间件层** (2h)
   - 实现责任链模式
   - 可插拔的中间件

4. **创建门面类** (2h)
   - 统一入口
   - 组装适配器和中间件

5. **迁移原有逻辑** (2h)
   - 逐步替换原文件引用
   - 保持向后兼容

6. **测试验证** (2h)

**预估工时**: 12h (1.5 天)

---

### 1.4 拆分 `insight-report.skill.ts` (947 行)

**拆分方案**:

```
src/lib/ai-skills/skills/insight-report/
├── insight-report.skill.ts     # 主类 (~200 行)
├── steps/
│   ├── collect-data.step.ts    # 数据收集 (~150 行)
│   ├── analyze-trends.step.ts  # 趋势分析 (~150 行)
│   ├── generate-insights.step.ts # 洞察生成 (~150 行)
│   └── format-report.step.ts   # 报告格式化 (~150 行)
└── analyzers/
    ├── activity-analyzer.ts    # 活跃度分析
    ├── content-analyzer.ts     # 内容分析
    └── trend-analyzer.ts       # 趋势分析
```

**预估工时**: 10h (1.25 天)

---

### 1.5 拆分其他超大文件

| 文件                                | 当前行数 | 目标结构                  | 预估工时 |
| ----------------------------------- | -------- | ------------------------- | -------- |
| `data-export.skill.ts`              | 819      | steps/ + formatters/      | 8h       |
| `learning-path.skill.ts`            | 806      | steps/ + generators/      | 8h       |
| `knowledge-agent.ts`                | 788      | handlers/ + processors/   | 8h       |
| `multi-vector-embedding.service.ts` | 838      | strategies/ + processors/ | 10h      |

---

## Phase 2: 测试覆盖提升 (P1)

### 目标

- E2E 测试场景从 <10 提升到 >30
- 单元测试覆盖率从 ~60% 提升到 >80%

### 2.1 E2E 测试场景补充

**新增测试文件**:

```
e2e/
├── smoke.spec.ts              # 已有
├── auth/
│   ├── login.spec.ts          # 登录流程
│   ├── logout.spec.ts         # 登出流程
│   └── register.spec.ts       # 注册流程
├── bookmarks/
│   ├── create.spec.ts         # 创建书签
│   ├── edit.spec.ts           # 编辑书签
│   ├── delete.spec.ts         # 删除书签
│   ├── batch-operations.spec.ts # 批量操作
│   └── import-export.spec.ts  # 导入导出
├── folders/
│   ├── create.spec.ts         # 创建文件夹
│   ├── move.spec.ts           # 移动书签
│   └── organize.spec.ts       # 整理功能
├── ai/
│   ├── search.spec.ts         # AI 搜索
│   ├── summary.spec.ts        # AI 摘要
│   ├── classify.spec.ts       # AI 分类
│   └── skills.spec.ts         # Skills 功能
└── settings/
    └── preferences.spec.ts    # 用户设置
```

**执行步骤**:

1. **创建测试模板** (2h)

   ```typescript
   // e2e/templates/authenticated-test.ts
   import { test as base } from "@playwright/test";

   export const test = base.extend({
     authenticatedPage: async ({ page }, use) => {
       // 登录逻辑
       await use(page);
     },
   });
   ```

2. **编写 Auth 测试** (4h)
3. **编写 Bookmarks 测试** (6h)
4. **编写 Folders 测试** (4h)
5. **编写 AI 测试** (6h)
6. **编写 Settings 测试** (2h)

**预估工时**: 24h (3 天)

---

### 2.2 单元测试补充

**目标模块**:

| 模块                | 当前覆盖 | 目标覆盖 | 需补充测试        |
| ------------------- | -------- | -------- | ----------------- |
| ai-skills/skills/\* | 60%      | 85%      | 各 Skill 步骤测试 |
| classification/\*   | 70%      | 90%      | 边界条件测试      |
| ai-agent/tools/\*   | 50%      | 80%      | 工具函数测试      |

**执行步骤**:

1. **运行覆盖率报告** (0.5h)

   ```bash
   npm test -- --coverage --coverageReporters=html
   ```

2. **识别未覆盖代码** (1h)
   - 分析 coverage/lcov-report
   - 标记关键未覆盖分支

3. **为每个 Skill 补充步骤测试** (8h)
   - 每个步骤独立测试
   - 边界条件覆盖

4. **为 classification 补充边界测试** (4h)
   - 空输入处理
   - 异常输入处理
   - 超时处理

5. **为 tools 补充单元测试** (4h)

**预估工时**: 18h (2.25 天)

---

### 2.3 集成测试补充

**新增集成测试**:

```
src/lib/ai-skills/__tests__/integration/
├── skill-execution.integration.test.ts    # Skill 执行流程
├── intent-routing.integration.test.ts     # 意图路由
├── orchestration.integration.test.ts      # 编排执行
└── fallback.integration.test.ts           # 降级机制
```

**预估工时**: 8h (1 天)

---

## Phase 3: 架构优化 (P2)

### 3.1 模块依赖图生成

**工具**: `madge` + `dependency-cruiser`

**执行步骤**:

1. **安装工具** (0.5h)

   ```bash
   npm install -D madge dependency-cruiser
   ```

2. **生成依赖图** (1h)

   ```bash
   npx madge --image docs/dependency-graph.svg src/lib
   ```

3. **配置依赖规则** (2h)

   ```javascript
   // .dependency-cruiser.js
   module.exports = {
     forbidden: [
       {
         name: "no-circular",
         severity: "error",
         from: {},
         to: { circular: true },
       },
     ],
   };
   ```

4. **集成 CI 检查** (1h)

**预估工时**: 4.5h

---

### 3.2 日志系统 Next.js 兼容性修复

**问题**: `cookies was called outside request scope`

**解决方案**:

1. **创建上下文感知日志器** (4h)

   ```typescript
   // src/lib/shared/logger/context-logger.ts
   import { headers } from "next/headers";

   export function getRequestLogger() {
     try {
       // 尝试获取请求上下文
       const headersList = headers();
       return createServerLogger({
         requestId: headersList.get("x-request-id"),
       });
     } catch {
       // 非请求上下文，使用静态日志器
       return createStaticLogger();
     }
   }
   ```

2. **更新 SkillExecutionLogger** (2h)
   - 检测执行环境
   - 选择合适的日志器

3. **测试验证** (2h)
   - 确保 Edge 环境正常
   - 确保 SSR 环境正常

**预估工时**: 8h (1 天)

---

### 3.3 TODO/FIXME 清理

**基于 TECH_DEBT_20251225.md**:

| 优先级 | 任务                 | 预估工时 |
| ------ | -------------------- | -------- |
| P1     | Prompt 构建器实现    | 8h       |
| P2     | Ollama Provider 支持 | 16h      |
| P2     | Agent Memory 持久化  | 12h      |
| P3     | 外部监控集成         | 8h       |

**总预估工时**: 44h (5.5 天)

---

## 执行计划总览

### 时间线

```
Week 1-2: Phase 1 (超大文件拆分)
├── Day 1-2: ai-generator.ts
├── Day 3-4: duplicate-cleanup.skill.ts
├── Day 5-6: integration.ts
├── Day 7-8: insight-report.skill.ts
└── Day 9-10: 其他文件

Week 3-4: Phase 2 (测试覆盖)
├── Day 1-3: E2E 测试
├── Day 4-5: 单元测试补充
└── Day 6-7: 集成测试

Week 5-6: Phase 3 (架构优化)
├── Day 1: 依赖图生成
├── Day 2: 日志系统修复
└── Day 3-10: TODO 清理
```

### 风险与缓解

| 风险         | 影响 | 缓解措施                       |
| ------------ | ---- | ------------------------------ |
| 拆分引入回归 | 高   | 每次拆分后运行全量测试         |
| 测试编写耗时 | 中   | 使用测试模板，优先覆盖关键路径 |
| 依赖更新冲突 | 低   | 小步提交，及时 code review     |

### 成功指标

| 指标           | 当前 | 目标 | 验收标准         |
| -------------- | ---- | ---- | ---------------- |
| 最大文件行数   | 1775 | <400 | 所有文件 <400 行 |
| E2E 测试数     | <10  | >30  | 30+ 个 E2E 场景  |
| 单元测试覆盖率 | ~60% | >80% | coverage 报告    |
| ESLint 错误    | 0    | 0    | 保持零错误       |
| 类型检查       | 通过 | 通过 | 无新增错误       |

---

## 审核检查清单

请审核以下内容：

### Phase 1: 文件拆分

- [ ] ai-generator.ts 拆分方案是否合理？
- [ ] 步骤分离的粒度是否合适？
- [ ] 是否需要调整优先级？

### Phase 2: 测试补充

- [ ] E2E 测试场景是否覆盖核心功能？
- [ ] 测试优先级是否正确？
- [ ] 是否需要增减测试场景？

### Phase 3: 架构优化

- [ ] 日志系统修复方案是否可行？
- [ ] TODO 清理优先级是否合理？
- [ ] 是否有遗漏的优化项？

### 整体计划

- [ ] 时间估算是否合理？
- [ ] 风险评估是否充分？
- [ ] 成功指标是否可衡量？

---

**请审核后反馈：**

1. 哪些任务需要调整？
2. 优先级是否需要变更？
3. 是否有其他建议？

---

_文档版本: v1.0.0_
_创建时间: 2025-12-25_
_待审核人: [项目负责人]_
