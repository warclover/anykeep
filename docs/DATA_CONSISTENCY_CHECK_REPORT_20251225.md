# AnyKeep 数据一致性检查报告

**生成日期**: 2025-12-25
**项目版本**: v2.4.0
**检查范围**: 数据库结构、TypeScript 类型、API 数据同步、向量引用

---

## 执行摘要

| 检查项                | 状态      | 问题数 | 严重级别 |
| --------------------- | --------- | ------ | -------- |
| 数据库结构完整性      | ✅ 通过   | 0      | -        |
| TypeScript 类型一致性 | ⚠️ 需关注 | 3      | 中       |
| API 数据同步规则      | 🔴 需修复 | 5      | 高/中    |
| 向量 (Embedding) 引用 | ⚠️ 需关注 | 4      | 中/低    |

**总计**: 12 个问题需要处理

---

## 一、数据库结构分析

### 1.1 核心表统计

| 表名                       | 字段数 | 索引数 | RLS策略数 | 状态        |
| -------------------------- | ------ | ------ | --------- | ----------- |
| bookmarks                  | 57     | 20+    | 4         | ✅ 完整     |
| folders                    | 12     | 3      | 1         | ✅ 完整     |
| profiles                   | 14     | 0      | 3         | ✅ 完整     |
| bookmark_snapshots         | 25+    | 8      | 5         | ✅ 完整     |
| import_history             | 13     | 3      | 3         | ✅ 完整     |
| ai_conversations           | 12     | 4      | 1         | ✅ 完整     |
| ai_messages                | 11     | 3      | 2         | ✅ 完整     |
| ai_skill_executions        | 16     | 5      | 2         | ✅ 完整     |
| classification_suggestions | 12     | 3      | 3         | ✅ 完整     |
| smart_lists                | 17     | -      | -         | ✅ 完整     |
| folder_profiles            | 10+    | -      | -         | ⚠️ 部分问题 |

### 1.2 外键关系完整性

```
✅ bookmarks.user_id → auth.users.id (CASCADE)
✅ bookmarks.folder_id → folders.id (SET NULL)
✅ folders.parent_id → folders.id (CASCADE, self-ref)
✅ bookmark_snapshots.bookmark_id → bookmarks.id (CASCADE)
✅ ai_conversations.context_folder_id → folders.id (SET NULL)
✅ ai_messages.conversation_id → ai_conversations.id (CASCADE)
```

### 1.3 向量字段配置

| 字段                              | 维度 | 索引类型 | 距离度量 | 状态    |
| --------------------------------- | ---- | -------- | -------- | ------- |
| bookmarks.embedding               | 1024 | HNSW     | cosine   | ✅      |
| bookmarks.title_embedding         | 1024 | HNSW     | cosine   | ✅      |
| bookmarks.tag_embedding           | 1024 | HNSW     | cosine   | ✅      |
| folder_profiles.profile_embedding | 1024 | -        | -        | ⚠️      |
| folder_profiles.name_embedding    | 1024 | -        | -        | ⚠️ 孤立 |

---

## 二、问题清单

### 🔴 高优先级问题 (需立即修复)

#### P1: `/api/init` 返回完整 embedding 字段

**位置**: `src/app/api/init/route.ts:79-81`

**问题描述**:

```typescript
// 当前代码
let query = supabase.from("bookmarks").select("*, folders(name)");
```

- 使用 `*` 返回所有字段，包括 `embedding` (1024维向量)
- 每个书签的 embedding 约 8KB，100条书签 = 800KB 额外传输
- 严重影响首屏加载性能

**修复建议**:

```typescript
// 使用明确的字段列表，排除 embedding
const INIT_BOOKMARK_FIELDS = `
  id, title, url, platform, cover_url, description, source_name,
  rating, is_invalid, is_in_trash, is_read, is_starred, is_locked,
  folder_id, user_tags, ai_summary, ai_tags, ai_content_type, status,
  author, publish_time, created_at, updated_at, folders(name)
`;

let query = supabase.from("bookmarks").select(INIT_BOOKMARK_FIELDS);
```

---

#### P2: API 端点字段选择不一致

**位置**: 多个 API 文件

**问题描述**:

