# Skill 执行流水线设计文档

## 概述

设计一套**轻量化的 Skill 执行标准化流水线**，解决以下问题：

1. 错误处理不一致
2. 无统一的权限检查
3. 难以追踪执行状态

## 设计原则

1. **轻量化** - 不过度工程化，仅封装必要逻辑
2. **复用优先** - 复用现有 InputValidator、RiskLevel、CancellationToken
3. **渐进式** - 与现有 OrchestrationSkill 兼容，不破坏现有代码
4. **可观测** - 每个阶段发出事件，便于追踪和调试

## 流水线阶段

```
┌─────────────────────────────────────────────────────────────────┐
│                    SkillExecutionPipeline                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ① RESOLVE      ② VALIDATE     ③ RISK_CHECK                   │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                     │
│  │ Skill   │───▶│ Input   │───▶│ Risk    │                     │
│  │ 解析    │    │ 验证    │    │ 评估    │                     │
│  └─────────┘    └─────────┘    └─────────┘                     │
│       │              │              │                           │
│       │              │              ▼                           │
│       │              │    ┌─────────────────┐                   │
│       │              │    │ 需要确认？       │                   │
│       │              │    │ high risk → yes │                   │
│       │              │    │ batch > 20 → yes│                   │
│       │              │    └─────────────────┘                   │
│       │              │              │                           │
│       ▼              ▼              ▼                           │
│  ④ EXECUTE      ⑤ FORMAT                                       │
│  ┌─────────┐    ┌─────────┐                                     │
│  │ 执行    │───▶│ 格式化  │───▶ Done                            │
│  │ + 取消  │    │ 输出    │                                     │
│  └─────────┘    └─────────┘                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 阶段详解

| 阶段           | 职责                  | 复用组件              | 失败处理                |
| -------------- | --------------------- | --------------------- | ----------------------- |
| **RESOLVE**    | 从 ID 查找 Skill 实例 | SkillRegistry         | 抛出 SkillNotFoundError |
| **VALIDATE**   | 输入验证与清洗        | InputValidator        | 返回验证错误            |
| **RISK_CHECK** | 风险评估与确认        | response-templates.ts | 高风险需确认            |
| **EXECUTE**    | 执行 Skill + 取消检查 | CancellationToken     | 支持中断                |
| **FORMAT**     | 统一输出格式          | OutputAdapter         | 标准化响应              |

## 类型定义

```typescript
// 流水线阶段枚举
enum PipelineStage {
  RESOLVE = "resolve",
  VALIDATE = "validate",
  RISK_CHECK = "risk_check",
  EXECUTE = "execute",
  FORMAT = "format",
}

// 阶段状态
type StageStatus = "pending" | "running" | "completed" | "failed" | "skipped";

// 流水线事件
interface PipelineEvent {
  stage: PipelineStage;
  status: StageStatus;
  timestamp: number;
  durationMs?: number;
  data?: {
    skillId?: string;
    riskLevel?: RiskLevel;
    requiresConfirmation?: boolean;
    validationWarnings?: string[];
    error?: string;
    errorCode?: string;
  };
}

// 流水线配置
interface PipelineConfig {
  /** 跳过验证（调试用） */
  skipValidation?: boolean;
  /** 跳过风险检查 */
  skipRiskCheck?: boolean;
  /** 用户已确认（跳过确认流程） */
  userConfirmed?: boolean;
  /** 影响数量（用于批量操作判断） */
  affectedCount?: number;
  /** 超时时间（毫秒） */
  timeoutMs?: number;
}

// 流水线上下文
interface PipelineContext {
  userId: string;
  traceId: string;
  signal?: AbortSignal;
  cancellationToken?: CancellationToken;
  config: PipelineConfig;
}
```

## 核心实现

```typescript
/**
 * Skill 执行流水线
 *
 * 5 阶段标准化执行：解析 → 验证 → 风险检查 → 执行 → 格式化
 */
class SkillExecutionPipeline {
  private skillRegistry: Map<string, OrchestrationSkill>;
  private inputValidator: InputValidator;

  /**
   * 流式执行 Skill
   */
  async *execute(
    skillId: string,
    input: string,
    context: PipelineContext,
  ): AsyncGenerator<PipelineEvent | OrchestrationStreamChunk> {
    const startTime = Date.now();

    // ① RESOLVE - Skill 解析
    yield* this.resolveStage(skillId);
    const skill = this.skillRegistry.get(skillId)!;

    // ② VALIDATE - 输入验证
    if (!context.config.skipValidation) {
      const validationResult = yield* this.validateStage(input);
      if (!validationResult.valid) {
        return; // 验证失败，已 yield 错误事件
      }
      input = validationResult.sanitizedInput;
    }

    // ③ RISK_CHECK - 风险评估
    if (!context.config.skipRiskCheck) {
      const needsConfirmation = yield* this.riskCheckStage(
        skillId,
        context.config.affectedCount,
        context.config.userConfirmed,
      );
      if (needsConfirmation) {
        return; // 需要确认，已 yield 确认请求
      }
    }

    // ④ EXECUTE - 执行
    yield* this.executeStage(skill, input, context);

    // ⑤ FORMAT - 格式化（在 executeStage 内完成）
    yield {
      stage: PipelineStage.FORMAT,
      status: "completed",
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
    };
  }
}
```

## 与现有架构集成

### 集成点 1：OrchestrationEngine

```typescript
// src/lib/ai-skills/engine/orchestration-engine.ts

class OrchestrationEngine {
  private pipeline: SkillExecutionPipeline;

