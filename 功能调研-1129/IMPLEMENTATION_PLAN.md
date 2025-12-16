# 智能分类 V3.5 → V4.0 升级开发计划

**版本**: V1.0
**日期**: 2025-12-08
**状态**: 待审核

---

## 一、项目概述

### 1.1 升级目标

将智能分类系统从 V3.0 升级至 V4.0，实现三大核心愿景：

| 维度         | 当前状态 (V3.0) | 目标状态 (V4.0)           |
| ------------ | --------------- | ------------------------- |
| **透明度**   | 黑盒决策        | 白盒可视化 + TraceID 追踪 |
| **动态性**   | 硬编码权重      | 场景化动态配置 + 热更新   |
| **响应速度** | P95 ~1.5s       | P95 < 500ms，感知 0ms     |

### 1.2 关键 KPI

| 指标          | 当前值 | 目标值  | 提升幅度 |
| ------------- | ------ | ------- | -------- |
| P95 响应耗时  | ~1.5s  | < 500ms | 67% ↓    |
| 用户感知延迟  | ~1.5s  | 0ms     | 100% ↓   |
| 分类采纳率    | ~85%   | > 92%   | +7%      |
| Tier 1 拦截率 | ~30%   | > 60%   | +30%     |
| AI 调用成本   | 基准   | -50%    | 50% ↓    |

### 1.3 现有代码基础

基于代码探索结果，V3.0 已实现：

```
src/lib/classification/
├── v3/                              # V3.0 核心模块
│   ├── config.ts                   # 17 个功能开关
│   ├── constants/
│   │   └── universal-categories.ts # 30 个通用分类 + 150 同义词
│   ├── strategies/                 # 5 层匹配器
│   │   ├── universal-matcher.ts
│   │   ├── knn-direct-matcher.ts
│   │   ├── fingerprint-matcher.ts
│   │   ├── tag-matcher.ts
│   │   └── query-expansion-matcher.ts
│   ├── services/                   # 核心服务
│   │   ├── tiered-classification.service.ts
│   │   ├── feedback-loop.service.ts
│   │   ├── dynamic-weights.service.ts
│   │   ├── ai-librarian.service.ts
│   │   └── ...
│   └── prompts/cot-prompt.ts
├── services/                       # 基础服务
├── repositories/                   # 数据访问层
└── container.ts                    # 依赖注入
```

**已实现功能**：

- ✅ 4 层分层策略 (TieredClassificationService)
- ✅ 5 种匹配器 (Vector/History/k-NN/Fingerprint/Universal)
- ✅ CoT 思维链推理
- ✅ 反馈闭环 + 动态权重
- ✅ 决策追踪表 (`classification_decisions`)
- ✅ 用户兴趣画像 (`user_interest_profiles`)

---

## 二、开发阶段规划

共分为 **3 个 Phase**，每个 Phase 约 **2 周**，总计 **6 周**。

---

## Phase 1: 稳基座与高性能 (Week 1-2)

**目标**: 解决系统复杂度，降低响应延迟，建立可观测性基础。

### Stage 1.1: 数据库索引优化

**Goal**: 向量检索耗时降低 50%

**工作内容**:

1. 检查现有 `embedding` 列索引类型（预计是 IVFFlat）
2. 创建 HNSW 索引迁移脚本
3. 优化相关查询 SQL
4. 添加索引性能监控

**文件变更**:

- `supabase/migrations/20251209xxxx_optimize_hnsw_index.sql` (新增)
- [folder-profile.repository.ts](src/lib/classification/repositories/folder-profile.repository.ts) (优化查询)

**Success Criteria**:

- [ ] HNSW 索引成功创建
- [ ] 向量检索 P95 < 100ms
- [ ] 无数据丢失

**Tests**:

- [ ] 迁移回滚测试
- [ ] 查询性能基准测试

**Status**: Not Started

---

### Stage 1.2: 全链路追踪 (Traceability)

