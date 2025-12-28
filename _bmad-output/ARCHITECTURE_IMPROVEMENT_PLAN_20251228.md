# AnyKeep 架构改进计划

**制定人**: Winston | 首席架构师
**日期**: 2025-12-28
**版本**: v1.0
**目标周期**: 12 周 (3 个月)

---

## 执行摘要

基于架构评审结果，本计划分为 **4 个阶段**，共 **18 个改进项**。优先解决稳定性和可维护性问题，然后逐步提升可观测性和扩展性。

### 投资回报预期

| 维度             | 当前状态 | 12 周后目标 |
| ---------------- | -------- | ----------- |
| 系统稳定性       | 95%      | 99.5%       |
| E2E 测试覆盖     | 10%      | 80%         |
| 平均故障恢复时间 | 30 分钟  | 5 分钟      |
| 新功能上线周期   | 5 天     | 2 天        |
| 开发者上手时间   | 3 天     | 1 天        |

---

## 阶段总览

```
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 1: 稳定性加固 (Week 1-3)                                      │
│  ├── 全局错误边界                                                    │
│  ├── E2E 核心路径测试                                                │
│  └── 日志标准化                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  Phase 2: 可维护性提升 (Week 4-6)                                    │
│  ├── Agent 核心拆分                                                  │
│  ├── 统一缓存层                                                      │
│  └── RPC 函数版本化                                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Phase 3: 可观测性建设 (Week 7-9)                                    │
│  ├── OpenTelemetry 集成                                              │
│  ├── 性能监控面板                                                    │
│  └── 告警体系                                                        │
├─────────────────────────────────────────────────────────────────────┤
│  Phase 4: 扩展性优化 (Week 10-12)                                    │
│  ├── API 网关抽象                                                    │
│  ├── 插件化架构                                                      │
│  └── 边缘部署准备                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: 稳定性加固 (Week 1-3)

### 1.1 全局错误边界系统

**优先级**: P0 | **工期**: 3 天 | **风险**: 低

**问题分析**:

- 当前错误边界分散在各个组件中
- 单个组件崩溃可能导致整页白屏
- 错误信息对用户不友好

**实施方案**:

```
src/components/error-boundary/
├── global-error-boundary.tsx      # 全局错误边界
├── feature-error-boundary.tsx     # 功能模块边界
├── ai-error-boundary.tsx          # AI 功能专用边界
├── fallback-ui.tsx                # 统一降级 UI
├── error-reporter.ts              # 错误上报服务
└── index.ts
```

**代码设计**:

```typescript
// global-error-boundary.tsx
interface GlobalErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export class GlobalErrorBoundary extends Component<
  GlobalErrorBoundaryProps,
  { hasError: boolean; error: Error | null }
> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 上报到 Sentry
    captureException(error, { extra: errorInfo });
    // 调用自定义处理
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <GlobalFallbackUI error={this.state.error} />;
    }
    return this.props.children;
  }
}

