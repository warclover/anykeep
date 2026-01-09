# OpenTelemetry 集成方案评估

**评估日期**: 2026-01-09
**评估人**: CTO / 架构团队
**状态**: 技术选型阶段

---

## 1. 背景与目标

### 当前痛点

1. **调试困难**: AI 请求失败时无法快速定位问题环节
2. **性能黑盒**: 不知道哪个 Skill/Workflow 步骤耗时最长
3. **成本不透明**: 无法按功能归因 Token 消耗
4. **用户反馈滞后**: 只能通过用户投诉发现问题

### 目标

```
建立端到端的 AI 调用链路追踪能力：
用户请求 → IntentRouter → 模式选择 → Skill/Workflow 执行 → 响应返回
```

---

## 2. 技术方案对比

### 候选方案

| 方案                 | 说明                | 适用场景             |
| -------------------- | ------------------- | -------------------- |
| **A. OpenTelemetry** | CNCF 标准，厂商中立 | 长期战略、多后端支持 |
| **B. Datadog APM**   | SaaS 一体化方案     | 快速上线、预算充足   |
| **C. 自建埋点**      | 自定义日志 + 分析   | 简单需求、成本敏感   |
| **D. Sentry**        | 错误追踪为主        | 错误监控、小团队     |

### 详细对比

| 维度             | OpenTelemetry | Datadog              | 自建埋点  | Sentry |
| ---------------- | ------------- | -------------------- | --------- | ------ |
| **初始成本**     | 低（开源）    | 高（订阅）           | 低        | 中     |
| **运维成本**     | 中            | 低                   | 高        | 低     |
| **学习曲线**     | 中            | 低                   | 低        | 低     |
| **功能完整度**   | 高            | 很高                 | 低        | 中     |
| **扩展性**       | 很高          | 高                   | 高        | 中     |
| **厂商锁定**     | 无            | 高                   | 无        | 中     |
| **社区生态**     | 活跃          | 商业支持             | 无        | 活跃   |
| **Next.js 支持** | ✅ 官方       | ✅                   | ✅        | ✅     |
| **AI/LLM 追踪**  | ✅ 有扩展     | ✅ LLM Observability | ❌ 需自建 | ❌     |

### 推荐方案: OpenTelemetry

**理由**:

1. **厂商中立**: 避免锁定，可灵活切换后端
2. **标准化**: CNCF 毕业项目，生态完善
3. **Next.js 官方支持**: `@vercel/otel` 零配置集成
4. **AI 追踪扩展**: OpenLLMetry 专门支持 LLM 调用追踪
5. **成本可控**: 可选择自托管后端（Jaeger/Tempo）

---

## 3. OpenTelemetry 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        AnyKeep 应用                              │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Next.js     │  │ AI Agent    │  │ Supabase    │             │
│  │ API Routes  │  │ Engine      │  │ Client      │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          │                                      │
│                   ┌──────▼──────┐                               │
│                   │ OTel SDK    │                               │
│                   │ + Exporter  │                               │
│                   └──────┬──────┘                               │
└──────────────────────────┼──────────────────────────────────────┘
                           │ OTLP (gRPC/HTTP)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                   OpenTelemetry Collector                        │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │ Receivers  │→ │ Processors │→ │ Exporters  │                │
│  │ (OTLP)     │  │ (Batch,    │  │ (Multiple) │                │
│  │            │  │  Filter)   │  │            │                │
│  └────────────┘  └────────────┘  └────────────┘                │
│                                        │                        │
│            ┌───────────────────────────┼───────────────┐       │
│            ▼                           ▼               ▼        │
│      ┌─────────┐               ┌─────────────┐  ┌──────────┐   │
│      │ Jaeger  │               │ Prometheus  │  │ Loki     │   │
│      │ (Traces)│               │  (Metrics)  │  │ (Logs)   │   │
│      └─────────┘               └─────────────┘  └──────────┘   │
└──────────────────────────────────────────────────────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Grafana   │
                    │  Dashboard  │
                    └─────────────┘
```

### 追踪维度设计

#### Span 层级结构

```
[Root Span] POST /api/agent/unified
    │
    ├── [Span] IntentRouter.route
    │       ├── [Span] IntentClassifier.classify
    │       ├── [Span] ComplexityEvaluator.evaluate
    │       └── [Span] ModeSelector.select
    │
    ├── [Span] UnifiedEngine.execute
    │       │
    │       └── (If Workflow Mode)
    │           [Span] WorkflowEngine.execute
    │               ├── [Span] Step: check_links
    │               │       └── [Span] Skill: link_health_check
    │               │               └── [Span] LLM Call (DeepSeek)
    │               └── [Span] Step: detect_duplicates
    │                       └── [Span] Skill: duplicate_cleanup
    │
    │       └── (If Skill Mode)
    │           [Span] OrchestrationEngine.execute
    │               ├── [Span] Skill Step 1
    │               ├── [Span] Skill Step 2
    │               └── [Span] Skill Step 3
    │
    │       └── (If Tool Mode)
    │           [Span] KnowledgeAgent.execute
    │               └── [Span] Tool: semantic_search
    │
    └── [Span] Response.stream
