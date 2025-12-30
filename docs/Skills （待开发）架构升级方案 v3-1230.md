# AnyKeep AI Skills 架构升级方案 v3.0

> **状态**: 已审核 ✅
> **创建日期**: 2025-12-30
> **更新日期**: 2025-12-30
> **预计工期**: 6 周

---

## 一、升级概述

本方案针对 AnyKeep AI Skills 系统进行四个维度的架构升级。

### 1.1 优先级调整说明

基于架构融合复杂度分析，对原始优先级进行了调整：

| 调整后优先级 | 原优先级 | 模块               | 目标                     | 融合难度   | 预计工期 |
| ------------ | -------- | ------------------ | ------------------------ | ---------- | -------- |
| **P0**       | P1       | LLM 分类缓存优化   | 缓存命中率 > 60%         | ⭐⭐       | Week 1-2 |
| **P1**       | P1       | Skill 超时优化     | 自适应超时 + 预警        | ⭐⭐⭐     | Week 2-3 |
| **P2**       | P2       | 事务边界强化       | 高风险操作 100% 事务保护 | ⭐⭐⭐⭐   | Week 3-4 |
| **P3**       | P0       | Skill 依赖拓扑管理 | 自动编排复合任务         | ⭐⭐⭐⭐⭐ | Week 4-6 |

**调整理由**：

- Phase 1（缓存优化）融合最简单，可立即见效
- Phase 4（依赖拓扑）融合最复杂，需前三项稳定后再实施
- 渐进式升级降低整体风险

---

## 二、架构融合分析

### 2.1 现有架构关键集成点

升级方案需要与以下 6 个核心组件进行融合：

| 组件                           | 文件位置                          | 当前职责                              | 升级影响阶段  |
| ------------------------------ | --------------------------------- | ------------------------------------- | ------------- |
| **ModeSelector**               | `router/mode-selector.ts`         | 意图→模式决策（atomic/orchestration） | Phase 4       |
| **ExecutionCoordinator**       | `engine/execution-coordinator.ts` | 执行模式协调 + 自动回退               | Phase 2, 4    |
| **OrchestrationEngine**        | `engine/orchestration-engine.ts`  | Skill 注册与执行（固定 30s 超时）     | Phase 2, 3, 4 |
| **LLMIntentClassifier**        | `router/llm-classifier.ts`        | LLM 意图分类（简单缓存）              | Phase 1       |
| **OrchestrationSkillMetadata** | `orchestration/types.ts`          | Skill 元数据定义                      | Phase 4       |
| **24 个 Skill 文件**           | `skills/*`                        | 各业务 Skill 实现                     | Phase 3, 4    |

### 2.2 执行模式演进

```
当前：atomic | orchestration
     ↓
升级后：atomic | orchestration | pipeline（新增）
```

**Pipeline 模式**：多 Skill 依赖组合的专用执行模式，保持单 Skill 编排模式不变。

### 2.3 关键设计决策

#### 决策 1：依赖声明采用声明式

```typescript
// ✅ 推荐：声明式（在 metadata 中）
metadata = {
  dependencies: [{ skillId: 'search', type: 'hard' }],
  provides: ['searchResults'],
};

// ❌ 避免：命令式（在代码中动态调用）
async *executeStream(context) {
  const searchResult = await this.runDependency('search');
}
```

**理由**：声明式更易于静态分析、循环依赖检测和可视化。

#### 决策 2：Pipeline 作为第三种执行模式

**理由**：保持现有 atomic/orchestration 逻辑不变，Pipeline 仅用于多 Skill 组合场景。

#### 决策 3：Feature Flag 分阶段启用

所有新功能通过 Feature Flag 控制，支持灰度发布和快速回滚。

---

## 三、Feature Flags 配置

```bash
# .env.local - Feature Flags 配置

# ========== Phase 1: LLM 缓存优化 ==========
ENABLE_INPUT_NORMALIZATION=true    # 输入归一化
ENABLE_LRU_CACHE=true              # LRU 缓存
ENABLE_REQUEST_DEDUP=true          # 请求去重

# ========== Phase 2: Skill 超时优化 ==========
ENABLE_ADAPTIVE_TIMEOUT=true       # 自适应超时
ENABLE_TIMEOUT_WARNING=true        # 超时预警
ENABLE_ASYNC_EXECUTION=false       # 异步执行（灰度发布）

# ========== Phase 3: 事务边界强化 ==========
ENABLE_SKILL_TRANSACTION=true      # 事务包装
ENABLE_IDEMPOTENCY=true            # 幂等性守卫

# ========== Phase 4: 依赖拓扑管理 ==========
ENABLE_DEPENDENCY_GRAPH=false      # 依赖图（开发中）
ENABLE_PIPELINE_MODE=false         # Pipeline 模式（灰度发布）
ENABLE_COMPOSITION_SUGGESTER=false # Skill 组合建议器
```