// fallback-ui.tsx
export function GlobalFallbackUI({ error }: { error: Error | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <AlertTriangle className="text-amber-500" />
          <CardTitle>出了点问题</CardTitle>
        </CardHeader>
        <CardContent>
          <p>应用遇到了意外错误，请刷新页面重试。</p>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-4 text-xs">{error?.message}</pre>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={() => window.location.reload()}>
            刷新页面
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
```

**集成位置**:

```typescript
// src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <GlobalErrorBoundary>
          <Providers>
            {children}
          </Providers>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}

// src/app/(main)/layout.tsx - 功能模块级别
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureErrorBoundary feature="main">
      <Sidebar />
      <main>{children}</main>
    </FeatureErrorBoundary>
  );
}
```

**验收标准**:

- [ ] 全局错误边界覆盖所有页面
- [ ] AI 功能有专用错误边界和友好提示
- [ ] 错误自动上报到 Sentry
- [ ] 开发环境显示详细错误信息
- [ ] 生产环境显示用户友好提示

---

### 1.2 E2E 核心路径测试

**优先级**: P0 | **工期**: 5 天 | **风险**: 中

**问题分析**:

- Playwright 已配置但测试用例不足
- 用户核心路径缺少端到端保障
- CI/CD 缺少 E2E 质量门禁

**覆盖路径**:

| 路径            | 优先级 | 预计用例数 |
| --------------- | ------ | ---------- |
| 用户认证流程    | P0     | 5          |
| AI 对话完整流程 | P0     | 10         |
| 浏览器书签导入  | P0     | 8          |
| 批量操作流程    | P1     | 6          |
| 数据导出流程    | P1     | 5          |
| 搜索功能        | P1     | 4          |

**目录结构**:

```
tests/e2e/
├── auth/
│   ├── login.spec.ts
│   ├── logout.spec.ts
│   └── session.spec.ts
├── ai-assistant/
│   ├── basic-query.spec.ts        # 基础查询
│   ├── orchestration.spec.ts      # 编排任务
│   ├── tool-calling.spec.ts       # 工具调用
│   └── error-recovery.spec.ts     # 错误恢复
├── browser-bookmark/
│   ├── import-flow.spec.ts        # 导入流程
│   ├── duplicate-handling.spec.ts # 重复处理
│   └── folder-structure.spec.ts   # 文件夹结构
├── batch-operations/
│   ├── batch-tag.spec.ts
│   ├── batch-move.spec.ts
│   └── batch-delete.spec.ts
├── export/
│   ├── csv-export.spec.ts
│   ├── markdown-export.spec.ts
│   └── obsidian-export.spec.ts
├── fixtures/
│   ├── test-user.ts
│   ├── test-bookmarks.ts
│   └── mock-data.ts
└── utils/
    ├── auth-helper.ts
    ├── db-helper.ts
    └── wait-helper.ts
```

**示例测试**:

```typescript
// tests/e2e/ai-assistant/basic-query.spec.ts
import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "../utils/auth-helper";

test.describe("AI Assistant Basic Query", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/home");
  });

  test("should answer bookmark count query", async ({ page }) => {
    // 打开 AI 助手
    await page.getByRole("button", { name: "AI 助理" }).click();

    // 等待面板打开
    await expect(page.getByRole("dialog")).toBeVisible();

    // 输入查询
    await page.getByPlaceholder("输入你的问题").fill("我有多少收藏？");
    await page.getByRole("button", { name: "发送" }).click();

    // 等待响应
    await expect(page.getByText(/总收藏/)).toBeVisible({ timeout: 30000 });

    // 验证响应包含数字
    const response = await page.getByTestId("ai-response").textContent();
    expect(response).toMatch(/\d+\s*条/);
  });

  test("should handle search query with tool call", async ({ page }) => {
    await page.getByRole("button", { name: "AI 助理" }).click();
    await page.getByPlaceholder("输入你的问题").fill("搜索关于 React 的文章");
    await page.getByRole("button", { name: "发送" }).click();

    // 验证工具调用指示器
    await expect(page.getByText("正在搜索")).toBeVisible({ timeout: 10000 });

    // 等待搜索结果
    await expect(page.getByTestId("search-results")).toBeVisible({
      timeout: 30000,
    });
  });
});
```

**CI 集成**:

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Start Supabase
        run: npx supabase start

      - name: Seed test data
        run: npm run db:seed:test

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

**验收标准**:

- [ ] 38 个 E2E 测试用例全部通过
- [ ] CI 流水线集成 E2E 测试
- [ ] 测试覆盖率报告自动生成
- [ ] 失败时自动截图和录像

---

### 1.3 日志标准化

**优先级**: P1 | **工期**: 2 天 | **风险**: 低

**问题分析**:

- 部分模块仍使用 console.log
- 日志格式不统一
- 缺少结构化日志字段

**实施方案**:

```typescript
// src/lib/logger/logger.ts
import pino from "pino";

// 标准日志字段
interface LogContext {
  userId?: string;
  conversationId?: string;
  requestId?: string;
  toolName?: string;
  duration?: number;
  [key: string]: unknown;
}

// 创建 logger 实例
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// 创建带上下文的子 logger
export function createContextLogger(context: LogContext) {
  return logger.child(context);
}

