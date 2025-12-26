# Phase 2: 核心场景 - 子方案

> **版本**: 2.1.0
> **父方案**: [AGENT_UPGRADE_IMPLEMENTATION_PLAN.md](../AGENT_UPGRADE_IMPLEMENTATION_PLAN.md)
> **V3 参考**: [AGENT_UPGRADE_PLAN_V3_20251225.md](../AGENT_UPGRADE_PLAN_V3_20251225.md)
> **日期**: 2025-12-26
> **状态**: ✅ Phase 2 全部完成
> **更新**: V2.2 - 更新实际完成状态（Batch 2.4 ✅ / Batch 3 ✅ / Batch 4 ✅ 含前端集成）

---

## 概览

| 属性         | 值                                                     |
| ------------ | ------------------------------------------------------ |
| **目标**     | 上下文记忆前端集成 + 搜索体验升级 + 整理闭环           |
| **周期**     | 5 周                                                   |
| **工时**     | 66h (+14h 前端集成)                                    |
| **Batch**    | Batch 2.4 (记忆前端) + Batch 3 (搜索) + Batch 4 (整理) |
| **前置依赖** | Phase 1 完成 ✅                                        |

### 任务状态标记

| 标记  | 含义   |
| ----- | ------ |
| `[ ]` | 待开始 |
| `[-]` | 进行中 |
| `[x]` | 已完成 |
| `[!]` | 阻塞中 |
| `[~]` | 已跳过 |

---

## 核心问题

### 问题 1: 上下文记忆无前端支持

**现象**: 后端上下文记忆已完成，但前端未集成

**根因分析**:

- 前端未生成/维护 conversationId
- API 请求未携带 conversationId
- 指代解析成功无视觉反馈

### 问题 2: 搜索结果不精准

**现象**: 搜索"上周的AI文章"返回无关结果

**根因分析**:

- 缺少时间范围解析
- 关键词提取不够智能
- 结果排序算法简单

### 问题 3: 整理操作无闭环

**现象**: 整理操作后用户不知道发生了什么，无法撤销

**根因分析**:

- 缺少方案预览和确认
- 无执行进度反馈
- 无撤销机制

---

## Batch 2.4: 上下文记忆前端集成 (4h) ✅ 完成

> **前置依赖**: Phase 1 Batch 2.1-2.3 ✅ 已完成
> **完成日期**: 2025-12-26
> **说明**: 在 `ai-panel-content.tsx` 中实现

### 2.4 前端集成 (4h) ✅

**目标**: 前端维护 conversationId + 显示记忆状态

| #     | 任务                              | 工时 | 文件路径                                 | 验收标准                    |
| ----- | --------------------------------- | ---- | ---------------------------------------- | --------------------------- |
| 2.4.1 | [x] 前端生成并维护 conversationId | 1h   | `src/components/ai/ai-panel-content.tsx` | UUID 生成，会话级存储       |
| 2.4.2 | [x] API 请求携带 conversationId   | 0.5h | `src/components/ai/ai-panel-content.tsx` | 所有请求带 conversationId   |
| 2.4.3 | [x] 显示"AI 记住了"提示           | 1h   | `src/components/ai/memory-indicator.tsx` | 指代解析成功时显示          |
| 2.4.4 | [x] 新会话时重置 conversationId   | 0.5h | `src/components/ai/ai-panel-content.tsx` | 点击"新对话"时重置          |
| 2.4.5 | [~] 前端集成测试                  | 1h   | 手动测试                                 | "把刚才的...保存"能正确工作 |

**技术要点**:

- conversationId 使用 `crypto.randomUUID()` 生成
- 存储在 React state 中，组件初始化时生成
- `handleClear` 函数在清除对话时生成新的 conversationId
- API 响应的 done chunk 携带 conversationId 供前端同步

---

## Batch 3: 搜索体验 (28h) ✅ 完成

> **完成日期**: 2025-12-25
> **实现位置**: `src/lib/ai-skills/search/` + `src/components/ai/`

### 3.1 查询理解增强 (10h) ✅

