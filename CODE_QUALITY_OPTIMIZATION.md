# AnyKeep 代码质量优化方案

> 生成日期：2025-11-28
> 基于代码库全面审查

---

## 代码库健康度评估

| 指标         | 评分       | 说明                     |
| ------------ | ---------- | ------------------------ |
| 代码重复度   | 4/10       | 多处重复代码需合并       |
| 模块化程度   | 6/10       | 结构合理但存在混合       |
| 类型安全     | 7/10       | TypeScript 使用良好      |
| 错误处理     | 6/10       | 有框架但不够统一         |
| 文档完整性   | 6/10       | API 文档好，工具函数不足 |
| 测试覆盖率   | 2/10       | 缺少单元测试             |
| **综合评分** | **5.2/10** | 中等，需持续改进         |

---

## 优化方案总览

### 阶段 1：消除重复代码（优先级：🔴 Critical）

#### 1.1 合并 HTML 解析工具

**问题**：`metadata-parser.ts` 和 `crawler.ts` 中存在 100% 重复的 HTML 实体解码逻辑。

**涉及文件**：

- `src/lib/utils/metadata-parser.ts` (508-532 行) - `cleanText()`
- `src/lib/utils/crawler.ts` (53-76 行) - `decodeHtmlEntities()`

**解决方案**：

```typescript
// 新建 src/lib/utils/html-utils.ts
export function decodeHtmlEntities(text: string): string { ... }
export function cleanText(text: string): string { ... }
export function extractTextContent(html: string): string { ... }
```

**预计收益**：减少 ~50 行重复代码

---

#### 1.2 合并内容提取函数

**问题**：字数统计和图片计数在两个文件中重复实现。

**涉及文件**：

- `src/lib/utils/metadata-parser.ts` (538-622 行)
- `src/lib/utils/crawler.ts` (109-181 行)

**解决方案**：

```typescript
// 新建 src/lib/utils/content-extractor.ts
export function extractWordCount(html: string): number { ... }
export function extractImageCount(html: string): number { ... }
export function extractMainContent(html: string): string { ... }
```

**预计收益**：减少 ~140 行重复代码

---

#### 1.3 合并微信解析逻辑

**问题**：微信公众号信息提取 9 种方法几乎完全相同。

**涉及文件**：

- `src/lib/utils/metadata-parser.ts` (329-443 行)
- `src/lib/utils/crawler.ts` (260-351 行)

**解决方案**：

```typescript
// 新建 src/lib/utils/platform-parsers/wechat.ts
export function extractWechatSourceAndAuthor(html: string): {
  sourceName: string | null;
  author: string | null;
} { ... }
```

**预计收益**：减少 ~200 行重复代码

---

### 阶段 2：统一 API 中间件（优先级：🔴 Critical）

#### 2.1 创建 API 装饰器

**问题**：24 个 API 路由中都有重复的认证检查样板代码（33 处出现）。

**当前模式**：

```typescript
// 每个 API 文件都重复这段代码
const supabase = await createClient();
const {
  data: { user },
  error: authError,
} = await supabase.auth.getUser();
if (authError || !user) {
  return unauthorizedError();
}
```

**解决方案**：

```typescript
// 新建 src/lib/api/middleware.ts
export function withAuth<T extends object>(
  handler: (
    request: NextRequest,
    user: User,
    supabase: SupabaseClient,
  ) => Promise<Response>,
) {
  return async (request: NextRequest): Promise<Response> => {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return unauthorizedError();
    }

    return handler(request, user, supabase);
  };
}

// 使用示例
export const POST = withAuth(async (request, user, supabase) => {
  // 直接使用 user 和 supabase，无需重复认证
});
```

**预计收益**：

- 减少 ~200 行重复代码
- 统一认证错误处理
- 便于添加更多中间件（限流、日志等）

---

### 阶段 3：重构大组件（优先级：🟠 High）

#### 3.1 拆分 BookmarkCard 组件

**问题**：`bookmark-card.tsx` 超过 577 行，包含 3 种视图变体和多个嵌套组件。

**当前结构**：

```
BookmarkCard (577 行)
├── ActionMenu (内嵌)
├── SelectionCheckbox (内嵌)
├── CardView 逻辑
├── ListView 逻辑
└── CompactView 逻辑
```

**重构方案**：

```
src/components/bookmark/
├── bookmark-card/
│   ├── index.tsx              # 主组件（选择器）
│   ├── card-view.tsx          # 卡片视图
│   ├── list-view.tsx          # 列表视图
│   ├── compact-view.tsx       # 紧凑视图
│   ├── action-menu.tsx        # 操作菜单
│   ├── selection-checkbox.tsx # 选择框
│   └── types.ts               # 共享类型
```

**预计收益**：

- 每个文件 < 150 行
- 视图逻辑独立，易于维护
- 便于单独测试

---

### 阶段 4：整合常量和工具（优先级：🟡 Medium）

#### 4.1 统一日期工具函数

**问题**：存在两个日期工具文件，功能重叠。

**涉及文件**：

- `src/lib/date-utils.ts` - 15 个函数
- `src/lib/utils/date-utils.ts` - 3 个函数（重复）

**解决方案**：

```typescript
// 删除 src/lib/utils/date-utils.ts
// 保留并增强 src/lib/date-utils.ts
export function formatRelativeTime(date: string | Date): string { ... }
export function formatFriendlyDate(date: string | Date): string { ... }
// ... 其他函数
```