---

## 四、Phase 1: LLM 分类缓存优化 (Week 1-2)

### 4.1 当前状态

**文件**: [llm-classifier.ts](src/lib/ai-skills/router/llm-classifier.ts)

```typescript
// 当前实现（L287-289）
private getCacheKey(message: string): string {
  return message.toLowerCase().trim().substring(0, 200);
}
```

**问题**:

- ❌ 无 LRU 淘汰策略，可能内存泄漏
- ❌ 无输入归一化，相似输入多次调用 LLM
- ❌ 无并发请求去重

### 4.2 融合策略

**融合难度**: ⭐⭐（低）

**融合点**: 仅修改 `LLMIntentClassifier` 内部实现，不改变外部 API

```typescript
// 升级后集成点
async classify(message: string): Promise<LLMClassificationResult | null> {
  // [新增] 输入归一化
  const normalizedKey = this.normalizer.generateCacheKey(message);

  // [新增] 请求去重
  return this.deduplicator.dedupe(normalizedKey, async () => {
    // [替换] LRU 缓存
    const cached = this.cache.get(normalizedKey);
    if (cached) return cached;

    const result = await this.classifyWithModel(message);
    this.cache.set(normalizedKey, result);
    return result;
  });
}
```

### 4.3 新增文件

```
src/lib/ai-skills/router/
├── input-normalizer.ts      # [新增] 输入归一化器
├── llm-classifier-cache.ts  # [新增] LRU 缓存包装器
└── request-deduplicator.ts  # [新增] 请求去重器
```

### 4.4 InputNormalizer 设计

```typescript
// src/lib/ai-skills/router/input-normalizer.ts

class InputNormalizer {
  // 同义词映射表
  private synonyms = new Map([
    ["帮我找", "搜索"],
    ["查一下", "搜索"],
    ["找找", "搜索"],
    ["整理一下", "整理"],
    ["清理下", "清理"],
    ["删掉", "删除"],
    ["移除", "删除"],
  ]);

  // 语气词（需移除）
  private fillers = ["请", "帮我", "我想", "能不能", "可以", "麻烦"];

  normalize(input: string): string {
    let normalized = input.trim().toLowerCase();
    // 1. 移除语气词
    // 2. 替换同义词
    // 3. 压缩空白
    // 4. 截取前 200 字符
    return normalized;
  }

  generateCacheKey(input: string): string {
    return this.fastHash(this.normalize(input));
  }
}
```

### 4.5 LRU 缓存包装器

```typescript
// src/lib/ai-skills/router/llm-classifier-cache.ts

class LLMClassifierCache {
  private cache: LRUCache<string, CacheEntry>;

  constructor(options: {
    maxSize: number; // 默认 1000
    ttlMs: number; // 默认 60000
  });

  get(input: string): LLMClassificationResult | null;
  set(input: string, result: LLMClassificationResult): void;
  getStats(): { size; hitRate; avgTTLRemaining };
}
```

### 4.6 请求去重器

```typescript
// src/lib/ai-skills/router/request-deduplicator.ts

class RequestDeduplicator {
  private pending: Map<string, Promise<Result>>;

  async dedupe<T>(key: string, executor: () => Promise<T>): Promise<T> {
    if (this.pending.has(key)) return this.pending.get(key);
    const promise = executor().finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
}
```

### 4.7 修改文件

| 文件                | 修改内容                                  |
| ------------------- | ----------------------------------------- |
| `llm-classifier.ts` | 替换内置缓存为 LRU 缓存，集成归一化和去重 |

### 4.8 验收标准

- [ ] 相似输入（"帮我找" vs "搜索"）缓存命中率 > 80%
- [ ] 缓存大小限制在 1000 条以内
- [ ] 并发相同请求合并率 > 90%
- [ ] 单元测试覆盖率 > 90%
- [ ] 保留原始输入用于调试日志

---

## 五、Phase 2: Skill 超时优化 (Week 2-3)

