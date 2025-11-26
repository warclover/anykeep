# AnyKeep - 代码优化实施指南

本文档提供具体的代码优化实施步骤和示例代码。

---

## 🔴 Priority 0: 类型安全修复

### 1. 修复 Folders API 类型定义

**文件**: `src/app/api/folders/[id]/route.ts`

#### 当前问题
```typescript
// ❌ Line 159
const updateData: any = {}
```

#### 修复方案
```typescript
// ✅ 1. 定义更新类型
type FolderUpdateFields = Partial<Pick<Folder, 'name' | 'parent_id' | 'color' | 'icon'>>

// ✅ 2. 使用严格类型
const updateData: FolderUpdateFields = {}

if (name !== undefined) updateData.name = name
if (parentId !== undefined) updateData.parent_id = parentId
if (color !== undefined) updateData.color = color
if (icon !== undefined) updateData.icon = icon
```

---

**文件**: `src/app/api/folders/route.ts`

#### 当前问题
```typescript
// ❌ Line 111-113
function buildFolderTree(folders: any[]): any[] {
  const folderMap = new Map<number, any>()
  const rootFolders: any[] = []
}
```

#### 修复方案
```typescript
// ✅ 1. 定义树节点类型
interface FolderTreeNode extends Folder {
  children: FolderTreeNode[]
}

// ✅ 2. 类型安全的树构建
function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const folderMap = new Map<number, FolderTreeNode>()
  const rootFolders: FolderTreeNode[] = []

  // 初始化所有文件夹节点
  folders.forEach((folder) => {
    folderMap.set(folder.id, { ...folder, children: [] })
  })

  // 构建树结构
  folders.forEach((folder) => {
    const node = folderMap.get(folder.id)!
    if (folder.parent_id === null) {
      rootFolders.push(node)
    } else {
      const parent = folderMap.get(folder.parent_id)
      if (parent) {
        parent.children.push(node)
      }
    }
  })

  return rootFolders
}
```

---

## 🔴 Priority 0: 批量删除 API 优化

### 问题分析

**当前实现** (前端并发请求):
```typescript
// ❌ N 个 HTTP 请求 + N 个数据库事务
const deletePromises = Array.from(selectedIds).map((id) =>
  fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
)
const results = await Promise.all(deletePromises)
```

**性能问题**:
- 100 条收藏 = 100 次 HTTP 往返
- 每次请求独立事务，无原子性保证
- 可能出现部分成功部分失败

---

### 优化方案: 批量删除 API

#### 步骤 1: 创建批量删除 API

**新建文件**: `src/app/api/bookmarks/batch-delete/route.ts`

```typescript
/**
 * 批量删除收藏 API
 * POST /api/bookmarks/batch-delete
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  successResponse,
  unauthorizedError,
  forbiddenError,
  databaseError,
  handleValidationError,
  internalError,
} from '@/lib/utils/api-response'

// 批量删除请求验证
const batchDeleteSchema = z.object({
  ids: z
    .array(z.number().positive())
    .min(1, '至少选择一条收藏')
    .max(100, '单次最多删除 100 条'),
})

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return unauthorizedError('请先登录')
    }

    // 2. 解析并验证请求体
    const body = await request.json()
    const validation = batchDeleteSchema.safeParse(body)

    if (!validation.success) {
      return handleValidationError(validation.error)
    }

    const { ids } = validation.data

    // 3. 验证所有收藏都属于当前用户（防止越权删除）
    const { data: bookmarks, error: checkError } = await supabase
      .from('bookmarks')
      .select('id, user_id')
      .in('id', ids)
      .is('deleted_at', null)

    if (checkError) {
      return databaseError('检查收藏失败', checkError)
    }

    // 检查权限
    const unauthorizedIds = bookmarks?.filter((b) => b.user_id !== user.id).map((b) => b.id)
    if (unauthorizedIds && unauthorizedIds.length > 0) {
      return forbiddenError(`无权限删除收藏: ${unauthorizedIds.join(', ')}`)
    }

    // 检查不存在的 ID
    const existingIds = bookmarks?.map((b) => b.id) || []
    const notFoundIds = ids.filter((id) => !existingIds.includes(id))
    if (notFoundIds.length > 0) {
      console.warn('[Batch Delete] Not found IDs:', notFoundIds)
    }

    // 4. 批量软删除（单次事务）
    const { error: deleteError } = await supabase
      .from('bookmarks')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', existingIds)

    if (deleteError) {
      return databaseError('批量删除失败', deleteError)
    }

    // 5. 批量减少存储计数
    const { error: decrementError } = await supabase.rpc('decrement_storage_used', {
      target_user_id: user.id,
      count: existingIds.length,
    })

    if (decrementError) {
      console.error('[Batch Delete] Failed to decrement storage:', decrementError)
      // 存储计数失败不影响删除操作
    }

    // 6. 返回结果
    return successResponse({
      deletedCount: existingIds.length,
      notFoundCount: notFoundIds.length,
      totalRequested: ids.length,
    })
  } catch (error) {
    console.error('POST /api/bookmarks/batch-delete error:', error)
    return internalError('批量删除时发生错误')
  }
}
```