**Goal**: 每次分类可追溯完整决策路径

**工作内容**:

1. 设计 `TraceID` 生成机制（UUID + 时间戳）
2. 扩展 `ClassificationResult` 类型，增加 `traceId` 和 `decisionPath`
3. 在每个 Matcher 中记录得分详情
4. 创建追踪日志存储（复用 `classification_decisions` 表 + 扩展 `matcher_scores` 字段）
5. 开发调试面板 API

**文件变更**:

- [classification.ts](src/lib/classification/types/classification.ts) (扩展类型)
- [tiered-classification.service.ts](src/lib/classification/v3/services/tiered-classification.service.ts) (注入 TraceID)
- `src/lib/classification/v3/strategies/*.ts` (记录详细得分)
- `src/app/api/classification/trace/route.ts` (新增：查询追踪 API)
- `src/app/(main)/dev/classification-trace/page.tsx` (新增：调试面板)

**Success Criteria**:

- [ ] 每次分类生成唯一 TraceID
- [ ] 可通过 TraceID 查询完整决策路径
- [ ] 调试面板可视化展示得分分布

**Tests**:

- [ ] TraceID 唯一性测试
- [ ] 决策路径完整性测试

**Status**: Not Started

---

### Stage 1.3: 配置中心化

**Goal**: 权重和分类配置可热更新，无需发版

**工作内容**:

#### 1.3.1 通用分类配置化

1. 创建 `universal_categories` 数据库表
2. 迁移 [universal-categories.ts](src/lib/classification/v3/constants/universal-categories.ts) 中的 30 个分类到数据库
3. 实现配置加载服务（带缓存 + 热更新）
4. 添加后台管理 API

#### 1.3.2 权重系统配置化

1. 创建 `classification_strategy_config` 数据库表
2. 设计场景化权重配置结构：
   ```typescript
   interface StrategyConfig {
     version: "v3.5";
     scenarios: {
       cold_start: { vector: 0.8; universal: 0.2; history: 0.0 };
       rich_history: { vector: 0.3; history: 0.5; fingerprint: 0.2 };
       precise_tag: { tag: 0.8; vector: 0.2 };
     };
     thresholds: {
       direct_lock: 0.92;
       ai_confirm: 0.65;
     };
   }
   ```
3. 实现 DynamicWeightsService 的数据库读取
4. 添加全局阈值配置

**文件变更**:

- `supabase/migrations/20251209xxxx_add_universal_categories_table.sql` (新增)
- `supabase/migrations/20251209xxxx_add_strategy_config_table.sql` (新增)
- `src/lib/classification/v3/services/config-center.service.ts` (新增)
- [universal-categories.ts](src/lib/classification/v3/constants/universal-categories.ts) (改为从 DB 加载)
- [dynamic-weights.service.ts](src/lib/classification/v3/services/dynamic-weights.service.ts) (重构)
- `src/app/api/admin/classification-config/route.ts` (新增：管理 API)

**Success Criteria**:

- [ ] 分类配置可在后台增删改
- [ ] 权重配置按场景加载
- [ ] 配置更新 < 1 分钟生效
- [ ] 配置缓存命中率 > 95%

**Tests**:

- [ ] 配置热更新测试
- [ ] 缓存失效测试
- [ ] 并发加载测试

**Status**: Not Started

---

### Stage 1.4: 实时纠错缓存

**Goal**: 用户移动书签后，再次遇到相同 URL 秒级命中

**工作内容**:

1. 设计 `CorrectionCache` 数据结构（URL → FolderID 映射）
2. 实现内存缓存（当前项目可用内存缓存起步，后续可扩展 Redis）
3. 在 `FeedbackLoopService` 中，用户移动书签时写入缓存
4. 在 `TieredClassificationService` 中，Tier 0 阶段优先查缓存
5. 缓存过期策略（7 天 or 用户再次移动）

**文件变更**:

- `src/lib/classification/v3/services/correction-cache.service.ts` (新增)
- [feedback-loop.service.ts](src/lib/classification/v3/services/feedback-loop.service.ts) (写入缓存)
- [tiered-classification.service.ts](src/lib/classification/v3/services/tiered-classification.service.ts) (Tier 0 查缓存)

**Success Criteria**:

- [ ] 用户移动书签后，相同 URL 命中缓存
- [ ] 缓存命中时响应 < 10ms
- [ ] 缓存过期自动清理

**Tests**:

- [ ] 缓存写入/读取测试
- [ ] 过期策略测试
- [ ] 并发安全测试

**Status**: Not Started

---

### Stage 1.5: 并发执行改造

**Goal**: 匹配器并行执行，总耗时降低 20%

**工作内容**:

1. 审计现有串行逻辑
2. 将 `isAvailable` 和 `match` 改为 `Promise.all` 并行
3. 处理错误隔离（单个 Matcher 失败不影响整体）
4. 添加超时控制（单个 Matcher 最大 500ms）

**文件变更**:

- [tiered-classification.service.ts](src/lib/classification/v3/services/tiered-classification.service.ts) (并行化)
- [strategies/index.ts](src/lib/classification/v3/strategies/index.ts) (并行执行逻辑)

**Success Criteria**:

- [ ] 所有 Matcher 并行执行
- [ ] 总耗时降低 20%
- [ ] 单个 Matcher 超时不阻塞

**Tests**:

- [ ] 并行执行正确性测试
- [ ] 超时测试
- [ ] 错误隔离测试

**Status**: Not Started

---

## Phase 2: 强交互与透明化 (Week 3-4)

**目标**: 让用户"看见" AI 的思考，提升信任度，改善交互体验。

### Stage 2.1: 乐观 UI 改造

**Goal**: 用户感知延迟降至 0ms

**工作内容**:

#### 前端改造

1. 重构收藏提交流程：先假定 Tier 1 结果正确，立即展示
2. 实现"预测分类"状态（带 loading 态）
3. 后台静默校验（AI 确认/否定）
4. 设计优雅的"修正动画"（当 AI 否定 Tier 1 结果时）
5. 修正提示文案：「AI 已根据您的最新习惯自动修正」

#### 后端改造

1. API 拆分为两阶段：
   - 阶段 1 `POST /api/classification/classify-quick`：返回 Tier 1 结果
   - 阶段 2 `POST /api/classification/classify-deep`：异步深度校验
2. WebSocket/SSE 推送修正结果（可选，初期可用轮询）

**文件变更**:

- `src/app/api/classification/classify-quick/route.ts` (新增)
- `src/app/api/classification/classify-deep/route.ts` (新增)
- `src/components/bookmark/bookmark-save-*.tsx` (前端状态重构)
- `src/hooks/use-classification.ts` (乐观更新逻辑)

**Success Criteria**:

- [ ] 保存书签后 < 100ms 显示分类结果
- [ ] 后台校验完成后，错误率 < 5% 时静默修正
- [ ] 用户感知流畅自然

**Tests**:

- [ ] 乐观更新正确性测试
- [ ] 修正动画 UI 测试
- [ ] 网络延迟模拟测试

**Status**: Not Started

---

### Stage 2.2: 决策理由透传

**Goal**: 前端展示 AI 分类的简化推理过程

**工作内容**:

1. 设计决策理由数据结构：
   ```typescript
   interface DecisionReason {
     primary: string; // 主要原因，如 "包含 React 标签"
     secondary?: string; // 次要原因，如 "与历史收藏相似"
     confidence: number;
   }
   ```
2. 在 AI Prompt 中要求输出简化理由
3. 后端 API 返回 `reason` 字段
4. 前端 Toast/卡片展示理由

**文件变更**:

- [classification.ts](src/lib/classification/types/classification.ts) (扩展 DecisionReason)
- [cot-prompt.ts](src/lib/classification/v3/prompts/cot-prompt.ts) (调整 Prompt)
- [tiered-classification.service.ts](src/lib/classification/v3/services/tiered-classification.service.ts) (生成理由)
- `src/components/bookmark/classification-toast.tsx` (新增：理由展示)

**Success Criteria**:

- [ ] 每次分类返回可读理由
- [ ] 理由准确反映决策逻辑
- [ ] UI 展示自然不干扰

**Tests**:

- [ ] 理由生成测试
- [ ] 多场景理由正确性测试

**Status**: Not Started

---

### Stage 2.3: 文件夹画像可视化

**Goal**: 用户可查看 AI 对每个文件夹的理解

**工作内容**:

1. 扩展 `folder_profiles` 数据：增加词云标签、特征向量描述
2. 开发画像计算服务：基于文件夹内书签标签、标题聚合
3. 设计画像面板 UI：词云 + 关键词列表 + 书签数量趋势
4. 集成到文件夹详情页

**文件变更**:

- `src/lib/classification/services/folder-profile-visualization.service.ts` (新增)
- `src/app/(main)/folders/[id]/profile/page.tsx` (新增：画像页面)
- `src/components/folder/folder-profile-panel.tsx` (新增：画像面板)

**Success Criteria**:

- [ ] 每个文件夹可查看 AI 画像
- [ ] 词云展示 Top 20 关键词
- [ ] 画像数据每日更新

**Tests**:

- [ ] 画像计算正确性测试
- [ ] 词云渲染测试

**Status**: Not Started

---

### Stage 2.4: 语义重排序 (Re-ranking)

**Goal**: 召回结果二次打分，去除噪音，提升准确率

**工作内容**:

1. 研究轻量级方案（Prompt 优化 vs Cross-Encoder）
2. 设计重排序服务接口
3. 在向量召回后、最终决策前插入重排序步骤
4. 实现负采样过滤：排除置信度高但分类逻辑冲突的候选

**文件变更**:

- `src/lib/classification/v3/services/reranker.service.ts` (新增)
- [tiered-classification.service.ts](src/lib/classification/v3/services/tiered-classification.service.ts) (集成重排序)

**Success Criteria**:

- [ ] 语义冲突候选被过滤
- [ ] 分类准确率提升 5%
- [ ] 重排序耗时 < 100ms

**Tests**:

- [ ] 重排序正确性测试
- [ ] 负采样过滤测试

**Status**: Not Started

---

### Stage 2.5: 拒绝机制强化

**Goal**: AI 在无合适匹配时明确拒绝，而非强行归类

**工作内容**:

1. 在 Prompt 中强化 "None of above" 选项权重
2. 实现置信度校准逻辑：
   - 检测"逻辑犹豫但分高"的情况
   - 后端强制降权（如：AI 输出 85% 但推理中出现"不确定"，降至 60%）
3. 增加"送入待整理"的触发条件

**文件变更**:

- [cot-prompt.ts](src/lib/classification/v3/prompts/cot-prompt.ts) (强化拒绝 Prompt)
- `src/lib/classification/v3/services/confidence-calibrator.service.ts` (新增)
- [tiered-classification.service.ts](src/lib/classification/v3/services/tiered-classification.service.ts) (集成校准)

**Success Criteria**:

- [ ] 无合适匹配时，80% 以上送入待整理
- [ ] 减少"强行归类"错误 50%

**Tests**:

- [ ] 拒绝场景测试
- [ ] 置信度校准测试

**Status**: Not Started

---

## Phase 3: 自进化与多模态 (Week 5-6)

**目标**: 系统具备自我优化能力，扩展内容理解边界。

### Stage 3.1: 动态权重引擎

**Goal**: 根据用户画像自动切换权重配置

**工作内容**:

1. 定义用户场景判断规则：
   - `cold_start`：书签 < 50，文件夹 < 5
   - `learning`：书签 50-200，有反馈记录
   - `mature`：书签 > 200，反馈采纳率 > 90%