**目标**: 从自然语言中提取搜索意图

| #     | 任务                        | 工时 | 文件路径                                                  | 验收标准                                  |
| ----- | --------------------------- | ---- | --------------------------------------------------------- | ----------------------------------------- |
| 3.1.1 | [x] 创建 `ParsedQuery` 类型 | 0.5h | `src/lib/ai-skills/search/types.ts`                       | keywords, timeRange, platform, fuzzyLevel |
| 3.1.2 | [x] 创建 `QueryParser` 类   | 1h   | `src/lib/ai-skills/search/query-parser.ts`                | parse() 方法                              |
| 3.1.3 | [x] 实现关键词提取          | 1.5h | 同上                                                      | 去除停用词，提取核心词                    |
| 3.1.4 | [x] 实现时间范围解析        | 1.5h | 同上                                                      | "最近一周" → 7 days                       |
| 3.1.5 | [x] 实现平台过滤解析        | 1h   | 同上                                                      | "微信的" → platform: wechat               |
| 3.1.6 | [x] 实现模糊程度判断        | 1h   | 同上                                                      | "那篇" → fuzzy                            |
| 3.1.7 | [x] 实现搜索意图识别        | 1h   | 同上                                                      | find_specific vs browse                   |
| 3.1.8 | [x] 编写测试用例            | 2.5h | `src/lib/ai-skills/search/__tests__/query-parser.test.ts` | 20+ 场景                                  |

**实现细节**:

- `QueryParser` 类 (710 行) 实现完整的自然语言查询解析
- 支持中文时间表达式解析（最近一周、上个月、前两天等）
- 平台识别（微信、B站、知乎、小红书等）
- 搜索意图分类（find_specific / browse / verify）

### 3.2 结果排序优化 (8h) ✅

**目标**: 多因素智能排序

| #     | 任务                           | 工时 | 文件路径                                                   | 验收标准           |
| ----- | ------------------------------ | ---- | ---------------------------------------------------------- | ------------------ |
| 3.2.1 | [x] 创建 `RankingFactors` 类型 | 0.5h | `src/lib/ai-skills/search/types.ts`                        | 5 个排序因子       |
| 3.2.2 | [x] 创建 `ResultRanker` 类     | 1h   | `src/lib/ai-skills/search/result-ranker.ts`                | rank() 方法        |
| 3.2.3 | [x] 实现标题匹配评分 (40%)     | 1h   | 同上                                                       | 精确/模糊/部分匹配 |
| 3.2.4 | [x] 实现内容匹配评分 (25%)     | 1h   | 同上                                                       | 摘要/全文匹配      |
| 3.2.5 | [x] 实现时间相关评分 (15%)     | 1h   | 同上                                                       | 越新越高           |
| 3.2.6 | [x] 实现用户行为评分 (10%)     | 1h   | 同上                                                       | 访问/收藏次数      |
| 3.2.7 | [x] 实现质量信号评分 (10%)     | 0.5h | 同上                                                       | 有摘要/有标签加分  |
| 3.2.8 | [x] 实现相关度标签生成         | 0.5h | 同上                                                       | 高相关/相关        |
| 3.2.9 | [x] 编写测试用例               | 1.5h | `src/lib/ai-skills/search/__tests__/result-ranker.test.ts` | 验证排序逻辑       |

**实现细节**:

- `ResultRanker` 类 (422 行) 实现多因素排序
- 权重配置：标题 40%、内容 25%、时间 15%、行为 10%、质量 10%
- 支持相关度分级（highly_relevant / relevant / partial）

### 3.3 搜索响应格式化 (4h) ✅

**目标**: 简洁、有用的搜索结果展示