---

#### 步骤 2: 更新数据库函数

**SQL 迁移**: 创建 `supabase/migrations/xxx_add_batch_decrement.sql`

```sql
-- 批量减少存储计数函数
CREATE OR REPLACE FUNCTION decrement_storage_used(
  target_user_id UUID,
  count INTEGER DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET storage_used = GREATEST(0, storage_used - count)
  WHERE id = target_user_id;
END;
$$;
```

---

#### 步骤 3: 更新前端调用

**文件**: `src/components/home/home-page-client.tsx`

```typescript
// ✅ 替换原有的批量删除实现
const handleBatchDelete = async () => {
  if (selectedIds.size === 0) return

  if (!confirm(`确定要删除选中的 ${selectedIds.size} 条收藏吗？删除后无法恢复。`)) {
    return
  }

  setIsBatchDeleting(true)
  try {
    // 单次 HTTP 请求
    const res = await fetch('/api/bookmarks/batch-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids: Array.from(selectedIds),
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error?.message || '批量删除失败')
    }

    // 成功反馈
    const { deletedCount, notFoundCount } = data.data
    if (notFoundCount > 0) {
      toast.warning(`已删除 ${deletedCount} 条，${notFoundCount} 条不存在`)
    } else {
      toast.success(`成功删除 ${deletedCount} 条收藏`)
    }

    // 乐观更新 UI
    setBookmarks((prev) => prev.filter((b) => !selectedIds.has(b.id)))
    setSelectedIds(new Set())
    setIsSelectionMode(false)

    // 刷新数据
    startTransition(() => {
      router.refresh()
    })
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '批量删除失败')
  } finally {
    setIsBatchDeleting(false)
  }
}
```

---

#### 性能对比

| 指标 | 旧方案（并发请求） | 新方案（批量API） | 提升 |
|------|------------------|------------------|------|
| **HTTP 请求数** | 100 次 | 1 次 | **99% ↓** |
| **数据库事务** | 100 个 | 1 个 | **99% ↓** |
| **响应时间** | ~5-10s | ~200-500ms | **95% ↓** |
| **失败处理** | 部分成功 | 原子性保证 | **一致性 ✅** |

---

## 🔴 Priority 0: 数据库索引优化

### 查询分析

#### 当前慢查询
```sql
-- 首页查询（未索引优化）
SELECT * FROM bookmarks
WHERE user_id = 'xxx'
  AND deleted_at IS NULL
  AND platform = 'WECHAT_OFFICIAL_ACCOUNT'
ORDER BY created_at DESC
LIMIT 50;

-- 性能: ~200-500ms (10,000+ 条记录)
```

---

### 索引方案

**创建迁移**: `supabase/migrations/xxx_add_performance_indexes.sql`