### 5.1 当前状态

**文件**: [orchestration-engine.ts](src/lib/ai-skills/engine/orchestration-engine.ts)

```typescript
// 当前配置（L39-44）
this.config = {
  defaultTimeoutMs: 30000, // 固定值
  maxConcurrentSkills: 1,
  enableAutoFallback: true,
};
```

**问题**:

- ❌ 超时固定，不适应数据量变化
- ❌ 无超时预警机制
- ❌ 长任务无异步执行支持

### 5.2 融合策略

**融合难度**: ⭐⭐⭐（中）

**融合点 1**: `OrchestrationEngine.execute()` 方法

```typescript
// 升级后：
async *execute(skillId: string, input: string, context: EngineContext) {
  // [新增] 自适应超时计算
  const timeoutConfig = this.timeoutScheduler.calculateTimeout(skillId, {
    dataCount: context.bookmarkIds?.length || 0,
    userTier: context.userTier || 'free',
    systemLoad: await getSystemLoad(),
  });

  // [新增] 包装超时预警
  yield* this.warningSystem.wrapWithWarning(
    this.executeWithTimeout(skillId, input, context, timeoutConfig),
    timeoutConfig,
    (remaining) => logger.info({ skillId, remaining }, 'Timeout warning'),
  );
}
```

**融合点 2**: `ExecutionCoordinator` 异步任务支持

```typescript
// 新增方法
async submitAsync(skillId: string, input: string, context: EngineContext): Promise<AsyncJobHandle> {
  return this.asyncExecutor.submit(skillId, input, context);
}
```

### 5.3 新增文件

```
src/lib/ai-skills/
├── timeout/
│   ├── adaptive-timeout.ts     # [新增] 自适应超时调度器
│   └── timeout-warning.ts      # [新增] 超时预警系统
└── async/
    └── async-executor.ts       # [新增] 异步执行管理器
```

### 5.4 AdaptiveTimeoutScheduler 设计

```typescript
// src/lib/ai-skills/timeout/adaptive-timeout.ts

class AdaptiveTimeoutScheduler {
  calculateTimeout(
    skillId: string,
    context: {
      dataCount: number;
      userTier: "free" | "pro";
      systemLoad?: number;
    },
  ): TimeoutConfig {
    const baseTimeout = skill.estimatedDurationMs || 15000;
    const maxTimeout = skill.maxExecutionTimeMs || 120000;

    // 计算动态因子
    const dataFactor = this.calculateDataFactor(dataCount);
    const loadFactor = systemLoad ? 1 + systemLoad * 0.5 : 1;
    const tierFactor = userTier === "pro" ? 1.5 : 1;

    const calculated = baseTimeout * dataFactor * loadFactor * tierFactor;

    return {
      timeoutMs: Math.min(calculated, maxTimeout),
      warningMs: calculated * 0.8, // 80% 时发出警告
    };
  }
}
```

### 5.5 TimeoutWarningSystem 设计

```typescript
// src/lib/ai-skills/timeout/timeout-warning.ts

class TimeoutWarningSystem {
  async *wrapWithWarning<T>(
    generator: AsyncGenerator<T>,
    config: TimeoutConfig,
    onWarning: (remaining: number) => void,
  ): AsyncGenerator<T | TimeoutWarningEvent> {
    const startTime = Date.now();
    let warningEmitted = false;

    for await (const chunk of generator) {
      const elapsed = Date.now() - startTime;

      // 80% 时间点发出预警
      if (!warningEmitted && elapsed >= config.warningMs) {
        warningEmitted = true;
        yield {
          type: "timeout_warning",
          remainingMs: config.timeoutMs - elapsed,
        };
      }

      yield chunk;
    }
  }
}
```

### 5.6 AsyncExecutionManager 设计

```typescript
// src/lib/ai-skills/async/async-executor.ts

class AsyncExecutionManager {
  async submit(
    skillId: string,
    input: string,
    context: EngineContext,
  ): Promise<AsyncJobHandle> {
    const jobId = generateJobId();
    // 启动后台执行
    this.executeInBackground(jobId, skillId, input, context);
    return { jobId, statusUrl: `/api/agent/jobs/${jobId}` };
  }

  async getStatus(jobId: string): Promise<AsyncJobStatus>;
}
```

### 5.7 新增 API