```

#### 关键属性 (Attributes)

```typescript
// 请求级别
{
  "ai.request.id": "req_abc123",
  "ai.intent.type": "search",
  "ai.intent.subtype": "semantic",
  "ai.intent.confidence": 0.92,
  "ai.mode": "skill",
  "ai.skill.id": "semantic_search",
  "ai.workflow.id": "bookmark_health",
  "user.id": "user_xyz",
}

// LLM 调用级别
{
  "llm.provider": "deepseek",
  "llm.model": "deepseek-chat",
  "llm.tier": "standard",
  "llm.tokens.prompt": 1200,
  "llm.tokens.completion": 350,
  "llm.tokens.total": 1550,
  "llm.cost.usd": 0.0023,
  "llm.latency.ms": 1850,
}

// 错误级别
{
  "error": true,
  "error.type": "LLMTimeoutError",
  "error.message": "Request timeout after 30s",
  "error.retry.count": 2,
}
```

---

## 4. 实施方案

### Phase 1: 基础集成 (Week 1-2)

#### 4.1.1 安装依赖

```bash
npm install @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/exporter-metrics-otlp-http \
  @vercel/otel
```

#### 4.1.2 初始化配置

```typescript
// src/lib/telemetry/otel-config.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "anykeep-ai",
    [SemanticResourceAttributes.SERVICE_VERSION]:
      process.env.APP_VERSION || "1.0.0",
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV,
  }),
  traceExporter: new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      "http://localhost:4318/v1/traces",
  }),
  metricExporter: new OTLPMetricExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      "http://localhost:4318/v1/metrics",
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

sdk.start();

process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .then(() => console.log("OTel SDK shut down"))
    .catch((error) => console.error("Error shutting down OTel SDK", error))
    .finally(() => process.exit(0));
});
```

#### 4.1.3 Next.js 集成

```typescript
// instrumentation.ts (Next.js 14+ 根目录)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./src/lib/telemetry/otel-config");
  }
}
```

```typescript
// next.config.js
module.exports = {
  experimental: {
    instrumentationHook: true,
  },
};
```

### Phase 2: AI 调用链追踪 (Week 3)

#### 4.2.1 UnifiedEngine 追踪

```typescript
// src/lib/ai-skills/engine/unified-engine.ts
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("anykeep-ai", "1.0.0");

export class UnifiedEngine {
  async execute(
    request: UnifiedRequest,
  ): Promise<AsyncGenerator<UnifiedStreamChunk>> {
    return tracer.startActiveSpan(
      "UnifiedEngine.execute",
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          "ai.request.id": request.requestId,
          "user.id": request.userId,
          "ai.message": request.message.substring(0, 100), // 截断敏感信息
        },
      },
      async (span) => {
        try {
          // 意图路由
          const routeResult = await tracer.startActiveSpan(
            "IntentRouter.route",
            async (routeSpan) => {
              const result = await this.intentRouter.route(request);
              routeSpan.setAttributes({
                "ai.intent.type": result.intent.type,
                "ai.intent.confidence": result.confidence,
                "ai.mode": result.mode,
              });
              routeSpan.end();
              return result;
            },
          );

          span.setAttributes({
            "ai.mode": routeResult.mode,
            "ai.skill.id": routeResult.skillId || "",
            "ai.workflow.id": routeResult.workflowId || "",
          });

          // 执行
          const result = await this.executeMode(routeResult);

          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : "Unknown error",
          });
          span.recordException(error as Error);
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }
}
```

#### 4.2.2 LLM 调用追踪

```typescript
// src/lib/ai-agent/llm/traced-llm-client.ts
import { trace, SpanKind } from "@opentelemetry/api";

const tracer = trace.getTracer("anykeep-llm", "1.0.0");