| 端点                    | embedding | author | publish_time | word_count | read_at |
| ----------------------- | --------- | ------ | ------------ | ---------- | ------- |
| `/api/bookmarks` (列表) | ✗ 排除    | ✗ 遗漏 | ✗ 遗漏       | ✗ 遗漏     | ✗ 遗漏  |
| `/api/init`             | ✓ 包含    | ✓ 包含 | ✓ 包含       | ✓ 包含     | ✓ 包含  |
| `/api/bookmarks/[id]`   | ✓ 包含    | ✓ 包含 | ✓ 包含       | ✓ 包含     | ✓ 包含  |

**影响**:

- 前端组件可能因字段缺失导致显示不完整
- 不同入口获取的数据格式不一致

**修复建议**:
创建统一的字段常量文件 `src/lib/constants/query-fields.ts`:

```typescript
export const BOOKMARK_LIST_FIELDS = `
  id, title, url, platform, cover_url, description, source_name,
  rating, is_invalid, is_in_trash, is_read, is_starred, is_locked,
  folder_id, user_tags, ai_summary, ai_tags, ai_content_type, status,
  author, publish_time, word_count, image_count, read_at, starred_at,
  pending_cluster, created_at, updated_at, folders(name)
`;

export const BOOKMARK_DETAIL_FIELDS = `
  *, folders(name)
`;
```

---

#### P3: 缺少数据版本同步机制

**位置**: 全局

**问题描述**:

- 批量操作（删除/移动/标签）后，客户端无法确认数据是否已更新
- 当前依赖 SWR 的 `mutate()` 失效整个列表缓存
- 可能导致显示过期数据

**影响场景**:

1. 批量删除 50 条书签后，列表可能仍显示已删除项
2. 批量移动到新文件夹后，源文件夹可能仍显示已移走的书签
3. 多标签页操作时，数据同步延迟

**修复建议**:

```typescript
// 方案 A: 添加 dataVersion 字段到响应
interface BookmarkListResponse {
  data: Bookmark[];
  dataVersion: number; // 每次数据变更 +1
  total: number;
}

// 方案 B: 启用 Supabase Realtime
const channel = supabase
  .channel("bookmarks_changes")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "bookmarks" },
    () => mutate("bookmarks:list"),
  )
  .subscribe();
```

---

### 🟡 中优先级问题 (计划修复)

#### P4: folder_profiles.name_embedding 孤立问题

**位置**:

- `supabase/migrations/20251208200001_add_folder_name_embedding.sql`
- `src/lib/classification/integration.ts:985-988`

**问题描述**:

- `name_embedding` 字段存在但生成时机不明确
- `profile_embedding` 依赖 `name_embedding`（30% 权重）
- 部分文件夹可能缺少 `name_embedding`

**诊断 SQL**:

```sql
SELECT COUNT(*) as missing_name_embedding
FROM folder_profiles
WHERE name_embedding IS NULL;
```

**修复建议**:

1. 添加定期检查 cron 任务
2. 在文件夹创建时自动生成 `name_embedding`
3. 使用已有的修复 API: `GET/POST /api/folders/fix-embeddings`

---

#### P5: 后台任务无进度反馈

**位置**: `src/app/api/bookmarks/route.ts:865-927`

**问题描述**:

- 书签创建后的 AI 处理（摘要、标签、向量）在后台异步执行
- 前端无法得知处理进度
- 用户看到 `status: PROCESSING` 但不知道何时完成

**当前状态**:

```
创建书签 → 返回 PROCESSING → [后台处理] → 状态变为 COMPLETED
                              ↑
                        用户无感知
```

**修复建议**:

```typescript
// 方案 A: 添加轮询机制（已部分实现）
useProcessingPoller(bookmarkId, { interval: 3000 });

// 方案 B: WebSocket 推送（推荐）
const channel = supabase
  .channel("processing_updates")
  .on("broadcast", { event: "bookmark_processed" }, ({ payload }) =>
    updateBookmark(payload.id),
  );

// 方案 C: Server-Sent Events
// GET /api/bookmarks/[id]/processing-status (SSE)
```

---

#### P6: HTTP 缓存配置不完整

**位置**: 多个 API route 文件

**当前状态**:

| 端点                  | Cache-Control                                     | 状态    |
| --------------------- | ------------------------------------------------- | ------- |
| `/api/bookmarks`      | `private, max-age=5, stale-while-revalidate=10`   | ✅      |
| `/api/folders`        | `private, max-age=300, stale-while-revalidate=60` | ✅      |
| `/api/init`           | 无                                                | ❌ 遗漏 |
| `/api/bookmarks/[id]` | 无                                                | ❌ 遗漏 |

**修复建议**:

```typescript
// /api/init/route.ts
return NextResponse.json(data, {
  headers: {
    "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
  },
});

// /api/bookmarks/[id]/route.ts
return NextResponse.json(bookmark, {
  headers: {
    "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
  },
});
```

---

### 🟢 低优先级问题 (可优化)

#### P7: TypeScript JSON 字段类型缺失

**位置**: `src/types/supabase.ts` (自动生成)

**问题描述**:
以下 JSON 字段使用 `Json` 类型，缺少具体业务类型定义：

| 字段                    | 表             | 建议类型               |
| ----------------------- | -------------- | ---------------------- |
| `classification_result` | bookmarks      | `ClassificationResult` |
| `options`               | import_history | `ImportOptions`        |
| `error_details`         | import_history | `ImportErrorDetail[]`  |

**修复建议**:

```typescript
// src/types/business.ts
export interface ClassificationResult {
  folder_id: number | null;
  folder_name: string;
  confidence: number;
  reason: string;
  match_source: "embedding" | "source" | "tag" | "rule";
}

export interface ImportOptions {
  preserveFolderStructure: boolean;
  skipDuplicates: boolean;
  // ...
}
```

---

#### P8: 向量维度签名不一致

**位置**: 多个 RPC 函数

**问题描述**:
部分旧的 RPC 函数可能仍使用 1536 维签名（虽然已迁移到 1024 维）

**诊断 SQL**:

```sql
SELECT proname, prosrc
FROM pg_proc
WHERE proname LIKE '%embedding%' OR proname LIKE '%semantic%';
```

**修复建议**:
审计所有向量相关 RPC 函数，确保签名统一为 `vector(1024)`

---

#### P9: Realtime 未启用

**位置**: `src/lib/supabase/client.ts:55-59`

**当前配置**:

```typescript
realtime: {
  heartbeatIntervalMs: 30_000,  // 仅配置心跳，未实际使用
}
```

**建议**:
对于需要实时协作的场景（如多人编辑同一文件夹），考虑启用 Realtime：

