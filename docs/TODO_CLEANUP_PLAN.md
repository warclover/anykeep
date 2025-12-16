# TODO 清理计划

> 生成时间: 2025-12-16
> 版本: V4.2.16
> 最后更新: 2025-12-16

## 概述

本文档整理了代码库中所有 TODO 项目，按优先级分类并提供具体的实施计划。

---

## P2 优先级 ✅ 已完成

### 1. Classification Suggestions 数据库扩展 ✅

**状态**: 已完成 (2025-12-16)

**问题描述**: `classification_suggestions` 表当前使用 `bookmark_id` (单数)，需要支持批量聚类建议。

**涉及文件**:

- `src/app/api/classification/cluster-suggestions/route.ts` (3 处)
- `src/app/api/classification/cluster-confirm/route.ts` (2 处)

**当前限制**:

```sql
-- 当前表结构
bookmark_id BIGINT NOT NULL REFERENCES public.bookmarks(id)
```

**需要添加的列**:
| 列名 | 类型 | 说明 |
|------|------|------|
| `bookmark_ids` | `BIGINT[]` | 支持多书签聚类建议 |
| `suggested_action` | `VARCHAR(50)` | 建议动作类型 (create_folder, merge, move, tag) |
| `metadata` | `JSONB` | 扩展元数据 |

**实施步骤**:

```sql
-- 迁移脚本: 20251217000001_extend_classification_suggestions.sql

-- 1. 添加新列
ALTER TABLE public.classification_suggestions
ADD COLUMN IF NOT EXISTS bookmark_ids BIGINT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS suggested_action VARCHAR(50) DEFAULT 'move_to_folder',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. 迁移现有数据
UPDATE public.classification_suggestions
SET bookmark_ids = ARRAY[bookmark_id]
WHERE bookmark_ids = '{}' OR bookmark_ids IS NULL;

-- 3. 添加约束
ALTER TABLE public.classification_suggestions
ADD CONSTRAINT chk_suggested_action
CHECK (suggested_action IN ('move_to_folder', 'create_folder', 'merge_folders', 'add_tags'));

-- 4. 添加索引
CREATE INDEX IF NOT EXISTS idx_classification_suggestions_action
ON public.classification_suggestions(suggested_action);

-- 5. 添加注释
COMMENT ON COLUMN public.classification_suggestions.bookmark_ids IS '关联的书签ID数组，支持批量建议';
COMMENT ON COLUMN public.classification_suggestions.suggested_action IS '建议动作类型';
COMMENT ON COLUMN public.classification_suggestions.metadata IS '扩展元数据，如置信度详情、相关标签等';
```

**代码更新**:

1. 更新 `cluster-suggestions/route.ts`:

```typescript
// 修改查询，使用 bookmark_ids
const { data: suggestions } = await supabase
  .from("classification_suggestions")
  .select(
    `
    id, suggested_folder_name, bookmark_ids, suggested_action,
    confidence, reason, metadata, created_at
  `,
  )
  .eq("user_id", user.id)
  .eq("status", "pending");
```

2. 更新 `cluster-confirm/route.ts`:

```typescript
// 移除类型断言，直接使用正确类型
const bookmarkIds = suggestion.bookmark_ids || [suggestion.bookmark_id];
```

**预计工时**: 2-3 小时

---

### 2. Snapshot Storage 清理功能 ✅

**状态**: 已完成 (2025-12-16)

**问题描述**: 删除快照时未清理 Supabase Storage 中的文件。

**涉及文件**:

- `src/lib/snapshot/snapshot.service.ts:577`

**已实现代码**:

```typescript
async deleteSnapshot(userId: string, snapshotId: number): Promise<boolean> {
  const snapshot = await this.getSnapshotById(userId, snapshotId);
  if (!snapshot) return false;

  // 收集需要删除的存储文件路径
  const pathsToDelete: string[] = [];
  if (snapshot.screenshot_storage_path) {
    pathsToDelete.push(snapshot.screenshot_storage_path);
  }
  // ... 清理 Storage 文件（失败不阻塞记录删除）

  const { error } = await getSnapshotsTable(supabase)
    .delete()
    .eq("id", snapshotId);
  // ...
}
```

**实施方案**:

```typescript
async deleteSnapshot(userId: string, snapshotId: number): Promise<boolean> {
  const supabase = await this.getSupabase();
  const snapshot = await this.getSnapshotById(userId, snapshotId);
  if (!snapshot) return false;

  // 清理 Storage 文件
  const pathsToDelete: string[] = [];

  if (snapshot.screenshot_storage_path) {
    pathsToDelete.push(snapshot.screenshot_storage_path);
  }
  if (snapshot.html_storage_path && !snapshot.html_storage_path.startsWith('inline:')) {
    pathsToDelete.push(snapshot.html_storage_path);
  }

  if (pathsToDelete.length > 0) {
    const { error: storageError } = await supabase.storage
      .from('snapshots')
      .remove(pathsToDelete);

    if (storageError) {
      logger.warn(
        { error: storageError.message, snapshotId, paths: pathsToDelete },
        '[SnapshotService] Failed to delete storage files, continuing with record deletion'
      );
      // 继续删除记录，即使存储清理失败
    }
  }

  // 删除数据库记录
  const { error } = await getSnapshotsTable(supabase)
    .delete()
    .eq("id", snapshotId)
    .eq("user_id", userId);

  if (error) {
    logger.error({ error: error.message, snapshotId }, "[SnapshotService] Failed to delete snapshot");
    return false;
  }

  logger.info({ snapshotId, cleanedFiles: pathsToDelete.length }, "[SnapshotService] Snapshot deleted");
  return true;
}
```

**预计工时**: 1 小时

---

## P3 优先级 (建议本月完成)

### 3. Folder Organization 热度追踪 ✅

**状态**: 已完成 (2025-12-16)

**涉及文件**:

- `src/lib/folder-organization/init.ts` (3 处)
- `src/lib/folder-organization/services/heat-tracker.service.ts` (新建)

**已实现**:

- ✅ 热度追踪定时任务 (`FolderHeatTrackerService`)
- ✅ 从数据库查询待处理建议数量 (`getPendingSuggestionsCount`)
- ✅ 模块状态返回实际热度追踪状态 (`heatTrackerActive`)
- ✅ 新增异步完整状态查询 (`getFullFolderOrganizationStatus`)

**实际工时**: 2 小时

---

### 4. Summary 模块 Ollama 集成

**涉及文件**:

- `src/lib/summary/summary.config.ts` (3 处)
- `src/lib/summary/providers/provider.factory.ts` (1 处)
- `src/lib/summary/prompts/index.ts` (1 处)

**待实现**:

- Ollama Provider 实现
- Ollama 服务检测
- 本地模型 Prompt 优化

**预计工时**: 8-12 小时

---

### 5. Settings 页面功能 ✅

**状态**: 已完成 (2025-12-16)

**涉及文件**:

- `src/components/settings/settings-page-client.tsx` (3 处)
- `src/app/api/user/export/route.ts` (新建)
- `src/app/api/user/delete/route.ts` (新建)

**已实现**:

- ✅ 平台 OAuth 流程（占位提示，需各平台开发者账号配置）
- ✅ 数据导出功能 (`POST /api/user/export`)
  - 导出书签、文件夹、浏览器书签、用户设置
  - JSON 格式下载
- ✅ 账号删除功能 (`DELETE /api/user/delete`)
  - 二次确认（邮箱验证）
  - 清理 Storage 文件
  - 级联删除所有关联数据

**实际工时**: 3 小时

---

## P4 优先级 (可延后)

### 6. 其他零散 TODO

| 文件                                                | 行号 | 内容                      | 工时 | 状态      |
| --------------------------------------------------- | ---- | ------------------------- | ---- | --------- |
| `classification/learning/learning-event-handler.ts` | 165  | 获取书签的标签和来源      | 1h   | ✅ 已完成 |
| `quick-add/drawer/DetailDrawer.tsx`                 | 187  | 从 API 加载文件夹         | 1h   | ✅ 已完成 |
| `confirmation/confirmation.service.ts`              | 651  | 加载关联的书签/文件夹信息 | 2h   | 待处理    |
| `confirmation/confirmation-expiry.cron.ts`          | 163  | 按用户分组发送通知        | 3h   | 待处理    |
| `metrics/classification-metrics.ts`                 | 542  | 发送到指标收集服务        | 4h   | 待处理    |

---

## 执行计划

### 本周 (P2)

| 日期  | 任务                                | 负责人 | 状态 |
| ----- | ----------------------------------- | ------ | ---- |
| Day 1 | Classification Suggestions 迁移脚本 | -      | ✅   |
| Day 1 | Classification Suggestions 代码更新 | -      | ✅   |
| Day 2 | Snapshot Storage 清理功能           | -      | ✅   |
| Day 2 | 测试验证                            | -      | ✅   |

### 本月 (P3)

| 周次   | 任务                         | 预计工时 |
| ------ | ---------------------------- | -------- |
| Week 2 | Folder Organization 热度追踪 | 6h       |
| Week 3 | Summary Ollama 集成          | 12h      |
| Week 4 | Settings 页面功能            | 16h      |

---

## 注意事项

1. **数据库迁移**: 所有数据库变更需要先在本地测试，确保向后兼容
2. **Storage 清理**: 失败时应继续删除记录，避免数据不一致
3. **类型断言**: 迁移完成后移除所有 `as unknown as` 类型断言

---

## 验收标准

- [ ] 所有 P2 TODO 已清理
- [ ] 无类型断言警告
- [ ] 单元测试覆盖
- [ ] ESLint 检查通过
- [ ] 数据库迁移已应用到生产环境
