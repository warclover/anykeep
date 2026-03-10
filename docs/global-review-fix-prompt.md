# AnyKeep 全局代码审查修复提示词

> 生成时间：2026-03-10 | 基于 CTO 级全局审查 | 当前分支：newclassification

---

## 背景

你是 AnyKeep 项目的 CTO。刚完成了一次全局代码审查，发现了多个需要修复的问题。请按优先级分批修复以下问题。每完成一批后运行 `npx tsc --noEmit` 验证类型安全，运行 `npx jest --passWithNoTests` 验证测试。

**项目关键信息：**

- Next.js 14 App Router + Supabase + TypeScript
- 分类系统刚完成 v1→v2 迁移（v5 路由已删除，代码归档到 `_archived/classification-v1/`）
- `tsconfig.json` 中 `@/lib/classification/*` 路径别名指向 `_archived/classification-v1/`
- 所有 API 路由认证使用 `withAuthMiddleware`（`src/lib/api/middleware.ts`）
- API 路径常量在 `src/lib/constants/api-paths.ts`
- 标准错误响应工具函数在 `src/lib/utils/api-response.ts`（`successResponse`, `internalError`, `notFoundError`, `badRequestError`, `handleValidationError`）

---

## 第一批：P0 快速修复（预计 1h）

### 1.1 封装 `safeParseBody()` 工具函数

**问题**：项目中 134+ 处 `await request.json()` 裸调用，客户端发送非 JSON 体时会抛出未捕获异常。虽然 `withAuthMiddleware` 有全局 try-catch 兜底，但错误信息不友好（返回通用 500 而非 400）。

**修复**：在 `src/lib/utils/api-response.ts` 中新增 `safeParseBody<T>()` 函数：

```typescript
/**
 * 安全解析请求体，JSON 解析失败时返回 400 而非抛出异常
 */
export async function safeParseBody<T = unknown>(
  request: Request,
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  try {
    const data = (await request.json()) as T;
    return { data, error: null };
  } catch {
    return {
      data: null,
      error: badRequestError("请求体不是有效的 JSON 格式"),
    };
  }
}
```

然后在 **5 个高风险路由** 中优先应用（不需要全量替换，先做高风险的）：

- `src/app/api/classification/v2/classify/route.ts`
- `src/app/api/classification/v2/batch/route.ts`
- `src/app/api/agent/unified/route.ts`
- `src/app/api/bookmarks/batch-delete/route.ts`
- `src/app/api/bookmarks/batch-import/route.ts`

### 1.2 清理 v2 路由 JSDoc 中的 v5 引用

**问题**：4 个 v2 路由文件的 JSDoc 注释中仍引用已删除的 `/api/classification/v5/...` 路径。

**修复**：更新以下文件的头部注释，将 v5 引用改为 v2：

- `src/app/api/classification/v2/rules/route.ts` — 第 8 行
- `src/app/api/classification/v2/feedback/route.ts` — 第 9 行
- `src/app/api/classification/v2/classify/route.ts` — 第 8 行
- `src/app/api/classification/v2/batch/route.ts` — 第 7 行

### 1.3 修正 Feature Flag 注册表的路径引用

**问题**：`src/lib/ai-agent/config/feature-flag-registry.ts` 第 1253/1258/1263 行的 `ENABLE_AI_TAG_MATCHER` Feature Flag 的 `integrationPoints` 引用了不存在的 `lib/classification/v5/classification-pipeline/...` 路径。

**修复**：将路径更新为 v2 等效路径或标注为 `_archived`。先读取该文件确认当前内容，然后修正 integrationPoints 中的 file 字段。

---

## 第二批：P1 AI 端点限流（预计 1h）

### 2.1 为 AI 生成端点添加速率限制

**问题**：以下端点调用 LLM 产生成本，但缺少速率限制保护：

- `src/app/api/summary/generate/route.ts` — AI 摘要生成
- `src/app/api/synthesis/generate/route.ts` — 主题合成
- `src/app/api/ai/generate-title/route.ts` — 标题生成
- `src/app/api/ai/vision-analyze/route.ts` — 视觉分析

**参考实现**：查看 `src/app/api/agent/unified/route.ts` 中的 `checkRateLimit` 用法，以及 `src/app/api/trash/empty/route.ts` 中的限流实现。

**修复**：为每个端点添加适当的速率限制：

- summary/generate: 每用户每分钟 10 次
- synthesis/generate: 每用户每分钟 5 次
- ai/generate-title: 每用户每分钟 20 次
- ai/vision-analyze: 每用户每分钟 10 次

先阅读现有的限流实现代码确认 API，然后逐个添加。

---

## 第三批：P1 错误响应标准化（预计 30min）

### 3.1 统一错误响应格式

**问题**：18+ 个路由使用原始 `NextResponse.json({ error: ... })` 而非标准工具函数。

**修复**：在以下文件中将裸 `NextResponse.json` 错误响应替换为标准工具函数：

- `src/app/api/batch-classification/[batchId]/confirm/route.ts` — `{ error: "Missing batchId" }` → `badRequestError("Missing batchId")`
- `src/app/api/distribution/rss/[token]/route.ts` — `{ error: "无效的 Feed Token" }` → `badRequestError("无效的 Feed Token")`
- `src/app/api/image-proxy/route.ts` — `{ error: "Domain not allowed" }` → `forbiddenError("Domain not allowed")`

