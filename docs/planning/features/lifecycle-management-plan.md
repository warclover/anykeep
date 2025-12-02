# 智能收藏生命周期管理系统 - 实现方案

> **项目**: AnyKeep - 垃圾箱、失效检测、高价值文件夹功能
> **创建时间**: 2025-12-02
> **状态**: 📝 待审核

---

## 📋 需求概述

### 核心目标

1. **垃圾箱文件夹**：软删除缓冲区,30天后自动永久删除（系统文件夹,不可删除）
2. **已失效文件夹**：自动检测并收集失效链接,30天检测一次（系统文件夹,不可删除）
3. **全局失效检测**：记录检测历史,数据页面可查看统计
4. **高价值文件夹**：虚拟视图聚合5星评级收藏（系统文件夹,不可删除）

### 设计原则

✅ **虚拟文件夹**：通过查询条件实现,不占用物理 folder_id
✅ **状态解耦**：新增字段不影响现有删除/文件夹逻辑
✅ **混合触发机制**：服务器定时任务（每月1次）+ 客户端启动检查（超过30天触发）
✅ **智能检测**：自动过滤无法检测的链接（微信、需登录等）
✅ **零破坏**：完全向后兼容现有功能

---

## 🎯 架构设计

### 1. 虚拟文件夹 vs 物理文件夹

```
物理文件夹（folders 表）：
  - 用户手动创建和管理
  - 存储在 folders 表中
  - 通过 folder_id 关联

虚拟文件夹（查询视图）：
  - 系统自动维护的智能集合
  - 不存储在 folders 表中
  - 通过查询条件过滤（WHERE is_in_trash = true）

优势：
  ✅ 不污染用户的文件夹树
  ✅ 不影响现有 folder_id 关系
  ✅ 查询性能更优（索引支持）
  ✅ 业务逻辑清晰分离
```

### 2. 状态字段分离

```sql
-- bookmarks 表新增字段（不影响现有功能）
ALTER TABLE bookmarks ADD COLUMN is_in_trash BOOLEAN DEFAULT FALSE;
ALTER TABLE bookmarks ADD COLUMN trashed_at TIMESTAMPTZ;
ALTER TABLE bookmarks ADD COLUMN is_invalid BOOLEAN DEFAULT FALSE;
ALTER TABLE bookmarks ADD COLUMN invalidated_at TIMESTAMPTZ;
ALTER TABLE bookmarks ADD COLUMN last_validation_at TIMESTAMPTZ;
```

### 3. 混合触发机制架构

```
服务器定时任务 + 客户端启动检查

┌─────────────────────────────────────────────────────────┐
│  服务器端（Supabase Edge Functions + pg_cron）          │
├─────────────────────────────────────────────────────────┤
│  Edge Function 1: cleanup-trash                         │
│  触发时间: 每月1号凌晨 2:00                              │
│  任务: 删除 trashed_at < NOW() - 30天                   │
│  说明: 服务器自动清理过期垃圾箱收藏                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Edge Function 2: validate-all-links                    │
│  触发时间: 每月1号凌晨 3:00                              │
│  任务: 批量检测所有收藏（智能过滤不可检测链接）          │
│       更新 is_invalid 状态                               │
│       记录 validation_history                            │
│  说明: 服务器自动执行全局失效检测                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  客户端（App 启动检查）                                  │
├─────────────────────────────────────────────────────────┤
│  检查逻辑: 启动时检查 profiles 表的检测时间戳            │
│           - last_trash_cleanup_at（上次垃圾箱清理）      │
│           - last_validation_at（上次失效检测）           │
│                                                          │
│  触发条件: 距离上次执行超过 30 天                        │
│  触发方式: 调用相同的 Edge Functions                     │
│  说明: 兜底机制，防止服务器定时任务失败                  │
└─────────────────────────────────────────────────────────┘
```

**优势**：

- ✅ 服务器定时任务作为主要执行机制
- ✅ 客户端启动检查作为兜底保障
- ✅ 即使 pg_cron 失败，用户启动应用时会自动补救
- ✅ 确保任务至少每30天执行一次

---

## 📐 详细设计

### 一、数据模型扩展

#### 1.1 Bookmarks 表新增字段

```sql
-- 垃圾箱状态
ALTER TABLE bookmarks
  ADD COLUMN is_in_trash BOOLEAN DEFAULT FALSE,
  ADD COLUMN trashed_at TIMESTAMPTZ;

-- 链接有效性状态
ALTER TABLE bookmarks
  ADD COLUMN is_invalid BOOLEAN DEFAULT FALSE,
  ADD COLUMN invalidated_at TIMESTAMPTZ,
  ADD COLUMN last_validation_at TIMESTAMPTZ;

-- 性能优化索引
CREATE INDEX idx_bookmarks_trash
  ON bookmarks(is_in_trash, trashed_at)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_bookmarks_invalid
  ON bookmarks(is_invalid, invalidated_at)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_bookmarks_high_value
  ON bookmarks(rating)
  WHERE deleted_at IS NULL AND rating = 5;
```

**字段说明**：

