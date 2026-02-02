# Workflow 轻量化重构方案 (Workflow Lite Refactoring Plan)
> **核心理念**: No-Engine (无引擎), Code-First (代码优先), Service-Oriented (服务导向)

本方案旨在将过度设计的 `workflow` 编排引擎重构为一套极简的 **"标准化异步任务框架"**。通过彻底移除复杂的 DAG 解析、状态机和分布式锁，回归纯 TypeScript 函数组合，从而在保留自动化能力的同时，大幅降低维护成本和系统风险。

---

## 1. 核心设计原则

### 1.1 彻底去“链”化 (Function Composition)
*   **旧模式**: JSON 配置定义步骤 -> 引擎运行时解析 -> 反射调用 Skill。
*   **新模式**: **纯代码实现**。一个 Workflow 就是一个标准的 TypeScript `async` 函数。
*   **优势**: 利用 TypeScript 编译器进行静态类型检查，杜绝运行时路径错误和类型错误。

### 1.2 零依赖调用 (Service-Oriented)
*   **原则**: 禁止在 Lite 任务中引用旧 Workflow 的 `Tool/Skill` 类。
*   **实现**: 任务逻辑直接调用业务层 (`Service Layer`) 或纯工具函数 (`Utils`)。
*   **隔离**: 新旧系统在代码层面完全物理隔离，互不引用。

### 1.3 强化稳定性 (Idempotency & Observability)
*   **幂等性**: 核心 Runner 内置 `deduplicationKey` 检查，防止 Cron 任务因网络波动重复执行。
*   **可观测性**: 内置结构化日志 (`[LITE:TaskName] Step -> Status`)，让执行过程透明化。

---

## 2. 架构设计

### 2.1 目录结构
```
src/lib/workflow-lite/
├── core/
│   ├── runner.ts          # 高阶函数：负责 Try-Catch, 幂等检查, 日志
│   ├── logger.ts          # 结构化日志工具 (Console封装)
│   └── types.ts           # L_Context, L_Result (全新类型，以 L_ 开头)
├── tasks/                 # 具体的业务流程实现
│   ├── daily-digest.ts    # 每日摘要任务
│   └── folder-cleanup.ts  # 文件夹整理任务
├── adapters/              # 简单的防腐层，用于调用某些必须的 AI 能力
│   └── ai-adapter.ts
└── index.ts               # 统一导出
```

### 2.2 核心 Runner 实现 (伪代码)
```typescript
// src/lib/workflow-lite/core/runner.ts

export async function runLiteTask<T>(
  name: string,
  dedupKey: string | null, // 幂等键 (如 "daily-digest-2025-01-29")
  taskLogic: (ctx: L_Context) => Promise<T> // 纯函数逻辑
) {
  const logger = createLogger(name);

  // 1. 幂等性检查 (防止重复执行)
  if (dedupKey && await isDuplicate(dedupKey)) {
    logger.info("Skipping duplicate execution");
    return;
  }

  try {
    logger.start();
    // 2. 执行业务逻辑 (直接调用，无引擎解析)
    const result = await taskLogic({ logger });
    logger.success(result);
    // 3. 记录成功状态 (可选：写入 DB 用于下次幂等检查)
    await recordSuccess(dedupKey);
    return result;
  } catch (error) {
    logger.error(error);
    // 4. 错误兜底与报警
    await recordFailure(dedupKey, error);
    throw error; // 抛出异常供上层处理
  }
}
```

---

## 3. 实施步骤 (Phased Implementation)

### Phase 1: 建立基座 (Foundation)
**目标**: 建立 `workflow-lite` 目录，确保编译通过，不影响现有代码。

1.  创建 `src/lib/workflow-lite/core` 及 `types.ts`。
2.  定义 `L_Context` 接口，仅包含 `logger` 和基础元数据。
3.  实现 `runner.ts`，暂时使用内存 Map 模拟幂等检查（后续接 DB）。

### Phase 2: 移植核心任务 (Migration)
**目标**: 将 `daily-digest` 重写为 Lite 任务，验证架构可行性。

1.  **代码重写**: 在 `src/lib/workflow-lite/tasks/daily-digest.ts` 中实现逻辑。
    *   使用 `import { SearchService }` 获取数据。
    *   使用 `import { LLMService }` 生成摘要。
2.  **验证**: 编写单元测试，运行 `executeDailyDigest()`，检查控制台日志是否符合预期。

### Phase 3: 安全切换 (Switchover)
**目标**: 将 Cron 流量切换到新系统，保留旧系统作为“熔断备份”。

1.  **修改 Cron 入口**: `src/app/api/internal/cron/workflow-scheduled-triggers/route.ts`
    ```typescript
    // 伪代码: 灰度切换逻辑
    try {
      if (jobName === 'daily-digest') {
         await executeDailyDigest(); // 尝试新系统
         return success();
      }
    } catch (e) {
      console.error("Lite execution failed, falling back to legacy...");
      // 失败回滚：如果新代码报错，降级调用旧 Workflow
      await legacyOrchestrator.run(jobName);
    }
    ```

### Phase 4: 清理与移除 (Cleanup)
**目标**: 当新系统稳定运行 48 小时后，移除旧代码。

1.  移除 `src/app/api/internal/cron` 中的回滚逻辑。
2.  物理删除 `src/lib/workflow`。
3.  物理删除 `src/app/api/workflow`。

---

## 4. 风险控制与防御 (Risk Mitigation)

| 潜在风险 | 防御措施 |
| :--- | :--- |
| **函数错误** | **Try-Catch-Fallback**: 在切换初期，保留旧代码作为 Catch 块中的兜底逻辑。 |
| **类型污染** | **物理隔离**: Lite 代码严禁 `import` 旧 Workflow 目录下的任何文件。可通过 ESLint 规则强制约束。 |
| **重复执行** | **强制幂等**: `runLiteTask` 强制要求传入 `dedupKey`，否则在开发环境报警告。 |
| **状态丢失** | **日志透传**: 虽无详细 DB 状态，但所有关键步骤通过 `logger.step()` 输出到云端日志，易于追踪。 |

---

## 5. 下一步行动
建议立即开始 **Phase 1 (建立基座)**，这不需要修改任何现有业务代码，风险为零。