```
src/app/api/agent/jobs/
├── route.ts           # POST: 提交异步任务
└── [jobId]/route.ts   # GET: 查询任务状态
```

### 5.8 修改文件

| 文件                       | 修改内容                                |
| -------------------------- | --------------------------------------- |
| `orchestration-engine.ts`  | 集成自适应超时调度                      |
| `execution-coordinator.ts` | 集成超时预警系统，添加 submitAsync 方法 |

### 5.9 验收标准

- [ ] 数据量 > 100 时超时自动延长
- [ ] 80% 时间点发出预警
- [ ] 长任务（> 30s）可转为异步执行
- [ ] 异步任务 API 支持状态查询
- [ ] Feature Flag 可控制各功能开关

---

## 六、Phase 3: 事务边界强化 (Week 3-4)

### 6.1 当前状态

高风险 Skill（`batch_organize`, `duplicate_cleanup`）缺少事务包装。

### 6.2 融合策略

**融合难度**: ⭐⭐⭐⭐（高）

**受影响的 Skills**（需逐一迁移）：

| Skill ID            | 风险等级 | 需事务保护的操作   |
| ------------------- | -------- | ------------------ |
| `batch_organize`    | 高       | 批量移动、标签操作 |
| `duplicate_cleanup` | 高       | 删除重复书签       |
| `smart_tagging`     | 中       | 批量标签更新       |
| `link_health_check` | 中       | 批量状态更新       |

**融合点**: 高风险 Skill 的 `executeStream()` 方法

```typescript
// 示例：batch-organize.skill.ts
async *executeStream(context: OrchestrationContext) {
  // [升级后] 事务包装
  const result = await this.transactionWrapper.executeInTransaction(
    'batch_organize',
    async (client) => {
      return this.batchMoveBookmarks(bookmarks, targetFolder, client);
    },
    { enableSnapshot: true }
  );

  if (!result.success) {
    yield* this.handleTransactionFailure(result);
    return;
  }
}
```

### 6.3 新增文件

```
src/lib/ai-skills/transaction/
├── transaction-wrapper.ts    # [新增] 事务包装器
└── idempotency-guard.ts      # [新增] 幂等性守卫
```

### 6.4 SkillTransactionWrapper 设计

```typescript
// src/lib/ai-skills/transaction/transaction-wrapper.ts

class SkillTransactionWrapper {
  async executeInTransaction<T>(
    skillId: string,
    executor: (client: SupabaseClient) => Promise<T>,
    options?: { enableSnapshot?: boolean },
  ): Promise<TransactionResult<T>> {
    const snapshotId = options?.enableSnapshot
      ? await this.createSnapshot(skillId)
      : null;

    try {
      await this.supabase.rpc("begin_skill_transaction", {
        p_skill_id: skillId,
      });
      const result = await executor(this.supabase);
      await this.supabase.rpc("commit_skill_transaction", {
        p_skill_id: skillId,
      });
      return { success: true, data: result, snapshotId };
    } catch (error) {
      await this.supabase.rpc("rollback_skill_transaction", {
        p_skill_id: skillId,
      });
      return {
        success: false,
        error: error.message,
        snapshotId,
        canUndo: !!snapshotId,
      };
    }
  }
}
```

### 6.5 IdempotencyGuard 设计

```typescript
// src/lib/ai-skills/transaction/idempotency-guard.ts

class IdempotencyGuard {
  generateKey(skillId: string, userId: string, input: unknown): string;

  async checkAndMark(key: string): Promise<{
    alreadyExecuted: boolean;
    previousResult?: unknown;
  }>;

  async recordResult(key: string, result: unknown): Promise<void>;
}
```

### 6.6 数据库迁移

```sql
-- supabase/migrations/xxx_add_skill_transactions.sql

CREATE OR REPLACE FUNCTION begin_skill_transaction(p_skill_id TEXT)
RETURNS VOID AS $$ BEGIN ... END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION commit_skill_transaction(p_skill_id TEXT)
RETURNS VOID AS $$ BEGIN ... END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rollback_skill_transaction(p_skill_id TEXT)
RETURNS VOID AS $$ BEGIN ... END; $$ LANGUAGE plpgsql;

-- 幂等性记录表
CREATE TABLE skill_idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE NOT NULL,
  skill_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- 索引优化
CREATE INDEX idx_skill_idempotency_key ON skill_idempotency_records(idempotency_key);
CREATE INDEX idx_skill_idempotency_expires ON skill_idempotency_records(expires_at);
```