| 字段名               | 类型        | 说明                        |
| -------------------- | ----------- | --------------------------- |
| `is_in_trash`        | BOOLEAN     | 是否在垃圾箱中（默认false） |
| `trashed_at`         | TIMESTAMPTZ | 进入垃圾箱的时间戳          |
| `is_invalid`         | BOOLEAN     | 链接是否失效（默认false）   |
| `invalidated_at`     | TIMESTAMPTZ | 首次检测到失效的时间        |
| `last_validation_at` | TIMESTAMPTZ | 最后一次验证时间            |

#### 1.1.2 Profiles 表新增字段（触发时间戳）

```sql
-- 任务执行时间戳（用于客户端启动检查）
ALTER TABLE profiles
  ADD COLUMN last_trash_cleanup_at TIMESTAMPTZ,
  ADD COLUMN last_validation_at TIMESTAMPTZ;

-- 注释
COMMENT ON COLUMN profiles.last_trash_cleanup_at IS '上次垃圾箱清理时间';
COMMENT ON COLUMN profiles.last_validation_at IS '上次失效检测时间';
```

**字段说明**：

| 字段名                  | 类型        | 说明                               |
| ----------------------- | ----------- | ---------------------------------- |
| `last_trash_cleanup_at` | TIMESTAMPTZ | 上次垃圾箱清理时间（用于30天检查） |
| `last_validation_at`    | TIMESTAMPTZ | 上次失效检测时间（用于30天检查）   |

#### 1.2 新增 validation_history 表

```sql
CREATE TABLE validation_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 检测统计
  total_bookmarks INTEGER NOT NULL,        -- 用户总收藏数
  total_checked INTEGER NOT NULL,          -- 实际检测数量
  skipped_count INTEGER NOT NULL,          -- 跳过的数量（不可检测）
  valid_count INTEGER NOT NULL,
  invalid_count INTEGER NOT NULL,
  error_count INTEGER NOT NULL,

  -- 性能指标
  duration_ms INTEGER,
  average_response_time_ms INTEGER,

  -- 详细结果（JSONB 存储失效的书签 ID 和错误信息）
  invalid_bookmarks JSONB,

  -- 跳过原因统计（JSONB）
  skipped_reasons JSONB,

  -- 时间戳
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 策略
ALTER TABLE validation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own validation history"
  ON validation_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- 索引
CREATE INDEX idx_validation_history_user_time
  ON validation_history(user_id, created_at DESC);
```

**表结构说明**：

| 字段名                     | 类型    | 说明                         |
| -------------------------- | ------- | ---------------------------- |
| `total_bookmarks`          | INTEGER | 用户总收藏数                 |
| `total_checked`            | INTEGER | 实际检测数量                 |
| `skipped_count`            | INTEGER | 跳过的数量（不可检测）       |
| `valid_count`              | INTEGER | 有效链接数量                 |
| `invalid_count`            | INTEGER | 失效链接数量                 |
| `error_count`              | INTEGER | 检测出错数量                 |
| `duration_ms`              | INTEGER | 总耗时（毫秒）               |
| `average_response_time_ms` | INTEGER | 平均响应时间（毫秒）         |
| `invalid_bookmarks`        | JSONB   | 失效收藏详情（ID + 错误）    |
| `skipped_reasons`          | JSONB   | 跳过原因统计（平台 -> 数量） |

---

### 二、虚拟文件夹查询逻辑

#### 2.1 垃圾箱查询

```typescript
// GET /api/bookmarks?folder=trash
const query = supabase
  .from("bookmarks")
  .select("*")
  .eq("user_id", userId)
  .is("deleted_at", null)
  .eq("is_in_trash", true)
  .order("trashed_at", { ascending: false });
```

**显示内容**：

- 所有被删除但未永久删除的收藏
- 按删除时间倒序排列
- 显示剩余保留天数（30 - 已经过天数）

#### 2.2 已失效查询

```typescript
// GET /api/bookmarks?folder=invalid
const query = supabase
  .from("bookmarks")
  .select("*")
  .eq("user_id", userId)
  .is("deleted_at", null)
  .eq("is_in_trash", false)
  .eq("is_invalid", true)
  .order("invalidated_at", { ascending: false });
```

**显示内容**：

- 所有检测为失效的收藏
- 按失效时间倒序排列
- 显示最后验证时间

#### 2.3 高价值查询

```typescript
// GET /api/bookmarks?folder=high-value
const query = supabase
  .from("bookmarks")
  .select("*")
  .eq("user_id", userId)
  .is("deleted_at", null)
  .eq("is_in_trash", false)
  .eq("rating", 5)
  .order("updated_at", { ascending: false });
```

**显示内容**：

- 所有5星评级的收藏
- 按更新时间倒序排列
- 星标图标高亮显示

#### 2.4 正常收藏查询（排除垃圾箱）

```typescript
// 现有查询需要升级
const query = supabase
  .from("bookmarks")
  .select("*")
  .eq("user_id", userId)
  .is("deleted_at", null)
  .eq("is_in_trash", false) // 新增：排除垃圾箱
  .or(`folder_id.eq.${folderId},folder_id.is.null`);
```

#### 2.5 智能过滤逻辑（失效检测专用）

**不可检测的链接类型**：