**预计收益**：消除导入混淆，统一日期处理

---

#### 4.2 分离验证 Schema

**问题**：所有验证 Schema 混合在 `validation.ts`（357 行）。

**重构方案**：

```
src/lib/schemas/
├── index.ts           # 统一导出
├── bookmark.ts        # 书签相关 Schema
├── folder.ts          # 文件夹相关 Schema
├── search.ts          # 搜索相关 Schema
└── common.ts          # 通用 Schema（URL、标签等）
```

---

#### 4.3 创建错误常量

**问题**：Supabase 错误代码使用魔法字符串。

**当前模式**：

```typescript
if (queryError.code === "PGRST116") {
  // 魔法数字！
  return notFoundError(BOOKMARK.NOT_FOUND);
}
```

**解决方案**：

```typescript
// 新建 src/lib/errors/database-errors.ts
export const DB_ERRORS = {
  NOT_FOUND: "PGRST116",
  FOREIGN_KEY_VIOLATION: "23503",
  UNIQUE_VIOLATION: "23505",
  // ...
} as const;

// 使用
if (queryError.code === DB_ERRORS.NOT_FOUND) { ... }
```

---

### 阶段 5：改进异步任务处理（优先级：🟡 Medium）

#### 5.1 统一异步任务系统

**问题**：AI 生成内容的 3 个异步函数调用顺序和错误处理不一致。

**涉及函数**：

- `generateBookmarkAIContent()`
- `generateBookmarkEmbedding()`
- `processAIFolderRecommendation()`

**解决方案**：

```typescript
// 新建 src/lib/tasks/bookmark-tasks.ts
export async function queueBookmarkProcessing(
  bookmarkId: number,
  options: ProcessingOptions,
): Promise<void> {
  const tasks = [
    { name: "ai_content", fn: generateAIContent },
    { name: "embedding", fn: generateEmbedding, dependsOn: "ai_content" },
    {
      name: "folder_recommendation",
      fn: recommendFolder,
      dependsOn: "ai_content",
    },
  ];

  await executeTaskGraph(tasks, bookmarkId, options);
}
```

**未来扩展**：可引入 Bull 或 RabbitMQ 实现真正的任务队列。

---

### 阶段 6：补充测试（优先级：🟢 Low，但重要）

#### 6.1 添加单元测试

**当前状态**：项目中没有任何测试文件。

**优先测试的模块**：

```
tests/
├── lib/
│   ├── utils/
│   │   ├── html-utils.test.ts      # HTML 解析
│   │   ├── content-extractor.test.ts
│   │   └── date-utils.test.ts
│   └── schemas/
│       ├── bookmark.test.ts        # 验证 Schema
│       └── folder.test.ts
└── components/
    └── bookmark/
        └── bookmark-card.test.tsx   # 组件测试
```

---

## 实施计划

### 第 1 周：消除重复代码

| 任务                        | 涉及文件                           | 预计时间 |
| --------------------------- | ---------------------------------- | -------- |
| 创建 `html-utils.ts`        | metadata-parser.ts, crawler.ts     | 2h       |
| 创建 `content-extractor.ts` | metadata-parser.ts, crawler.ts     | 2h       |
| 创建 `wechat.ts` 平台解析   | metadata-parser.ts, crawler.ts     | 2h       |
| 统一日期工具                | date-utils.ts, utils/date-utils.ts | 1h       |
| 测试验证                    | 全部相关 API                       | 1h       |

### 第 2 周：API 中间件 + 组件重构

| 任务                | 涉及文件               | 预计时间 |
| ------------------- | ---------------------- | -------- |
| 创建 API 中间件     | 新建 api/middleware.ts | 2h       |
| 迁移 24 个 API 路由 | 所有 route.ts          | 4h       |
| 拆分 BookmarkCard   | bookmark-card.tsx      | 4h       |

### 第 3 周：常量整理 + 测试

| 任务         | 涉及文件      | 预计时间 |
| ------------ | ------------- | -------- |
| 分离 Schema  | validation.ts | 2h       |
| 创建错误常量 | 新建 errors/  | 1h       |
| 添加单元测试 | 新建 tests/   | 4h       |

---

## 预期收益总结

| 指标           | 优化前  | 优化后   |
| -------------- | ------- | -------- |
| 重复代码行数   | ~500 行 | ~50 行   |
| 最大单文件行数 | 577 行  | < 200 行 |
| 认证样板代码   | 33 处   | 1 处     |
| 测试覆盖率     | 0%      | > 30%    |
| 维护难度       | 高      | 低       |

---

## 风险评估

| 风险                    | 可能性 | 影响 | 缓解措施              |
| ----------------------- | ------ | ---- | --------------------- |
| 重构引入回归            | 中     | 高   | 先添加测试再重构      |
| API 中间件性能          | 低     | 中   | 基准测试验证          |
| 组件拆分导致 props 复杂 | 中     | 低   | 使用 Context 共享状态 |

---

## 备注

- 所有重构遵循 **DRY（不重复自己）** 原则
- 每次重构后运行 `npx tsc --noEmit` 验证类型
- 重构前创建 Git 分支，便于回滚
- 优先处理 🔴 Critical 问题，再处理 🟠 High 问题