```sql
-- ========================================
-- 性能优化索引
-- ========================================

-- 1. 首页查询主索引（复合索引 + 部分索引）
-- 覆盖: user_id + deleted_at + created_at 排序
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_active_created
ON bookmarks (user_id, created_at DESC)
WHERE deleted_at IS NULL;

-- 2. 平台筛选索引
-- 覆盖: user_id + platform + deleted_at
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_platform
ON bookmarks (user_id, platform)
WHERE deleted_at IS NULL;

-- 3. 文件夹筛选索引
-- 覆盖: folder_id 查询
CREATE INDEX IF NOT EXISTS idx_bookmarks_folder
ON bookmarks (folder_id)
WHERE deleted_at IS NULL;

-- 4. 标题搜索索引（GIN 索引用于全文搜索）
-- 覆盖: title ILIKE '%keyword%'
CREATE INDEX IF NOT EXISTS idx_bookmarks_title_trgm
ON bookmarks USING gin (title gin_trgm_ops);

-- 5. 描述搜索索引
-- 覆盖: description ILIKE '%keyword%'
CREATE INDEX IF NOT EXISTS idx_bookmarks_description_trgm
ON bookmarks USING gin (description gin_trgm_ops);

-- 6. 向量搜索索引（未来 AI 语义搜索）
-- CREATE INDEX IF NOT EXISTS idx_bookmarks_embedding
-- ON bookmarks USING ivfflat (embedding vector_cosine_ops);

-- ========================================
-- 统计信息更新
-- ========================================
ANALYZE bookmarks;

-- ========================================
-- 索引使用情况监控查询
-- ========================================
-- 使用以下查询检查索引效率:
--
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan,
--   idx_tup_read,
--   idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE tablename = 'bookmarks'
-- ORDER BY idx_scan DESC;
```

---

### 预期性能提升

| 查询场景 | 优化前 | 优化后 | 提升 |
|---------|--------|--------|------|
| 首页列表（全部） | 200ms | 20ms | **90% ↓** |
| 平台筛选查询 | 300ms | 30ms | **90% ↓** |
| 文件夹查询 | 150ms | 15ms | **90% ↓** |
| 标题搜索 | 500ms | 50ms | **90% ↓** |

---

## 🟡 Priority 1: 结构化日志系统

### 安装 Pino 日志库

```bash
npm install pino pino-pretty
```

---

### 创建日志工具

**新建文件**: `src/lib/logger.ts`

```typescript
/**
 * 结构化日志工具
 * 基于 Pino 实现
 */

import pino from 'pino'

// 日志级别配置
const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug'

// 创建日志实例
export const logger = pino({
  level: logLevel,
  // 开发环境美化输出
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  // 生产环境结构化输出
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
})

// 创建子日志器（带上下文）
export const createLogger = (context: string) => {
  return logger.child({ context })
}

// 使用示例:
// const log = createLogger('BookmarkAPI')
// log.info({ url, userId }, 'Creating new bookmark')
// log.error({ error, bookmarkId }, 'Failed to generate AI summary')
```

---

### 替换现有日志

**示例**: `src/app/api/bookmarks/route.ts`

```typescript
// ❌ 旧代码
console.log('[Crawler] Auto-crawling content from:', url)
console.error('[AI] Failed:', error)

// ✅ 新代码
import { createLogger } from '@/lib/logger'
const log = createLogger('BookmarkAPI')

log.info({ url, userId: user.id }, 'Starting content crawl')
log.error({ error, url }, 'AI generation failed', error)
```

---

## 🟡 Priority 1: 请求取消机制

### 实现 AbortController

**文件**: `src/components/home/home-page-client.tsx`

```typescript
import { useRef } from 'react'

export function HomePageClient({ bookmarks: initialBookmarks, error }: HomePageClientProps) {
  // ... 其他状态

  // ✅ 添加 AbortController 引用
  const loadMoreAbortController = useRef<AbortController>()

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return

    // ✅ 取消之前的请求
    loadMoreAbortController.current?.abort()
    loadMoreAbortController.current = new AbortController()

    setIsLoadingMore(true)
    try {
      const lastBookmark = bookmarks[bookmarks.length - 1]
      const params = new URLSearchParams({
        cursor: lastBookmark.id.toString(),
        limit: '50',
      })

      if (currentPlatform) {
        params.append('platform', currentPlatform)
      }

      // ✅ 传入 signal
      const res = await fetch(`/api/bookmarks?${params}`, {
        signal: loadMoreAbortController.current.signal,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || '加载失败')
      }

      const data = await res.json()
      const newBookmarks = data.data.bookmarks

      setBookmarks((prev) => [...prev, ...newBookmarks])
      setHasMore(data.data.pagination.hasMore)
    } catch (error) {
      // ✅ 忽略取消错误
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Load more request cancelled')
        return
      }
      toast.error(error instanceof Error ? error.message : '加载失败')
    } finally {
      setIsLoadingMore(false)
    }
  }

  // ✅ 组件卸载时取消请求
  useEffect(() => {
    return () => {
      loadMoreAbortController.current?.abort()
    }
  }, [])

  // ...
}
```