```typescript
// src/lib/validation/url-filter.ts

/**
 * 判断 URL 是否可以进行失效检测
 */
export function isUrlValidatable(url: string, platform?: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // 1. 微信公众号文章（需要登录）
    if (
      hostname.includes("weixin.qq.com") ||
      hostname.includes("mp.weixin.qq.com")
    ) {
      return false;
    }

    // 2. 需要登录的平台
    const loginRequiredDomains = [
      "xiaohongshu.com", // 小红书详情页
      "twitter.com", // Twitter 需要登录
      "x.com", // X (Twitter)
      "facebook.com", // Facebook
      "instagram.com", // Instagram
      "linkedin.com", // LinkedIn
    ];

    if (loginRequiredDomains.some((domain) => hostname.includes(domain))) {
      return false;
    }

    // 3. 本地文件或特殊协议
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return false;
    }

    // 4. 内网地址
    if (
      hostname === "localhost" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.")
    ) {
      return false;
    }

    // 5. 平台特定判断
    if (platform === "WECHAT_OFFICIAL_ACCOUNT") {
      return false; // 所有微信公众号内容都跳过
    }

    return true;
  } catch (error) {
    // URL 解析失败，无法检测
    return false;
  }
}

/**
 * 批量过滤可检测的收藏
 */
export function filterValidatableBookmarks(
  bookmarks: Array<{ url: string; platform?: string }>,
) {
  return bookmarks.filter((b) => isUrlValidatable(b.url, b.platform));
}
```

**使用示例**：

```typescript
// 失效检测 API 中使用
const { data: bookmarks } = await supabase
  .from("bookmarks")
  .select("id, url, platform")
  .eq("user_id", user.id)
  .is("deleted_at", null)
  .eq("is_in_trash", false);

// 智能过滤
const validatableBookmarks = filterValidatableBookmarks(bookmarks);

// 只检测可检测的链接
for (const bookmark of validatableBookmarks) {
  // 执行检测...
}
```

**统计信息**：

在检测结果中记录：

- `total_bookmarks`: 用户总收藏数
- `total_checked`: 实际检测数量
- `skipped_count`: 跳过的数量（不可检测）
- `skipped_reasons`: 跳过原因统计（JSONB）

---

### 三、API 设计

#### 3.1 删除操作改造

**现有 API**：`DELETE /api/bookmarks/[id]`

**改造方案**（软删除变为移入垃圾箱）：

```typescript
// src/app/api/bookmarks/[id]/route.ts

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. 检查收藏是否存在且属于当前用户
  const { data: bookmark } = await supabase
    .from("bookmarks")
    .select("id, is_locked, user_id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();

  if (!bookmark || bookmark.user_id !== user.id) {
    return new Response("Not found", { status: 404 });
  }

  // 2. 检查是否锁定
  if (bookmark.is_locked) {
    return new Response("Locked bookmark cannot be deleted", { status: 403 });
  }

  // 3. 移入垃圾箱（而非永久删除）
  const { error } = await supabase
    .from("bookmarks")
    .update({
      is_in_trash: true,
      trashed_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ message: "Moved to trash" }), {
    status: 200,
  });
}
```

#### 3.2 新增恢复 API

**API**：`POST /api/bookmarks/[id]/restore`

```typescript
// src/app/api/bookmarks/[id]/restore/route.ts

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 从垃圾箱恢复
  const { data, error } = await supabase
    .from("bookmarks")
    .update({
      is_in_trash: false,
      trashed_at: null,
    })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .eq("is_in_trash", true)
    .select()
    .single();

  if (error || !data) {
    return new Response("Not found in trash", { status: 404 });
  }

  return new Response(JSON.stringify(data), { status: 200 });
}
```

#### 3.3 新增永久删除 API

**API**：`DELETE /api/bookmarks/[id]/permanent`

```typescript
// src/app/api/bookmarks/[id]/permanent/route.ts

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const serviceSupabase = createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. 验证收藏在垃圾箱中
  const { data: bookmark } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .eq("is_in_trash", true)
    .single();

  if (!bookmark) {
    return new Response("Not found in trash", { status: 404 });
  }

  // 2. 永久删除（设置 deleted_at）
  const { error } = await serviceSupabase
    .from("bookmarks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", params.id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  // 3. 减少存储计数
  await serviceSupabase.rpc("decrement_storage_used", {
    p_user_id: user.id,
    p_decrement: 1,
  });

  return new Response(JSON.stringify({ message: "Permanently deleted" }), {
    status: 200,
  });
}
```

#### 3.4 批量操作 API

**批量恢复**：`POST /api/bookmarks/batch-restore`

```typescript
// src/app/api/bookmarks/batch-restore/route.ts

export async function POST(request: Request) {
  const { bookmarkIds } = await request.json();
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 批量恢复（最多100个）
  if (bookmarkIds.length > 100) {
    return new Response("Too many items", { status: 400 });
  }

  const { data, error } = await supabase
    .from("bookmarks")
    .update({
      is_in_trash: false,
      trashed_at: null,
    })
    .in("id", bookmarkIds)
    .eq("user_id", user.id)
    .eq("is_in_trash", true)
    .select("id");

  return new Response(
    JSON.stringify({
      restored: data?.length || 0,
      ids: data?.map((b) => b.id) || [],
    }),
    { status: 200 },
  );
}
```