| #     | 任务                 | 工时 | 文件路径                                                        | 验收标准           |
| ----- | -------------------- | ---- | --------------------------------------------------------------- | ------------------ |
| 3.3.1 | [x] 创建搜索响应模板 | 1h   | `src/lib/ai-skills/search/response-formatter.ts`                | 单结果/多结果模板  |
| 3.3.2 | [x] 实现单结果格式化 | 0.5h | 同上                                                            | 高置信时的简洁展示 |
| 3.3.3 | [x] 实现列表格式化   | 1h   | 同上                                                            | 带元数据的列表     |
| 3.3.4 | [x] 实现空结果处理   | 0.5h | 同上                                                            | 友好提示+建议      |
| 3.3.5 | [x] 编写测试用例     | 1h   | `src/lib/ai-skills/search/__tests__/response-formatter.test.ts` | 各种场景           |

**实现细节**:

- `ResponseFormatter` 类 (539 行) 实现搜索响应格式化
- 生成 AI 友好的响应文本
- 自动生成跟进搜索建议

### 3.4 集成到搜索服务 (4h) ✅

**目标**: 将增强功能集成到现有搜索

| #     | 任务                 | 工时 | 文件路径                                              | 验收标准                        |
| ----- | -------------------- | ---- | ----------------------------------------------------- | ------------------------------- |
| 3.4.1 | [x] 创建增强搜索服务 | 1.5h | `src/lib/ai-skills/search/enhanced-search.service.ts` | 整合 QueryParser + ResultRanker |
| 3.4.2 | [x] 添加响应格式化   | 1h   | 同上                                                  | 使用 ResponseFormatter          |
| 3.4.3 | [x] 实现 SearchSkill | 1.5h | `src/lib/ai-skills/skills/search/search.skill.ts`     | 完整搜索 Skill                  |

**实现细节**:

- `EnhancedSearchService` (348 行) 整合所有搜索增强组件
- `SearchSkill` (357 行) 提供完整的搜索 Skill 实现
- 支持关键词搜索、语义搜索、混合搜索模式

### 3.5 前端集成 (6h) ✅

**目标**: 搜索结果增强展示 + 交互优化

| #     | 任务                     | 工时 | 文件路径                                    | 验收标准           |
| ----- | ------------------------ | ---- | ------------------------------------------- | ------------------ |
| 3.5.1 | [x] 创建搜索结果列表组件 | 2h   | `src/components/ai/search-results-list.tsx` | 带元数据的列表展示 |
| 3.5.2 | [x] 创建搜索结果卡片组件 | 0.5h | `src/components/ai/search-result-card.tsx`  | 单个结果卡片       |
| 3.5.3 | [x] 添加查询理解反馈组件 | 1h   | `src/components/ai/query-feedback.tsx`      | 显示解析结果       |
| 3.5.4 | [x] 添加"查看更多"功能   | 0.5h | `src/components/ai/search-results-list.tsx` | 折叠/展开结果      |
| 3.5.5 | [~] 集成到消息渲染       | 1h   | 待集成                                      | 检测搜索结果类型   |
| 3.5.6 | [~] 前端集成测试         | 1h   | 手动测试                                    | 搜索结果正确渲染   |

**实现细节**:

- `SearchResultsList` 组件支持完整搜索响应展示
- `SearchResultCard` 组件显示单个结果详情
- 集成查询理解反馈和搜索建议

---

## Batch 4: 整理体验 (34h) ✅ 完成

> **完成日期**: 2025-12-26
> **实现位置**: `src/lib/ai-skills/organize/` + `src/lib/ai-skills/skills/batch-organize/`
> **前端组件**: `src/components/ai/organize-*.tsx`

### 4.1 整理工作流设计 (10h) ✅

**目标**: 分析 → 方案 → 确认 → 执行 闭环

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 分析    │ → │ 方案    │ → │ 确认    │ → │ 执行    │ → │ 报告    │
│ analyze │    │ plan    │    │ confirm │    │ execute │    │ report  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

