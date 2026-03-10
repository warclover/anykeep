# 桥接模块评估与清理路线图

> 生成时间：2026-03-10 | 基于 Batch 5.4 全局评估

## 概述

项目中有 21 个桥接模块位于 `src/lib/` 下，通过 `@/lib/classification/` 路径别名（映射到 `_archived/classification-v1/`）进行 re-export。本文档评估每个模块的功能是否已在 v2 中实现，并给出处置建议。

## 评估表格

| 桥接模块路径                           | 导出内容                                                            | 引用次数 | v2 等效 | 建议     |
| -------------------------------------- | ------------------------------------------------------------------- | -------- | ------- | -------- |
| `ai-librarian/index.ts`                | `createAILibrarianService`                                          | 1        | 无      | **删除** |
| `classification-client/index.ts`       | `TagPreMatcher`, `FolderCacheSyncService`                           | 1        | 无      | 保留     |
| `classification-config/index.ts`       | `getConfigCenter`                                                   | 1        | 部分    | **迁移** |
| `classification-constants/index.ts`    | `CLASSIFICATION_WEIGHTS`, `UNIVERSAL_CATEGORIES` 等                 | 2        | 部分    | **迁移** |
| `classification-integration/index.ts`  | `classifyBookmarkV2`, `shouldUseV2Classification`                   | 2        | 是      | **迁移** |
| `classification-matchers/index.ts`     | `tagMatcher`, `titleMatcher`                                        | 2        | 无      | 保留     |
| `embedding-ab-test/index.ts`           | `embeddingABTestService`                                            | 2        | 无      | 保留     |
| `folder-evolution/index.ts`            | `mergeService`, `splitService`, `renameService`, `reportService`    | 11       | 无      | 保留     |
| `folder-naming/index.ts`               | `FOLDER_NAMING_RULES`, `sanitizeFolderName`, `generateFallbackName` | 1        | 部分    | **迁移** |
| `folder-quota/index.ts`                | `UnifiedQuotaService`                                               | 2        | 无      | 保留     |
| `folder-tag-profiler/index.ts`         | `FolderTagProfilerService`                                          | 2        | 无      | 保留     |
| `folder/health/index.ts`               | `FolderHealthService`                                               | 2        | 无      | 保留     |
| `folder/organization/index.ts`         | `SmartSortingService`, `FolderAutoOrganizationService` 等           | 1        | 无      | 保留     |
| `folder/organization/init.ts`          | `initFolderOrganization`, `stopFolderOrganization`                  | 0        | 无      | **删除** |
| `folder/profile/index.ts`              | `FolderProfileRepository`, `SuggestionRepository`                   | 3        | 无      | 保留     |
| `interests/index.ts`                   | `InterestService`, `InterestProfileService`                         | 6        | 无      | 保留     |
| `job-queue/index.ts`                   | `JobQueueService`                                                   | 3        | 无      | 保留     |
| `operation-log/index.ts`               | `OperationLogService`, undo/persistence 函数                        | 8        | 部分    | 保留     |
| `prompts/index.ts`                     | `getPromptConfig`, `buildTypeSpecificPrompt`                        | 3        | 部分    | **迁移** |
| `tag-graph/index.ts`                   | `tagGraphService`                                                   | 3        | 无      | 保留     |
| `folder-organization/init.ts` (旧位置) | 同 `folder/organization/init.ts`                                    | 0        | N/A     | **删除** |

## 分类统计

| 类别               | 数量 | 模块                                                                                                |
| ------------------ | ---- | --------------------------------------------------------------------------------------------------- |
| 删除（无损）       | 3    | ai-librarian, folder/organization/init.ts, folder-organization/init.ts                              |
| 迁移（有 v2 等效） | 5    | classification-config, classification-constants, classification-integration, folder-naming, prompts |
| 保留（必要或活跃） | 13   | 其余模块                                                                                            |

## 关键发现

1. **v2 并不完全替代 v1**：v2 专注于单条书签的分类决策，而 v1 包含文件夹演进、健康诊断、兴趣域管理、文件夹画像等独立功能。

2. **最高引用数的是文件夹演进** (`folder-evolution/`, 11 refs)，表明这是核心功能，需独立维护。

3. **操作日志有两层次**：
   - v2 `operation-log.ts`：单条书签分类撤销
   - v1 `operation-log/`：文件夹层级操作撤销与通知

4. **统一文件夹模块正在过渡**：`src/lib/folder/organization/` 是新入口，但仍桥接导入 v1。

## 实施建议

| 阶段              | 内容                                               | 预估工时 |
| ----------------- | -------------------------------------------------- | -------- |
| Phase 1（立即）   | 删除 3 个无引用/废弃模块                           | 30min    |
| Phase 2（本迭代） | 迁移 config/constants/folder-naming 到 v2          | 2h       |
| Phase 3（后续）   | 重构 classification-integration，统一 prompts 系统 | 4h       |
| Phase 4（长期）   | 丰富 `folder/organization/` 模块，减少 v1 桥接依赖 | 8h+      |