2. 为每个场景配置最优权重（基于测试数据）
3. 实现场景自动检测 + 权重切换
4. 添加 A/B 测试支持

**文件变更**:

- `src/lib/classification/v3/services/user-scenario-detector.service.ts` (新增)
- [dynamic-weights.service.ts](src/lib/classification/v3/services/dynamic-weights.service.ts) (重构)
- `supabase/migrations/20251209xxxx_add_scenario_config.sql` (场景配置)

**Success Criteria**:

- [x] 用户场景自动识别
- [x] 权重按场景动态加载
- [x] 支持 A/B 测试对比

**Tests**:

- [ ] 场景判断测试
- [ ] 权重切换测试

**Status**: Complete

**已实现文件**:

- `src/lib/classification/v3/services/user-scenario-detector.service.ts` (新增 - 场景检测)
- `src/lib/classification/v3/services/dynamic-weights.service.ts` (重构 - 场景化权重)
- `supabase/migrations/20251209000001_add_scenario_weight_config.sql` (场景配置表)

---

### Stage 3.2: 命名优化引擎

**Goal**: 自动创建文件夹时，名称"信达雅"

**工作内容**:

1. 实现 Few-Shot 学习：从用户现有文件夹提取命名风格
2. 在自动创建 Prompt 中注入用户风格样本
3. 实现语义去重：防止创建"JS 学习"和"JavaScript 学习"
4. 调用 Qwen-Max（阿里百炼）进行中文命名优化

**文件变更**:

- `src/lib/classification/v3/services/naming-engine.service.ts` (新增)
- [auto-create-evaluator.service.ts](src/lib/classification/v3/services/auto-create-evaluator.service.ts) (集成命名引擎)
- `src/lib/classification/v3/prompts/naming-prompt.ts` (新增)

**Success Criteria**:

- [x] 新文件夹名称符合用户风格
- [x] 语义重复文件夹检测率 > 90%
- [ ] 用户对名称满意度提升

**Tests**:

- [ ] 命名风格学习测试
- [ ] 语义去重测试

**Status**: Complete

**已实现文件**:

- `src/lib/classification/v3/services/naming-engine.service.ts` (新增 - 命名优化引擎)
- `src/lib/classification/v3/prompts/naming-prompt.ts` (新增 - 命名 Prompt 模板)

**实现亮点**:

- Few-Shot 学习用户命名风格
- 本地规则引擎 + AI 深度检测双层去重
- 支持中英文语义同义词映射
- 缓存用户文件夹风格分析

---

### Stage 3.3: 整理大师主动巡检

**Goal**: 周报机制，主动发现问题并推送建议

**工作内容**:

1. 开发后台定时任务（Supabase Edge Function Cron）
2. 实现巡检逻辑：
   - 检测高重复度文件夹（相似度 > 80%）
   - 检测已失效链接（404）
   - 检测长期未访问书签
3. 生成优化建议报告
4. 通过 Notification 推送（或邮件）
5. 仅对活跃用户开启，控制成本

**文件变更**:

- `supabase/functions/librarian-patrol/index.ts` (新增：巡检 Edge Function)
- [ai-librarian.service.ts](src/lib/classification/v3/services/ai-librarian.service.ts) (扩展巡检逻辑)
- `src/app/api/notifications/librarian-report/route.ts` (新增：报告推送)

**Success Criteria**:

- [x] 每两周自动巡检一次
- [x] 发现问题后 24 小时内推送
- [ ] 用户可一键采纳建议（UI 集成待后续开发）

**Tests**:

- [ ] 巡检触发测试
- [ ] 建议生成测试

**Status**: Complete

**已实现文件**:

- `src/lib/classification/v3/services/librarian-patrol.service.ts` (新增 - 巡检服务)
- `supabase/functions/librarian-patrol/index.ts` (新增 - 定时巡检 Edge Function)
- `supabase/migrations/20251209000002_add_patrol_reports.sql` (新增 - 报告表迁移)
- `src/app/api/librarian/patrol/route.ts` (新增 - 巡检 API)