**清空垃圾箱**：`POST /api/trash/empty`

```typescript
// src/app/api/trash/empty/route.ts

export async function POST(request: Request) {
  const supabase = createServerClient();
  const serviceSupabase = createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. 获取垃圾箱中的所有收藏
  const { data: trashItems } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_in_trash", true)
    .is("deleted_at", null);

  if (!trashItems || trashItems.length === 0) {
    return new Response(JSON.stringify({ deleted: 0 }), { status: 200 });
  }

  // 2. 批量永久删除
  const { error } = await serviceSupabase
    .from("bookmarks")
    .update({ deleted_at: new Date().toISOString() })
    .in(
      "id",
      trashItems.map((item) => item.id),
    );

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  // 3. 减少存储计数
  await serviceSupabase.rpc("decrement_storage_used", {
    p_user_id: user.id,
    p_decrement: trashItems.length,
  });

  return new Response(
    JSON.stringify({
      deleted: trashItems.length,
    }),
    { status: 200 },
  );
}
```

#### 3.5 失效检测 API

**手动触发检测**：`POST /api/validation/check`

```typescript
// src/app/api/validation/check/route.ts

export async function POST(request: Request) {
  const { bookmarkIds, concurrency = 10 } = await request.json();
  const supabase = createServerClient();
  const serviceSupabase = createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const startedAt = new Date();
  let totalChecked = 0;
  let validCount = 0;
  let invalidCount = 0;
  let errorCount = 0;
  const invalidBookmarks: any[] = [];

  // 获取要检测的收藏
  let query = supabase
    .from("bookmarks")
    .select("id, url")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .eq("is_in_trash", false);

  if (bookmarkIds && bookmarkIds.length > 0) {
    query = query.in("id", bookmarkIds);
  }

  const { data: bookmarks } = await query;

  if (!bookmarks || bookmarks.length === 0) {
    return new Response("No bookmarks to check", { status: 400 });
  }

  // 批量检测（复用现有 link-validator 逻辑）
  for (let i = 0; i < bookmarks.length; i += concurrency) {
    const batch = bookmarks.slice(i, i + concurrency);

    await Promise.allSettled(
      batch.map(async (bookmark) => {
        try {
          const response = await fetch(bookmark.url, {
            method: "HEAD",
            signal: AbortSignal.timeout(5000),
          });

          const isValid = response.ok;

          // 更新数据库
          await serviceSupabase
            .from("bookmarks")
            .update({
              is_invalid: !isValid,
              invalidated_at: isValid ? null : new Date().toISOString(),
              last_validation_at: new Date().toISOString(),
            })
            .eq("id", bookmark.id);

          if (isValid) {
            validCount++;
          } else {
            invalidCount++;
            invalidBookmarks.push({
              id: bookmark.id,
              url: bookmark.url,
              status: response.status,
            });
          }
        } catch (error) {
          errorCount++;
          invalidBookmarks.push({
            id: bookmark.id,
            url: bookmark.url,
            error: error.message,
          });

          // 标记为失效
          await serviceSupabase
            .from("bookmarks")
            .update({
              is_invalid: true,
              invalidated_at: new Date().toISOString(),
              last_validation_at: new Date().toISOString(),
            })
            .eq("id", bookmark.id);
        }

        totalChecked++;
      }),
    );
  }

  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();

  // 记录验证历史
  await serviceSupabase.from("validation_history").insert({
    user_id: user.id,
    total_checked: totalChecked,
    valid_count: validCount,
    invalid_count: invalidCount,
    error_count: errorCount,
    duration_ms: durationMs,
    invalid_bookmarks: invalidBookmarks,
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
  });

  return new Response(
    JSON.stringify({
      totalChecked,
      validCount,
      invalidCount,
      errorCount,
      durationMs,
    }),
    { status: 200 },
  );
}
```

**获取检测历史**：`GET /api/validation/history`

```typescript
// src/app/api/validation/history/route.ts

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error, count } = await supabase
    .from("validation_history")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  return new Response(
    JSON.stringify({
      data,
      total: count,
      page,
      limit,
    }),
    { status: 200 },
  );
}
```

---

### 四、自动任务实现

#### 4.1 自动清理垃圾箱（30天）

**Edge Function**：`supabase/functions/cleanup-trash/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 计算30天前的时间戳
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // 1. 获取要永久删除的收藏
    const { data: itemsToDelete, error: fetchError } = await supabase
      .from("bookmarks")
      .select("id, user_id")
      .is("deleted_at", null)
      .eq("is_in_trash", true)
      .lt("trashed_at", thirtyDaysAgo.toISOString());

    if (fetchError) {
      throw fetchError;
    }

    if (!itemsToDelete || itemsToDelete.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          deletedCount: 0,
          message: "No items to delete",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // 2. 批量永久删除
    const { error: deleteError } = await supabase
      .from("bookmarks")
      .update({ deleted_at: new Date().toISOString() })
      .in(
        "id",
        itemsToDelete.map((item) => item.id),
      );

    if (deleteError) {
      throw deleteError;
    }

    // 3. 按用户减少存储计数
    const userCounts = itemsToDelete.reduce(
      (acc, item) => {
        acc[item.user_id] = (acc[item.user_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    for (const [userId, count] of Object.entries(userCounts)) {
      await supabase.rpc("decrement_storage_used", {
        p_user_id: userId,
        p_decrement: count,
      });

      // 4. 更新用户的 last_trash_cleanup_at 时间戳
      await supabase
        .from("profiles")
        .update({ last_trash_cleanup_at: new Date().toISOString() })
        .eq("id", userId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount: itemsToDelete.length,
        affectedUsers: Object.keys(userCounts).length,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
```

