# AnyKeep 工作流功能修复计划

> 基于 BMad Master 代码审查报告制定
> 日期: 2026-01-09

---

## 📊 问题概览

| 优先级 | 数量 | 预计工时 |
|--------|------|----------|
| 🚨 Critical (P0) | 6 | 8-12h |
| ⚠️ Major (P1) | 8 | 6-10h |
| 📝 Minor (P2) | 8 | 4-6h |
| **总计** | **22** | **18-28h** |

---

## 🚨 Phase 1: 严重问题修复 (P0 - 必须立即修复)

### Sprint 1.1: 安全漏洞修复 (预计 4-6h)

#### C1: SQL 注入风险修复

**优先级**: 🔴 最高
**影响文件**:
- `src/lib/workflow/integration/workflow-intent-matcher.ts`
- `src/lib/workflow/triggers/event-trigger-manager.ts`
- `src/lib/workflow/orchestrator/workflow-orchestrator.ts`

**修复方案**:
```typescript
// 修复前 (有风险)
.or(`category.eq.builtin,user_id.eq.${userId}`)

// 修复后 (安全)
// 方案 A: 分开查询
const [builtinResult, userResult] = await Promise.all([
  supabase.from("workflows").select("*").eq("category", "builtin").eq("enabled", true),
  supabase.from("workflows").select("*").eq("user_id", userId).eq("enabled", true),
]);
const data = [...(builtinResult.data || []), ...(userResult.data || [])];

// 方案 B: 使用 RPC 函数 (推荐)
const { data } = await supabase.rpc("get_accessible_workflows", { p_user_id: userId });
```

**验收标准**:
- [ ] 所有 `.or()` 拼接调用已移除
- [ ] 添加 SQL 注入测试用例
- [ ] 通过安全扫描

---

#### C2: 分布式锁释放安全修复

**优先级**: 🔴 最高
**影响文件**:
- `supabase/migrations/20260108100003_add_workflow_locks.sql`
- `src/lib/workflow/triggers/distributed-lock.ts`

**修复方案**:
```sql
-- 新增迁移文件: 20260109_fix_workflow_lock_release.sql
CREATE OR REPLACE FUNCTION release_workflow_lock(
  p_lock_id BIGINT,
  p_lock_key TEXT,
  p_instance_id TEXT  -- 新增参数
)
RETURNS BOOLEAN AS $$
DECLARE
  v_deleted BOOLEAN;
BEGIN
  DELETE FROM workflow_locks
  WHERE lock_key = p_lock_key
    AND lock_id = p_lock_id
    AND instance_id = p_instance_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**TypeScript 调用更新**:
```typescript
async releaseLock(lockId: number, lockKey: string): Promise<boolean> {
  const { data, error } = await this.supabase.rpc("release_workflow_lock", {
    p_lock_id: lockId,
    p_lock_key: lockKey,
    p_instance_id: this.instanceId,  // 新增
  });
  return data === true;
}
```

**验收标准**:
- [ ] 迁移文件已创建并执行
- [ ] distributed-lock.ts 已更新
- [ ] 添加并发测试用例

---

#### C3: ReDoS 正则表达式防护

**优先级**: 🔴 高
**影响文件**:
- `src/lib/workflow/integration/workflow-intent-matcher.ts`

**修复方案**:
```typescript
import safeRegex from "safe-regex";

// 添加到类中
private readonly MAX_REGEX_LENGTH = 200;
private readonly REGEX_TIMEOUT_MS = 100;

private evaluateRegexPattern(
  pattern: string,
  message: string,
  weight: number,
): PatternMatchResult | null {
  // 1. 长度检查
  if (pattern.length > this.MAX_REGEX_LENGTH) {
    logger.warn({ pattern: pattern.substring(0, 50) }, "Regex too long, rejected");
    return null;
  }

  // 2. 安全性检查 (使用 safe-regex 库)
  if (!safeRegex(pattern)) {
    logger.warn({ pattern }, "Potentially unsafe regex, rejected");
    return null;
  }

  // 3. 执行带超时
  try {
    const startTime = performance.now();
    const regex = new RegExp(pattern, "i");
    const match = message.match(regex);

    const elapsed = performance.now() - startTime;
    if (elapsed > this.REGEX_TIMEOUT_MS) {
      logger.warn({ pattern, elapsed }, "Regex execution too slow");
    }

    // ... 现有逻辑
  } catch (error) {
    logger.error({ pattern, error }, "Regex execution error");
    return null;
  }
}
```

**依赖安装**:
```bash
npm install safe-regex
npm install -D @types/safe-regex
```

**验收标准**:
- [ ] safe-regex 依赖已安装
- [ ] 正则验证逻辑已实现
- [ ] 添加 ReDoS 攻击测试用例

---

#### C4: 内置工作流 RLS 保护

**优先级**: 🔴 高
**影响文件**:
- `supabase/migrations/` (新增迁移)

**修复方案**:
```sql
-- 新增迁移文件: 20260109_protect_builtin_workflows.sql