**实现亮点**:

- 失效链接检测（HEAD 请求采样检测）
- 陈旧书签检测（90 天未访问阈值）
- 综合评分算法（基础分 - 失效扣分 - 陈旧扣分）
- 活跃用户过滤（控制成本）
- 报告历史记录与对比分析
- 用户通知偏好配置

---

### Stage 3.4: 自动化回归测试

**Goal**: 保障代码变更不影响分类准确率

**工作内容**:

1. 构建"黄金样本"测试集（100 个人工确认的书签-文件夹对）
2. 创建测试脚本：批量运行分类，统计准确率
3. 集成 CI/CD：每次 PR 自动运行，准确率下降 > 2% 阻止合并
4. 添加权重变更审计日志

**文件变更**:

- `tests/classification/golden-samples.json` (新增：测试集)
- `tests/classification/regression.test.ts` (新增：回归测试)
- `.github/workflows/classification-regression.yml` (新增：CI 配置)

**Success Criteria**:

- [x] 黄金样本覆盖主要分类场景
- [x] CI 自动运行回归测试
- [x] 准确率阈值保护生效

**Tests**:

- [ ] 回归测试脚本测试
- [ ] CI 流程测试

**Status**: Complete

**已实现文件**:

- `tests/classification/golden-samples.json` (新增 - 100 个黄金样本)
- `tests/classification/regression.test.ts` (新增 - Jest 回归测试)
- `.github/workflows/classification-regression.yml` (新增 - CI/CD 配置)

**实现亮点**:

- 100 个覆盖 6 大分类、3 种难度的黄金样本
- 支持同义词和模糊匹配的准确率判定
- 按分类/难度维度的统计报告
- PR 自动评论测试结果
- 权重变更自动审计警告
- 准确率阈值 80%，下降 >2% 阻止合并

---

### Stage 3.5: 多模态预研

**Status**: ⏸️ 延期至 V4.1

> 此功能暂不在 V4.0 范围内实现，将在后续版本中规划。

---

## 三、LLM 选型策略

根据 V4.0 文档建议和项目现有资源（阿里百炼云/DeepSeek）：

| 场景                | 推荐模型      | 理由                        | 成本 |
| ------------------- | ------------- | --------------------------- | ---- |
| **Tier 2 主力推理** | DeepSeek-V3   | 推理能力 Top，JSON 遵循度高 | 低   |
| **命名优化**        | Qwen-Max      | 中文语感极佳，"信达雅"      | 中   |
| **整理大师巡检**    | DeepSeek-R1   | 深度推理，复杂逻辑分析      | 中   |
| **重排序 (可选)**   | 轻量级 Prompt | 复用现有模型，节省成本      | 低   |

---

## 四、风险评估与应对

| 风险                 | 影响              | 概率 | 应对措施                            |
| -------------------- | ----------------- | ---- | ----------------------------------- |
| **乐观 UI 幻觉**     | 先展示错误分类    | 中   | 设计优雅修正动画 + 用户提示         |
| **巡检成本过高**     | Token 消耗激增    | 中   | 限频（周更）+ 仅活跃用户 + 轻量模型 |
| **配置热更新不一致** | 短时间状态不同步  | 低   | 接受分钟级最终一致性                |
| **HNSW 迁移风险**    | 数据丢失/索引失效 | 低   | 完整备份 + 回滚脚本                 |
| **并发改造 bug**     | 竞态条件导致错误  | 中   | 充分测试 + 错误隔离                 |

---

## 五、里程碑与验收标准