  async *execute(skillId: string, input: string, context: EngineContext) {
    // 使用流水线执行
    for await (const event of this.pipeline.execute(skillId, input, {
      userId: context.userId,
      traceId: context.traceId,
      signal: context.signal,
      cancellationToken: context.cancellationToken,
      config: {
        userConfirmed: context.userConfirmed,
        affectedCount: context.affectedCount,
      },
    })) {
      if ("stage" in event) {
        // 流水线事件 - 用于可观测性
        this.emitPipelineEvent(event);
      } else {
        // Skill 输出块 - 透传给调用方
        yield event;
      }
    }
  }
}
```

### 集成点 2：统一 API

```typescript
// src/app/api/agent/unified/route.ts

// 支持通过 header 传递确认状态
const userConfirmed = request.headers.get("X-User-Confirmed") === "true";
const affectedCount = parseInt(request.headers.get("X-Affected-Count") || "1");
```

## 错误处理策略

### 统一错误类型

```typescript
// 流水线专用错误
class PipelineError extends Error {
  constructor(
    message: string,
    public readonly stage: PipelineStage,
    public readonly code: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

// 预定义错误码
const PIPELINE_ERROR_CODES = {
  SKILL_NOT_FOUND: "SKILL_NOT_FOUND",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  RISK_CONFIRMATION_REQUIRED: "RISK_CONFIRMATION_REQUIRED",
  EXECUTION_TIMEOUT: "EXECUTION_TIMEOUT",
  EXECUTION_CANCELLED: "EXECUTION_CANCELLED",
  EXECUTION_FAILED: "EXECUTION_FAILED",
} as const;
```

### 错误恢复流程

```
错误发生
    │
    ▼
┌─────────────────┐
│ 检查 retryable │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
  true      false
    │         │
    ▼         ▼
  重试      终止
 (最多3次)  (返回错误)
```

## 可观测性

### 日志格式

```typescript
// 每个阶段开始
logger.info(
  {
    stage: "resolve",
    status: "running",
    traceId: context.traceId,
    skillId,
  },
  "Pipeline stage started",
);

// 每个阶段完成
logger.info(
  {
    stage: "resolve",
    status: "completed",
    traceId: context.traceId,
    durationMs: 5,
  },
  "Pipeline stage completed",
);

// 错误日志
logger.error(
  {
    stage: "execute",
    status: "failed",
    traceId: context.traceId,
    error: "Timeout",
    code: "EXECUTION_TIMEOUT",
  },
  "Pipeline stage failed",
);
```

### 指标采集（可选）

```typescript
// 流水线执行时间分布
pipeline_execution_duration_ms{stage="resolve"}
pipeline_execution_duration_ms{stage="validate"}
pipeline_execution_duration_ms{stage="risk_check"}
pipeline_execution_duration_ms{stage="execute"}

// 阶段成功率
pipeline_stage_success_total{stage="execute", success="true"}
pipeline_stage_success_total{stage="execute", success="false"}
```

## 文件结构

```
src/lib/ai-skills/
├── pipeline/                          # 新增：流水线模块
│   ├── types.ts                       # 类型定义
│   ├── skill-execution-pipeline.ts    # 核心实现
│   ├── stages/                        # 阶段实现
│   │   ├── resolve-stage.ts
│   │   ├── validate-stage.ts
│   │   ├── risk-check-stage.ts
│   │   └── execute-stage.ts
│   ├── errors.ts                      # 错误定义
│   └── __tests__/                     # 测试
│       ├── skill-execution-pipeline.test.ts
│       └── stages/
│           ├── resolve-stage.test.ts
│           └── risk-check-stage.test.ts
└── engine/
    └── orchestration-engine.ts        # 修改：集成流水线
```

## 迁移策略

### Phase 1：新增流水线模块（本次实现）

- 创建 `pipeline/` 目录
- 实现 5 个阶段
- 编写测试

### Phase 2：集成到 OrchestrationEngine

- 将 OrchestrationEngine.execute 重构为使用 Pipeline
- 保持 API 不变，内部实现替换

### Phase 3：扩展可观测性（可选）

- 添加 Prometheus 指标
- 集成 OpenTelemetry tracing

## 测试策略

```typescript
describe('SkillExecutionPipeline', () => {
  describe('resolve stage', () => {
    it('should find registered skill', async () => { ... });
    it('should throw SkillNotFoundError for unknown skill', async () => { ... });
  });

  describe('validate stage', () => {
    it('should pass valid input', async () => { ... });
    it('should reject empty input', async () => { ... });
    it('should sanitize XSS content', async () => { ... });
  });

  describe('risk check stage', () => {
    it('should allow low risk operations', async () => { ... });
    it('should require confirmation for high risk operations', async () => { ... });
    it('should require confirmation for batch > 20', async () => { ... });
    it('should skip confirmation when userConfirmed=true', async () => { ... });
  });

  describe('execute stage', () => {
    it('should execute skill and yield chunks', async () => { ... });
    it('should handle cancellation', async () => { ... });
    it('should handle timeout', async () => { ... });
  });

  describe('end-to-end', () => {
    it('should complete full pipeline successfully', async () => { ... });
    it('should stop at risk check when confirmation needed', async () => { ... });
  });
});
```

## 总结

这个设计实现了：

- ✅ **标准化流程**：5 阶段清晰分离
- ✅ **错误处理一致**：统一的 PipelineError
- ✅ **风险门控**：复用现有 response-templates.ts
- ✅ **执行状态追踪**：每阶段发出 PipelineEvent
- ✅ **轻量化**：仅 ~300 行核心代码
- ✅ **兼容现有架构**：渐进式集成，不破坏现有代码
