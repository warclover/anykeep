# 统一 API 版本与路径常量导致问题 — 诊断与修复计划

> 基于提交 ee91b1be（refactor(api): 统一 API 版本与路径常量，消除碎片化）后的现象整理。  
> 状态：**P0/P2 已实施**

### 实施记录

| 项                          | 状态      | 说明                                                                                           |
| --------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| P0-1 列表响应结构           | ✅ 已实施 | `use-bookmarks-swr.ts` 按 v1 的 `data.items` / `data.hasMore` 解析                             |
| P0-2 v1 创建后 AI 摘要/标签 | ✅ 已实施 | v1 POST 创建成功后调用 `bookmarkAITasks.generateContent`，复用旧版 `generateBookmarkAIContent` |
| 快速收藏乐观更新            | ✅ 已实施 | v1 创建成功返回 `data.bookmark`，FAB 派发 `BOOKMARK_CREATED`                                   |
| P2 批量删除 ids 兼容        | ✅ 已实施 | `BatchBookmarkIdsSchema` 使用 `z.coerce.number()` 兼容 string                                  |
| P1 元数据/首页图            | ⏸ 延后   | 可与后续「封面/元数据 job」统一做                                                              |

---

## 一、问题清单与根因概览

| #   | 现象                           | 根因分类              | 根因摘要                                                                                                                |
| --- | ------------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | 首页快速收藏功能失效           | 响应结构 + 后续流程   | 列表接口期望旧版 `data.bookmarks` / `data.pagination`，v1 返回 `data.items` / `data.hasMore`；创建后未触发摘要/标签任务 |
| 2   | AI 摘要功能失效                | 流程缺失              | v1 创建书签仅写库，未入队摘要/标签任务                                                                                  |
| 3   | AI 标签功能失效                | 同上                  | 同上                                                                                                                    |
| 4   | 收藏卡片自动获取首页图功能失效 | 响应结构 + 元数据流程 | 列表解析错误导致卡片数据异常；v1 创建未走元数据/封面拉取                                                                |
| 5   | 首页收藏卡片删除功能失效       | 响应结构 + 类型       | 列表因响应结构不匹配无法正确展示，删除依赖的 `ids` 可能类型不一致                                                       |

---

## 二、详细诊断

### 2.1 列表接口：v1 响应结构与前端期望不一致（影响 1、4、5）

**现状**

- 首页列表数据来自 `useBookmarksSWR`，请求地址已改为 **v1**：`API_PATHS.bookmarks.list` → `GET /api/v1/bookmarks`。
- **v1 实际返回**（`BookmarkService.list()` → `BookmarkListResponse`）：
  ```json
  { "success": true, "data": { "items": [...], "total", "limit", "offset", "hasMore": true } }
  ```
- **前端解析**（`src/lib/cache/hooks/use-bookmarks-swr.ts`）仍按**旧版**结构取数：
  - `result.data.bookmarks` → v1 中为 `undefined`
  - `result.data.pagination.hasMore` → v1 中为 `undefined`

**影响**

- 列表拿不到 `bookmarks`，首页卡片不展示或展示异常 → **快速收藏后列表不更新、卡片不显示、删除无可靠列表态**。
- 列表项中的 `coverUrl` 等字段本在 v1 的 `items[].coverUrl` 里，因整体解析错误导致「首页图」也失效。

**补充**：快速收藏（FAB/QuickAdd）当前在创建成功后仅 toast，未触发 `UIEvents.BOOKMARK_CREATED`，首页依赖的乐观更新也不会收到新书签；在列表解析修复后，需依赖 refetch 或后续在 v1 创建成功处派发事件并传入新书签（或至少 id）以保持体验一致。

**结论**：列表接口的**响应结构不兼容**是现象 1、4、5 的共同根因之一。

---

### 2.2 v1 创建书签未触发 AI 摘要/标签（影响 2、3）

**现状**

- 快速收藏走 **v1**：`POST /api/v1/bookmarks`，body 仅 `{ url }`，由 `IngestionService.ingest()` 只做：标准化 URL → 去重 → 落库。
- **旧版** `POST /api/bookmarks` 在创建后会：
  - 调用 `bookmarkAITasks.generateContent()` → 内部执行 `generateBookmarkAIContent()`（摘要+标签），失败时入队 `job_queue` 重试。