// 模块专用 logger 工厂
export function createModuleLogger(module: string) {
  return logger.child({ module });
}

// 使用示例
const aiLogger = createModuleLogger("ai-agent");
aiLogger.info({ toolName: "search", duration: 150 }, "Tool executed");
```

**迁移脚本**:

```typescript
// scripts/migrate-console-to-logger.ts
// 扫描并替换 console.log → logger.info
// console.error → logger.error
// console.warn → logger.warn
```

**验收标准**:

- [ ] 所有 console.log 替换为 logger
- [ ] 日志格式统一为 JSON
- [ ] 关键操作包含 userId、requestId
- [ ] 日志级别可通过环境变量控制

---

## Phase 2: 可维护性提升 (Week 4-6)

### 2.1 Agent 核心拆分

**优先级**: P1 | **工期**: 4 天 | **风险**: 中

**问题分析**:

- `agent.ts` 约 500 行，职责过多
- 包含：核心逻辑、流式处理、工具调用、上下文管理
- 修改风险高，测试难以隔离

**拆分方案**:

```
src/lib/ai-agent/core/
├── agent.ts              # 500 行 (当前)
│
└── 拆分后:
    ├── agent.ts              # ~100 行 (入口 + 组合)
    ├── agent-executor.ts     # ~150 行 (核心执行逻辑)
    ├── agent-streaming.ts    # ~100 行 (SSE 流式处理)
    ├── agent-tools.ts        # ~100 行 (工具调用管理)
    └── agent-context.ts      # ~80 行 (上下文管理)
```

**拆分后的职责**:

```typescript
// agent.ts - 入口 + 组合
export class KnowledgeAgent {
  private executor: AgentExecutor;
  private streaming: AgentStreaming;
  private tools: AgentToolManager;
  private context: AgentContextManager;

  constructor(config: AgentConfig) {
    this.context = new AgentContextManager(config);
    this.tools = new AgentToolManager(config.tools);
    this.streaming = new AgentStreaming();
    this.executor = new AgentExecutor({
      context: this.context,
      tools: this.tools,
      streaming: this.streaming,
    });
  }

  async execute(request: AgentRequest): Promise<AgentResponse> {
    return this.executor.execute(request);
  }

  async *stream(request: AgentRequest): AsyncGenerator<StreamChunk> {
    yield* this.executor.stream(request);
  }
}

// agent-executor.ts - 核心执行逻辑
export class AgentExecutor {
  async execute(request: AgentRequest): Promise<AgentResponse> {
    const context = await this.context.build(request);
    const messages = this.buildMessages(context);
    const response = await this.callLLM(messages);
    return this.processResponse(response);
  }
}

// agent-streaming.ts - SSE 流式处理
export class AgentStreaming {
  createEncoder(): TransformStream<StreamChunk, Uint8Array> {}
  formatChunk(chunk: StreamChunk): string {}
  parseChunk(data: string): StreamChunk {}
}

// agent-tools.ts - 工具调用管理
export class AgentToolManager {
  async callTool(name: string, args: unknown): Promise<ToolResult> {}
  validateToolArgs(name: string, args: unknown): boolean {}
  getToolSchema(name: string): ToolSchema {}
}

// agent-context.ts - 上下文管理
export class AgentContextManager {
  async build(request: AgentRequest): Promise<AgentContext> {}
  async compress(messages: Message[]): Promise<Message[]> {}
  injectSystemReminder(context: AgentContext): AgentContext {}
}
```

**迁移步骤**:

1. 创建新文件，定义接口
2. 逐个提取函数到新模块
3. 更新 agent.ts 使用组合模式
4. 运行所有测试确保无回归
5. 更新相关文档

**验收标准**:

- [ ] agent.ts 行数 < 150 行
- [ ] 每个模块单一职责
- [ ] 所有现有测试通过
- [ ] 新增模块测试覆盖 > 90%

---

### 2.2 统一缓存层

**优先级**: P1 | **工期**: 3 天 | **风险**: 低

**问题分析**:

- 缓存分散：IndexedDB、内存 LRU、Supabase
- 缺少统一的缓存抽象
- 缓存失效策略不一致

**设计方案**:

```typescript
// src/lib/cache/types.ts
export interface CacheOptions {
  ttl?: number; // 过期时间 (ms)
  tags?: string[]; // 用于批量失效
  priority?: "low" | "normal" | "high";
}

