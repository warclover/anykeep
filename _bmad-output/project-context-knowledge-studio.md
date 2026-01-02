---
project_name: "Knowledge Studio (知识工坊)"
user_name: "Xiafe"
date: "2026-01-02"
sections_completed:
  [
    "technology_stack",
    "language_rules",
    "framework_rules",
    "testing_rules",
    "code_quality",
    "workflow_rules",
    "critical_rules",
  ]
architecture_source: "architecture-knowledge-studio.md"
---

# Project Context for AI Agents - Knowledge Studio

_Critical rules and patterns that AI agents must follow when implementing Knowledge Studio. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Core Technologies

| Technology           | Version | Note                     |
| -------------------- | ------- | ------------------------ |
| Next.js (App Router) | 14.2.35 | SSE streaming compatible |
| TypeScript           | 5.x     | strict mode enabled      |
| React                | 18.3.1  | Server/Client Components |
| Supabase             | 2.84.0  | PostgreSQL + RLS         |
| AI SDK (Vercel)      | 5.0.116 | DeepSeek primary         |
| Tailwind CSS         | 3.4.18  | -                        |
| Zod                  | 4.1.12  | Runtime validation       |
| Pino                 | 10.1.0  | Structured logging       |

### Knowledge Studio Specific

| Component        | Path                                  | Purpose         |
| ---------------- | ------------------------------------- | --------------- |
| Blueprint Engine | `src/lib/knowledge-studio/blueprint/` | 5 写作蓝图生成  |
| Chat-to-Edit     | `src/lib/knowledge-studio/chat-edit/` | 段落级聊天修改  |
| Quota Manager    | `src/lib/knowledge-studio/quota/`     | 乐观计费 + 补偿 |
| Material Scorer  | `src/lib/knowledge-studio/material/`  | 素材健康度评分  |

---

## Critical Implementation Rules

### TypeScript Rules

- **strict mode 强制**: 所有函数必须有完整类型签名
- **类型导出**: 每个模块必须有 `types.ts` 文件
- **泛型使用**: API 响应使用 `SuccessResponse<T>` 泛型
- **never 使用 any**: 使用 `unknown` + 类型守卫替代
- **路径别名**: 始终使用 `@/` 而非相对路径

```typescript
// ✅ 正确
import { BlueprintConfig } from "@/lib/knowledge-studio/blueprint/types";

// ❌ 错误
import { BlueprintConfig } from "../../../blueprint/types";
```

### SSE 流式规则 (Knowledge Studio 核心)

- **事件命名**: 必须使用 `{domain}:{action}` 格式
- **Payload 结构**: 必须包含 `timestamp` 和 `requestId`
- **5 阶段进度**: parsing → outline → content → citations → finalizing

```typescript
// ✅ 正确的 SSE 事件
emitEvent({
  event: "generation:stage",
  data: {
    timestamp: new Date().toISOString(),
    requestId: ctx.requestId,
    stage: "content",
    stageProgress: 67,
    totalProgress: 52,
  },
});

// ❌ 错误
emit("progress", { percent: 50 });
```

### Supabase 规则

- **RLS 强制**: 所有表必须有 `user_id` 和 RLS 策略
- **JSONB 字段**: 动态数据用 JSONB（`citations`, `generation_metadata`）
- **RPC 事务**: 多表操作使用 `supabase.rpc()` 包装
- **乐观更新**: 先扣配额后执行，失败时补偿

```sql
-- synthesis_reports 必须有 RLS
ALTER TABLE synthesis_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own reports"
  ON synthesis_reports FOR ALL
  USING (auth.uid() = user_id);
```

### React Hooks 规则

- **命名约定**: `useKnowledgeStudio*` 前缀
- **依赖数组**: 必须完整，禁止使用 eslint-disable
- **状态更新**: 使用 `useCallback` 包装操作方法
- **SSE 订阅**: 使用 `useEffect` 清理订阅

```typescript
// ✅ 正确的 Hook 结构
function useGeneration() {
  const [status, setStatus] = useState<GenerationStatus>("idle");

  const generate = useCallback(
    async (config: GenerationConfig) => {
      // 实现
    },
    [
      /* 完整依赖 */
    ],
  );

  return { status, generate };
}
```

---

## Testing Rules

- **测试目录**: `__tests__/` 与源文件同级
- **命名格式**: `{source-file}.test.ts`
- **Mock 模式**: 使用 `jest.mock()` 替代真实 API
- **覆盖率要求**: 新功能 > 80%

```
src/lib/knowledge-studio/blueprint/
├── blueprint-engine.ts
└── __tests__/
    └── blueprint-engine.test.ts
```

---

## Code Quality Rules

### 命名规范

| 类型     | 规范             | 示例                            |
| -------- | ---------------- | ------------------------------- |
| 文件名   | kebab-case       | `blueprint-engine.ts`           |
| 组件名   | PascalCase       | `SynthesisEditor`               |
| 函数名   | camelCase        | `generateReport`                |
| 常量     | UPPER_SNAKE_CASE | `MAX_CONTEXT_TOKENS`            |
| 数据库表 | snake_case 复数  | `synthesis_reports`             |
| API 端点 | kebab-case 复数  | `/api/knowledge-studio/reports` |

### 错误处理

**三级错误策略**:

1. **可恢复**: 自动重试 + 用户提示
2. **需干预**: 显示操作选项
3. **致命**: 终止 + 错误报告

```typescript
// 必须使用 RecoverableError 接口
interface RecoverableError {
  code: string;
  message: string;
  recoverable: boolean;
  retryAfterMs?: number;
}
```

---

## Critical Don't-Miss Rules

### 必须遵守

1. **Feature Flag 服务端验证**: Pro 功能必须在服务端检查 `profiles.membership_type`
2. **配额消耗先扣后执行**: 使用乐观计费模式，失败时补偿
3. **引用 10 秒持久化**: 生成完成后 10 秒内必须持久化 citations
4. **SSE 断点续传**: 支持 `Last-Event-ID` 重连

### 绝对禁止

```typescript
// ❌ 禁止客户端检查 Pro 权限
if (userPlan === 'pro') { ... }  // 可被绕过

// ✅ 必须服务端验证
const { data: profile } = await supabase
  .from('profiles')
  .select('membership_type')
  .eq('id', userId)
  .single();
```

```typescript
// ❌ 禁止吞掉错误
try {
  await generate();
} catch (e) {}

// ✅ 必须处理或重新抛出
try {
  await generate();
} catch (error) {
  if (error instanceof QuotaExceededError) {
    return { error: { code: "QUOTA_EXCEEDED", message: "配额已用完" } };
  }
  throw error;
}
```

```typescript
// ❌ 禁止硬编码 UI 文本
<Button>开始生成</Button>

// ✅ 使用常量配置
<Button>{UI_TEXT.GENERATE_START}</Button>
```

### AI 模型调用规则

- **主模型**: DeepSeek (`deepseek-chat`)
- **故障转移**: DeepSeek → 阿里百炼云 → 服务不可用提示
- **故障触发**: 连续 2 次 API 超时（>30s）或单次 5xx

---

## Architecture Reference

完整架构决策参见: [`architecture-knowledge-studio.md`](./architecture-knowledge-studio.md)

- Decision 4.1: JSONB 数据模型
- Decision 4.2: 乐观计费 + 补偿机制
- Decision 4.3: 滑动窗口上下文 (3 轮 + 500 token 摘要)
- Decision 4.4: 5 阶段 SSE 进度
- Decision 4.5: 服务端 Pro Feature Flag

---

**Last Updated**: 2026-01-02
**Status**: Ready for Implementation