---

## 🟡 Priority 1: 文案常量化

### 创建消息常量

**新建文件**: `src/lib/constants/messages.ts`

```typescript
/**
 * UI 文案常量
 * 统一管理所有用户可见文本，便于国际化
 */

export const MESSAGES = {
  // 收藏相关
  BOOKMARK: {
    CREATE_SUCCESS: '收藏创建成功！',
    CREATE_ERROR: '创建收藏失败',
    DELETE_CONFIRM: '确定要删除这条收藏吗？删除后无法恢复。',
    DELETE_SUCCESS: '删除成功',
    DELETE_ERROR: '删除失败',
    UPDATE_SUCCESS: '更新成功',
    UPDATE_ERROR: '更新失败',
    BATCH_DELETE_CONFIRM: (count: number) => `确定要删除选中的 ${count} 条收藏吗？删除后无法恢复。`,
    BATCH_DELETE_SUCCESS: (count: number) => `成功删除 ${count} 条收藏`,
  },

  // 标签相关
  TAGS: {
    UPDATE_SUCCESS: '标签更新成功',
    UPDATE_ERROR: '更新标签失败',
    PLACEHOLDER: '输入标签,用逗号或空格分隔',
  },

  // 笔记相关
  NOTES: {
    UPDATE_SUCCESS: '备注更新成功',
    UPDATE_ERROR: '更新备注失败',
    PLACEHOLDER: '输入备注...',
  },

  // 通用操作
  COMMON: {
    LOADING: '加载中...',
    SAVING: '保存中...',
    CANCEL: '取消',
    CONFIRM: '确定',
    SAVE: '保存',
    DELETE: '删除',
    EDIT: '编辑',
  },

  // 错误提示
  ERROR: {
    UNAUTHORIZED: '请先登录',
    FORBIDDEN: '无权限访问',
    NOT_FOUND: '资源不存在',
    NETWORK_ERROR: '网络错误，请稍后重试',
    UNKNOWN_ERROR: '发生未知错误',
  },
} as const
```

---

### 使用示例

```typescript
// ❌ 旧代码
toast.success('收藏创建成功！')
if (!confirm('确定要删除这条收藏吗？删除后无法恢复。')) return

// ✅ 新代码
import { MESSAGES } from '@/lib/constants/messages'

toast.success(MESSAGES.BOOKMARK.CREATE_SUCCESS)
if (!confirm(MESSAGES.BOOKMARK.DELETE_CONFIRM)) return
```

---

## 📊 优化效果验证

### 性能测试清单

创建测试文件: `tests/performance.test.ts`

```typescript
describe('Performance Benchmarks', () => {
  test('批量删除 API 性能', async () => {
    const startTime = performance.now()

    await fetch('/api/bookmarks/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: Array.from({ length: 50 }, (_, i) => i + 1) }),
    })

    const duration = performance.now() - startTime
    expect(duration).toBeLessThan(1000) // < 1 秒
  })

  test('首页查询性能（有索引）', async () => {
    const startTime = performance.now()

    await fetch('/api/bookmarks?limit=50')

    const duration = performance.now() - startTime
    expect(duration).toBeLessThan(500) // < 500ms
  })
})
```

---

## 🎯 验收标准

### Phase 1 完成标准

- ✅ 所有 TypeScript `any` 类型已替换
- ✅ ESLint 无 `@typescript-eslint/no-explicit-any` 警告
- ✅ 批量删除 API 响应时间 < 500ms (100 条)
- ✅ 首页查询响应时间 < 100ms (索引生效)
- ✅ 数据库索引创建成功并验证

### 验证命令

```bash
# 1. 类型检查
npm run type-check

# 2. ESLint 检查
npm run lint

# 3. 运行性能测试
npm run test:performance

# 4. 检查数据库索引
# 在 Supabase Dashboard SQL Editor 执行:
SELECT * FROM pg_indexes WHERE tablename = 'bookmarks';
```

---

**文档版本**: 1.0
**最后更新**: 2025-11-24
**维护人员**: Development Team