**pg_cron 配置**：

```sql
-- 每月1号凌晨2点执行
SELECT cron.schedule(
  'cleanup-trash-monthly',
  '0 2 1 * *',  -- 每月1号 02:00
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/cleanup-trash',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  ) AS request_id;
  $$
);
```

#### 4.2 自动失效检测（智能过滤）

**Edge Function**：`supabase/functions/validate-all-links/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 智能过滤：判断 URL 是否可以检测
function isUrlValidatable(url: string, platform?: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // 1. 微信公众号（需要登录）
    if (
      hostname.includes("weixin.qq.com") ||
      hostname.includes("mp.weixin.qq.com")
    ) {
      return false;
    }

    // 2. 需要登录的平台
    const loginRequired = [
      "xiaohongshu.com",
      "twitter.com",
      "x.com",
      "facebook.com",
      "instagram.com",
      "linkedin.com",
    ];
    if (loginRequired.some((d) => hostname.includes(d))) {
      return false;
    }

    // 3. 特殊协议或本地地址
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return false;
    }
    if (
      hostname === "localhost" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.")
    ) {
      return false;
    }

    // 4. 平台特定判断
    if (platform === "WECHAT_OFFICIAL_ACCOUNT") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const startedAt = new Date();
    const BATCH_SIZE = 100;
    const CONCURRENCY = 10;
    let offset = 0;
    let hasMore = true;

    // 按用户分组统计
    const userStats: Record<
      string,
      {
        totalBookmarks: number;
        totalChecked: number;
        skippedCount: number;
        validCount: number;
        invalidCount: number;
        errorCount: number;
        invalidBookmarks: any[];
        skippedReasons: Record<string, number>;
      }
    > = {};

    while (hasMore) {
      const { data: bookmarks, error } = await supabase
        .from("bookmarks")
        .select("id, url, platform, user_id")
        .is("deleted_at", null)
        .eq("is_in_trash", false)
        .range(offset, offset + BATCH_SIZE - 1);

      if (error || !bookmarks || bookmarks.length === 0) {
        hasMore = false;
        break;
      }

      // 分用户初始化统计
      for (const bookmark of bookmarks) {
        if (!userStats[bookmark.user_id]) {
          userStats[bookmark.user_id] = {
            totalBookmarks: 0,
            totalChecked: 0,
            skippedCount: 0,
            validCount: 0,
            invalidCount: 0,
            errorCount: 0,
            invalidBookmarks: [],
            skippedReasons: {},
          };
        }
        userStats[bookmark.user_id].totalBookmarks++;
      }

      // 智能过滤：只检测可检测的链接
      const validatableBookmarks = bookmarks.filter((b) => {
        const canValidate = isUrlValidatable(b.url, b.platform);
        if (!canValidate) {
          const stats = userStats[b.user_id];
          stats.skippedCount++;
          const reason = b.platform || "unknown";
          stats.skippedReasons[reason] =
            (stats.skippedReasons[reason] || 0) + 1;
        }
        return canValidate;
      });

      // 并发验证
      for (let i = 0; i < validatableBookmarks.length; i += CONCURRENCY) {
        const batch = validatableBookmarks.slice(i, i + CONCURRENCY);

        await Promise.allSettled(
          batch.map(async (bookmark) => {
            const stats = userStats[bookmark.user_id];
            stats.totalChecked++;

            try {
              const response = await fetch(bookmark.url, {
                method: "HEAD",
                signal: AbortSignal.timeout(5000),
              });

              const isValid = response.ok;

              await supabase
                .from("bookmarks")
                .update({
                  is_invalid: !isValid,
                  invalidated_at: isValid ? null : new Date().toISOString(),
                  last_validation_at: new Date().toISOString(),
                })
                .eq("id", bookmark.id);

              if (isValid) {
                stats.validCount++;
              } else {
                stats.invalidCount++;
                stats.invalidBookmarks.push({
                  id: bookmark.id,
                  url: bookmark.url,
                  status: response.status,
                });
              }
            } catch (error) {
              stats.errorCount++;
              stats.invalidBookmarks.push({
                id: bookmark.id,
                url: bookmark.url,
                error: error.message,
              });

              await supabase
                .from("bookmarks")
                .update({
                  is_invalid: true,
                  invalidated_at: new Date().toISOString(),
                  last_validation_at: new Date().toISOString(),
                })
                .eq("id", bookmark.id);
            }
          }),
        );
      }

      offset += BATCH_SIZE;
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // 按用户插入验证历史
    for (const [userId, stats] of Object.entries(userStats)) {
      await supabase.from("validation_history").insert({
        user_id: userId,
        total_bookmarks: stats.totalBookmarks,
        total_checked: stats.totalChecked,
        skipped_count: stats.skippedCount,
        valid_count: stats.validCount,
        invalid_count: stats.invalidCount,
        error_count: stats.errorCount,
        duration_ms: durationMs,
        average_response_time_ms:
          stats.totalChecked > 0
            ? Math.round(durationMs / stats.totalChecked)
            : 0,
        invalid_bookmarks: stats.invalidBookmarks.slice(0, 100),
        skipped_reasons: stats.skippedReasons,
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
      });

      // 更新用户的 last_validation_at 时间戳
      await supabase
        .from("profiles")
        .update({ last_validation_at: completedAt.toISOString() })
        .eq("id", userId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        affectedUsers: Object.keys(userStats).length,
        totalChecked: Object.values(userStats).reduce(
          (sum, s) => sum + s.totalChecked,
          0,
        ),
        totalSkipped: Object.values(userStats).reduce(
          (sum, s) => sum + s.skippedCount,
          0,
        ),
        durationMs,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
```