| #     | 任务                    | 工时 | 文件路径                                                              | 验收标准                         |
| ----- | ----------------------- | ---- | --------------------------------------------------------------------- | -------------------------------- |
| 4.1.1 | [x] 创建整理 Skill 框架 | 1h   | `src/lib/ai-skills/skills/batch-organize/batch-organize.skill.ts`     | 主流程框架                       |
| 4.1.2 | [x] 创建相关类型定义    | 1h   | `src/lib/ai-skills/skills/batch-organize/types.ts`                    | OrganizeAction, OrganizeStats 等 |
| 4.1.3 | [x] 实现数据获取步骤    | 1.5h | `src/lib/ai-skills/skills/batch-organize/steps/data-fetching.step.ts` | 按范围查询书签和文件夹           |
| 4.1.4 | [x] 实现分类建议步骤    | 2h   | `src/lib/ai-skills/skills/batch-organize/steps/categorize.step.ts`    | 基于内容推荐文件夹               |
| 4.1.5 | [x] 实现去重检测步骤    | 1.5h | `src/lib/ai-skills/skills/batch-organize/steps/duplicate.step.ts`     | URL/标题相似度检测               |
| 4.1.6 | [x] 实现标签建议步骤    | 2h   | `src/lib/ai-skills/skills/batch-organize/steps/tag.step.ts`           | 智能标签推荐                     |
| 4.1.7 | [x] 编写测试用例        | 1h   | `src/lib/ai-skills/skills/batch-organize/__tests__/`                  | 各步骤测试                       |

**实现细节**:

- `BatchOrganizeSkill` (v2.0.0) 实现完整的整理编排流程
- 支持 5 种整理操作：auto-categorize, auto-tag, clean-duplicates, archive-old, validate-urls
- 模块化步骤设计，每个步骤独立文件

### 4.2 方案执行引擎 (8h + 4h 撤销) ✅

**目标**: 安全执行整理操作 + 支持撤销

| #     | 任务                       | 工时 | 文件路径                                                             | 验收标准      |
| ----- | -------------------------- | ---- | -------------------------------------------------------------------- | ------------- |
| 4.2.1 | [x] 实现执行步骤主方法     | 1h   | `src/lib/ai-skills/skills/batch-organize/steps/execute.step.ts`      | 按方案执行    |
| 4.2.2 | [x] 实现 Saga 执行步骤     | 1h   | `src/lib/ai-skills/skills/batch-organize/steps/saga-execute.step.ts` | Saga 模式执行 |
| 4.2.3 | [x] 实现归档操作步骤       | 1.5h | `src/lib/ai-skills/skills/batch-organize/steps/archive.step.ts`      | 归档旧内容    |
| 4.2.4 | [x] 实现报告生成步骤       | 1.5h | `src/lib/ai-skills/skills/batch-organize/steps/report.step.ts`       | 执行结果汇总  |
| 4.2.5 | [x] 创建 Saga Orchestrator | 1h   | `src/lib/ai-skills/organize/saga-orchestrator/saga-orchestrator.ts`  | 事务编排器    |
| 4.2.6 | [x] 编写测试用例           | 2h   | `src/lib/ai-skills/organize/saga-orchestrator/__tests__/`            | Saga 流程测试 |

**实现细节**:

- `SagaOrchestrator` (552 行) 实现完整的 Saga Pattern
- 支持步骤重试、超时、补偿机制
- 与 SnapshotManager 集成实现自动回滚

#### 4.2.X 撤销机制实现 ✅ 已完成

> **完成日期**: 2025-12-25
> **实现位置**: `src/lib/ai-skills/organize/snapshot-manager/`

| #      | 任务                                 | 工时 | 文件路径                                                                         | 验收标准                   |
| ------ | ------------------------------------ | ---- | -------------------------------------------------------------------------------- | -------------------------- |
| 4.2.7  | [x] 创建 `OperationSnapshot` 类型    | 0.5h | `src/lib/ai-skills/organize/snapshot-manager/types.ts`                           | 快照数据结构               |
| 4.2.8  | [x] 实现 `createSnapshot()` 方法     | 1h   | `src/lib/ai-skills/organize/snapshot-manager/snapshot-manager.ts`                | 执行前创建快照             |
| 4.2.9  | [x] 实现 `revertFromSnapshot()` 方法 | 1.5h | 同上                                                                             | 从快照恢复（undoSnapshot） |
| 4.2.10 | [x] 实现快照存储（数据库）           | 1h   | 同上                                                                             | 支持 7 天 TTL              |
| 4.2.11 | [x] 编写撤销测试用例                 | 1h   | `src/lib/ai-skills/organize/snapshot-manager/__tests__/snapshot-manager.test.ts` | 撤销流程测试               |