### 6.7 验收标准

- [ ] 高风险操作（delete, batch\_\*）100% 事务保护
- [ ] 重复请求幂等性 100%
- [ ] 失败后可通过快照恢复
- [ ] 事务锁超时 5s，自动重��

---

## 七、Phase 4: Skill 依赖拓扑管理 (Week 4-6) - 重点

### 7.1 当前状态

**文件**: [types.ts](src/lib/ai-skills/orchestration/types.ts)

```typescript
// 当前元数据定义（L215-224）
export interface OrchestrationSkillMetadata extends SkillMetadata {
  deliverableTypes?: DeliverableType[];
  outputFormats?: OutputFormat[];
  requiresConfirmation?: boolean;
  steps?: StepDefinition[];
  // ❌ 缺少依赖声明
}
```

**问题**:

- ❌ Skill 之间无依赖声明机制
- ❌ 无法自动编排复合任务（如"整理并生成报告"）
- ❌ 上下文传递没有标准化

### 7.2 融合策略

**融合难度**: ⭐⭐⭐⭐⭐（最高）

**融合点 1**: 类型扩展（向后兼容）

```typescript
// types.ts 扩展 - 所有新增字段均为可选
export interface OrchestrationSkillMetadata extends SkillMetadata {
  // [现有字段保持不变]
  deliverableTypes?: DeliverableType[];
  outputFormats?: OutputFormat[];
  requiresConfirmation?: boolean;
  steps?: StepDefinition[];

  // [新增字段 - 全部可选，保证向后兼容]
  dependencies?: SkillDependency[];
  provides?: string[];
  mutexGroup?: string;
}
```

**融合点 2**: `ModeSelector` 添加 Pipeline 模式

```typescript
// mode-selector.ts 扩展
select(intent: IntentClassification, complexity: ComplexityEvaluation): ModeSelection {
  // [现有逻辑保持]

  // [新增] 检测是否需要多 Skill 组合
  if (FeatureFlags.ENABLE_PIPELINE_MODE && this.requiresMultipleSkills(intent)) {
    const suggestion = this.compositionSuggester.suggest(intent, complexity);
    if (suggestion.confidence > 0.7) {
      return {
        mode: 'pipeline',       // 新增模式
        pipeline: suggestion,
        fallbackMode: 'atomic',
      };
    }
  }

  // [现有逻辑继续]
}
```

**融合点 3**: `ExecutionCoordinator` 支持 Pipeline 执行

```typescript
// execution-coordinator.ts 扩展
async *executePipeline(
  plan: ExecutionPlan,
  input: string,
  context: EngineContext
): AsyncGenerator<UnifiedStreamChunk> {
  const pipeline = new DependencyPipeline(this.orchestrationEngine);

  for await (const chunk of pipeline.execute(plan, {
    ...context,
    sharedContext: new SharedExecutionContext(),
  })) {
    yield this.outputAdapter.adaptPipelineChunk(chunk);
  }
}
```

### 7.3 类型扩展

```typescript
// src/lib/ai-skills/orchestration/types.ts（扩展）

/**
 * Skill 依赖声明
 */
interface SkillDependency {
  /** 依赖的 Skill ID */
  skillId: string;
  /** 依赖类型：hard-必须成功，soft-可容错 */
  type: "hard" | "soft";
  /** 输出映射：将依赖输出传递给当前 Skill */
  outputMapping?: {
    sourceField: string; // 来源 Skill 的输出字段
    targetField: string; // 当前 Skill 的输入字段
  }[];
}

/**
 * 扩展 OrchestrationSkillMetadata（向后兼容）
 */
interface OrchestrationSkillMetadata extends SkillMetadata {
  // [现有字段]
  deliverableTypes?: DeliverableType[];
  outputFormats?: OutputFormat[];
  requiresConfirmation?: boolean;
  steps?: StepDefinition[];

  // [新增字段 - 全部可选]
  dependencies?: SkillDependency[];
  provides?: string[];
  mutexGroup?: string;
}
```

### 7.4 新增文件

```
src/lib/ai-skills/pipeline/
├── dependency-graph.ts       # [新增] 依赖图
├── dependency-pipeline.ts    # [新增] 依赖感知 Pipeline
├── context-protocol.ts       # [新增] 上下文传递协议
└── __tests__/
    ├── dependency-graph.test.ts
    └── dependency-pipeline.test.ts

src/lib/ai-skills/router/
└── composition-suggester.ts  # [新增] Skill 组合建议器
```