```typescript
// 按需订阅，而非全局启用
const subscribeToFolderChanges = (folderId: number) => {
  return supabase
    .channel(`folder:${folderId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "bookmarks",
        filter: `folder_id=eq.${folderId}`,
      },
      handleChange,
    )
    .subscribe();
};
```

---

#### P10: folders 查询遗漏 system_type 字段

**位置**: `src/app/api/folders/route.ts:62-72`

**当前查询**:

```typescript
const listFields = `
  id, name, parent_id, is_system, is_archived, folder_group,
  sort_order, created_at, updated_at
`;
// 遗漏: system_type
```

**修复**:

```typescript
const listFields = `
  id, name, parent_id, is_system, system_type, is_archived, folder_group,
  sort_order, created_at, updated_at
`;
```

---

#### P11: 错误重试机制有限

**位置**: `src/app/api/bookmarks/[id]/route.ts:186-198`

**当前实现**:

```typescript
updateFolderProfilesOnBookmarkChange(...).catch((err) => {
  logger.warn({ error: err }, "Failed to update folder profiles");
  // 仅记录日志，不重试
});
```

**建议**: 集成到 `bookmarkAITasks` 重试队列

---

#### P12: 多向量迁移缺乏可观测性

**位置**: `/api/embedding/migrate`

**问题**: 无法查询迁移进度和状态

**建议**:

```typescript
// 添加迁移状态端点
GET /api/embedding/migrate/status
{
  "total": 10000,
  "migrated": 5234,
  "failed": 12,
  "progress": 52.34,
  "estimatedTimeRemaining": "15min"
}
```

---

## 三、数据同步规则检查

### 3.1 缓存失效规则

| 操作       | 失效的缓存                                   | 实现状态      |
| ---------- | -------------------------------------------- | ------------- |
| 创建书签   | `bookmarks:list:*`                           | ✅ 已实现     |
| 更新书签   | `bookmarks:detail:{id}` + `bookmarks:list:*` | ✅ 已实现     |
| 删除书签   | `bookmarks:list:*`                           | ✅ 已实现     |
| 移动书签   | `bookmarks:list:*` + `folders:list`          | ⚠️ 部分实现   |
| 批量操作   | `bookmarks:list:*`                           | ✅ 已实现     |
| 创建文件夹 | `folders:list`                               | ✅ 已实现     |
| 删除文件夹 | `folders:list` + `bookmarks:list:*`          | ⚠️ 需确认级联 |

### 3.2 乐观更新规则

| 操作         | 乐观更新 | 回滚机制        |
| ------------ | -------- | --------------- |
| 星标切换     | ✅       | ✅ 快照回滚     |
| 已读标记     | ✅       | ✅ 快照回滚     |
| 批量标签     | ✅       | ✅ 快照回滚     |
| 移动到文件夹 | ✅       | ✅ 快照回滚     |
| 删除书签     | ✅       | ⚠️ 软删除可恢复 |

### 3.3 数据流完整性

```
┌─────────────────────────────────────────────────────────────────┐
│                      数据流向图                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [用户操作] ──────→ [API Route] ──────→ [Supabase DB]          │
│       │                  │                    │                 │
│       │                  ↓                    │                 │
│       │         [缓存失效 mutate()]           │                 │
│       │                  │                    │                 │
│       ↓                  ↓                    ↓                 │
│  [乐观更新] ←──── [SWR 重新验证] ←──── [数据变更通知]           │
│       │                  │                    │                 │
│       └──────────────────┴────────────────────┘                 │
│                          │                                      │
│                          ↓                                      │
│                   [UI 状态更新]                                  │
│                                                                 │
│  ⚠️ 缺失环节: [数据变更通知] 未实现 (Realtime/WebSocket)        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 四、向量引用完整性

### 4.1 向量生成覆盖率检查

**诊断 SQL**:

```sql
-- 检查 embedding 覆盖率
SELECT
  COUNT(*) as total,
  COUNT(embedding) as with_embedding,
  COUNT(*) - COUNT(embedding) as missing,
  ROUND(100.0 * COUNT(embedding) / NULLIF(COUNT(*), 0), 2) as coverage_percent
FROM bookmarks
WHERE deleted_at IS NULL AND status = 'COMPLETED';

-- 检查多向量版本分布
SELECT
  embedding_version,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percent
FROM bookmarks
WHERE deleted_at IS NULL AND embedding IS NOT NULL
GROUP BY embedding_version;

-- 检查 folder name_embedding 缺失
SELECT
  f.id, f.name, fp.name_embedding IS NULL as missing_name_embedding
FROM folders f
LEFT JOIN folder_profiles fp ON f.id = fp.folder_id
WHERE f.deleted_at IS NULL AND f.is_system = false;
```

### 4.2 向量搜索函数完整性

| 函数名                             | 输入维度    | 用途         | 状态 |
| ---------------------------------- | ----------- | ------------ | ---- |
| `search_bookmarks_semantic`        | 1024        | 基础语义搜索 | ✅   |
| `search_bookmarks_by_embedding`    | 1024        | RAG 检索     | ✅   |
| `search_bookmarks_by_title_vector` | 1024        | 标题快速搜索 | ✅   |
| `search_bookmarks_by_tag_vector`   | 1024        | 标签搜索     | ✅   |
| `search_bookmarks_hybrid`          | 1024 + text | 混合搜索     | ✅   |
| `search_bookmarks_multi_vector`    | 1024        | 多向量融合   | ✅   |
| `find_related_bookmarks`           | -           | 相关推荐     | ✅   |

### 4.3 孤立向量检测

**潜在孤立数据**:

1. `folder_profiles.name_embedding` - 可能存在未初始化的文件夹
2. 已删除书签的向量 - 软删除不清除向量数据
3. 失败的向量生成 - `embedding IS NULL AND status = 'COMPLETED'`

**清理建议**:

```sql
-- 标记异常状态
UPDATE bookmarks
SET status = 'FAILED'
WHERE embedding IS NULL
  AND status = 'COMPLETED'
  AND created_at < NOW() - INTERVAL '1 hour';
```