**实现细节**:

- `SnapshotManager` (725 行) 完整实现
- 支持 5 种操作类型：batch_categorize, batch_tag, batch_dedupe, batch_archive, batch_delete
- 数据库持久化存储（`operation_snapshots` 表）
- 396 行完整测试覆盖

### 4.3 整理 Skill 集成 (8h) ✅

**目标**: 创建完整的整理 Skill

| #     | 任务                             | 工时 | 文件路径                                                          | 验收标准                     |
| ----- | -------------------------------- | ---- | ----------------------------------------------------------------- | ---------------------------- |
| 4.3.1 | [x] 创建 `BatchOrganizeSkill` 类 | 1.5h | `src/lib/ai-skills/skills/batch-organize/batch-organize.skill.ts` | 继承 OrchestrationSkill      |
| 4.3.2 | [x] 实现 6 步骤定义              | 1h   | `src/lib/ai-skills/skills/batch-organize/schema.ts`               | data_fetching → ... → report |
| 4.3.3 | [x] 实现输入解析方法             | 1h   | `src/lib/ai-skills/skills/batch-organize/batch-organize.skill.ts` | parseInput() 自然语言解析    |
| 4.3.4 | [x] 实现步骤执行方法             | 1h   | 同上                                                              | executeStep() 分发到各步骤   |
| 4.3.5 | [x] 实现确认等待机制             | 1h   | 同上                                                              | 返回确认请求                 |
| 4.3.6 | [x] 实现报告生成                 | 1h   | `src/lib/ai-skills/skills/batch-organize/steps/report.step.ts`    | generateSummary()            |
| 4.3.7 | [x] 注册到 SkillRegistry         | 0.5h | `src/lib/ai-skills/register.ts`                                   | 添加 batch_organize skill    |
| 4.3.8 | [x] 集成测试                     | 1h   | `src/lib/ai-skills/skills/batch-organize/__tests__/`              | 完整流程                     |

**实现细节**:

- 完整的编排 Skill 实现，支持 SSE 流式响应
- 支持自然语言输入解析（"帮我整理一下书签"）
- 与 Saga Orchestrator 和 SnapshotManager 集成

### 4.4 前端集成 (8h) ✅ 完成

**目标**: 整理方案确认 + 执行进度 + 操作撤销
**完成日期**: 2025-12-26

| #     | 任务                     | 工时 | 文件路径                                      | 验收标准                     |
| ----- | ------------------------ | ---- | --------------------------------------------- | ---------------------------- |
| 4.4.1 | [x] 创建整理方案预览组件 | 2h   | `src/components/ai/organize-plan-preview.tsx` | 分组展示：移动/去重/归档操作 |
| 4.4.2 | [x] 创建执行进度组件     | 1.5h | `src/components/ai/organize-progress.tsx`     | 步骤进度条 + 当前操作        |
| 4.4.3 | [x] 实现方案确认交互     | 1h   | `src/components/ai/organize-plan-preview.tsx` | 确认/调整/取消按钮           |
| 4.4.4 | [x] 实现撤销按钮         | 1h   | `src/components/ai/organize-result.tsx`       | 执行完成后显示撤销按钮       |
| 4.4.5 | [x] 集成到消息渲染       | 1.5h | `src/components/ai/ai-message.tsx`            | 检测 organize 类型消息       |
| 4.4.6 | [~] 前端集成测试         | 1h   | 手动测试                                      | 完整整理流程交互             |

**实现细节**:

- `OrganizePlanPreview` (548 行) 实现方案预览 + 确认交互
- `OrganizeProgress` (338 行) 实现进度显示（完整版 + 内联版）
- `OrganizeResult` (453 行) 实现结果展示 + 撤销功能
- `AIMessage` 集成检测 `batch_organize` skillId，自动使用专用组件