export interface CacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  invalidateByTag(tag: string): Promise<void>;
  clear(): Promise<void>;
}

// src/lib/cache/adapters/memory-adapter.ts
export class MemoryCacheAdapter implements CacheManager {
  private cache: LRUCache<string, CacheEntry>;

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry || this.isExpired(entry)) {
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    this.cache.set(key, {
      value,
      expiresAt: options?.ttl ? Date.now() + options.ttl : undefined,
      tags: options?.tags || [],
    });
  }
}

// src/lib/cache/adapters/indexeddb-adapter.ts
export class IndexedDBCacheAdapter implements CacheManager {
  private db: IDBDatabase;
  // ... IndexedDB 实现
}

// src/lib/cache/cache-factory.ts
export function createCache(
  type: "memory" | "indexeddb" | "hybrid",
): CacheManager {
  switch (type) {
    case "memory":
      return new MemoryCacheAdapter();
    case "indexeddb":
      return new IndexedDBCacheAdapter();
    case "hybrid":
      return new HybridCacheAdapter(
        new MemoryCacheAdapter(),
        new IndexedDBCacheAdapter(),
      );
  }
}

// src/lib/cache/hybrid-adapter.ts
export class HybridCacheAdapter implements CacheManager {
  constructor(
    private l1: CacheManager, // 内存 (快)
    private l2: CacheManager, // IndexedDB (持久)
  ) {}

  async get<T>(key: string): Promise<T | null> {
    // 先查 L1
    let value = await this.l1.get<T>(key);
    if (value) return value;

    // 再查 L2
    value = await this.l2.get<T>(key);
    if (value) {
      // 回填 L1
      await this.l1.set(key, value);
    }
    return value;
  }
}
```

**使用示例**:

```typescript
// 在 AI Agent 中使用
const cache = createCache("hybrid");

// 缓存用户偏好
await cache.set(`user:${userId}:preferences`, preferences, {
  ttl: 1000 * 60 * 60, // 1 小时
  tags: ["user", `user:${userId}`],
});

// 批量失效用户相关缓存
await cache.invalidateByTag(`user:${userId}`);
```

**验收标准**:

- [ ] 统一缓存接口定义
- [ ] 3 种适配器实现 (Memory, IndexedDB, Hybrid)
- [ ] 支持 TTL 和标签失效
- [ ] 迁移现有缓存使用到新接口

---

### 2.3 RPC 函数版本化

**优先级**: P1 | **工期**: 2 天 | **风险**: 低

**问题分析**:

- 当前 RPC 函数无版本号
- 修改签名会导致客户端崩溃
- 无法平滑迁移

**实施方案**:

```sql
-- 1. 重命名现有函数为 v1
ALTER FUNCTION batch_add_tags RENAME TO batch_add_tags_v1;
ALTER FUNCTION batch_remove_tags RENAME TO batch_remove_tags_v1;

-- 2. 创建兼容性包装函数
CREATE OR REPLACE FUNCTION batch_add_tags(
  bookmark_ids uuid[],
  tag_names text[]
)
RETURNS json
LANGUAGE plpgsql
AS $$
BEGIN
  -- 调用最新版本
  RETURN batch_add_tags_v1(bookmark_ids, tag_names);
END;
$$;