---

## 五、修复优先级排序

### 立即修复 (本周内)

| #   | 问题                       | 影响       | 工作量 |
| --- | -------------------------- | ---------- | ------ |
| P1  | `/api/init` 返回 embedding | 首屏性能   | 0.5h   |
| P2  | API 字段选择不一致         | 数据完整性 | 1h     |
| P10 | folders 缺少 system_type   | 功能缺陷   | 0.5h   |

### 计划修复 (本月内)

| #   | 问题                | 影响          | 工作量 |
| --- | ------------------- | ------------- | ------ |
| P3  | 数据版本同步机制    | 数据一致性    | 4h     |
| P4  | name_embedding 孤立 | AI 分类准确性 | 2h     |
| P6  | HTTP 缓存配置       | 性能优化      | 1h     |

### 后续优化 (按需)

| #   | 问题             | 影响       | 工作量 |
| --- | ---------------- | ---------- | ------ |
| P5  | 后台任务进度反馈 | 用户体验   | 8h     |
| P7  | JSON 字段类型    | 代码质量   | 2h     |
| P9  | Realtime 启用    | 实时协作   | 4h     |
| P11 | 错误重试机制     | 数据可靠性 | 4h     |
| P12 | 迁移可观测性     | 运维效率   | 2h     |

---

## 六、健康检查脚本

### 6.1 数据库健康检查

```sql
-- 创建健康检查视图
CREATE OR REPLACE VIEW data_health_check AS
SELECT
  -- 书签统计
  (SELECT COUNT(*) FROM bookmarks WHERE deleted_at IS NULL) as total_bookmarks,
  (SELECT COUNT(*) FROM bookmarks WHERE deleted_at IS NULL AND embedding IS NOT NULL) as bookmarks_with_embedding,
  (SELECT COUNT(*) FROM bookmarks WHERE deleted_at IS NULL AND status = 'PROCESSING' AND created_at < NOW() - INTERVAL '1 hour') as stuck_processing,

  -- 文件夹统计
  (SELECT COUNT(*) FROM folders WHERE deleted_at IS NULL) as total_folders,
  (SELECT COUNT(*) FROM folder_profiles WHERE name_embedding IS NULL) as folders_missing_name_embedding,

  -- 向量版本分布
  (SELECT COUNT(*) FROM bookmarks WHERE embedding_version = 1) as embedding_v1_count,
  (SELECT COUNT(*) FROM bookmarks WHERE embedding_version = 2) as embedding_v2_count,

  -- 异常数据
  (SELECT COUNT(*) FROM bookmarks WHERE embedding IS NULL AND status = 'COMPLETED') as completed_without_embedding;
```

### 6.2 API 健康检查端点

建议添加: `GET /api/health/data-consistency`

```typescript
// src/app/api/health/data-consistency/route.ts
export async function GET() {
  const checks = await Promise.all([
    checkEmbeddingCoverage(),
    checkFolderProfiles(),
    checkStuckProcessing(),
    checkOrphanedData(),
  ]);

  return NextResponse.json({
    status: checks.every((c) => c.ok) ? "healthy" : "degraded",
    checks,
    timestamp: new Date().toISOString(),
  });
}
```

---

## 七、总结

### 做得好的部分 ✅

1. **数据库设计完善** - 57 个字段的 bookmarks 表覆盖了所有业务需求
2. **类型安全** - Supabase 自动生成的类型与手动业务类型配合良好
3. **缓存策略** - SWR + HTTP Cache + localStorage 三层缓存
4. **向量系统** - 多向量架构 (V4.2) 设计合理

### 需要改进的部分 ⚠️

1. **API 一致性** - 不同端点返回字段不统一
2. **实时同步** - 依赖轮询而非推送
3. **可观测性** - 缺少数据健康检查机制
4. **向量完整性** - 部分 name_embedding 缺失

### 下一步行动

1. **立即**: 修复 P1/P2/P10 问题
2. **本周**: 添加数据健康检查端点
3. **本月**: 实现数据版本同步机制
4. **长期**: 评估 Realtime 启用的成本收益

---

**报告生成者**: Claude Code
**审核状态**: 待审核