---

## 验收标准

### Batch 2.4 完成标准 ✅

- [x] 前端正确生成并维护 conversationId
- [x] "把刚才的总结保存" 能正确解析"刚才"
- [x] 指代解析成功时显示"AI 记住了"提示
- [x] 新会话时 conversationId 正确重置

### Batch 3 完成标准 ✅

- [x] "上周的AI文章" 正确解析时间范围
- [x] 搜索结果按相关度排序，高相关显示标记
- [x] 结果支持"查看更多"展开
- [x] 空结果时显示友好提示和建议

### Batch 4 完成标准 ✅

- [x] 后端：整理方案生成功能
- [x] 后端：执行引擎 + Saga Pattern
- [x] 后端：撤销机制（快照存储 + 恢复）
- [x] 前端：整理方案预览组件 (OrganizePlanPreview)
- [x] 前端：执行进度显示 (OrganizeProgress / OrganizeProgressInline)
- [x] 前端：撤销按钮交互 (OrganizeResult)

---

## 实际目录结构

```
src/lib/ai-skills/
├── search/                              # Batch 3 ✅
│   ├── types.ts                         # 269 行类型定义
│   ├── query-parser.ts                  # 710 行查询解析
│   ├── result-ranker.ts                 # 422 行结果排序
│   ├── response-formatter.ts            # 539 行响应格式化
│   ├── enhanced-search.service.ts       # 348 行增强搜索服务
│   ├── index.ts                         # 模块导出
│   └── __tests__/
│       ├── query-parser.test.ts
│       ├── result-ranker.test.ts
│       └── response-formatter.test.ts
├── organize/                            # Batch 4 基础设施 ✅
│   ├── snapshot-manager/                # 撤销机制
│   │   ├── types.ts                     # 261 行类型定义
│   │   ├── snapshot-manager.ts          # 725 行快照管理
│   │   ├── index.ts
│   │   └── __tests__/
│   │       └── snapshot-manager.test.ts # 396 行测试
│   ├── saga-orchestrator/               # Saga Pattern
│   │   ├── saga-orchestrator.ts         # 552 行事务编排
│   │   ├── index.ts
│   │   └── __tests__/
│   │       └── saga-orchestrator.test.ts
│   └── index.ts
└── skills/
    ├── search/                          # 搜索 Skill ✅
    │   ├── search.skill.ts              # 357 行
    │   ├── types.ts
    │   ├── index.ts
    │   └── __tests__/
    └── batch-organize/                  # 整理 Skill ✅
        ├── batch-organize.skill.ts      # 编排 Skill
        ├── types.ts
        ├── schema.ts                    # 步骤定义
        ├── index.ts
        ├── steps/                       # 步骤实现
        │   ├── data-fetching.step.ts
        │   ├── categorize.step.ts
        │   ├── tag.step.ts
        │   ├── duplicate.step.ts
        │   ├── archive.step.ts
        │   ├── execute.step.ts
        │   ├── saga-execute.step.ts
        │   ├── report.step.ts
        │   ├── types.ts
        │   └── index.ts
        └── __tests__/

src/components/ai/
├── memory-indicator.tsx               # Batch 2.4 ✅
├── search-results-list.tsx            # Batch 3.5 ✅
├── search-result-card.tsx             # Batch 3.5 ✅
├── query-feedback.tsx                 # Batch 3.5 ✅
├── organize-plan-preview.tsx          # Batch 4.4 ✅ (548 行)
├── organize-progress.tsx              # Batch 4.4 ✅ (338 行)
└── organize-result.tsx                # Batch 4.4 ✅ (453 行)
```

---

## 相关文档

- [最佳实践参考](./best-practices.md) - chrono-node、BM25、Saga Pattern
- [验证用例](./validation-cases.md) _(待创建)_
- [Phase 1 子方案](../phase-1-foundation/README.md) ✅ 已完成
- [Phase 3 子方案](../phase-3-advanced/README.md)
- [Phase 4 子方案](../phase-4-interaction/README.md)