**pg_cron 配置**：

```sql
-- 每月1号凌晨3点执行
SELECT cron.schedule(
  'validate-links-monthly',
  '0 3 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/validate-all-links',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  ) AS request_id;
  $$
);
```

#### 4.3 客户端启动检查 API

**API**：`GET /api/maintenance/check`

**功能**：客户端启动时调用，检查是否需要触发垃圾箱清理或失效检测

```typescript
// src/app/api/maintenance/check/route.ts

export async function GET(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 获取用户的最后执行时间
  const { data: profile } = await supabase
    .from("profiles")
    .select("last_trash_cleanup_at, last_validation_at")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return new Response("Profile not found", { status: 404 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const tasks: string[] = [];

  // 检查垃圾箱清理（超过30天或从未执行）
  if (
    !profile.last_trash_cleanup_at ||
    new Date(profile.last_trash_cleanup_at) < thirtyDaysAgo
  ) {
    tasks.push("cleanup-trash");
  }

  // 检查失效检测（超过30天或从未执行）
  if (
    !profile.last_validation_at ||
    new Date(profile.last_validation_at) < thirtyDaysAgo
  ) {
    tasks.push("validate-links");
  }

  return new Response(
    JSON.stringify({
      needMaintenance: tasks.length > 0,
      tasks,
      lastCleanup: profile.last_trash_cleanup_at,
      lastValidation: profile.last_validation_at,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}
```

**API**：`POST /api/maintenance/trigger`

**功能**：手动触发维护任务

```typescript
// src/app/api/maintenance/trigger/route.ts

export async function POST(request: Request) {
  const { task } = await request.json();
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 调用对应的 Edge Function
  const edgeFunctionUrl =
    task === "cleanup-trash"
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cleanup-trash`
      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/validate-all-links`;

  try {
    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: user.id }),
    });

    const result = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        task,
        result,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
```

**前端启动检查逻辑**：

```typescript
// src/hooks/use-maintenance-check.ts

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function useMaintenanceCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const response = await fetch("/api/maintenance/check");
        const data = await response.json();

        if (data.needMaintenance && data.tasks.length > 0) {
          // 自动触发维护任务（静默执行）
          for (const task of data.tasks) {
            await fetch("/api/maintenance/trigger", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ task }),
            });
          }

          toast({
            title: "系统维护完成",
            description: `已完成${data.tasks.length}项维护任务`,
          });
        }
      } catch (error) {
        console.error("Maintenance check failed:", error);
      } finally {
        setIsChecking(false);
      }
    };

    // 应用启动时检查
    setIsChecking(true);
    checkMaintenance();
  }, []);

  return { isChecking };
}
```

**在根布局中使用**：

```typescript
// src/app/(main)/layout.tsx

import { useMaintenanceCheck } from "@/hooks/use-maintenance-check";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  useMaintenanceCheck();  // 启动时自动检查

  return <>{children}</>;
}
```

---

### 五、前端实现

#### 5.1 路由设计

```typescript
// 虚拟文件夹路由
/home?folder=trash           // 垃圾箱
/home?folder=invalid         // 已失效
/home?folder=high-value      // 高价值
/home?folder=123             // 普通文件夹（现有逻辑）
```

#### 5.2 侧边栏文件夹树

```typescript
// src/components/layout/sidebar.tsx

// 系统文件夹区域（新增）
📂 系统文件夹
  ├── 📥 待整理 (INBOX)
  ├── ⭐ 高价值 (HIGH_VALUE)       // 新增
  ├── ❌ 已失效 (INVALID)          // 新增
  └── 🗑️ 垃圾箱 (TRASH)           // 新增

📂 我的文件夹
  ├── 💼 工作
  └── 📚 学习
```

**实现代码**：

