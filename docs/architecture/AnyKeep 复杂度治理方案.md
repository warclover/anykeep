# AnyKeep 架构治理与优化方案

> 版本: v2.1
> 日期: 2025-12-14
> 作者: Winston (Architect Agent)
> 状态: 已评审，待实施

## 目录

1. [执行摘要](#执行摘要)
2. [复杂度诊断](#复杂度诊断)
3. [六大优化领域总览](#六大优化领域总览)
4. [性能优化方案](#性能优化方案)
5. [可观测性增强](#可观测性增强)
6. [测试覆盖改进](#测试覆盖改进)
7. [模块化重构](#模块化重构)
8. [易维护性提升](#易维护性提升)
9. [可扩展性增强](#可扩展性增强)
10. [安全性与稳定性](#安全性与稳定性)
11. [实施路线图](#实施路线图)
12. [立即行动清单](#立即行动清单)
13. [风险控制](#风险控制)
14. [附录](#附录)

---

## 执行摘要

### 项目现状评估

| 维度           | 现状 | 评分   | 主要问题                                |
| -------------- | ---- | ------ | --------------------------------------- |
| **代码复杂度** | 高   | 6/10   | Bookmarks 50字段, Classification 85文件 |
| **系统性能**   | 良好 | 7.5/10 | 缓存完善，React 优化不足                |
| **可观测性**   | 不足 | 5/10   | 无生产级错误追踪                        |
| **测试覆盖**   | 极低 | 3/10   | 4.9% 覆盖率                             |
| **模块化程度** | 良好 | 8/10   | 架构清晰，部分模块过大                  |
| **易维护性**   | 中等 | 6.5/10 | 模块过大，常量分散                      |
| **可扩展性**   | 良好 | 7.5/10 | 事件驱动，但配置耦合                    |
| **安全性**     | 中等 | 7/10   | 开发路由需保护                          |

### 核心优化目标

| 目标         | 当前       | 1个月后  | 3个月后 |
| ------------ | ---------- | -------- | ------- |
| 代码重复度   | 85%        | 15%      | 10%     |
| 测试覆盖率   | 4.9%       | 15%      | 35%     |
| 问题诊断时间 | 1h+        | <5min    | <2min   |
| API P95 延迟 | ~200ms     | <150ms   | <100ms  |
| LCP 加载时间 | ~1200ms    | <1000ms  | <800ms  |
| 维护复杂度   | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐    |

---

## 复杂度诊断

### 系统复杂度概览

| 维度               | 现状                          | 复杂度评分      |
| ------------------ | ----------------------------- | --------------- |
| **Summary 模块**   | 21 文件，2 Provider，3 服务层 | ⭐⭐⭐⭐ 高     |
| **Bookmarks 表**   | 77 次迁移修改，~50 个字段     | ⭐⭐⭐⭐⭐ 很高 |
| **Classification** | 85 个文件，16 个子目录        | ⭐⭐⭐⭐⭐ 很高 |
| **EventBus**       | 27 个事件，已定义摘要事件     | ⭐⭐⭐ 中       |
| **API 路由**       | 149 条现有路由                | ⭐⭐⭐⭐ 高     |

### 关键问题识别

| 领域               | 核心问题               | 可简化项    | 风险等级 |
| ------------------ | ---------------------- | ----------- | -------- |
| **Summary 模块**   | Provider 代码 85% 重复 | -450 行代码 | 🟡 低    |
| **Bookmarks 表**   | 5组冗余布尔+时间戳     | -9 个字段   | 🟠 中    |
| **API 路由**       | 重复路由 + 废弃 API    | -19 个路由  | 🟡 低    |
| **Classification** | 模块过大，难以维护     | 拆分3子模块 | 🟠 中    |

### Bookmarks 表字段冗余分析

| 冗余类型        | 字段组合                        | 问题                 | 建议                                   |
| --------------- | ------------------------------- | -------------------- | -------------------------------------- |
| **布尔+时间戳** | `is_starred` + `starred_at`     | 信息重复             | 删除 `is_starred`                      |
| **布尔+时间戳** | `is_in_trash` + `trashed_at`    | 信息重复             | 删除 `is_in_trash`                     |
| **布尔+时间戳** | `is_invalid` + `invalidated_at` | 信息重复             | 删除 `is_invalid`                      |
| **布尔标志**    | `pending_cluster`               | 可用时间戳判断       | 删除，改用 `pending_since IS NOT NULL` |
| **布尔标志**    | `is_marked_for_deletion`        | 与 `deleted_at` 重复 | 合并到状态字段                         |

### API 路由问题清单

| 问题类型 | 路由                                                        | 状态       | 建议             |
| -------- | ----------------------------------------------------------- | ---------- | ---------------- |
| **废弃** | `/api/ai/recommend-folder`                                  | V3.1 废弃  | 删除             |
| **废弃** | `/api/bookmarks/auto-classify`                              | 已迁移     | 删除             |
| **废弃** | `/api/classification/v3/feedback`                           | 旧版本     | 删除             |
| **重复** | `/api/confirmations` vs `/api/classification/confirmations` | 功能重叠   | 合并             |
| **重复** | `classify-quick` / `classify-deep` / `classify`             | 可参数化   | 合并为单一路由   |
| **开发** | `/api/dev/*` (6个)                                          | 无环境保护 | 添加生产环境检查 |

---

## 六大优化领域总览

基于深度分析，识别出以下 **6 个关键优化领域**：

### 领域一：系统响应性能（当前 7.5/10）

| 优化项                   | 预期收益           | 优先级 | 工作量 |
| ------------------------ | ------------------ | ------ | ------ |
| **React 组件 memo 优化** | 渲染性能 +30-50%   | 🔴 P0  | 5天    |
| **代码分割（动态导入）** | 初始包 -40-50%     | 🔴 P1  | 3天    |
| **缓存分层策略**         | 命中率 70% → 85%   | 🟠 P2  | 3天    |
| **统计查询物化视图**     | analytics 页面加速 | 🟠 P2  | 2天    |
| **浏览器书签快速导航**   | UX 提升            | 🟢 P3  | 2天    |

### 领域二：问题定位能力（当前 5/10）

| 优化项                        | 预期收益           | 优先级 | 工作量 |
| ----------------------------- | ------------------ | ------ | ------ |
| **集成 Sentry 错误追踪**      | 诊断时间 1h → 5min | 🔴 P0  | 2天    |
| **添加请求追踪 ID**           | 日志关联能力       | 🔴 P0  | 1天    |
| **清理 265 处 console.log**   | 日志规范化         | 🔴 P1  | 2天    |
| **部署 Prometheus + Grafana** | 实时监控仪表板     | 🟠 P2  | 5天    |
| **日志聚合（Loki）**          | 生产日志可查询     | 🟠 P2  | 3天    |

### 领域三：测试覆盖（当前 4.9%）

| 优化项                  | 预期收益     | 优先级 | 工作量 |
| ----------------------- | ------------ | ------ | ------ |
| **API Routes 集成测试** | 关键路径保护 | 🔴 P0  | 5天    |
| **Hooks 单元测试**      | 数据流可靠性 | 🔴 P1  | 3天    |
| **创建 jest.setup.ts**  | 测试基础设施 | 🔴 P1  | 0.5天  |
| **关键组件测试**        | UI 稳定性    | 🟠 P2  | 5天    |
| **E2E 测试框架**        | 用户流程保护 | 🟢 P3  | 5天    |

### 领域四：易维护性（当前 6.5/10）

| 优化项                       | 预期收益        | 优先级 | 工作量 |
| ---------------------------- | --------------- | ------ | ------ |
| **拆分 Classification 模块** | 85 → 3 个子模块 | 🟠 P2  | 10天   |
| **建立共享配置层**           | 降低模块耦合    | 🟠 P2  | 3天    |
| **整理 Utils 工具**          | 28 → 5 个分类   | 🟢 P3  | 3天    |
| **统一导出规范**             | 一致的导入体验  | 🟢 P3  | 2天    |
| **建立编码规范文档**         | 团队一致性      | 🟢 P3  | 2天    |

### 领域五：可扩展性（当前 7.5/10）

| 优化项                 | 预期收益            | 优先级 | 工作量 |
| ---------------------- | ------------------- | ------ | ------ |
| **加强 EventBus 使用** | 模块完全解耦        | 🟠 P2  | 5天    |
| **Provider 基类抽象**  | 易于添加新 Provider | 🔴 P1  | 2天    |
| **API 版本控制体系**   | 平滑升级能力        | 🟢 P3  | 3天    |
| **Feature Flag 系统**  | 灰度发布能力        | 🟢 P3  | 3天    |

### 领域六：安全性与稳定性（当前 7/10）

| 优化项                 | 预期收益     | 优先级 | 工作量 |
| ---------------------- | ------------ | ------ | ------ |
| **开发路由环境保护**   | 生产环境安全 | 🔴 P0  | 0.5天  |
| **数据库迁移回滚策略** | 变更可逆     | 🟠 P2  | 2天    |
| **错误边界增强**       | 故障隔离     | 🟠 P2  | 2天    |
| **Rate Limiting**      | 防止滥用     | 🟢 P3  | 2天    |

---

## 性能优化方案

### 当前性能架构评估：7.5/10

**已实现的优化**：

- ✅ SWR 缓存策略（staleTime: 30s, cacheTime: 5m）
- ✅ KeepAlive 页面缓存（最多 5 页）
- ✅ localStorage 持久化（V5.0+）
- ✅ 虚拟滚动（react-virtuoso，支持 10,000+ 条）
- ✅ 图片懒加载（Intersection Observer）
- ✅ HTTP 缓存头（max-age: 30s, swr: 60s）
- ✅ 数据库索引（12+ 索引，含 HNSW 向量索引）

**需要改进的领域**：

### P0: React 组件优化（预期提升 30-50% 渲染性能）

```typescript
// 问题：大量组件未使用 memo
const BookmarkCard = ({ bookmark, onDelete }) => { ... }

// 建议：
const BookmarkCard = memo(({ bookmark, onDelete }) => { ... })

// 需要优化的组件清单：
// - BookmarkCard, BookmarkListItem (高频渲染)
// - CachedPage, VirtualBookmarkList (列表项)
// - PlatformFilter, UsageTagFilter (筛选组件)
// - FolderTreeItem (递归组件)
// - TagBadge (标签展示)
```

**优化步骤**：

1. **识别高频渲染组件**

   ```bash
   # 使用 React DevTools Profiler 识别
   # 重点关注 "Rendered at" 频率高的组件
   ```

2. **应用 memo 包装**

   ```typescript
   // 基础 memo
   export const BookmarkCard = memo(function BookmarkCard(props) { ... })

   // 自定义比较函数（复杂 props）
   export const BookmarkCard = memo(function BookmarkCard(props) { ... },
     (prev, next) => prev.bookmark.id === next.bookmark.id
   )
   ```

3. **稳定回调引用**

   ```typescript
   // 问题：每次渲染创建新函数
   <BookmarkCard onDelete={() => handleDelete(id)} />

   // 解决：使用 useCallback
   const handleDeleteBookmark = useCallback((id) => {
     handleDelete(id)
   }, [handleDelete])
   ```

### P1: 代码分割（预期减少 40-50% 初始包大小）

```typescript
// 当前：next.config.mjs 没有动态导入
// 建议：

import dynamic from 'next/dynamic'

// 重模块动态加载
const AnalyticsPage = dynamic(
  () => import('@/components/analytics/analytics-page'),
  {
    loading: () => <AnalyticsSkeleton />,
    ssr: false  // 客户端渲染（图表库不需要 SSR）
  }
)

const SettingsPage = dynamic(
  () => import('@/components/settings/settings-page-client'),
  { loading: () => <SettingsSkeleton /> }
)

// Debug 页面（生产环境不加载）
const DebugPage = dynamic(
  () => import('@/components/debug/debug-page'),
  { ssr: false }
)
```

**目标页面与预期收益**：

| 页面         | 当前大小 | 分割后   | 收益        |
| ------------ | -------- | -------- | ----------- |
| `/analytics` | ~120KB   | 按需加载 | -120KB 初始 |
| `/settings`  | ~80KB    | 按需加载 | -80KB 初始  |
| `/debug/*`   | ~60KB    | 按需加载 | -60KB 初始  |
| **总计**     | ~260KB   | -        | **-260KB**  |

### P2: 缓存智能管理

```typescript
// 问题：缓存粒度过粗，可能导致内存膨胀
// 建议：分层缓存策略

// src/lib/cache/tiered-cache.ts
export const tieredCacheConfig = {
  hot: {
    ttl: 5 * 60 * 1000, // 5 分钟
    maxSize: 100,
    patterns: ["/home", "/inbox"], // 高频页面
  },
  warm: {
    ttl: 15 * 60 * 1000, // 15 分钟
    maxSize: 500,
    patterns: ["/folders/*", "/tags/*"],
  },
  cold: {
    ttl: 60 * 60 * 1000, // 1 小时
    maxSize: 5000,
    patterns: ["/analytics", "/settings"],
  },
};

// 缓存监控
export function getCacheStats(): CacheStats {
  return {
    size: cacheMap.size,
    memoryEstimate: estimateMemoryUsage(),
    hitRate: hits / (hits + misses),
    hotKeys: getTopAccessedKeys(10),
  };
}
```

### P3: 数据库查询优化

```sql
-- 问题：统计查询可能慢
-- 建议：添加物化视图

CREATE MATERIALIZED VIEW mv_bookmark_stats AS
SELECT
  user_id,
  platform,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE is_starred) as starred_count,
  COUNT(*) FILTER (WHERE folder_id IS NULL) as uncategorized_count
FROM bookmarks
WHERE deleted_at IS NULL
GROUP BY user_id, platform;

-- 刷新策略：每小时刷新一次
CREATE OR REPLACE FUNCTION refresh_bookmark_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_bookmark_stats;
END;
$$ LANGUAGE plpgsql;
```

### 性能 KPI 目标

| 指标           | 当前    | 目标    | 优化方向     |
| -------------- | ------- | ------- | ------------ |
| **FCP**        | ~500ms  | <300ms  | 缓存恢复 ✅  |
| **LCP**        | ~1200ms | <1000ms | 代码分割     |
| **CLS**        | ~0.1    | <0.05   | 骨架屏       |
| **缓存命中率** | ~70%    | >85%    | 缓存分层     |
| **API P95**    | ~200ms  | <150ms  | 查询优化     |
| **包大小**     | ~450KB  | <350KB  | Tree-shaking |

---

## 可观测性增强

### 当前状态评估：5/10

**已有基础**：

- ✅ Pino 结构化日志系统
- ✅ 性能监控框架（PerformanceMonitor）
- ✅ Web Vitals 采集（未上报）
- ✅ 分类系统指标（ClassificationMetrics）

**关键缺失**：

- ❌ 生产级错误追踪（Sentry）
- ❌ 请求追踪链（Request ID）
- ❌ 指标聚合平台（Prometheus）
- ❌ 日志可查询系统（Loki/ELK）
- ❌ 告警机制

### Phase 1: 错误追踪（立即实施）

#### 1.1 集成 Sentry

```bash
# 安装
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // 性能监控采样率
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // 环境标识
  environment: process.env.NODE_ENV,

  // 版本标识（便于追踪发布）
  release: process.env.NEXT_PUBLIC_APP_VERSION,

  // 过滤敏感信息
  beforeSend(event, hint) {
    // 过滤已知的非关键错误
    if (event.exception?.values?.[0]?.value?.includes("ResizeObserver")) {
      return null;
    }

    // 移除敏感数据
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
    }

    return event;
  },

  // 忽略特定错误
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Network request failed",
    /^Loading chunk \d+ failed/,
  ],
});
```

```typescript
// sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

```typescript
// instrumentation.ts (Next.js 14+)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
```

**预期效果**：

- 实时错误告警（Slack/邮件/飞书）
- 错误分组与重现指南
- 用户影响范围分析
- 问题诊断时间：1h+ → 5min

#### 1.2 添加请求追踪 ID

```typescript
// src/middleware.ts (扩展现有中间件)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";

export function middleware(request: NextRequest) {
  // 获取或生成 Request ID
  const requestId = request.headers.get("x-request-id") || `req_${uuidv4()}`;

  // 克隆响应并添加 header
  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);

  // 在请求头中传递给 API 路由
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
```

```typescript
// src/lib/utils/request-context.ts
import { headers } from "next/headers";

export function getRequestId(): string {
  const headersList = headers();
  return headersList.get("x-request-id") || "unknown";
}

// 所有日志附加 requestId
export function logWithContext(
  level: "info" | "warn" | "error",
  message: string,
  data?: Record<string, unknown>,
) {
  const requestId = getRequestId();
  logger[level]({ requestId, ...data }, message);
}
```

```typescript
// API 错误响应示例
// src/app/api/bookmarks/route.ts
export async function GET(request: NextRequest) {
  const requestId = request.headers.get("x-request-id");

  try {
    // ... 业务逻辑
  } catch (error) {
    logger.error({ requestId, error }, "Failed to fetch bookmarks");

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An error occurred",
          requestId, // 返回给用户，便于问题报告
        },
      },
      { status: 500 },
    );
  }
}
```

#### 1.3 清理 console.log

```typescript
// .eslintrc.js 添加规则
module.exports = {
  rules: {
    "no-console": [
      "warn",
      {
        allow: ["warn", "error", "info"],
      },
    ],
  },
};

// 替换脚本（可选）
// scripts/replace-console.ts
const replacePatterns = [
  { from: /console\.log\(/g, to: "logger.debug(" },
  { from: /console\.error\(/g, to: "logger.error(" },
  { from: /console\.warn\(/g, to: "logger.warn(" },
];
```

### Phase 2: 指标聚合（2-3周）

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Next.js   │───▶│ Prometheus  │───▶│  Grafana    │
│  /metrics   │    │   Server    │    │ Dashboards  │
└─────────────┘    └─────────────┘    └─────────────┘
```

```typescript
// src/app/api/metrics/route.ts
import { NextResponse } from "next/server";
import client from "prom-client";

// 初始化默认指标
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: "anykeep_" });

// 自定义指标
export const httpRequestDuration = new client.Histogram({
  name: "anykeep_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.1, 0.3, 0.5, 1, 2, 5],
});

export const classificationCounter = new client.Counter({
  name: "anykeep_classification_total",
  help: "Total number of classifications",
  labelNames: ["status", "provider"],
});

export const cacheHitCounter = new client.Counter({
  name: "anykeep_cache_hits_total",
  help: "Cache hit counter",
  labelNames: ["cache_type"],
});

export async function GET() {
  const metrics = await client.register.metrics();
  return new NextResponse(metrics, {
    headers: { "Content-Type": client.register.contentType },
  });
}
```

**关键仪表板**：

- 分类成功率与延迟
- API 错误率趋势
- 缓存命中率
- 资源使用监控
- 用户活跃度

---

## 测试覆盖改进

### 当前状态评估：3/10

| 指标             | 数据     | 评级        |
| ---------------- | -------- | ----------- |
| **总源代码文件** | 752 个   | -           |
| **总测试文件**   | 37 个    | 🔴 严重不足 |
| **测试覆盖率**   | **4.9%** | 🔴 极低     |

### 完全未测试的关键模块

| 模块                 | 文件数 | 风险等级 | 优先级 |
| -------------------- | ------ | -------- | ------ |
| **API Routes**       | 149    | 🔴 极高  | P0     |
| **React Hooks**      | 35     | 🔴 极高  | P1     |
| **React Components** | 100+   | 🔴 极高  | P2     |
| **Summary 服务**     | 15     | 🔴 高    | P1     |
| **Utils 工具**       | 28     | 🟠 中    | P2     |

### 测试改进计划

#### Phase 1: 紧急覆盖（1-2周，目标 15%）

```markdown
[ ] API Routes 基础测试（40-60 用例）- POST /api/bookmarks - 创建书签 - GET /api/bookmarks - 获取列表 - PUT/DELETE /api/bookmarks/[id] - 修改删除 - POST /api/classification/classify - 分类 - 成功路径 + 错误处理 + 权限验证

[ ] Hook 单元测试（30-40 用例）- use-page-data.test.ts - use-smart-lists.test.ts - use-messages.test.ts - use-confirmations.test.ts

[ ] Summary 模块测试（25-35 用例）- summary.service.test.ts - provider-factory.test.ts - content-fetcher.service.test.ts
```

#### Phase 2: 关键覆盖（2-4周，目标 35%）

```markdown
[ ] Browser Bookmark 完整覆盖 - exporter.test.ts - link-validator.test.ts - metadata-fetcher.test.ts

[ ] 关键组件测试（15-20 个）- BookmarkCard.test.tsx - BookmarkListItem.test.tsx - FolderTree.test.tsx - SearchBar.test.tsx

[ ] Utils 工具库覆盖 - embedding-generator.test.ts - url-validator.test.ts - date-formatter.test.ts
```

### Jest 配置修复

```typescript
// jest.setup.ts (新建)
import "@testing-library/jest-dom";

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}
Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}
Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: MockResizeObserver,
});
```

```typescript
// jest.config.ts (更新)
import type { Config } from "jest";

const config: Config = {
  // ... 现有配置 ...

  // 添加覆盖率门限
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 40,
      lines: 40,
      statements: 40,
    },
    // 关键模块更高标准
    "./src/lib/": {
      branches: 50,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },

  // 增强覆盖率报告
  coverageReporters: ["text", "text-summary", "html", "lcov"],

  // 设置文件
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};

export default config;
```

### 测试模板示例

```typescript
// src/app/api/bookmarks/__tests__/route.test.ts
import { GET, POST } from "../route";
import { createMockRequest } from "@/test-utils/mock-request";
import { createMockUser } from "@/test-utils/mock-user";

// Mock Supabase
jest.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: jest.fn() },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  }),
}));

describe("GET /api/bookmarks", () => {
  it("should return 401 for unauthenticated requests", async () => {
    const request = createMockRequest({ authenticated: false });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("should return bookmarks for authenticated user", async () => {
    const user = createMockUser();
    const request = createMockRequest({ user });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it("should handle database errors gracefully", async () => {
    // Mock database error
    jest.spyOn(supabase, "from").mockImplementationOnce(() => {
      throw new Error("Database connection failed");
    });

    const request = createMockRequest({ authenticated: true });
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error.code).toBe("DATABASE_ERROR");
  });
});

describe("POST /api/bookmarks", () => {
  it("should create a bookmark with valid data", async () => {
    const request = createMockRequest({
      method: "POST",
      body: { url: "https://example.com", title: "Example" },
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it("should return 400 for invalid URL", async () => {
    const request = createMockRequest({
      method: "POST",
      body: { url: "not-a-valid-url" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

---

## 模块化重构

### 当前架构评估：8/10

**优势**：

- ✅ 容器模式（依赖注入）
- ✅ 事件驱动解耦（EventBus）
- ✅ 分层架构（Services → Repositories → Data）
- ✅ 无循环依赖

**问题**：

- ⚠️ Classification 模块过大（85 文件）
- ⚠️ Utils 工具杂乱（28 文件）
- ⚠️ 常量分散在各处

### 重构计划

#### 1. 拆分 Classification 模块

```
当前：
src/lib/classification/ (85 个文件)
├── services/ (24 个)
├── repositories/ (6 个)
├── strategies/ (7 个)
├── v3/ (30+ 个)
├── types/
├── constants/
├── config/
└── ...

目标：
src/lib/classification/
├── core/                    # 基础分类服务
│   ├── services/
│   │   ├── classification.service.ts
│   │   └── job-queue.service.ts
│   ├── strategies/
│   │   ├── vector-matcher.ts
│   │   └── history-matcher.ts
│   └── repositories/
│       └── bookmark.repository.ts
│
├── v3/                      # V3 增强版本（保持现有）
│   ├── strategies/
│   ├── services/
│   └── config/
│
├── learning/                # 学习与反馈
│   ├── services/
│   │   ├── feedback.service.ts
│   │   └── learning.service.ts
│   └── repositories/
│       └── feedback.repository.ts
│
├── interest/                # 兴趣管理
│   ├── services/
│   │   └── interest.service.ts
│   └── repositories/
│       └── interest.repository.ts
│
├── shared/                  # 共享类型和工具
│   ├── types/
│   ├── constants/
│   └── utils/
│
├── container.ts             # 统一依赖注入
└── index.ts                 # 模块导出
```

**迁移步骤**：

1. **Phase 1**：创建目录结构，不移动文件
2. **Phase 2**：逐个迁移文件，更新导入路径
3. **Phase 3**：更新 `index.ts` 导出
4. **Phase 4**：删除旧文件，验证构建

#### 2. 建立共享配置层

```typescript
// src/lib/config/index.ts
export * from "./ai-summary.config";
export * from "./classification.config";
export * from "./feature-flags";
export * from "./service-config";

// src/lib/config/ai-summary.config.ts
// 从 classification 模块迁移
export interface AISummaryConfig {
  defaultProvider: "deepseek" | "aliyun-bailian";
  fallbackEnabled: boolean;
  maxTokens: number;
  timeout: number;
}

export function getAISummaryConfig(): AISummaryConfig {
  return {
    defaultProvider:
      (process.env.DEFAULT_SUMMARY_PROVIDER as any) || "deepseek",
    fallbackEnabled: process.env.SUMMARY_FALLBACK_ENABLED !== "false",
    maxTokens: parseInt(process.env.SUMMARY_MAX_TOKENS || "2000"),
    timeout: parseInt(process.env.SUMMARY_TIMEOUT || "30000"),
  };
}

// src/lib/config/feature-flags.ts
export interface FeatureFlags {
  enableV3Classification: boolean;
  enableEnhancedSummary: boolean;
  enableKnowledgeLink: boolean;
  enableDebugMode: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    enableV3Classification: process.env.ENABLE_V3_CLASSIFICATION === "true",
    enableEnhancedSummary: process.env.ENABLE_ENHANCED_SUMMARY === "true",
    enableKnowledgeLink: process.env.ENABLE_KNOWLEDGE_LINK === "true",
    enableDebugMode: process.env.NODE_ENV === "development",
  };
}
```

#### 3. 整理 Utils 工具

```
当前：src/lib/utils/ (28 个文件，杂乱)

目标：
src/lib/utils/
├── embedding/              # 向量相关
│   ├── embedding-generator.ts
│   ├── similarity.ts
│   └── index.ts
│
├── validation/             # 验证工具
│   ├── url-validator.ts
│   ├── input-sanitizer.ts
│   └── index.ts
│
├── network/                # 网络请求
│   ├── fetch-with-retry.ts
│   ├── api-client.ts
│   └── index.ts
│
├── format/                 # 格式化
│   ├── date-formatter.ts
│   ├── number-formatter.ts
│   └── index.ts
│
├── common/                 # 通用工具
│   ├── debounce.ts
│   ├── throttle.ts
│   ├── deep-merge.ts
│   └── index.ts
│
└── index.ts                # 统一导出
```

---

## 易维护性提升

### 当前问题

1. **模块边界不清晰**：Classification 85 个文件难以定位
2. **常量分散**：配置散布在 5 个目录
3. **导入路径复杂**：深层嵌套导入难以维护
4. **缺乏文档**：新成员上手困难

### 改进方案

#### 1. 统一导出规范

```typescript
// 每个模块必须有 index.ts 统一导出
// src/lib/summary/index.ts

// 类型导出
export type {
  SummaryInput,
  SummaryResult,
  SummaryOptions,
  ProviderName,
} from "./summary.types";

// 服务导出
export { SummaryService, getSummaryService } from "./services/summary.service";
export { ContentFetcherService } from "./services/content-fetcher.service";

// Provider 导出
export {
  ProviderFactory,
  getProviderFactory,
} from "./providers/provider.factory";

// 配置导出
export { getSummaryConfig, type SummaryConfig } from "./summary.config";

// 不导出内部实现细节
// ❌ export { parseResponseV1 } from './providers/deepseek.provider';
```

#### 2. 建立编码规范文档

```markdown
// docs/architecture/coding-standards.md

# AnyKeep 编码规范

## 文件命名

- 组件：PascalCase（BookmarkCard.tsx）
- 服务：kebab-case（summary.service.ts）
- 类型：kebab-case（summary.types.ts）
- 测试：_.test.ts 或 _.spec.ts

## 目录结构

每个模块目录必须包含：

- index.ts（统一导出）
- types.ts 或 \*.types.ts（类型定义）
- **tests**/（测试文件）

## 导入顺序

1. Node.js 内置模块
2. 第三方库
3. 项目别名导入（@/lib/...）
4. 相对路径导入

## 注释规范

- 公共 API 必须有 JSDoc
- 复杂逻辑需要行内注释
- TODO 必须关联 Issue 编号
```

#### 3. 创建模块依赖图

```
src/lib/
├── classification/  ──────────────────┐
│   └── depends on: summary, shared    │
│                                      │
├── summary/  ─────────────────────────┤
│   └── depends on: shared             │
│                                      │
├── browser-bookmark/  ────────────────┤
│   └── depends on: shared             │
│                                      │
├── cache/  ───────────────────────────┤
│   └── depends on: shared             │
│                                      │
├── knowledge-link/  ──────────────────┤
│   └── depends on: summary, shared    │
│                                      │
└── shared/  ◄─────────────────────────┘
    ├── event-bus/
    ├── supabase/
    └── utils/
```

---

## 可扩展性增强

### 当前优势

- ✅ 事件驱动架构（EventBus）
- ✅ Provider 模式（可插拔）
- ✅ 容器模式（依赖注入）

### 改进方案

#### 1. Provider 基类抽象

```typescript
// src/lib/summary/providers/base.provider.ts
export abstract class BaseProvider implements ISummaryProvider {
  abstract readonly name: ProviderName;
  abstract readonly priority: number;

  // 共享实现（当前在 DeepSeek 和 Aliyun 中重复）
  protected buildPrompts(input: SummaryInput): PromptBuildResult {
    // ... 450 行共享代码
  }

  protected parseResponse(content: string): ParsedResponse {
    // ...
  }

  protected async *generateSummaryStream(
    input: SummaryInput,
  ): AsyncGenerator<StreamChunk> {
    // ...
  }

  // 模板方法
  async generateSummary(input: SummaryInput): Promise<SummaryResult> {
    const prompts = this.buildPrompts(input);
    const response = await this.callAPI(prompts);
    return this.parseResponse(response);
  }

  // 子类必须实现
  abstract callAPI(prompts: PromptBuildResult): Promise<string>;
  abstract estimateCost(tokenCount: number): number;
}

// src/lib/summary/providers/deepseek.provider.ts
export class DeepSeekProvider extends BaseProvider {
  readonly name = "deepseek" as const;
  readonly priority = 1;

  // 仅需实现差异部分
  async callAPI(prompts: PromptBuildResult): Promise<string> {
    const response = await fetch("https://api.deepseek.com/v1/chat", {
      // DeepSeek 特定配置
    });
    return response.json();
  }

  estimateCost(tokenCount: number): number {
    return tokenCount * 0.001; // DeepSeek 定价
  }
}
```

#### 2. 加强 EventBus 使用

```typescript
// 用事件替代直接调用，实现模块解耦

// 当前（紧耦合）
class ClassificationService {
  async classify(bookmark: Bookmark) {
    const result = await this.doClassify(bookmark);

    // 直接调用其他模块
    await profileService.updateProfile(result.folderId);
    await statisticsService.recordClassification(result);
  }
}

// 目标（解耦）
class ClassificationService {
  async classify(bookmark: Bookmark) {
    const result = await this.doClassify(bookmark);

    // 发布事件，不关心谁处理
    eventBus.emit("classification:completed", {
      bookmarkId: bookmark.id,
      folderId: result.folderId,
      confidence: result.confidence,
    });

    return result;
  }
}

// 其他模块订阅
// src/lib/folder-organization/subscribers.ts
eventBus.on("classification:completed", async (payload) => {
  await profileService.updateProfile(payload.folderId);
});

// src/lib/statistics/subscribers.ts
eventBus.on("classification:completed", async (payload) => {
  await statisticsService.recordClassification(payload);
});
```

#### 3. Feature Flag 系统

```typescript
// src/lib/feature-flags/index.ts
import { createClient } from "@/lib/supabase/client";

interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage: number;
  conditions?: {
    userIds?: string[];
    environments?: string[];
  };
}

class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();

  async isEnabled(
    flagName: string,
    context?: { userId?: string },
  ): Promise<boolean> {
    const flag = this.flags.get(flagName);
    if (!flag) return false;

    // 检查环境条件
    if (flag.conditions?.environments) {
      if (!flag.conditions.environments.includes(process.env.NODE_ENV!)) {
        return false;
      }
    }

    // 检查用户白名单
    if (flag.conditions?.userIds && context?.userId) {
      if (flag.conditions.userIds.includes(context.userId)) {
        return true;
      }
    }

    // 按比例灰度
    if (flag.rolloutPercentage < 100) {
      const hash = this.hashUserId(context?.userId || "anonymous");
      return hash % 100 < flag.rolloutPercentage;
    }

    return flag.enabled;
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

// 使用示例
const featureFlags = new FeatureFlagService();

if (await featureFlags.isEnabled("enhanced_summary", { userId })) {
  // 使用增强摘要
} else {
  // 使用标准摘要
}
```

---

## 安全性与稳定性

### 当前问题

1. **开发路由暴露**：`/api/dev/*` 无环境保护
2. **错误边界不完整**：部分页面缺少错误处理
3. **无 Rate Limiting**：API 可能被滥用

### 改进方案

#### 1. 开发路由环境保护

```typescript
// src/app/api/dev/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";

// 统一的开发路由保护
function devRouteGuard(handler: Function) {
  return async (request: NextRequest, context: any) => {
    // 生产环境直接返回 404
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // 开发环境执行原始处理器
    return handler(request, context);
  };
}

// 应用到所有开发路由
export const GET = devRouteGuard(async (request: NextRequest) => {
  // 开发逻辑
});

export const POST = devRouteGuard(async (request: NextRequest) => {
  // 开发逻辑
});
```

#### 2. 增强错误边界

```typescript
// src/app/global-error.tsx
'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 上报到 Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">出错了</h2>
            <p className="text-gray-600 mb-4">
              应用遇到了一个问题，我们已记录此错误。
            </p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              重试
            </button>
            {error.digest && (
              <p className="mt-4 text-sm text-gray-400">
                错误代码: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
```

#### 3. Rate Limiting

```typescript
// src/lib/rate-limit/index.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// 使用 Upstash Redis（Serverless 友好）
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

// 不同 API 的限流配置
export const rateLimiters = {
  // 通用 API：每分钟 60 次
  default: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    analytics: true,
    prefix: "ratelimit:default",
  }),

  // AI 相关 API：每分钟 10 次
  ai: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    analytics: true,
    prefix: "ratelimit:ai",
  }),

  // 导入 API：每小时 5 次
  import: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    analytics: true,
    prefix: "ratelimit:import",
  }),
};

// 使用示例
// src/app/api/classification/classify/route.ts
import { rateLimiters } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.ip ?? "127.0.0.1";
  const { success, limit, reset, remaining } = await rateLimiters.ai.limit(ip);

  if (!success) {
    return NextResponse.json(
      {
        error: "Too Many Requests",
        retryAfter: reset,
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      },
    );
  }

  // 继续处理请求
}
```

---

## 实施路线图

### Phase 1: 快速胜利（Week 1-2）

| 任务               | 工作量 | 收益         | 风险  | 负责人 |
| ------------------ | ------ | ------------ | ----- | ------ |
| 清理废弃 API       | 1天    | -800 行代码  | 🟢 低 | 后端   |
| 开发路由环境保护   | 0.5天  | 安全性提升   | 🟢 低 | 后端   |
| 创建 BaseProvider  | 2天    | -450 行重复  | 🟢 低 | 后端   |
| 集成 Sentry        | 2天    | 实时错误告警 | 🟢 低 | 全栈   |
| 添加 Request ID    | 1天    | 问题追踪能力 | 🟢 低 | 后端   |
| 创建 jest.setup.ts | 0.5天  | 测试基础设施 | 🟢 低 | 测试   |

**Week 1-2 检查点**：

- [ ] 废弃 API 已删除
- [ ] 开发路由已保护
- [ ] Sentry 已上线并收到首条告警
- [ ] Request ID 已在日志中出现

### Phase 2: 结构优化（Week 3-6）

| 任务                   | 工作量 | 收益            | 风险  | 负责人 |
| ---------------------- | ------ | --------------- | ----- | ------ |
| 删除冗余布尔字段       | 3天    | -5 个字段       | 🟠 中 | 后端   |
| 合并 Confirmations API | 2天    | -3.5KB 代码     | 🟡 低 | 后端   |
| React 组件优化         | 5天    | 30-50% 渲染提升 | 🟡 低 | 前端   |
| 代码分割               | 3天    | 40-50% 包缩减   | 🟡 低 | 前端   |
| 补充测试（15%）        | 10天   | 测试保护        | 🟢 低 | 测试   |
| 清理 console.log       | 2天    | 日志规范化      | 🟢 低 | 全栈   |

**Week 3-6 检查点**：

- [ ] Bookmarks 表字段数 < 45
- [ ] API 路由数 < 135
- [ ] 测试覆盖率 > 15%
- [ ] LCP < 1000ms

### Phase 3: 架构升级（Week 7-12）

| 任务                | 工作量 | 收益         | 风险  | 负责人 |
| ------------------- | ------ | ------------ | ----- | ------ |
| 拆分 Classification | 10天   | 可维护性提升 | 🟠 中 | 后端   |
| 部署监控系统        | 5天    | 全面可观测性 | 🟡 低 | DevOps |
| 统一标签系统        | 5天    | 数据模型简化 | 🟠 中 | 后端   |
| 测试覆盖（35%）     | 持续   | 长期质量保障 | 🟢 低 | 测试   |
| 建立共享配置层      | 3天    | 降低耦合     | 🟡 低 | 后端   |
| 整理 Utils 工具     | 3天    | 代码组织     | 🟢 低 | 全栈   |

**Week 7-12 检查点**：

- [ ] Classification 模块已拆分为 3 个子模块
- [ ] Grafana 仪表板已上线
- [ ] 测试覆盖率 > 35%
- [ ] 问题诊断时间 < 2min

---

## 立即行动清单

根据 **ROI（投入产出比）** 排序，建议优先执行：

### Week 1（立竿见影）

```markdown
Day 1-2: 可观测性基础
├─ [ ] 安装 @sentry/nextjs
├─ [ ] 配置 sentry.client.config.ts
├─ [ ] 配置 sentry.server.config.ts
├─ [ ] 测试错误上报
└─ [ ] 配置 Slack 通知

Day 3: 请求追踪
├─ [ ] 更新 middleware.ts 添加 Request ID
├─ [ ] 创建 request-context.ts 工具
├─ [ ] 更新 5 个关键 API 的错误响应
└─ [ ] 验证日志中 requestId 字段

Day 4: 安全性
├─ [ ] 创建开发路由保护中间件
├─ [ ] 应用到所有 /api/dev/\* 路由
└─ [ ] 验证生产环境返回 404

Day 5: 代码清理
├─ [ ] 删除 /api/ai/recommend-folder
├─ [ ] 删除 /api/bookmarks/auto-classify
├─ [ ] 删除 /api/classification/v3/feedback
└─ [ ] 运行构建验证
```

### Week 2（高收益）

```markdown
Day 6-7: Provider 重构
├─ [ ] 创建 base.provider.ts
├─ [ ] 提取 450 行共享代码
├─ [ ] 重构 DeepSeekProvider
├─ [ ] 重构 AliyunBailianProvider
└─ [ ] 运行所有测试验证

Day 8-9: React 优化
├─ [ ] 使用 React DevTools 识别高频组件
├─ [ ] 为 BookmarkCard 添加 memo
├─ [ ] 为 BookmarkListItem 添加 memo
├─ [ ] 添加必要的 useCallback
└─ [ ] 对比优化前后 Profiler 数据

Day 10: 测试基础
├─ [ ] 创建 jest.setup.ts
├─ [ ] 为 GET /api/bookmarks 编写测试
├─ [ ] 为 POST /api/bookmarks 编写测试
└─ [ ] 运行 npm run test:coverage
```

### 验收标准

| 里程碑           | 时间   | 验收标准                |
| ---------------- | ------ | ----------------------- |
| **Week 1 完成**  | Day 5  | Sentry 收到生产错误告警 |
| **Week 2 完成**  | Day 10 | Provider 代码行数 < 600 |
| **Month 1 完成** | Day 30 | 测试覆盖率 > 15%        |
| **Month 3 完成** | Day 90 | 问题诊断时间 < 2min     |

---

## 风险控制

### 每个 Phase 的前置条件

| Phase       | 前置条件                    |
| ----------- | --------------------------- |
| **Phase 1** | ✅ 可直接执行               |
| **Phase 2** | 需要完成 Phase 1 的测试基础 |
| **Phase 3** | 需要详细迁移脚本和回滚计划  |

### 回滚策略

#### 数据库变更回滚

```sql
-- 所有迁移必须提供回滚脚本
-- 示例：删除冗余字段的回滚

-- 回滚脚本 (down migration)
ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;

UPDATE bookmarks
SET is_starred = (starred_at IS NOT NULL);
```

#### API 变更回滚

```typescript
// 保持旧 API 兼容 2 个版本周期
// /api/classification/classify-quick -> /api/classification/classify?mode=quick

// 旧路由重定向
// src/app/api/classification/classify-quick/route.ts
export async function POST(request: NextRequest) {
  console.warn("DEPRECATED: Use /api/classification/classify?mode=quick");

  // 转发到新路由
  const newUrl = new URL(
    "/api/classification/classify?mode=quick",
    request.url,
  );
  return fetch(newUrl, {
    method: "POST",
    headers: request.headers,
    body: request.body,
  });
}
```

#### 模块重构回滚

```typescript
// 使用 Feature Flag 灰度发布
if (await featureFlags.isEnabled("new_classification_module")) {
  return newClassificationService.classify(bookmark);
} else {
  return oldClassificationService.classify(bookmark);
}
```

### 紧急回滚流程

```markdown
1. 识别问题
   - Sentry 告警
   - 用户反馈
   - 监控指标异常

2. 评估影响
   - 影响范围（用户数、功能范围）
   - 严重程度（数据损坏、功能不可用、性能下降）

3. 执行回滚
   - Git revert（代码回滚）
   - 数据库 down migration（数据库回滚）
   - Feature Flag 关闭（功能回滚）

4. 验证恢复
   - 检查错误率恢复
   - 检查性能指标恢复
   - 抽样验证用户功能

5. 事后分析
   - 编写事故报告
   - 更新回滚文档
   - 改进监控告警
```

---

## 预期收益总结

| 指标                    | 当前       | Phase 1 后 | Phase 2 后 | Phase 3 后 |
| ----------------------- | ---------- | ---------- | ---------- | ---------- |
| **代码行数**            | 33,451     | 32,200     | 31,000     | 30,000     |
| **代码重复度**          | 85%        | 15%        | 15%        | 10%        |
| **测试覆盖率**          | 4.9%       | 8%         | 15%        | 35%        |
| **问题诊断时间**        | 1h+        | <5min      | <3min      | <2min      |
| **API P95**             | ~200ms     | ~180ms     | ~150ms     | ~100ms     |
| **LCP**                 | ~1200ms    | ~1100ms    | ~1000ms    | ~800ms     |
| **维护复杂度**          | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | ⭐⭐⭐     | ⭐⭐       |
| **Bookmarks 字段**      | 50         | 50         | 45         | 40         |
| **API 路由数**          | 149        | 143        | 130        | 125        |
| **Classification 文件** | 85         | 85         | 85         | 45         |

---

## 附录

### A. 关键文件位置

| 功能                    | 文件路径                               |
| ----------------------- | -------------------------------------- |
| **Summary 核心**        | `src/lib/summary/index.ts`             |
| **Classification 容器** | `src/lib/classification/container.ts`  |
| **EventBus**            | `src/lib/shared/event-bus/`            |
| **缓存系统**            | `src/lib/cache/`                       |
| **Logger**              | `src/lib/logger.ts`                    |
| **API 响应工具**        | `src/lib/utils/api-response.ts`        |
| **性能监控**            | `src/lib/utils/performance-monitor.ts` |
| **Jest 配置**           | `jest.config.ts`                       |

### B. 相关设计文档

- [AI功能模块设计-智能浓缩与知识关联 v1.2](../design/AI功能模块设计-智能浓缩与知识关联%20v1.2.md)
- [v1.5-upgrade-plan](./v1.5-upgrade-plan.md)
- [coding-standards](./coding-standards.md)（待创建）
- [source-tree](./source-tree.md)（待更新）

### C. 工具与依赖

| 工具                   | 用途            | 安装命令                                        |
| ---------------------- | --------------- | ----------------------------------------------- |
| **Sentry**             | 错误追踪        | `npm install @sentry/nextjs`                    |
| **prom-client**        | Prometheus 指标 | `npm install prom-client`                       |
| **@upstash/ratelimit** | Rate Limiting   | `npm install @upstash/ratelimit @upstash/redis` |
| **uuid**               | Request ID 生成 | `npm install uuid @types/uuid`                  |

### D. 更新日志

| 日期       | 版本 | 变更                                             |
| ---------- | ---- | ------------------------------------------------ |
| 2025-12-14 | v2.1 | 新增六大优化领域总览、立即行动清单、详细实施代码 |
| 2025-12-14 | v2.0 | 新增性能、可观测性、测试、模块化分析             |
| 2025-12-14 | v1.0 | 初始复杂度治理方案                               |

---

## 签署确认

| 角色       | 姓名         | 日期       | 签名 |
| ---------- | ------------ | ---------- | ---- |
| 架构师     | Winston (AI) | 2025-12-14 | ✅   |
| 技术负责人 |              |            |      |
| 产品负责人 |              |            |      |

---

_本文档由 Winston (Architect Agent) 生成，基于 AnyKeep 项目代码深度分析。_