- **v1 路径**没有任何「生成摘要/标签」或「入队摘要/标签任务」的逻辑。

**影响**

- 通过 v1 创建的书签不会生成 AI 摘要、AI 标签，也不会进入 job_queue 做异步补全。

**结论**：v1 创建流程缺少「摘要/标签生成或入队」步骤，导致现象 2、3。

---

### 2.3 首页图与元数据（影响 4）

**现状**

- **列表侧**：v1 的 `toListItemResponse()` 已包含 `coverUrl`（来自 `bookmark.cover_url`），只要列表按 v1 结构正确解析，卡片即可拿到首页图。
- **创建侧**：旧版创建会通过 metadata 拉取、爬虫等得到 `coverUrl` 再落库；v1 创建仅落库 URL，没有拉取元数据/封面的步骤，因此**新加的书签**在 v1 路径下没有封面，直到有单独任务补全。

**结论**：

- 「已有数据的卡片不显示图」→ 主要因列表响应结构错误，修复 2.1 即可。
- 「新收藏的书签没有自动首页图」→ 需在 v1 创建后增加元数据/封面拉取（或入队任务）。

---

### 2.4 首页删除与批量删除（影响 5）

**现状**

- 首页批量删除已调用 **v1**：`POST /api/v1/bookmarks/batch/delete`，body `{ ids: number[] }`。
- v1 使用 `BatchBookmarkIdsSchema`：`ids` 为 `z.array(z.number().int().positive())`，**不接受 string**。
- 首页类型不统一：部分类型为 `Set<number>`、部分为 `Set<string>`（如 `types.ts` 中 `selectedIds: Set<string>`）。若某处传入 string 类型的 id，会导致校验失败或行为异常。

**结论**：删除接口本身为 v1 且语义正确；失效主要来自列表数据错乱（2.1）。为稳妥起见，建议在服务端对 `ids` 做兼容（如对 string 做安全转换或明确拒绝并返回 400）。

---

## 三、修复计划（建议顺序）

### 3.1 P0：统一列表响应结构（修复 1、4、5 的展示与操作）

**目标**：让 `useBookmarksSWR` 在请求 v1 列表时，能正确得到 `bookmarks` 和 `hasMore`。

**方案 A（推荐）：前端适配 v1 结构**

- 文件：`src/lib/cache/hooks/use-bookmarks-swr.ts`。
- 在 `fetchFromAPI` / 使用 `result` 的地方，按「v1 优先、旧版兼容」解析：
  - 若存在 `result.data.items`，则：
    - `bookmarks := result.data.items`
    - `hasMore := result.data.hasMore`
  - 否则保持现有逻辑：`result.data.bookmarks`、`result.data.pagination.hasMore`。
- 同样在 `loadMore` 中按 v1 结构解析 `result.data`（`items` + `hasMore`），保证分页与首屏一致。

**方案 B（备选）：v1 同时兼容旧结构**

- 在 `GET /api/v1/bookmarks` 的 handler 中，除返回 `{ items, total, limit, offset, hasMore }` 外，额外增加一层：
  - `data.bookmarks = data.items`
  - `data.pagination = { hasMore: data.hasMore, ... }`
- 这样现有前端无需改解析逻辑，但 API 会携带冗余字段；长期建议仍以方案 A 收敛到 v1 结构。

**验收**：首页列表正常展示、分页/加载更多正常；快速收藏后列表可更新（或通过刷新/事件看到新项）；删除后列表状态正确；卡片能显示已有数据的封面图。

---

### 3.2 P0：v1 创建书签后触发 AI 摘要与标签（修复 2、3）

**目标**：通过 v1 创建的书签也能生成 AI 摘要和 AI 标签（与旧版行为一致）。

**方案**

- 在 **v1 创建书签** 的 handler 中，`IngestionService.ingest()` 返回 `created` 后：
  - 调用现有「摘要+标签」的异步流程（与旧版 `bookmarkAITasks.generateContent` 对齐），或
  - 将「摘要+标签」任务入队到 `job_queue`，由现有 cron/worker 消费。