```typescript
const systemFolders = [
  { id: "inbox", name: "待整理", icon: "📥", count: inboxCount },
  { id: "high-value", name: "高价值", icon: "⭐", count: highValueCount },
  { id: "invalid", name: "已失效", icon: "❌", count: invalidCount },
  { id: "trash", name: "垃圾箱", icon: "🗑️", count: trashCount },
];
```

#### 5.3 垃圾箱页面

**新增组件**：`src/components/trash/trash-page.tsx`

**功能**：

- ✅ 显示垃圾箱中的所有收藏
- ✅ 恢复单个/批量收藏
- ✅ 永久删除单个/批量收藏
- ✅ 清空垃圾箱按钮（带二次确认）
- ✅ 显示剩余保留天数（30 - 已经过天数）

**UI 示例**：

```tsx
<div className="trash-page">
  <div className="trash-header">
    <h2>垃圾箱</h2>
    <Button variant="destructive" onClick={handleEmptyTrash}>
      清空垃圾箱
    </Button>
  </div>

  {bookmarks.map((bookmark) => (
    <BookmarkCard
      key={bookmark.id}
      bookmark={bookmark}
      actions={
        <>
          <Button onClick={() => handleRestore(bookmark.id)}>恢复</Button>
          <Button
            variant="destructive"
            onClick={() => handlePermanentDelete(bookmark.id)}
          >
            永久删除
          </Button>
          <span className="text-muted-foreground">
            {getDaysRemaining(bookmark.trashed_at)} 天后自动删除
          </span>
        </>
      }
    />
  ))}
</div>
```

#### 5.4 数据统计页面

**新增页面**：`src/app/(main)/data/page.tsx`

**显示内容**：

- ✅ 最新失效检测统计卡片
- ✅ 历史检测趋势图表（可选）
- ✅ 失效收藏列表（可跳转详情）
- ✅ 手动触发检测按钮

---

## 📅 实施阶段

### Stage 1: 数据库迁移和基础 API

**目标**: 完成数据模型扩展和核心 API

**任务**:

- [ ] 创建数据库迁移文件
  - 新增 bookmarks 表字段
  - 创建 validation_history 表
  - 添加索引
- [ ] 改造删除 API（移入垃圾箱）
- [ ] 创建恢复 API
- [ ] 创建永久删除 API
- [ ] 创建批量操作 API

**成功标准**:

- 迁移脚本无错误执行
- 所有 API 通过测试
- RLS 策略验证通过

**预计时间**: 4小时

---

### Stage 2: 虚拟文件夹查询逻辑

**目标**: 实现三个虚拟文件夹的查询

**任务**:

- [ ] 改造首页查询逻辑（排除垃圾箱）
- [ ] 实现垃圾箱查询
- [ ] 实现已失效查询
- [ ] 实现高价值查询
- [ ] 优化查询性能（索引验证）

**成功标准**:

- 每个虚拟文件夹查询正确
- 查询性能 < 500ms（1000条数据）
- 分页功能正常

**预计时间**: 3小时

---

### Stage 3: 前端 UI 实现

**目标**: 完成垃圾箱、已失效、高价值的前端界面

**任务**:

- [ ] 扩展侧边栏（新增3个系统文件夹）
- [ ] 实现垃圾箱页面
- [ ] 改造删除操作流程
- [ ] 实现已失效页面
- [ ] 实现高价值页面
- [ ] Toast 提示优化

**成功标准**:

- UI 符合设计规范（Shadcn UI）
- 操作流程流畅
- 错误提示友好

**预计时间**: 6小时

---

### Stage 4: 链接失效检测

**目标**: 实现手动和自动失效检测

**任务**:

- [ ] 复用现有 link-validator.ts 逻辑
- [ ] 创建失效检测 API
- [ ] 实现批量检测逻辑
- [ ] 更新 is_invalid 状态
- [ ] 记录 validation_history
- [ ] 前端触发检测按钮
- [ ] 显示检测进度

**成功标准**:

- 检测准确率 > 95%
- 并发控制正常（最多20个）
- 检测结果正确记录

**预计时间**: 4小时

---

### Stage 5: 定时任务实现

**目标**: 实现自动清理和自动检测

**任务**:

- [ ] 创建 cleanup-trash Edge Function
- [ ] 创建 validate-all-links Edge Function
- [ ] 配置 pg_cron 定时任务
- [ ] 测试定时任务执行
- [ ] 日志记录和错误处理

**成功标准**:

- 定时任务按时执行
- 错误自动重试
- 执行日志可查询

**预计时间**: 3小时

---

### Stage 6: 数据统计页面

**目标**: 实现失效检测历史和统计展示

**任务**:

- [ ] 创建数据页面路由
- [ ] 实现检测历史列表
- [ ] 实现趋势图表（可选）
- [ ] 实现失效收藏列表
- [ ] 手动触发检测按钮

**成功标准**:

- 数据展示清晰
- 可跳转到失效收藏详情
- 手动检测按钮可用

**预计时间**: 3小时

---

## ⏱️ 时间估算总览

| 阶段     | 预计工时 | 优先级 |
| -------- | -------- | ------ |
| Stage 1  | 4h       | P0     |
| Stage 2  | 3h       | P0     |
| Stage 3  | 6h       | P0     |
| Stage 4  | 4h       | P1     |
| Stage 5  | 3h       | P1     |
| Stage 6  | 3h       | P2     |
| **总计** | **23h**  | -      |