export class TracedLLMClient {
  async chat(params: ChatParams): Promise<ChatResponse> {
    return tracer.startActiveSpan(
      "LLM.chat",
      {
        kind: SpanKind.CLIENT,
        attributes: {
          "llm.provider": params.provider,
          "llm.model": params.model,
          "llm.tier": params.tier,
          "llm.tokens.max": params.maxTokens,
        },
      },
      async (span) => {
        const startTime = Date.now();

        try {
          const response = await this.innerClient.chat(params);

          span.setAttributes({
            "llm.tokens.prompt": response.usage.promptTokens,
            "llm.tokens.completion": response.usage.completionTokens,
            "llm.tokens.total": response.usage.totalTokens,
            "llm.latency.ms": Date.now() - startTime,
            "llm.finish_reason": response.finishReason,
          });

          return response;
        } catch (error) {
          span.setAttributes({
            "llm.error": true,
            "llm.error.type": error.constructor.name,
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }
}
```

### Phase 3: 仪表盘与告警 (Week 4)

#### 4.3.1 Docker Compose 部署

```yaml
# docker-compose.otel.yml
version: "3.8"

services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ["--config=/etc/otel-config.yaml"]
    volumes:
      - ./otel-config.yaml:/etc/otel-config.yaml
    ports:
      - "4317:4317" # OTLP gRPC
      - "4318:4318" # OTLP HTTP
      - "8888:8888" # Prometheus metrics

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686" # UI
      - "14268:14268" # Collector HTTP

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    volumes:
      - grafana-storage:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

volumes:
  grafana-storage:
```

#### 4.3.2 Collector 配置

```yaml
# otel-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024

  filter:
    spans:
      exclude:
        match_type: regexp
        span_names:
          - "health_check.*"

exporters:
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true

  prometheus:
    endpoint: "0.0.0.0:8889"
    namespace: anykeep

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, filter]
      exporters: [jaeger]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus]
```

---

## 5. 性能影响评估

### 预期开销

| 维度     | 预期影响     | 缓解措施           |
| -------- | ------------ | ------------------ |
| **延迟** | +2-5ms/请求  | 异步上报、采样     |
| **内存** | +50-100MB    | 批量处理、限制缓冲 |
| **CPU**  | +1-3%        | 采样率控制         |
| **网络** | +5-10KB/请求 | 压缩、批量         |

### 采样策略

```typescript
// 开发环境: 100% 采样
// 生产环境: 智能采样
const sampler = new ParentBasedSampler({
  root: new TraceIdRatioBasedSampler(0.1), // 10% 随机采样
  remoteParentSampled: new AlwaysOnSampler(),
  remoteParentNotSampled: new AlwaysOffSampler(),
});

// 高优先级请求始终采样
// - 错误请求
// - 慢请求 (>5s)
// - 特定 Skill/Workflow
```

---

## 6. 成本估算

### 自托管方案

| 组件           | 规格            | 月成本 (USD) |
| -------------- | --------------- | ------------ |
| OTel Collector | 2 vCPU, 4GB RAM | ~$30         |
| Jaeger         | 2 vCPU, 8GB RAM | ~$50         |
| Prometheus     | 2 vCPU, 8GB RAM | ~$50         |
| Grafana        | 1 vCPU, 2GB RAM | ~$15         |
| **总计**       |                 | **~$145/月** |

### SaaS 方案对比

| 方案               | 月成本   | 说明                 |
| ------------------ | -------- | -------------------- |
| Grafana Cloud Free | $0       | 10K spans/月，有限制 |
| Grafana Cloud Pro  | $49+     | 50K spans/月起       |
| Datadog APM        | $31/host | 功能全面             |
| New Relic          | $0-$99   | 100GB/月免费         |

**建议**: 初期使用 Grafana Cloud Free 或自托管，验证价值后再升级。

---

## 7. 风险与缓解

| 风险           | 概率 | 影响 | 缓解措施                |
| -------------- | ---- | ---- | ----------------------- |
| 性能开销超预期 | 低   | 中   | 采样率调整、异步化      |
| 敏感数据泄露   | 中   | 高   | 属性过滤、数据脱敏      |
| 运维复杂度增加 | 中   | 中   | Docker Compose 一键部署 |
| 告警疲劳       | 中   | 低   | 渐进式告警配置          |

---

## 8. 决策与下一步

### 决策

✅ **采用 OpenTelemetry 作为可观测性标准**

**理由**:

1. 厂商中立，长期战略正确
2. Next.js 官方支持，集成简单
3. 成本可控，可选自托管或 SaaS
4. 社区生态完善，AI/LLM 扩展可用

### 下一步行动

| 序号 | 行动                            | 负责人 | 截止日期   |
| ---- | ------------------------------- | ------ | ---------- |
| 1    | 安装 OTel 依赖并完成基础配置    | 后端   | 2026-01-15 |
| 2    | 搭建开发环境 Collector + Jaeger | DevOps | 2026-01-17 |
| 3    | 集成 UnifiedEngine 追踪         | 后端   | 2026-01-22 |
| 4    | 搭建 Grafana 仪表盘 MVP         | 全栈   | 2026-01-29 |

---

## 参考资料

- [OpenTelemetry 官方文档](https://opentelemetry.io/docs/)
- [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
- [@vercel/otel](https://www.npmjs.com/package/@vercel/otel)
- [OpenLLMetry - LLM 追踪](https://github.com/traceloop/openllmetry)
- [Grafana Tempo 文档](https://grafana.com/docs/tempo/latest/)

---

## 变更记录

| 日期       | 版本 | 变更     |
| ---------- | ---- | -------- |
| 2026-01-09 | 1.0  | 初始版本 |