-- 3. 新版本函数示例
CREATE OR REPLACE FUNCTION batch_add_tags_v2(
  bookmark_ids uuid[],
  tag_names text[],
  options jsonb DEFAULT '{}'::jsonb  -- 新增参数
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  skip_duplicates boolean;
BEGIN
  skip_duplicates := COALESCE((options->>'skip_duplicates')::boolean, false);

  -- 新版本逻辑
  -- ...

  RETURN result;
END;
$$;
```

**客户端版本选择**:

```typescript
// src/lib/supabase/rpc.ts
export async function batchAddTags(
  bookmarkIds: string[],
  tagNames: string[],
  options?: { version?: "v1" | "v2"; skipDuplicates?: boolean },
) {
  const version = options?.version || "v1";
  const rpcName = `batch_add_tags_${version}`;

  if (version === "v2") {
    return supabase.rpc(rpcName, {
      bookmark_ids: bookmarkIds,
      tag_names: tagNames,
      options: { skip_duplicates: options?.skipDuplicates },
    });
  }

  return supabase.rpc(rpcName, {
    bookmark_ids: bookmarkIds,
    tag_names: tagNames,
  });
}
```

**验收标准**:

- [ ] 所有 RPC 函数添加 \_v1 后缀
- [ ] 创建兼容性包装函数
- [ ] 客户端支持版本选择
- [ ] 文档更新

---

## Phase 3: 可观测性建设 (Week 7-9)

### 3.1 OpenTelemetry 集成

**优先级**: P1 | **工期**: 5 天 | **风险**: 中

**目标**:

- 分布式追踪
- 性能指标采集
- 日志关联

**架构设计**:

```
┌─────────────────────────────────────────────────────────────┐
│                        AnyKeep                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Next.js   │  │  AI Agent   │  │  Supabase   │          │
│  │   Pages     │  │   Tools     │  │   Client    │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         └────────────────┼────────────────┘                  │
│                          │                                   │
│              ┌───────────▼───────────┐                       │
│              │   OpenTelemetry SDK   │                       │
│              │   (Traces + Metrics)  │                       │
│              └───────────┬───────────┘                       │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │   OTLP Exporter       │
               │   (Jaeger / Grafana)  │
               └───────────────────────┘
```

**实施方案**:

```typescript
// src/lib/telemetry/tracer.ts
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

// 初始化
const provider = new NodeTracerProvider();
const exporter = new OTLPTraceExporter({
  url: process.env.OTLP_ENDPOINT || "http://localhost:4318/v1/traces",
});

provider.addSpanProcessor(new BatchSpanProcessor(exporter));
provider.register();

// 创建 tracer
export const tracer = trace.getTracer("anykeep", "1.0.0");

// 包装函数
export function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      if (attributes) {
        span.setAttributes(attributes);
      }
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

// 使用示例
async function searchBookmarks(query: string) {
  return withSpan(
    "ai.tool.search",
    async () => {
      // 搜索逻辑
    },
    { "search.query": query },
  );
}
```

**AI Agent 集成**:

```typescript
// src/lib/ai-agent/core/agent-executor.ts
import { withSpan, tracer } from "@/lib/telemetry";

export class AgentExecutor {
  async execute(request: AgentRequest): Promise<AgentResponse> {
    return withSpan("ai.agent.execute", async () => {
      const span = trace.getActiveSpan();
      span?.setAttributes({
        "ai.user_id": request.userId,
        "ai.conversation_id": request.conversationId,
        "ai.message_length": request.message.length,
      });

      // 子 span: 上下文构建
      const context = await withSpan("ai.agent.build_context", async () => {
        return this.context.build(request);
      });

      // 子 span: LLM 调用
      const response = await withSpan(
        "ai.agent.llm_call",
        async () => {
          return this.callLLM(context);
        },
        { "ai.model": context.model },
      );

      return response;
    });
  }
}
```

**验收标准**:

- [ ] 核心路径添加追踪 span
- [ ] AI 工具调用可追踪
- [ ] 错误自动关联 span
- [ ] Jaeger/Grafana 可视化

---

### 3.2 性能监控面板

**优先级**: P2 | **工期**: 3 天 | **风险**: 低

**监控指标**:

| 指标类别 | 具体指标     | 告警阈值 |
| -------- | ------------ | -------- |
| API 性能 | P95 延迟     | > 3s     |
| AI Agent | 平均响应时间 | > 15s    |
| 工具调用 | 成功率       | < 95%    |
| 数据库   | 查询耗时     | > 500ms  |
| 内存     | 堆使用率     | > 80%    |

**实施方案**:

```typescript
// src/lib/telemetry/metrics.ts
import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("anykeep");

// API 延迟直方图
export const apiLatencyHistogram = meter.createHistogram("api.latency", {
  description: "API request latency",
  unit: "ms",
});

// AI Agent 响应时间
export const agentResponseTime = meter.createHistogram(
  "ai.agent.response_time",
  {
    description: "AI Agent response time",
    unit: "ms",
  },
);

// 工具调用计数器
export const toolCallCounter = meter.createCounter("ai.tool.calls", {
  description: "Number of tool calls",
});

// 工具调用成功率
export const toolSuccessRate = meter.createObservableGauge(
  "ai.tool.success_rate",
  {
    description: "Tool call success rate",
  },
);

// 使用示例
function recordApiLatency(route: string, duration: number) {
  apiLatencyHistogram.record(duration, { route });
}
```

**验收标准**:

- [ ] 关键指标采集
- [ ] Grafana 仪表盘配置
- [ ] 告警规则配置
- [ ] 周报自动生成

---

### 3.3 告警体系

**优先级**: P2 | **工期**: 2 天 | **风险**: 低

**告警规则**:

```yaml
# alerting-rules.yml
groups:
  - name: anykeep-critical
    rules:
      - alert: HighErrorRate
        expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: AIAgentSlowResponse
        expr: histogram_quantile(0.95, rate(ai_agent_response_time_bucket[5m])) > 30000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "AI Agent response time is high"

      - alert: ToolCallFailure
        expr: rate(ai_tool_calls_total{status="error"}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High tool call failure rate"
```

**通知渠道**:

- Slack (工作时间)
- 邮件 (非紧急)
- PagerDuty (P0 故障)

**验收标准**:

- [ ] 告警规则配置完成
- [ ] 通知渠道配置
- [ ] 告警收敛策略
- [ ] 值班轮转设置

---

## Phase 4: 扩展性优化 (Week 10-12)

### 4.1 API 网关抽象

**优先级**: P2 | **工期**: 4 天 | **风险**: 中

**目标**:

- 统一 API 入口
- 请求/响应转换
- 限流和认证

**设计方案**:

```typescript
// src/lib/api/gateway.ts
export interface ApiGateway {
  use(middleware: Middleware): void;
  handle(request: NextRequest): Promise<NextResponse>;
}

// 中间件链
export interface Middleware {
  name: string;
  handle(
    request: NextRequest,
    next: () => Promise<NextResponse>,
  ): Promise<NextResponse>;
}

// 内置中间件
export const rateLimitMiddleware: Middleware = {
  name: "rate-limit",
  async handle(request, next) {
    const ip = request.ip || "unknown";
    const allowed = await checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );
    }
    return next();
  },
};