---

## 🔒 安全性

1. **RLS 策略**：所有操作都受 RLS 保护
2. **权限检查**：锁定的收藏无法删除
3. **二次确认**：永久删除需要用户确认
4. **API 限流**：防止滥用检测 API

---

## ⚡ 性能优化

1. **索引优化**：垃圾箱、失效、高价值查询都有专用索引
2. **批量操作**：使用 `IN` 查询和批量 UPDATE
3. **并发控制**：链接检测最多20个并发
4. **分页查询**：所有列表都支持分页

---

## ⚠️ 风险评估

### 高风险

1. **定时任务可靠性**：pg_cron 可能失败
   - 缓解：添加手动触发按钮
   - 缓解：记录执行日志

2. **链接检测误判**：某些网站可能误报失效
   - 缓解：支持手动标记为有效
   - 缓解：重试机制

### 中风险

1. **性能问题**：大量收藏检测耗时长
   - 缓解：批量处理和并发控制
   - 缓解：后台异步执行

2. **存储计数不一致**：永久删除时需要更新存储计数
   - 缓解：使用现有 `decrement_storage_used()` 函数

### 低风险

1. **UI 兼容性**：新文件夹图标显示
   - 缓解：使用统一的图标库

---

## 📦 交付物

### 代码文件

- 数据库迁移文件 x 1
- API Routes x 10
- Edge Functions x 2
- React 组件 x 5
- Hooks x 2
- 类型定义 x 1

### 文档

- API 文档更新
- 用户手册更新
- 测试报告

---

## 🎯 后续优化

1. **智能检测**：根据网站历史可靠性调整检测频率
2. **批量恢复**：支持按条件批量恢复
3. **导出功能**：导出失效检测报告
4. **通知功能**：检测完成后发送通知

---

## 🔄 关键变更总结（基于用户反馈）

### 1. 垃圾箱清理周期

**变更前**: 7天后自动删除
**变更后**: 30天后自动删除

**影响**：

- 用户有更长时间恢复误删的收藏
- 数据库存储开销略有增加（可接受）

### 2. 触发机制设计

**变更前**: 服务器定时任务（每天/每月固定时间）
**变更后**: **混合触发机制**

```
服务器端（主要）：
  - 垃圾箱清理：每月1号凌晨2点
  - 失效检测：每月1号凌晨3点

客户端（兜底）：
  - 应用启动时检查 profiles 表时间戳
  - 超过30天自动触发相应任务
  - 更新 last_trash_cleanup_at / last_validation_at
```

**优势**：

- ✅ 服务器任务失败时，客户端自动补救
- ✅ 确保任务至少每30天执行一次
- ✅ 对离线用户友好（重新上线时自动执行）

### 3. 智能过滤逻辑

**新增功能**: 自动跳过无法检测的链接

**过滤规则**：

- 微信公众号（`weixin.qq.com`, `mp.weixin.qq.com`）
- 需要登录的平台（小红书、Twitter、Facebook、Instagram、LinkedIn）
- 本地地址（`localhost`, `192.168.*`, `10.*`, `172.*`）
- 非 HTTP/HTTPS 协议
- 平台类型为 `WECHAT_OFFICIAL_ACCOUNT`

**统计记录**：

- `total_bookmarks`: 用户总收藏数
- `total_checked`: 实际检测数量
- `skipped_count`: 跳过的数量
- `skipped_reasons`: 跳过原因统计（JSONB）

**优势**：

- ✅ 避免无效检测浪费资源
- ✅ 减少误报（微信文章通常需要登录）
- ✅ 提高检测准确率

### 4. 系统文件夹属性

**明确属性**: 所有虚拟文件夹均为系统文件夹，不可删除

```
系统文件夹：
  - 📥 待整理 (INBOX) - 已存在
  - ⭐ 高价值 (HIGH_VALUE) - 新增，虚拟视图
  - ❌ 已失效 (INVALID) - 新增，虚拟视图
  - 🗑️ 垃圾箱 (TRASH) - 新增，虚拟视图
```

**实现方式**：

- 前端路由实现（`/home?folder=trash`）
- 不存储在 `folders` 表中
- 通过查询条件过滤

### 5. 数据模型扩展

**Bookmarks 表**：新增 5 个字段
**Profiles 表**：新增 2 个时间戳字段
**新增 validation_history 表**：记录检测历史

**关键字段**：

- `is_in_trash`: 垃圾箱标记
- `trashed_at`: 进入垃圾箱时间
- `is_invalid`: 失效标记
- `last_validation_at`: 最后验证时间
- `last_trash_cleanup_at`: 上次清理时间（profiles）

---

**状态**: 📝 待审核
**下一步**: 用户审核通过后开始 Stage 1

**关键决策**：

1. ✅ 垃圾箱保留期：30天
2. ✅ 混合触发机制：服务器定时 + 客户端启动检查
3. ✅ 智能过滤：跳过微信、小红书等需登录平台
4. ✅ 高价值文件夹：虚拟视图（非物理复制）
5. ✅ 系统文件夹：不可删除