- 入队时 payload 需包含：`bookmarkId`、`url` 等，以便与现有 `generateBookmarkAIContent` 或等价逻辑对接；若已有 `job_queue` 类型（如 `summary` / `generate_tags`），复用并保证 v1 创建路径也会写入该类型任务。

**注意**：若摘要/标签由统一 job 处理，需确认 v1 创建的书签在 DB 中状态（如 `status`）与旧版一致，以便 job 能正确识别并处理。

**验收**：通过快速收藏（仅传 url）创建书签后，一段时间内该书签出现 AI 摘要与 AI 标签；或可在 job_queue 中看到对应任务并被成功消费。

---

### 3.3 P1：v1 创建后补全元数据/首页图（强化 4）

**目标**：新通过 v1 创建的书签也能自动获得封面图（与旧版「自动获取首页图」一致）。

**方案**

- 在 v1 创建书签成功后：
  - **方案 1**：同步或异步调用现有「元数据抓取」逻辑（如旧版 metadata API 或爬虫），将 `cover_url` 等写回该书签。
  - **方案 2**：入队「元数据/封面」类 job（若已有），由后台拉取 og:image 等并更新 `cover_url`。
- 若当前没有独立「封面」job，可考虑与摘要/标签放在同一 job 中一起补全，或新增轻量 job 只做元数据/封面。

**验收**：通过 v1 快速收藏的新书签，在无用户手动编辑的情况下，能自动出现封面图（或 job 成功执行并更新 `cover_url`）。

---

### 3.4 P2：批量删除 ids 类型兼容与错误信息（加固 5）

**目标**：避免因 id 类型（string vs number）导致批量删除静默失败或报错不清晰。

**方案**

- 在 `POST /api/v1/bookmarks/batch/delete` 的 body 校验中：
  - 对 `ids` 做安全转换：如 `ids = body.ids.map(id => Number(id)).filter(n => Number.isInteger(n) && n > 0)`，再传入 `BatchBookmarkIdsSchema` 或等价校验；或
  - 在 schema 层使用 `z.coerce.number()` 等，在合法范围内接受 string 并转为 number。
- 若校验失败，返回 400 并明确说明「ids 须为有效数字或数字字符串」。

**验收**：前端误传 string id 时，要么被正确转换为 number 并执行删除，要么得到明确 400 错误信息。

---

## 四、建议实施顺序与依赖

1. **3.1 列表响应结构**：先做，无依赖，可立即恢复首页展示、快速收藏后的列表与删除体验，以及已有数据的首页图。
2. **3.2 摘要/标签**：依赖「v1 创建」入口已稳定（当前已稳定），可与 3.1 并行或紧随其后。
3. **3.3 元数据/首页图**：依赖 3.2 的入队或异步机制（若共用 job 基础设施），可排在 3.2 之后。
4. **3.4 批量删除 ids**：可与 3.1 同周期内完成，提升健壮性。

---

## 五、涉及文件速查

| 修改点                      | 文件                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 列表响应解析（v1 vs 旧版）  | `src/lib/cache/hooks/use-bookmarks-swr.ts`                                                                   |
| v1 创建书签 + 摘要/标签入队 | `src/app/api/v1/bookmarks/route.ts`（POST）                                                                  |
| 摘要/标签/元数据入队逻辑    | 复用 `src/app/api/bookmarks/route.ts` 中 `bookmarkAITasks` 或 job 相关实现；或 `IngestionService` / job 服务 |
| 批量删除 ids 兼容           | `src/app/api/v1/bookmarks/batch/delete/route.ts` 或对应校验层                                                |

---

## 六、小结

- **现象 1、4、5** 主要来自：**列表接口使用 v1 URL 但仍按旧版响应结构解析**，导致列表为空或错乱，进而快速收藏、首页图、删除都表现异常。
- **现象 2、3** 来自：**v1 创建书签只写库，未触发摘要/标签生成或入队**。
- 优先完成 **3.1（列表解析）** 和 **3.2（摘要/标签）**，即可恢复「快速收藏、AI 摘要、AI 标签、首页图、首页删除」的核心体验；3.3、3.4 用于增强与健壮性。

请审核上述诊断与修复计划，确认后可按该顺序实施。