-- 1. 删除现有不完善的策略
DROP POLICY IF EXISTS "Users can update their own workflows" ON workflows;
DROP POLICY IF EXISTS "Users can delete their own workflows" ON workflows;

-- 2. 创建保护内置工作流的策略
CREATE POLICY "Users can update their own non-builtin workflows"
  ON workflows FOR UPDATE
  USING (
    auth.uid() = user_id
    AND category != 'builtin'
  );

CREATE POLICY "Users can delete their own non-builtin workflows"
  ON workflows FOR DELETE
  USING (
    auth.uid() = user_id
    AND category != 'builtin'
  );

-- 3. 内置工作流只能由系统管理员通过 service_role 修改
-- (不需要额外策略，RLS 默认拒绝)
```

**验收标准**:
- [ ] 迁移文件已创建并执行
- [ ] 测试：普通用户无法修改/删除内置工作流
- [ ] 测试：用户可以正常管理自己的工作流

---

### Sprint 1.2: 功能完整性修复 (预计 4-6h)

#### C5: 内置工作流 Skill ID 修正

**优先级**: 🔴 高
**影响文件**:
- `src/lib/workflow/builtin/daily-digest.workflow.ts`
- `src/lib/workflow/builtin/bookmark-health.workflow.ts`
- `supabase/migrations/20260108100004_seed_builtin_workflows.sql`

**需要映射的 Skill ID**:

| 错误 ID | 正确 ID | 说明 |
|---------|---------|------|
| `search_bookmarks` | `search` | 搜索 Skill |
| `rank_bookmarks` | ❌ 不存在 | 需新增或移除步骤 |
| `count_bookmarks` | ❌ 不存在 | 需新增或移除步骤 |
| `analyze_folder_overlap` | ❌ 不存在 | 需新增或移除步骤 |

**修复选项**:

**选项 A**: 实现缺失的 Skills (推荐)
```typescript
// 新增 Skills 列表
// 1. count_bookmarks - 统计书签数量
// 2. rank_bookmarks - 书签评分排序
// 3. analyze_folder_overlap - 文件夹重叠分析
```

**选项 B**: 修改工作流定义，仅使用现有 Skills
```typescript
// 修改 daily-digest.workflow.ts
steps: [
  {
    id: "get_unread",
    name: "获取未读列表",
    type: "skill",
    config: { skillId: "search" },  // 修正 ID
  },
  // 移除 rank_bookmarks 步骤
  {
    id: "generate_summaries",
    name: "生成摘要",
    type: "skill",
    config: { skillId: "quick_digest" },
  },
],
```

**验收标准**:
- [ ] 所有 Skill ID 引用有效
- [ ] 工作流可正常执行
- [ ] 添加 Skill ID 验证测试

---

#### C6: ExecutionEngine 步骤类型实现

**优先级**: 🔴 高
**影响文件**:
- `src/lib/workflow/engine/execution-engine.ts`
- `src/lib/workflow/types/workflow.types.ts`

**需实现的步骤类型**:

| 类型 | 用途 | 实现优先级 |
|------|------|-----------|
| `aggregate` | 聚合多个步骤结果 | P0 - 必须 |
| `notification` | 发送通知 | P1 - 可选 |
| `condition` | 条件分支 | P1 - 可选 |
| `parallel` | 并行执行 | P2 - 后续 |
| `tool` | 调用 Tool | P2 - 后续 |

**aggregate 步骤实现**:
```typescript
// execution-engine.ts
private async executeAggregateStep(
  step: WorkflowStep,
  context: WorkflowContext,
): Promise<StepResult> {
  const config = step.config as AggregateStepConfig;
  const sourceSteps = config.sourceSteps || [];

  // 收集指定步骤的输出
  const aggregatedData: Record<string, unknown> = {};
  for (const stepId of sourceSteps) {
    const stepOutput = context.stepOutputs.get(stepId);
    if (stepOutput) {
      aggregatedData[stepId] = stepOutput;
    }
  }

  return {
    status: "completed",
    output: {
      aggregated: aggregatedData,
      timestamp: new Date().toISOString(),
    },
  };
}
```

**notification 步骤实现**:
```typescript
private async executeNotificationStep(
  step: WorkflowStep,
  context: WorkflowContext,
): Promise<StepResult> {
  const config = step.config as NotificationStepConfig;

  // 发送通知 (可集成 Supabase Edge Function)
  await this.sendNotification({
    userId: context.userId,
    type: config.notificationType || "in_app",
    title: config.title,
    body: this.resolveTemplate(config.bodyTemplate, context),
  });

  return { status: "completed", output: { notified: true } };
}
```

**验收标准**:
- [ ] aggregate 步骤已实现并测试
- [ ] notification 步骤已实现并测试
- [ ] 内置工作流可正常执行

---

## ⚠️ Phase 2: 重要问题修复 (P1 - 应尽快修复)

### Sprint 2.1: 稳定性增强 (预计 3-5h)

#### M1 & M2: 超时保护统一实现

**影响文件**:
- `src/app/api/workflow/sse/route.ts`
- `src/lib/workflow/engine/execution-engine.ts`

**修复方案**:

```typescript
// execution-engine.ts - 工作流级超时
async execute(workflow: WorkflowDefinition, context: WorkflowContext): Promise<void> {
  const timeoutMs = workflow.config?.timeout || 300000; // 默认5分钟
  const abortController = new AbortController();

  const timeoutId = setTimeout(() => {
    abortController.abort();
    logger.warn({ workflowId: workflow.id, timeoutMs }, "Workflow timeout");
  }, timeoutMs);

  try {
    // 传递 signal 给子步骤
    await this.executeSteps(workflow.steps, { ...context, signal: abortController.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
```

```typescript
// sse/route.ts - SSE 连接超时
const MAX_CONNECTION_TIME = 5 * 60 * 1000; // 5分钟
const connectionStart = Date.now();

const checkInterval = setInterval(async () => {
  if (Date.now() - connectionStart > MAX_CONNECTION_TIME) {
    sendEvent({ type: "timeout", message: "Connection timeout" });
    clearInterval(checkInterval);
    controller.close();
    return;
  }
  // ... 现有逻辑
}, 500);
```

**验收标准**:
- [ ] 工作流超时后正确终止
- [ ] SSE 连接超时后正确关闭
- [ ] 添加超时测试用例

---

#### M3: 缓存独立过期时间

**影响文件**:
- `src/lib/workflow/integration/workflow-intent-matcher.ts`
- `src/lib/workflow/triggers/event-trigger-manager.ts`

**修复方案**:
```typescript
// 修改缓存结构
private patternCache: Map<string, {
  data: WorkflowDefinition[];
  expiry: number;
}> = new Map();

// 检查缓存
const cached = this.patternCache.get(cacheKey);
if (cached && cached.expiry > Date.now()) {
  return cached.data;
}

// 更新缓存
this.patternCache.set(cacheKey, {
  data: workflows,
  expiry: Date.now() + this.CACHE_TTL_MS,
});
```

**验收标准**:
- [ ] 每个用户缓存独立过期
- [ ] 缓存命中率正常

---

### Sprint 2.2: 可靠性增强 (预计 3-5h)

#### M5: Edge Function 速率限制

**影响文件**:
- `supabase/functions/workflow-scheduler/index.ts`

**修复方案**:
```typescript
// 使用 Redis 或数据库记录调用频率
const RATE_LIMIT_WINDOW = 60000; // 1分钟
const MAX_CALLS_PER_WINDOW = 10;

async function checkRateLimit(functionName: string): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  const { count } = await supabase
    .from("function_rate_limits")
    .select("*", { count: "exact" })
    .eq("function_name", functionName)
    .gte("called_at", new Date(windowStart).toISOString());

  if ((count ?? 0) >= MAX_CALLS_PER_WINDOW) {
    return false; // 限制
  }

  // 记录调用
  await supabase.from("function_rate_limits").insert({
    function_name: functionName,
    called_at: new Date().toISOString(),
  });

  return true;
}
```

---

#### M7: 工作流禁用时取消执行中实例

**影响文件**:
- `src/app/api/workflows/[id]/toggle/route.ts`
- `src/lib/workflow/orchestrator/workflow-orchestrator.ts`

**修复方案**:
```typescript
// toggle/route.ts
if (enabled === false) {
  // 查找并取消执行中的实例
  const { data: runningExecutions } = await supabase
    .from("workflow_executions")
    .select("id")
    .eq("workflow_id", workflowId)
    .eq("status", "running");

  if (runningExecutions?.length) {
    await orchestrator.cancelExecutions(
      runningExecutions.map(e => e.id),
      "Workflow disabled by user"
    );
  }
}
```

---

#### M8: 执行历史清理策略

**修复方案**:
```sql
-- 新增迁移文件: 20260109_add_execution_cleanup.sql

-- 1. 添加清理函数
CREATE OR REPLACE FUNCTION cleanup_old_executions(
  p_retention_days INT DEFAULT 30
)
RETURNS INT AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM workflow_executions
  WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL
    AND status IN ('completed', 'failed', 'cancelled');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 使用 pg_cron 定期清理 (需要启用扩展)
SELECT cron.schedule(
  'cleanup-workflow-executions',
  '0 3 * * *',  -- 每天凌晨3点
  $$SELECT cleanup_old_executions(30)$$
);
```

---

## 📝 Phase 3: 次要问题改进 (P2 - 建议改进)

### Sprint 3.1: 代码质量提升

| ID | 任务 | 文件 | 预计工时 |
|----|------|------|----------|
| N1 | 添加 Zod Schema 验证 | toggle/route.ts 等 | 1h |
| N2 | 日志敏感信息脱敏 | skill-step-executor.ts | 0.5h |
| N3 | 魔法数字提取为常量 | workflow-intent-matcher.ts | 0.5h |
| N4 | 添加前端错误边界 | workflow-list-page.tsx | 1h |
| N5 | 乐观更新失败提示 | workflow-settings-card.tsx | 0.5h |
| N6 | 移除 `as any` 类型断言 | trigger-scheduler.ts | 1h |

---

## 📅 执行时间线

```
Week 1 (Day 1-3): Phase 1 - 严重问题修复
├── Day 1: C1 SQL注入 + C2 分布式锁
├── Day 2: C3 ReDoS + C4 RLS保护
└── Day 3: C5 Skill ID + C6 步骤类型

Week 1 (Day 4-5): Phase 2 - 重要问题修复
├── Day 4: M1-M3 超时与缓存
└── Day 5: M5-M8 速率限制与清理

Week 2 (Day 1-2): Phase 3 - 次要问题改进
└── Day 1-2: N1-N6 代码质量
```

---

## ✅ 验收检查清单

### Phase 1 完成标准
- [ ] 无 SQL 注入漏洞
- [ ] 分布式锁安全
- [ ] ReDoS 防护到位
- [ ] 内置工作流受保护
- [ ] 所有 Skill ID 有效
- [ ] 所有步骤类型可执行

### Phase 2 完成标准
- [ ] 超时保护正常工作
- [ ] 缓存逻辑正确
- [ ] Edge Function 有速率限制
- [ ] 禁用工作流取消执行
- [ ] 历史数据自动清理

### Phase 3 完成标准
- [ ] 输入验证使用 Zod
- [ ] 日志无敏感信息
- [ ] 无魔法数字
- [ ] 前端有错误边界
- [ ] 类型安全 (无 `as any`)

---

## 🔗 相关文档

- [工作流 Phase 1 规范](../specs/workflow-phase1-engine.md)
- [工作流 Phase 2 规范](../specs/workflow-phase2-frontend.md)
- [工作流 Phase 3 规范](../specs/workflow-phase3-ai-integration.md)
- [工作流 Phase 4 规范](../specs/workflow-phase4-extensions.md)

---

> 报告生成: BMad Master
> 日期: 2026-01-09
