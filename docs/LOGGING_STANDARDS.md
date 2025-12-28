/\*\*

- 日志标准化指南
-
- 项目统一使用 Pino 结构化日志系统
-
- @version 1.0.0
- @since 2025-12-28
  \*/

# AnyKeep 日志标准化指南

## 1. 日志工具选择

| 场景       | 使用工具       | 导入方式                                              |
| ---------- | -------------- | ----------------------------------------------------- |
| 服务端代码 | `logger`       | `import { logger, createLogger } from '@/lib/logger'` |
| 客户端组件 | `clientLogger` | `import { clientLogger } from '@/lib/client-logger'`  |
| API Routes | `createLogger` | `const log = createLogger('api/route-name')`          |
| Service 类 | `createLogger` | `const log = createLogger('service-name')`            |

## 2. 日志级别使用规范

```typescript
// trace - 最详细的调试信息（生产环境默认不输出）
logger.trace({ data }, "Detailed debugging info");

// debug - 开发调试信息
logger.debug({ userId, action }, "Processing user action");

// info - 重要业务事件
logger.info({ bookmarkId, title }, "Bookmark created successfully");

// warn - 可恢复的异常情况
logger.warn({ retryCount, error: err.message }, "Retrying operation");

// error - 错误信息（需要关注）
logger.error({ error, context }, "Failed to process request");

// fatal - 致命错误（系统不可用）
logger.fatal({ error }, "Database connection failed");
```

## 3. 结构化日志格式

```typescript
// ✅ 正确：结构化日志
logger.info(
  {
    userId: "user123",
    action: "create_bookmark",
    bookmarkId: "bm456",
    duration: 150,
  },
  "Bookmark created",
);

// ❌ 错误：字符串拼接
logger.info(`User user123 created bookmark bm456`);
```

## 4. 命名空间规范

```typescript
// API 路由
const log = createLogger("api/bookmarks");
const log = createLogger("api/agent/unified");

// 服务类
const log = createLogger("classification-service");
const log = createLogger("embedding-generator");

// Skill
const log = createLogger("skill/knowledge-review");
```

## 5. ESLint 规则

项目配置了严格的 `no-console` 规则：

- 禁止：`console.log`, `console.debug`, `console.info`, `console.warn`
- 允许：`console.error`（用于错误边界等特殊场景）

测试文件允许使用 `console.log`（eslint-disable）。

## 6. 迁移指南

### 6.1 服务端代码迁移

```typescript
// Before
console.log("Processing bookmark:", bookmarkId);
console.error("Failed:", error);

// After
import { createLogger } from "@/lib/logger";
const logger = createLogger("bookmark-service");

logger.info({ bookmarkId }, "Processing bookmark");
logger.error({ error, bookmarkId }, "Failed to process");
```

### 6.2 客户端代码迁移

```typescript
// Before
console.log("Component mounted");
console.error("Fetch failed:", error);

// After
import { clientLogger } from "@/lib/client-logger";

clientLogger.info("Component mounted");
clientLogger.error({ error: error.message }, "Fetch failed");
```

## 7. 生产环境配置

```bash
# .env.production
LOG_LEVEL=info  # 生产环境默认级别

# 调试时可临时开启 debug
LOG_LEVEL=debug
```

## 8. 日志监控集成

未来计划：

- Sentry 错误上报（error, fatal 级别）
- 日志聚合服务（ELK/Loki）
- 性能监控（关键操作 duration）