### 7.5 DependencyGraph 设计

```typescript
// src/lib/ai-skills/pipeline/dependency-graph.ts

class DependencyGraph {
  private adjacencyList: Map<string, Set<string>>;

  addSkill(skillId: string, dependencies: string[]): void;

  /** 拓扑排序 - O(V+E) 复杂度 */
  topologicalSort(targetSkillId: string): string[];

  /** 检测循环依赖 - 构建时强制执行 */
  detectCycle(): string[] | null;

  /** 层级划分（同层可并行） */
  partitionIntoLayers(sorted: string[]): SkillLayer[];
}
```

### 7.6 DependencyPipeline 设计

```typescript
// src/lib/ai-skills/pipeline/dependency-pipeline.ts

class DependencyPipeline {
  /**
   * 构建执行计划
   */
  buildExecutionPlan(targetSkillId: string): ExecutionPlan {
    const sorted = this.graph.topologicalSort(targetSkillId);
    const layers = this.partitionIntoLayers(sorted);
    return { layers, estimatedDurationMs: this.estimateTotalDuration(layers) };
  }

  /**
   * 执行计划（层级并行）
   */
  async *execute(
    plan: ExecutionPlan,
    context: PipelineContext,
  ): AsyncGenerator<DependencyPipelineChunk> {
    const sharedContext = new SharedExecutionContext();

    for (const layer of plan.layers) {
      // 层内并行执行
      const results = await Promise.all(
        layer.skills.map((skill) =>
          this.executeSkillWithDependencies(skill, sharedContext, context),
        ),
      );

      // 检查硬依赖失败
      for (const result of results) {
        if (!result.success && result.dependencyType === "hard") {
          yield* this.handleHardDependencyFailure(result);
          return;
        }
      }

      yield { type: "layer_complete", layer: layer.index, results };
    }
  }
}
```

### 7.7 SharedExecutionContext 设计

```typescript
// src/lib/ai-skills/pipeline/context-protocol.ts

class SharedExecutionContext {
  private outputs: Map<string, SkillOutput>;

  /** 注册 Skill 输出 */
  registerOutput(skillId: string, output: SkillOutput): void;

  /** 获取依赖输出（带字段映射） */
  getDependencyOutput<T>(
    skillId: string,
    mapping?: { sourceField: string; targetField: string }[],
  ): T | undefined;

  /** 获取合并上下文（用于最终 Skill） */
  getMergedContext(): Record<string, unknown>;
}
```

### 7.8 CompositionSuggester 设计

```typescript
// src/lib/ai-skills/router/composition-suggester.ts

class CompositionSuggester {
  /**
   * 分析意图，推荐最优 Skill 组合
   */
  async suggest(
    intent: IntentClassification,
    context: EngineContext,
  ): Promise<CompositionSuggestion> {
    // 1. 分析意图涉及的能力
    const requiredCapabilities = this.analyzeCapabilities(intent);

    // 2. 查找具备这些能力的 Skill
    const candidateSkills =
      this.findSkillsWithCapabilities(requiredCapabilities);

    // 3. 构建最优组合（最少 Skill 覆盖所有能力）
    const optimalCombination = this.findOptimalCombination(candidateSkills);

    // 4. 解析依赖关系
    const dependencies = this.resolveDependencies(optimalCombination);

    return {
      skills: optimalCombination,
      dependencies,
      estimatedDurationMs: this.estimateTotalDuration(dependencies),
      confidence: this.calculateConfidence(optimalCombination),
    };
  }
}
```

### 7.9 迁移现有 Skills

为现有 24 个 Skills 添加依赖声明（示例）：

```typescript
// batch-organize.skill.ts
readonly metadata: OrchestrationSkillMetadata = {
  // ...existing fields
  provides: ['affectedBookmarkIds', 'organizeStats'],
};

// periodic-report.skill.ts
readonly metadata: OrchestrationSkillMetadata = {
  // ...existing fields
  dependencies: [{
    skillId: 'batch_organize',
    type: 'soft',
    outputMapping: [
      { sourceField: 'affectedBookmarkIds', targetField: 'bookmarkIds' }
    ]
  }],
};
```

### 7.10 验收标准

