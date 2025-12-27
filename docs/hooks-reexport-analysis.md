# Hooks Re-export 文件清理报告

> 生成日期: 2025-12-27
> **状态: ✅ 已完成**

---

## 执行摘要

| 分类                    | 数量   | 状态            |
| ----------------------- | ------ | --------------- |
| Phase 1: 无使用直接删除 | 9      | ✅ 已删除       |
| Phase 2: 高频使用迁移   | 2      | ✅ 已迁移并删除 |
| Phase 3-4: 其余迁移     | 26     | ✅ 已迁移并删除 |
| **总计删除**            | **37** | ✅ 全部完成     |

---

## 迁移详情

### Phase 1: 直接删除（9 个，无活跃导入）

| 文件                        | 原目标模块           |
| --------------------------- | -------------------- |
| `use-bookmark-actions.ts`   | `./domain/bookmark/` |
| `use-extension-auth.ts`     | `./domain/platform/` |
| `use-import-history.ts`     | `./data/`            |
| `use-import-session.ts`     | `./domain/import/`   |
| `use-merge-suggestions.ts`  | `./domain/folder/`   |
| `use-metadata-fetcher.ts`   | `./data/`            |
| `use-platform-cache.ts`     | `./core/`            |
| `use-rename-suggestions.ts` | `./domain/folder/`   |
| `use-split-suggestions.ts`  | `./domain/folder/`   |

### Phase 2: 高频使用迁移（2 个）

| 文件                       | 使用次数 | 迁移至         |
| -------------------------- | -------- | -------------- |
| `use-abortable-fetch.ts`   | 18       | `@/hooks/core` |
| `use-custom-usage-tags.ts` | 9        | `@/hooks/data` |

### Phase 3-4: 其余迁移（26 个）

#### Data Hooks → `@/hooks/data`

- `use-smart-lists.ts` (4处)
- `use-messages.ts` (2处)
- `use-init-data.ts` (2处)
- `use-user.ts` (1处)
- `use-unread-count.ts` (1处)
- `use-smart-list-bookmarks.ts` (1处)
- `use-page-data.ts` (1处)
- `use-folder-profile.ts` (1处)

#### Core Hooks → `@/hooks/core`

- `use-color-theme.ts` (2处)
- `use-selection-mode.ts` (1处)
- `use-dialogs.ts` (1处)
- `use-debug-config.ts` (1处)

#### UI Hooks → `@/hooks/ui`

- `use-message-notification.ts` (3处)
- `use-processing-poller.ts` (2处)
- `use-classification-polling.ts` (2处)
- `use-trust-mode.ts` (1处)
- `use-confirmations.ts` (1处)

#### Domain Hooks

- `use-auto-snapshot.ts` → `@/hooks/domain/bookmark` (3处)
- `use-auto-snapshot-settings.ts` → `@/hooks/domain/bookmark` (2处)
- `use-reclassify.ts` → `@/hooks/domain/bookmark` (1处)
- `use-vision-analysis.ts` → `@/hooks/domain/ai` (1处)
- `use-evolution-reports.ts` → `@/hooks/domain/ai` (1处)
- `use-inbox-organization.ts` → `@/hooks/domain/ai` (1处)
- `use-librarian-analysis.ts` → `@/hooks/domain/folder` (1处)
- `use-operation-history.ts` → `@/hooks/domain/folder` (1处)
- `use-capacitor.ts` → `@/hooks/domain/platform` (1处)

---

## 验证结果

```
✅ TypeScript 类型检查通过
✅ 37 个 re-export 文件全部删除
✅ 66 处导入路径已迁移
```

---

## Hooks 目录最终结构

```
src/hooks/
├── core/                    # 核心通用 hooks
│   ├── use-abortable-fetch.ts
│   ├── use-color-theme.ts
│   ├── use-debug-config.ts
│   ├── use-dialogs.ts
│   └── use-selection-mode.ts
├── data/                    # 数据获取 hooks
│   ├── use-custom-usage-tags.ts
│   ├── use-folder-profile.ts
│   ├── use-folders.ts
│   ├── use-import-history.ts
│   ├── use-init-data.ts
│   ├── use-messages.ts
│   ├── use-metadata-fetcher.ts
│   ├── use-page-data.ts
│   ├── use-smart-list-bookmarks.ts
│   ├── use-smart-lists.ts
│   ├── use-unread-count.ts
│   └── use-user.ts
├── domain/                  # 领域特定 hooks
│   ├── ai/
│   ├── bookmark/
│   ├── folder/
│   ├── import/
│   └── platform/
└── ui/                      # UI 相关 hooks
    ├── use-classification-polling.ts
    ├── use-confirmations.ts
    ├── use-message-notification.ts
    ├── use-processing-poller.ts
    └── use-trust-mode.ts
```