先用 grep 搜索 `src/app/api/` 下所有 `NextResponse.json.*error` 模式，筛选出未使用标准工具函数的路由，逐个修复。注意排除已正确使用工具函数的文件。

---

## 第四批：P1 测试补全（预计 8h，可分多次）

### 4.1 `batch-classification/coordinator.ts` 单元测试

**问题**：`src/lib/batch-classification/coordinator.ts`（~500 行）是批量分类的核心协调器，包含三阶段处理（采样聚类 → 迭代聚类 → 映射）和撤销逻辑，完全无测试。

**修复**：创建 `src/lib/batch-classification/__tests__/coordinator.test.ts`，覆盖：

1. `startBatchClassification()` — 正常流程
2. `undoClassification()` — 按 folder_id 分组批量撤销
3. `saveClusterResultsBatch()` — Map 索引和批量插入
4. 错误处理路径（数据库错误、超时）

Mock Supabase client，测试业务逻辑。参考 `src/lib/classification-v2/__tests__/` 的测试风格。

### 4.2 `api/middleware.ts` 单元测试

**问题**：`src/lib/api/middleware.ts`（744 行）是所有 API 路由的基础设施，包含认证、错误处理、限流、验证，完全无测试。

**修复**：创建 `src/lib/api/__tests__/middleware.test.ts`，覆盖：

1. `withAuthMiddleware` — 正常认证、未认证 401、token 过期
2. `handleError` — 各种错误类型的响应格式
3. `RateLimitStore` — 限流计数、窗口滑动、清理
4. `validateBody` / `validateQuery` — Zod schema 验证通过/失败

### 4.3 激活 AI Agent Tools 跳过的测试

**问题**：54 个 `it.skip()` / `it.todo()` 测试未实现，集中在：

- `src/lib/ai-agent/tools/md-collection/__tests__/md-collection-tools.test.ts` — 21 个
- `src/lib/ai-agent/tools/settings/__tests__/settings-tools.test.ts` — 15 个
- `src/lib/ai-agent/tools/smart-list/__tests__/smart-list-tools.test.ts` — 8 个
- `src/lib/ai-agent/tools/bookmark/__tests__/bookmark-tools.test.ts` — 3 个

**修复**：逐个实现跳过的测试。先读取现有的 `it()` 测试实现作为参考模式，然后为每个 `it.skip()` 编写实际的测试逻辑。

---

## 第五批：P2 长期改进（可独立实施）

### 5.1 Supabase 类型重新生成

运行 `npm run supabase:gen:types` 更新 `src/types/supabase.ts`，然后检查哪些 `as any` / `as unknown as` 可以移除。项目中有 361 处双重断言和 53 处 `(supabase as any).rpc()`，大部分可通过更新类型解决。

### 5.2 硬编码 API 路径迁移（Top 10 高频文件）

优先迁移以下文件中的硬编码 API 路径到 `API_PATHS` 常量：

1. `src/hooks/domain/bookmark/use-reclassify.ts` — 6 处
2. `src/hooks/queries/use-folders-query.ts` — 3 处
3. `src/components/classification/classification-notification.tsx` — 2 处
4. `src/hooks/domain/ai/use-briefing.ts` — 3 处
5. `src/hooks/domain/bookmark/use-auto-snapshot.ts` — 3 处
6. `src/hooks/domain/folder/use-folder-health.ts` — 2 处
7. `src/hooks/domain/folder/use-split-suggestions.ts` — 1 处
8. `src/hooks/domain/folder/use-rename-suggestions.ts` — 1 处
9. `src/hooks/domain/folder/use-merge-suggestions.ts` — 1 处
10. `src/hooks/domain/ai/use-evolution-reports.ts` — 1 处

如果 `API_PATHS` 中缺少对应的常量定义，先在 `src/lib/constants/api-paths.ts` 中补充。

### 5.3 硬编码 Query Keys 修正

将以下文件中的硬编码 query key 改为使用 `src/hooks/queries/keys.ts` 工厂函数：

- `src/hooks/use-folder-quota.ts` — `["folder-quota"]`
- `src/hooks/data/use-notifications.ts` — `["notifications", {...}]`, `["notification-counts"]`
- `src/hooks/domain/folder/use-folder-heat.ts` — `["folder-heats"]`
- `src/components/home/providers/home-data-provider.tsx` — `["notification-count"]`

如果 `keys.ts` 中缺少对应的工厂函数，先补充。

### 5.4 桥接模块评估与清理路线图

评估 `src/lib/` 下 21 个桥接模块（re-export from `@/lib/classification/`），判断每个模块的功能是否已在 v2 中实现。输出一份评估表格到 `docs/bridge-module-assessment.md`，标注：

- 模块名
- 被引用次数
- v2 是否已有等效实现
- 建议处置（迁移/保留/删除）

---

## 执行注意事项

1. **每完成一个子任务后**运行 `npx tsc --noEmit` 确认类型安全
2. **修改测试后**运行对应的 `npx jest <测试文件路径>` 确认通过
3. **不要自动提交 git**，修复完成后统一由用户决定提交策略
4. **不要修改 `_archived/` 目录下的任何文件**
5. **保持代码注释语言与现有代码库一致**（中文注释为主）
6. 如遇到连锁问题（修复 A 引发 B），记录但不扩大修复范围，专注当前批次