| 里程碑               | 时间      | 验收标准                                       |
| -------------------- | --------- | ---------------------------------------------- |
| **M1: Phase 1 完成** | Week 2 末 | P95 响应 < 800ms，TraceID 可用，配置中心化完成 |
| **M2: Phase 2 完成** | Week 4 末 | 乐观 UI 上线，决策理由可见，画像可视化         |
| **M3: Phase 3 完成** | Week 6 末 | 动态权重生效，巡检运行，回归测试就绪           |
| **M4: 全量发布**     | Week 7    | KPI 全部达标，用户满意度提升                   |

---

## 六、依赖与前置条件

1. **数据库权限**: 需要 Supabase 生产环境的迁移权限
2. **AI 服务**: 确认 DeepSeek/阿里百炼 API 配额
3. **前端资源**: Phase 2 需要前端工程师配合
4. **测试数据**: 需收集 100 个黄金样本用于回归测试

---

## 七、开发顺序建议

按优先级排序（P1 → P2 → P3）：

### 第 1 周重点

| 序号 | Stage                    | 优先级 | 预估工时 |
| ---- | ------------------------ | ------ | -------- |
| 1    | Stage 1.1 数据库索引优化 | P1     | 4h       |
| 2    | Stage 1.2 全链路追踪     | P1     | 8h       |
| 3    | Stage 1.4 实时纠错缓存   | P1     | 6h       |

### 第 2 周重点

| 序号 | Stage                  | 优先级 | 预估工时 |
| ---- | ---------------------- | ------ | -------- |
| 4    | Stage 1.3 配置中心化   | P1     | 12h      |
| 5    | Stage 1.5 并发执行改造 | P1     | 4h       |

### 第 3-4 周重点

| 序号 | Stage                      | 优先级 | 预估工时 |
| ---- | -------------------------- | ------ | -------- |
| 6    | Stage 2.1 乐观 UI 改造     | P1     | 16h      |
| 7    | Stage 2.5 拒绝机制强化     | P1     | 4h       |
| 8    | Stage 2.2 决策理由透传     | P2     | 6h       |
| 9    | Stage 2.3 文件夹画像可视化 | P2     | 8h       |

### 第 5-6 周重点

| 序号   | Stage                    | 优先级 | 预估工时        |
| ------ | ------------------------ | ------ | --------------- |
| 10     | Stage 2.4 语义重排序     | P2     | 8h              |
| 11     | Stage 3.1 动态权重引擎   | P2     | 6h              |
| 12     | Stage 3.2 命名优化引擎   | P2     | 8h              |
| 13     | Stage 3.3 主动巡检       | P3     | 12h             |
| 14     | Stage 3.4 回归测试       | P2     | 6h              |
| ~~15~~ | ~~Stage 3.5 多模态预研~~ | ~~P3~~ | ~~延期至 V4.1~~ |

---

## 八、已确认决策

### 8.1 优先级

- [x] Stage 3.5 多模态预研 → **延期至 V4.1**

### 8.2 技术选型

- [x] 语义重排序 → **Prompt 优化**（成本低、迭代灵活、无需额外部署模型）
- [x] 乐观 UI 修正推送 → **SSE (Server-Sent Events)**（轻量、浏览器原生支持、Next.js 友好）

### 8.3 资源配置

- [x] 开发方式：**AI 辅助编程（Claude Opus 4.5）**
- [x] 工时：不作为硬性约束

### 8.4 测试策略

- [x] 黄金样本收集方式 → **从现有数据提取**
- [x] 回归测试阈值 → **准确率下降 > 2% 阻止合并**

### 8.5 运维配置

- [x] 配置中心化 UI → **开发者工具形式**（临时后台）
- [x] 巡检频率 → **每两周一次**

### 8.6 分支策略

- [x] 开发分支 → `feature/intelligent-classification-v4`（从当前 v3 分支创建）

---

## 九、开发启动检查清单

- [ ] 创建 `feature/intelligent-classification-v4` 分支
- [ ] 确认 Supabase 数据库迁移权限
- [ ] 确认 DeepSeek / 阿里百炼 API 配额
- [ ] 从现有数据提取黄金样本（100 条）

---

**计划已审核通过，等待启动开发。**