- [ ] Skill 可声明依赖关系
- [ ] 拓扑排序正确处理依赖顺序
- [ ] 同层级 Skill 并行执行，效率提升 > 50%
- [ ] 上下文自动传递，无需手动编排
- [ ] 自动推荐最优 Skill 组合
- [ ] 循环依赖检测和拒绝（构建时强制）
- [ ] 24 个 Skill 全部添加 provides/dependencies 声明

---

## 八、详细风险评估

### 8.1 风险矩阵

| 风险                       | 概率 | 影响 | 阶段 | 缓解策略                                             |
| -------------------------- | ---- | ---- | ---- | ---------------------------------------------------- |
| **缓存归一化导致分类错误** | 中   | 中   | P1   | 保留原始输入日志，A/B 测试分类准确率，监控命中率     |
| **超时计算不准确**         | 中   | 低   | P2   | 设置保守的 maxTimeout 上限（120s），监控实际执行时间 |
| **事务死锁**               | 低   | 高   | P3   | 使用乐观锁，设置 5s 锁超时，自动重试机制             |
| **循环依赖运行时发生**     | 中   | 高   | P4   | **构建时检测**，拒绝注册循环依赖 Skill               |
| **上下文传递数据丢失**     | 中   | 高   | P4   | 强类型 SharedExecutionContext，单元测试 100% 覆盖    |
| **24 Skill 迁移遗漏**      | 低   | 中   | P4   | 自动化脚本检查 provides/dependencies 声明完整性      |
| **向后兼容性破坏**         | 低   | 高   | All  | 所有新增字段设为可选，Feature Flag 控制              |
| **性能下降**               | 中   | 中   | P4   | 层级并行执行，拓扑排序复杂度 O(V+E)                  |

### 8.2 回滚策略

每个 Phase 都支持独立回滚：

| Phase | 回滚方式                                                        | 预计时间 |
| ----- | --------------------------------------------------------------- | -------- |
| P1    | 禁用 Feature Flags，恢复原始缓存逻辑                            | < 5 分钟 |
| P2    | 禁用 Feature Flags，恢复固定超时                                | < 5 分钟 |
| P3    | 禁用 Feature Flags，跳过事务包装                                | < 5 分钟 |
| P4    | 禁用 `ENABLE_PIPELINE_MODE`，回退到 atomic/orchestration 双模式 | < 5 分钟 |

---

## 九、关键文件清单

### 9.1 新增文件

| 文件路径                             | 职责          | 阶段 | 融合难度   |
| ------------------------------------ | ------------- | ---- | ---------- |
| `router/input-normalizer.ts`         | 输入归一化    | P1   | ⭐⭐       |
| `router/llm-classifier-cache.ts`     | LRU 缓存      | P1   | ⭐⭐       |
| `router/request-deduplicator.ts`     | 请求去重      | P1   | ⭐⭐       |
| `timeout/adaptive-timeout.ts`        | 自适应超时    | P2   | ⭐⭐⭐     |
| `timeout/timeout-warning.ts`         | 超时预警      | P2   | ⭐⭐⭐     |
| `async/async-executor.ts`            | 异步执行      | P2   | ⭐⭐⭐     |
| `transaction/transaction-wrapper.ts` | 事务包装      | P3   | ⭐⭐⭐⭐   |
| `transaction/idempotency-guard.ts`   | 幂等性守卫    | P3   | ⭐⭐⭐⭐   |
| `pipeline/dependency-graph.ts`       | 依赖图        | P4   | ⭐⭐⭐⭐⭐ |
| `pipeline/dependency-pipeline.ts`    | 依赖 Pipeline | P4   | ⭐⭐⭐⭐⭐ |
| `pipeline/context-protocol.ts`       | 上下文协议    | P4   | ⭐⭐⭐⭐⭐ |
| `router/composition-suggester.ts`    | 组合建议器    | P4   | ⭐⭐⭐⭐   |

### 9.2 修改文件

| 文件路径                          | 修改内容                     | 阶段   | 影响范围     |
| --------------------------------- | ---------------------------- | ------ | ------------ |
| `router/llm-classifier.ts`        | 集成 LRU 缓存和归一化        | P1     | 内部实现     |
| `engine/orchestration-engine.ts`  | 集成自适应超时               | P2     | 执行流程     |
| `engine/execution-coordinator.ts` | 集成超时预警 + Pipeline 执行 | P2, P4 | 执行流程     |
| `orchestration/types.ts`          | 扩展元数据类型               | P4     | 类型定义     |
| `router/mode-selector.ts`         | 集成 Pipeline 模式           | P4     | 路由决策     |
| 各 Skill 文件（24 个）            | 添加依赖声明                 | P4     | Skill 元数据 |