export const authMiddleware: Middleware = {
  name: "auth",
  async handle(request, next) {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return next();
  },
};

export const loggingMiddleware: Middleware = {
  name: "logging",
  async handle(request, next) {
    const start = Date.now();
    const response = await next();
    logger.info({
      method: request.method,
      path: request.nextUrl.pathname,
      status: response.status,
      duration: Date.now() - start,
    });
    return response;
  },
};
```

**验收标准**:

- [ ] API 网关抽象层
- [ ] 中间件链机制
- [ ] 统一错误处理
- [ ] 请求日志记录

---

### 4.2 插件化架构

**优先级**: P2 | **工期**: 4 天 | **风险**: 中

**目标**:

- AI 工具可插拔
- 导出格式可扩展
- 第三方集成支持

**设计方案**:

```typescript
// src/lib/plugins/types.ts
export interface Plugin {
  name: string;
  version: string;
  type: "tool" | "exporter" | "integration";

  initialize(context: PluginContext): Promise<void>;
  destroy(): Promise<void>;
}

export interface ToolPlugin extends Plugin {
  type: "tool";
  schema: ToolSchema;
  execute(args: unknown): Promise<ToolResult>;
}

export interface ExporterPlugin extends Plugin {
  type: "exporter";
  format: string;
  export(bookmarks: Bookmark[]): Promise<ExportResult>;
}

// src/lib/plugins/registry.ts
export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();

  async register(plugin: Plugin): Promise<void> {
    await plugin.initialize(this.createContext(plugin));
    this.plugins.set(plugin.name, plugin);
  }

  async unregister(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (plugin) {
      await plugin.destroy();
      this.plugins.delete(name);
    }
  }

  getToolPlugins(): ToolPlugin[] {
    return Array.from(this.plugins.values()).filter(
      (p): p is ToolPlugin => p.type === "tool",
    );
  }
}

// 示例插件
const notionExporterPlugin: ExporterPlugin = {
  name: "notion-exporter",
  version: "1.0.0",
  type: "exporter",
  format: "notion",

  async initialize(context) {
    // 初始化 Notion API 客户端
  },

  async destroy() {
    // 清理资源
  },

  async export(bookmarks) {
    // 导出到 Notion
  },
};
```

**验收标准**:

- [ ] 插件接口定义
- [ ] 插件注册机制
- [ ] 示例插件实现
- [ ] 插件热加载支持

---

### 4.3 边缘部署准备

**优先级**: P3 | **工期**: 2 天 | **风险**: 低

**目标**:

- 评估边缘部署可行性
- 准备 Edge Runtime 兼容代码
- 制定全球加速方案

**评估报告**:

| 模块       | Edge 兼容性 | 改造工作量 |
| ---------- | ----------- | ---------- |
| API Routes | ⚠️ 部分     | 中         |
| AI Agent   | ❌ 不兼容   | 高         |
| Auth       | ✅ 兼容     | 低         |
| 静态资源   | ✅ 兼容     | 无         |

**建议方案**:

```
┌─────────────────────────────────────────────────────────────┐
│                      CDN Edge (Vercel/Cloudflare)           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  静态资源   │  │  认证      │  │  读缓存    │           │
│  │  (全球加速) │  │  (JWT验证) │  │  (KV Store) │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Origin Server (单区域)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  AI Agent   │  │  数据库    │  │  复杂逻辑   │           │
│  │  (DeepSeek) │  │  (Supabase)│  │  (写操作)   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

**验收标准**:

- [ ] Edge 兼容性评估报告
- [ ] 关键路径 Edge 化改造方案
- [ ] 全球加速 PoC

---

## 资源需求

### 人力投入

| 阶段    | 周期 | 所需人力 | 主要角色    |
| ------- | ---- | -------- | ----------- |
| Phase 1 | 3 周 | 1.5 人   | 前端 + 测试 |
| Phase 2 | 3 周 | 1 人     | 全栈        |
| Phase 3 | 3 周 | 1 人     | SRE/DevOps  |
| Phase 4 | 3 周 | 1 人     | 架构师      |

### 工具采购

| 工具                 | 用途     | 预算 (月) |
| -------------------- | -------- | --------- |
| Jaeger/Grafana Cloud | 可观测性 | $50-100   |
| PagerDuty            | 告警     | $20       |
| Playwright Cloud     | E2E 测试 | $50       |

---

## 里程碑

| 里程碑               | 日期    | 交付物                 |
| -------------------- | ------- | ---------------------- |
| M1: 稳定性加固完成   | Week 3  | 错误边界 + 38 E2E 测试 |
| M2: 可维护性提升完成 | Week 6  | Agent 拆分 + 统一缓存  |
| M3: 可观测性上线     | Week 9  | 追踪 + 监控 + 告警     |
| M4: 扩展性优化完成   | Week 12 | API 网关 + 插件系统    |

---

## 风险评估

| 风险                   | 影响 | 概率 | 缓解措施            |
| ---------------------- | ---- | ---- | ------------------- |
| Agent 拆分引入 Bug     | 高   | 中   | 增量拆分 + 充分测试 |
| E2E 测试不稳定         | 中   | 高   | 重试机制 + 隔离环境 |
| OpenTelemetry 性能开销 | 中   | 低   | 采样率控制          |
| 人力不足               | 高   | 中   | 优先级排序 + 分阶段 |

---

**制定人**: Winston | 首席架构师
**审批**: 待 Xiafe 确认
**下次评审**: 2025-01-11 (Phase 1 完成后)