---

## 十、测试计划

### 10.1 单元测试

| 模块                     | 测试用例数 | 覆盖率目标 |
| ------------------------ | ---------- | ---------- |
| InputNormalizer          | 20         | 95%        |
| LLMClassifierCache       | 15         | 90%        |
| RequestDeduplicator      | 10         | 95%        |
| AdaptiveTimeoutScheduler | 15         | 85%        |
| TimeoutWarningSystem     | 10         | 90%        |
| DependencyGraph          | 25         | 95%        |
| DependencyPipeline       | 20         | 90%        |
| SharedExecutionContext   | 15         | 95%        |
| SkillTransactionWrapper  | 15         | 90%        |
| IdempotencyGuard         | 10         | 90%        |

### 10.2 集成测试场景

| 场景            | 描述                                  | 阶段 |
| --------------- | ------------------------------------- | ---- |
| 同义词缓存命中  | "帮我找" vs "搜索" 命中同一缓存       | P1   |
| 并发请求去重    | 相同请求同时发起，只执行一次 LLM 调用 | P1   |
| 超时渐进调度    | 不同数据量的超时时间变化符合预期      | P2   |
| 超时预警触发    | 80% 时间点正确发出预警                | P2   |
| 事务回滚        | 高风险操作失败后的数据恢复            | P3   |
| 幂等性验证      | 重复请求返回相同结果                  | P3   |
| 多 Skill 依赖链 | A → B → C 的顺序执行和上下文传递      | P4   |
| 层级并行执行    | 同层级 A, B, C 并行执行性能           | P4   |
| 循环依赖检测    | 注册循环依赖 Skill 时拒绝             | P4   |

---

## 十一、性能指标

| 指标                    | 当前值 | 目标值            | 阶段 |
| ----------------------- | ------ | ----------------- | ---- |
| LLM 分类缓存命中率      | ~30%   | > 60%             | P1   |
| 相同请求去重率          | 0%     | > 90%             | P1   |
| 平均超时准确度          | N/A    | ± 20%             | P2   |
| 超时预警触发率          | N/A    | 100%（当超时时）  | P2   |
| 事务回滚成功率          | N/A    | > 99%             | P3   |
| 幂等性命中率            | N/A    | > 95%（重复请求） | P3   |
| 依赖 Skill 并行效率提升 | N/A    | > 50%             | P4   |
| 循环依赖检测率          | N/A    | 100%              | P4   |

---

## 十二、实施时间表

```
Week 1: LLM 缓存优化（基础）
  ├── 输入归一化器
  ├── LRU 缓存包装器
  ├── 请求去重器
  └── 单元测试

Week 2: LLM 缓存优化（集成）+ 超时优化（基础）
  ├── 集成到 LLMIntentClassifier
  ├── A/B 测试验证分类准确率
  ├── 自适应超时调度器
  └── 超时预警系统

Week 3: 超时优化（完成）+ 事务边界（基础）
  ├── 异步执行管理器
  ├── 异步任务 API
  ├── 事务包装器
  └── 集成测试

Week 4: 事务边界（完成）+ 依赖拓扑（基础）
  ├── 幂等性守卫
  ├── 数据库迁移
  ├── 依赖图 + 类型扩展
  └── 循环依赖检测

Week 5: 依赖拓扑（核心）
  ├── 依赖 Pipeline
  ├── 上下文协议
  ├── SharedExecutionContext
  └── 集成测试

Week 6: 依赖拓扑（完成）+ 验收
  ├── 组合建议器
  ├── 迁移现有 24 个 Skills
  ├── 全量回归测试
  └── 性能基准测试
```

---

## 十三、审批确认

- [x] 方案内容已审阅
- [x] 架构融合分析已确认
- [x] 风险评估已确认
- [x] 优先级调整已确认
- [ ] 实施时间表可接受
- [ ] 开始实施

---

## 十四、变更记录

| 日期       | 版本 | 变更内容                                                       |
| ---------- | ---- | -------------------------------------------------------------- |
| 2025-12-30 | v3.0 | 初始版本                                                       |
| 2025-12-30 | v3.1 | 添加架构融合分析、详细风险评估、Feature Flags 配置、优先级调整 |
