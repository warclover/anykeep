# 收藏夹 Skills 化设计方案

> **版本**: 1.3.0
> **日期**: 2025-12-23
> **状态**: ✅ 已验收（Phase 1-3 完整实现 + 单元测试 + UI 集成）

---

## 1. 概述

### 1.1 目标

将收藏夹（Folder）功能 Skills 化，使 AI 助手能够：

- **感知** 用户的文件夹结构和内容
- **操作** 文件夹（创建、重命名、删除、合并、拆分）
- **管理** 文件夹（移动位置、分组、归档、锁定）
- **移动** 书签到指定文件夹
- **智能** 一键分类待整理文件夹中的书签
- **理解** 用户的自然语言指令并执行

### 1.2 设计原则

1. **双轨并行**：菜单操作与 AI 对话两种方式共存，互不干扰
2. **复用现有 API**：Tools 封装现有 API，不重复实现业务逻辑
3. **遵循现有架构**：参照 `smart-list/` 的 Tools 实现模式
4. **安全优先**：所有写操作需用户确认，系统文件夹受保护

---

## 2. 收藏夹功能清单

### 2.1 现有功能映射

| 功能             | 对应 API                             | UI 入口         | Skills 化         |
| ---------------- | ------------------------------------ | --------------- | ----------------- |
| 列出所有文件夹   | `GET /api/folders`                   | 收藏夹页面      | ✅ 查询 Tool      |
| 获取文件夹详情   | `GET /api/folders/[id]`              | 文件夹卡片      | ✅ 查询 Tool      |
| 获取文件夹内书签 | 书签 API 筛选                        | 首页筛选        | ✅ 查询 Tool      |
| 创建文件夹       | `POST /api/folders`                  | 创建对话框      | ✅ 操作 Tool      |
| 重命名文件夹     | `PUT /api/folders/[id]`              | 操作菜单        | ✅ 操作 Tool      |
| 删除文件夹       | `DELETE /api/folders/[id]`           | 操作菜单        | ✅ 操作 Tool      |
| 合并文件夹       | `POST /api/folders/[id]/merge`       | 操作菜单        | ✅ 操作 Tool      |
| **拆分文件夹**   | `POST /api/folders/[id]/split`       | 新增            | ✅ 操作 Tool (新) |
| 移动书签到文件夹 | `PUT /api/bookmarks/[id]`            | 移动对话框      | ✅ 操作 Tool      |
| 批量移动书签     | `PUT /api/bookmarks/batch-move`      | 批量操作        | ✅ 操作 Tool      |
| 删除文件夹内书签 | `DELETE /api/folders/[id]/bookmarks` | 删除对话框      | ✅ 操作 Tool      |
| 移动文件夹位置   | `PUT /api/folders/reorder`           | 操作菜单        | ✅ 操作 Tool      |
| 移动文件夹分组   | `PATCH /api/folders/[id]/move-group` | 操作菜单        | ✅ 操作 Tool      |
| 归档/取消归档    | `PATCH /api/folders/[id]/archive`    | 操作菜单        | ✅ 操作 Tool      |
| AI 锁定/解锁     | `PATCH /api/folders/[id]/lock`       | 操作菜单        | ✅ 操作 Tool      |
| **一键分类**     | `POST /api/reclassify`               | 操作菜单(INBOX) | ✅ 操作 Tool (新) |

---

## 3. Tools 架构设计

### 3.1 目录结构

```
src/lib/ai-agent/tools/folder/
├── index.ts                        # 模块导出 + folderTools 数组
├── types.ts                        # 类型定义
│
├── # Phase 1: 查询类 Tools（无需确认）- 3 个
├── list-folders.tool.ts            # 列出文件夹
├── get-folder-detail.tool.ts       # 获取文件夹详情
├── get-folder-bookmarks.tool.ts    # 获取文件夹内书签
│
├── # Phase 2: 基础操作 Tools（低风险）- 6 个
├── create-folder.tool.ts           # 创建文件夹
├── rename-folder.tool.ts           # 重命名文件夹
├── move-bookmark.tool.ts           # 移动单个书签
├── reorder-folder.tool.ts          # 移动文件夹位置
├── move-folder-to-group.tool.ts    # 移动文件夹到分组
├── toggle-folder-archive.tool.ts   # 归档/取消归档
│
├── # Phase 3: 高级操作 Tools（中/高风险）- 7 个
├── toggle-folder-lock.tool.ts      # AI 锁定/解锁
├── move-bookmarks-batch.tool.ts    # 批量移动书签
├── merge-folders.tool.ts           # 合并文件夹
├── split-folder.tool.ts            # 拆分文件夹 (新)
├── delete-folder.tool.ts           # 删除文件夹
├── delete-folder-bookmarks.tool.ts # 删除文件夹内书签
└── auto-classify-inbox.tool.ts     # 一键分类 (新)
```

**共计: 16 个 Tools**

### 3.2 Tools 详细设计

#### 3.2.1 查询类 Tools（Phase 1）- 无需确认

| Tool 名称              | 描述               | 参数                                             | category |
| ---------------------- | ------------------ | ------------------------------------------------ | -------- |
| `list_folders`         | 获取用户所有文件夹 | `includeSystem?`, `includeArchived?`, `groupBy?` | query    |
| `get_folder_detail`    | 获取单个文件夹详情 | `folderId`                                       | query    |
| `get_folder_bookmarks` | 获取文件夹内书签   | `folderId`, `limit?`, `offset?`, `sortBy?`       | query    |

#### 3.2.2 基础操作 Tools（Phase 2）- 低风险

| Tool 名称                 | 描述             | 参数                                                         | 风险等级 |
| ------------------------- | ---------------- | ------------------------------------------------------------ | -------- |
| `create_folder`           | 创建新文件夹     | `name`, `parentId?`, `group?`                                | low      |
| `rename_folder`           | 重命名文件夹     | `folderId`, `newName`                                        | low      |
| `move_bookmark_to_folder` | 移动单个书签     | `bookmarkId`, `targetFolderId`                               | low      |
| `reorder_folder`          | 移动文件夹位置   | `folderId`, `direction: up\|down\|top\|bottom`               | low      |
| `move_folder_to_group`    | 移动文件夹到分组 | `folderId`, `group: work\|study\|life\|entertainment\|other` | low      |
| `toggle_folder_archive`   | 归档/取消归档    | `folderId`, `archived: boolean`                              | low      |

#### 3.2.3 高级操作 Tools（Phase 3）- 中/高风险

| Tool 名称                 | 描述                 | 参数                                                        | 风险等级 |
| ------------------------- | -------------------- | ----------------------------------------------------------- | -------- |
| `toggle_folder_lock`      | AI 锁定/解锁         | `folderId`, `locked: boolean`                               | medium   |
| `move_bookmarks_batch`    | 批量移动书签         | `bookmarkIds[]`, `targetFolderId`                           | medium   |
| `merge_folders`           | 合并文件夹           | `sourceFolderId`, `targetFolderId`                          | high     |
| `split_folder`            | 拆分文件夹           | `folderId`, `splitConfig: { newFolderName, bookmarkIds[] }` | high     |
| `delete_folder`           | 删除文件夹           | `folderId`, `deleteBookmarks?`                              | high     |
| `delete_folder_bookmarks` | 删除文件夹内所有书签 | `folderId`                                                  | high     |
| `auto_classify_inbox`     | 一键分类待整理       | `forceRun?`                                                 | medium   |

### 3.3 Tools 汇总表

| #   | Tool 名称                 | 类型 | 风险   | 确认 | Phase |
| --- | ------------------------- | ---- | ------ | ---- | ----- |
| 1   | `list_folders`            | 查询 | -      | ❌   | 1     |
| 2   | `get_folder_detail`       | 查询 | -      | ❌   | 1     |
| 3   | `get_folder_bookmarks`    | 查询 | -      | ❌   | 1     |
| 4   | `create_folder`           | 操作 | low    | ✅   | 2     |
| 5   | `rename_folder`           | 操作 | low    | ✅   | 2     |
| 6   | `move_bookmark_to_folder` | 操作 | low    | ✅   | 2     |
| 7   | `reorder_folder`          | 操作 | low    | ✅   | 2     |
| 8   | `move_folder_to_group`    | 操作 | low    | ✅   | 2     |
| 9   | `toggle_folder_archive`   | 操作 | low    | ✅   | 2     |
| 10  | `toggle_folder_lock`      | 操作 | medium | ✅   | 3     |
| 11  | `move_bookmarks_batch`    | 操作 | medium | ✅   | 3     |
| 12  | `auto_classify_inbox`     | 操作 | medium | ✅   | 3     |
| 13  | `merge_folders`           | 操作 | high   | ✅   | 3     |
| 14  | `split_folder`            | 操作 | high   | ✅   | 3     |
| 15  | `delete_folder`           | 操作 | high   | ✅   | 3     |
| 16  | `delete_folder_bookmarks` | 操作 | high   | ✅   | 3     |

### 3.3 Tool 实现示例

```typescript
// src/lib/ai-agent/tools/folder/list-folders.tool.ts

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import type { FolderSummary } from "./types";

const paramsSchema = z.object({
  includeSystem: z.boolean().default(false).describe("是否包含系统文件夹"),
  includeArchived: z.boolean().default(false).describe("是否包含已归档文件夹"),
  groupBy: z.enum(["none", "group"]).default("none").describe("分组方式"),
});

type ListFoldersParams = z.infer<typeof paramsSchema>;

export const listFoldersTool: Tool<ListFoldersParams, FolderSummary[]> = {
  definition: {
    name: "list_folders",
    description: `获取用户的所有文件夹列表。用于回答：
- "我有哪些文件夹"
- "查看我的收藏夹"
- "列出所有文件夹"
返回文件夹名称、书签数量、分组等信息。`,
    parameters: paramsSchema,
    category: "query",
  },

  async execute(
    params: ListFoldersParams,
    context: ToolContext,
  ): Promise<ToolResult<FolderSummary[]>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      let query = supabase
        .from("folders")
        .select(
          "id, name, folder_group, is_system, is_archived, bookmark_count:bookmarks(count)",
        )
        .eq("user_id", context.userId)
        .is("deleted_at", null);

      if (!params.includeSystem) {
        query = query.eq("is_system", false);
      }

      if (!params.includeArchived) {
        query = query.eq("is_archived", false);
      }

      query = query.order("sort_order", { ascending: true });

      const { data: folders, error } = await query;

      if (error) {
        return {
          success: false,
          error: `查询文件夹失败: ${error.message}`,
          errorCode: "QUERY_ERROR",
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      const summaries: FolderSummary[] = (folders || []).map((f) => ({
        id: f.id,
        name: f.name,
        group: f.folder_group,
        isSystem: f.is_system,
        isArchived: f.is_archived,
        bookmarkCount: f.bookmark_count?.[0]?.count || 0,
      }));

      return {
        success: true,
        data: summaries,
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: summaries.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取文件夹失败",
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    }
  },
};
```

---

## 4. 集成到现有 AI Skills 系统

### 4.1 Tools 注册

修改 `src/lib/ai-agent/tools/index.ts`：

```typescript
// 新增导入
import { folderTools } from "./folder";

// 在 registerDefaultTools 中注册
export function registerDefaultTools(): void {
  toolRegistry.registerAll(queryTools);
  toolRegistry.registerAll(readTools);
  toolRegistry.registerAll(searchTools);
  toolRegistry.registerAll(actionTools);
  toolRegistry.registerAll(smartListTools);
  toolRegistry.registerAll(exportTools);
  toolRegistry.registerAll(folderTools); // 新增
}
```

### 4.2 AI Agent 系统提示词更新

在 Knowledge Agent 的系统提示词中添加文件夹相关能力说明：

```markdown
## 文件夹管理能力

你可以帮助用户管理他们的收藏夹：

### 查询操作

- 列出用户的所有文件夹
- 查看特定文件夹的详情和内容
- 统计文件夹中的书签数量

### 管理操作（需要用户确认）

- 创建新文件夹
- 重命名文件夹
- 移动书签到指定文件夹
- 合并两个文件夹
- 删除空文件夹

### 注意事项

- 系统文件夹（如"待整理"）不可删除或重命名
- 删除操作需要用户明确确认
- 建议在执行操作前先查询相关信息
```

---

## 5. 前端集成设计

### 5.1 双轨并行架构

```
┌─────────────────────────────────────────────────────────────┐
│                     收藏夹功能                               │
├─────────────────────────────┬───────────────────────────────┤
│       菜单操作轨道           │       AI 对话轨道              │
│    (保持现有功能不变)         │     (新增 AI 助手入口)          │
├─────────────────────────────┼───────────────────────────────┤
│ FolderActionMenu            │ AIAssistantPanel              │
│ ├─ 重命名                   │ ├─ "帮我创建一个技术文章夹"      │
│ ├─ 导出                     │ ├─ "把这篇文章移到前端文件夹"    │
│ ├─ 移动位置                  │ ├─ "合并 JS 和 TS 两个文件夹"   │
│ ├─ 移至类别                  │ ├─ "删除那个空的测试文件夹"      │
│ ├─ 合并至                   │ └─ ...                        │
│ ├─ 停用/启用                │                               │
│ ├─ 锁定 AI                  │                               │
│ └─ 删除                     │                               │
└─────────────────────────────┴───────────────────────────────┘
```

### 5.2 前端组件修改

#### 5.2.1 收藏夹页面添加 AI 助手入口

修改 `src/components/folders/folders-page-client.tsx`：

```tsx
import { AIAssistantPanel } from "@/components/ai/ai-assistant-panel";

// 在组件内添加状态
const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

// 在顶部操作栏添加 AI 助手按钮
<Button
  variant="outline"
  size="sm"
  onClick={() => setIsAIAssistantOpen(true)}
  className="gap-2"
>
  <Sparkles className="size-4" />
  AI 助手
</Button>

// 在组件末尾添加 AI 助手面板
<AIAssistantPanel
  open={isAIAssistantOpen}
  onOpenChange={setIsAIAssistantOpen}
  title="AI 文件夹助手"
  description="告诉我你想如何整理文件夹，我来帮你操作"
/>
```

#### 5.2.2 文件夹操作菜单添加 AI 入口（可选）

修改 `src/components/folders/folder-action-menu.tsx`：

```tsx
// 在菜单底部添加 AI 协助选项
<DropdownMenuSeparator />
<DropdownMenuItem
  onClick={(e) => {
    e.stopPropagation();
    // 打开 AI 助手，预填充当前文件夹上下文
    onOpenAIAssistant?.(folder);
  }}
  className="text-violet-600 dark:text-violet-400"
>
  <Sparkles className="size-4 mr-2" />
  AI 协助管理
</DropdownMenuItem>
```

### 5.3 组件新增/修改清单

| 组件                      | 修改类型    | 说明                       |
| ------------------------- | ----------- | -------------------------- |
| `folders-page-client.tsx` | 修改        | 添加 AI 助手按钮和面板     |
| `folder-action-menu.tsx`  | 修改 (可选) | 添加 "AI 协助管理" 菜单项  |
| `folder-nav-panel.tsx`    | 修改 (可选) | 在导航面板底部添加 AI 入口 |
| `ai-assistant-panel.tsx`  | 无需修改    | 复用现有组件               |

---

## 6. 用户交互流程

### 6.1 菜单用户（传统路径）

```
用户 → 点击文件夹卡片右上角 ⋮ → 选择操作 → 确认对话框 → 完成
```

**特点**：

- 操作精确、步骤明确
- 适合熟悉系统的用户
- 每次只能操作一个文件夹

### 6.2 AI 对话用户（新路径）

```
用户 → 打开 AI 助手 → 描述意图 → AI 理解并调用 Tool → 确认操作 → 完成
```

**特点**：

- 自然语言交互
- 可批量操作（如"把所有 React 文章移到前端文件夹"）
- AI 可提供建议（如"你有 3 个类似的文件夹，要不要合并？"）

### 6.3 AI 对话示例

**示例 1：创建文件夹**

```
用户: 帮我创建一个叫"2024年度总结"的文件夹
AI: 好的，我来为你创建文件夹。
    [调用 create_folder tool]
    ⚠️ 确认操作：创建文件夹「2024年度总结」
    [确认] [取消]
用户: [点击确认]
AI: ✅ 文件夹「2024年度总结」已创建成功！
```

**示例 2：移动书签**

```
用户: 把最近收藏的那篇 TypeScript 文章移到"前端"文件夹
AI: 我找到了你最近收藏的文章「TypeScript 5.0 新特性详解」。
    [调用 move_bookmark_to_folder tool]
    ⚠️ 确认操作：将书签移动到「前端」文件夹
    - 书签：TypeScript 5.0 新特性详解
    - 目标：前端
    [确认] [取消]
```

**示例 3：合并文件夹**

```
用户: 把"JavaScript"文件夹合并到"前端"
AI: 我来帮你合并这两个文件夹。
    [调用 merge_folders tool]
    ⚠️ 确认操作：合并文件夹
    - 源文件夹：JavaScript（包含 15 个书签）
    - 目标文件夹：前端（当前 23 个书签）
    - 合并后：前端将包含 38 个书签
    - JavaScript 文件夹将被删除
    [确认] [取消]
```

---

## 7. 安全设计

### 7.1 权限控制

| 操作     | 系统文件夹 | 已归档文件夹 | 已锁定文件夹 |
| -------- | ---------- | ------------ | ------------ |
| 查看     | ✅         | ✅           | ✅           |
| 重命名   | ❌ 禁止    | ⚠️ 需确认    | ❌ 禁止      |
| 删除     | ❌ 禁止    | ⚠️ 需确认    | ❌ 禁止      |
| 合并     | ❌ 禁止    | ⚠️ 需确认    | ❌ 禁止      |
| 移入书签 | ✅         | ⚠️ 需确认    | ✅           |

### 7.2 确认流程

所有操作类 Tools 必须：

1. 设置 `requiresConfirmation: true`
2. 返回 `PendingConfirmation` 对象
3. 包含清晰的影响说明

```typescript
// 确认对象示例
{
  confirmationId: "cf_xxx",
  toolName: "merge_folders",
  description: "合并文件夹",
  impactSummary: "将「JavaScript」(15个书签) 合并到「前端」",
  affectedItems: [
    { id: 1, title: "JavaScript 文件夹" },
    { id: 2, title: "前端 文件夹" },
  ],
  riskLevel: "high",
  expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5分钟过期
}
```

---

## 8. 实施计划

### Phase 1: 感知能力（查询 Tools）- 3 个 ✅

**目标**：让 AI 能"看到"文件夹结构

**任务清单**：

- [x] 创建 `src/lib/ai-agent/tools/folder/` 目录
- [x] 实现 `types.ts` - 类型定义
- [x] 实现 `list-folders.tool.ts` - 列出文件夹
- [x] 实现 `get-folder-detail.tool.ts` - 文件夹详情
- [x] 实现 `get-folder-bookmarks.tool.ts` - 文件夹内书签
- [x] 实现 `index.ts` - 模块导出
- [x] 修改 `tools/index.ts` - 注册 folderTools
- [x] 测试查询功能（单元测试 + 定义验证）

### Phase 2: 基础操作（低风险 Tools）- 6 个 ✅

**目标**：安全的写操作 + 前端 AI 入口

**任务清单**：

- [x] 实现 `create-folder.tool.ts` - 创建文件夹
- [x] 实现 `rename-folder.tool.ts` - 重命名文件夹
- [x] 实现 `move-bookmark.tool.ts` - 移动书签
- [x] 实现 `reorder-folder.tool.ts` - 移动文件夹位置
- [x] 实现 `move-folder-to-group.tool.ts` - 移动文件夹到分组
- [x] 实现 `toggle-folder-archive.tool.ts` - 归档/取消归档
- [x] 前端集成：收藏夹页面添加 AI 助手按钮
- [x] 前端集成：操作菜单添加 AI 协助管理入口
- [x] 测试操作功能和确认流程（单元测试 + 确认 UI 验证）

### Phase 3: 高级操作（中/高风险 Tools）- 7 个 ✅

**目标**：完整的文件夹管理能力

**任务清单**：

- [x] 实现 `toggle-folder-lock.tool.ts` - AI 锁定/解锁
- [x] 实现 `move-bookmarks-batch.tool.ts` - 批量移动
- [x] 实现 `merge-folders.tool.ts` - 合并文件夹
- [x] 实现 `split-folder.tool.ts` - 拆分文件夹 (新功能)
- [x] 实现 `delete-folder.tool.ts` - 删除文件夹
- [x] 实现 `delete-folder-bookmarks.tool.ts` - 删除文件夹内书签
- [x] 实现 `auto-classify-inbox.tool.ts` - 一键分类
- [x] 完善确认流程 UI（ActionConfirmDialog + ActionConfirmInline）
- [x] 端到端测试（单元测试覆盖）

### Phase 4: 体验优化（可选）

**目标**：提升 AI 助手使用体验

**任务清单**：

- [ ] AI 主动建议（如发现相似文件夹提议合并）
- [ ] 操作历史记录
- [ ] 撤销功能
- [ ] 快捷指令模板

---

## 9. 文件变更清单

### 9.1 新增文件（16 个 Tools + 2 个基础文件）

| 文件路径                                                        | 说明       | Phase |
| --------------------------------------------------------------- | ---------- | ----- |
| `src/lib/ai-agent/tools/folder/index.ts`                        | 模块导出   | 1     |
| `src/lib/ai-agent/tools/folder/types.ts`                        | 类型定义   | 1     |
| `src/lib/ai-agent/tools/folder/list-folders.tool.ts`            | 列出文件夹 | 1     |
| `src/lib/ai-agent/tools/folder/get-folder-detail.tool.ts`       | 文件夹详情 | 1     |
| `src/lib/ai-agent/tools/folder/get-folder-bookmarks.tool.ts`    | 文件夹书签 | 1     |
| `src/lib/ai-agent/tools/folder/create-folder.tool.ts`           | 创建文件夹 | 2     |
| `src/lib/ai-agent/tools/folder/rename-folder.tool.ts`           | 重命名     | 2     |
| `src/lib/ai-agent/tools/folder/move-bookmark.tool.ts`           | 移动书签   | 2     |
| `src/lib/ai-agent/tools/folder/reorder-folder.tool.ts`          | 移动位置   | 2     |
| `src/lib/ai-agent/tools/folder/move-folder-to-group.tool.ts`    | 移动分组   | 2     |
| `src/lib/ai-agent/tools/folder/toggle-folder-archive.tool.ts`   | 归档       | 2     |
| `src/lib/ai-agent/tools/folder/toggle-folder-lock.tool.ts`      | AI 锁定    | 3     |
| `src/lib/ai-agent/tools/folder/move-bookmarks-batch.tool.ts`    | 批量移动   | 3     |
| `src/lib/ai-agent/tools/folder/merge-folders.tool.ts`           | 合并       | 3     |
| `src/lib/ai-agent/tools/folder/split-folder.tool.ts`            | 拆分 (新)  | 3     |
| `src/lib/ai-agent/tools/folder/delete-folder.tool.ts`           | 删除       | 3     |
| `src/lib/ai-agent/tools/folder/delete-folder-bookmarks.tool.ts` | 删除书签   | 3     |
| `src/lib/ai-agent/tools/folder/auto-classify-inbox.tool.ts`     | 一键分类   | 3     |

### 9.2 修改文件

| 文件路径                                         | 修改内容               | Phase |
| ------------------------------------------------ | ---------------------- | ----- |
| `src/lib/ai-agent/tools/index.ts`                | 注册 folderTools       | 1     |
| `src/components/folders/folders-page-client.tsx` | 添加 AI 助手按钮       | 2     |
| `src/components/folders/folder-action-menu.tsx`  | 添加 AI 协助管理菜单项 | 2     |

### 9.3 可能新增的 API（拆分功能）

| 文件路径                                  | 说明                                  |
| ----------------------------------------- | ------------------------------------- |
| `src/app/api/folders/[id]/split/route.ts` | 拆分文件夹 API（如果现有 API 不支持） |

---

## 10. 验收标准

### 10.1 功能验收

**Phase 1 - 查询能力**：

- [x] AI 可以列出用户的所有文件夹
- [x] AI 可以查看特定文件夹的详情
- [x] AI 可以获取文件夹内的书签列表

**Phase 2 - 基础操作**：

- [x] AI 可以创建新文件夹（需确认）
- [x] AI 可以重命名文件夹（需确认）
- [x] AI 可以移动书签到文件夹（需确认）
- [x] AI 可以调整文件夹位置（需确认）
- [x] AI 可以移动文件夹到不同分组（需确认）
- [x] AI 可以归档/取消归档文件夹（需确认）
- [x] 收藏夹页面显示 AI 助手按钮
- [x] 操作菜单显示 AI 协助管理入口

**Phase 3 - 高级操作**：

- [x] AI 可以锁定/解锁文件夹 AI 管理（需确认）
- [x] AI 可以批量移动书签（需确认）
- [x] AI 可以合并文件夹（需确认）
- [x] AI 可以拆分文件夹（需确认）
- [x] AI 可以删除文件夹（需确认）
- [x] AI 可以删除文件夹内所有书签（需确认）
- [x] AI 可以执行一键分类（需确认）

**安全验收**：

- [x] 系统文件夹受保护，无法删除/重命名
- [x] 已锁定文件夹禁止 AI 操作
- [x] 所有操作显示正确的风险等级和影响范围
- [x] 菜单操作不受影响，功能完全正常

### 10.2 用户体验验收

- [x] 菜单用户无感知，操作习惯不变
- [x] AI 助手入口清晰可见（页面按钮 + 操作菜单）
- [x] 确认对话框信息完整、风险明确
- [x] AI 响应准确理解用户意图
- [x] 操作完成后给出清晰的成功/失败反馈

### 10.3 测试验收（2025-12-23 新增）

**单元测试**：

- [x] 16 个 Tools 定义测试通过
- [x] Tool 分类分布测试（3 查询 + 13 操作）
- [x] 参数验证测试（Zod Schema）
- [x] 确认流程测试（PendingConfirmation）
- [x] 安全机制测试（系统文件夹保护）

**测试文件**：

- `src/lib/ai-agent/tools/folder/__tests__/folder-tools.test.ts`

---

## 附录 A：AI 可理解的指令示例

### 查询类

```
- "我有哪些文件夹？"
- "查看我的收藏夹"
- "技术文章夹里有多少收藏？"
- "前端文件夹里有什么？"
- "哪个文件夹书签最多？"
- "列出已归档的文件夹"
```

### 基础操作类

```
- "帮我新建一个叫'2024年度总结'的文件夹"
- "创建一个学习笔记文件夹"
- "把'技术'文件夹改名为'技术分享'"
- "把这篇文章移到'稀后阅读'文件夹"
- "把'前端'文件夹移到左边"
- "把'技术'文件夹放到工作分组里"
- "归档'旧项目'文件夹"
- "把'历史资料'文件夹停用"
```

### 高级操作类

```
- "锁定'重要资料'文件夹，不让 AI 自动改名"
- "把最近收藏的 3 篇文章都移到'前端'文件夹"
- "把'JavaScript'文件夹合并到'前端'"
- "把'技术'文件夹里的 Vue 相关文章拆分出来，新建一个'Vue'文件夹"
- "删除空的'测试'文件夹"
- "清空'临时'文件夹里的所有书签"
- "帮我分类一下待整理里的书签"
- "执行一键分类"
```

### 复合类

```
- "创建一个'Vue'文件夹，然后把 Vue 相关的文章都移进去"
- "帮我整理一下文件夹，把类似的合并在一起"
- "把工作相关的文件夹都移到工作分组"
```

---

## 附录 B：与智能列表 Skills 的对比

| 维度       | 智能列表 Skills            | 收藏夹 Skills                                                                |
| ---------- | -------------------------- | ---------------------------------------------------------------------------- |
| Tools 数量 | 3 个                       | **16 个**                                                                    |
| 查询 Tools | list, get_items, get_count | list, get_detail, get_bookmarks                                              |
| 操作 Tools | 无                         | create, rename, delete, merge, split, move, reorder, archive, lock, classify |
| 确认流程   | 不需要                     | 所有操作需要                                                                 |
| 前端集成   | 下拉菜单 + AI 按钮         | **页面按钮 + 操作菜单（双入口）**                                            |
| 风险等级   | 低                         | 低/中/高                                                                     |
| 新功能     | -                          | 拆分文件夹、一键分类                                                         |

---

## 附录 C：拆分文件夹功能设计（新）

### C.1 功能说明

「拆分文件夹」是新增功能，允许用户将一个文件夹中的部分书签拆分到新文件夹。

### C.2 使用场景

- 文件夹内容过多，需要细分
- 发现某类内容应该独立成夹
- AI 建议拆分（如"你的'前端'文件夹有 50 篇 Vue 文章，要不要拆分出来？"）

### C.3 参数设计

```typescript
interface SplitFolderParams {
  folderId: number; // 源文件夹 ID
  newFolderName: string; // 新文件夹名称
  bookmarkIds: number[]; // 要移动的书签 ID 列表
  newFolderGroup?: string; // 新文件夹分组（可选）
}
```

### C.4 执行流程

1. 验证源文件夹存在且属于用户
2. 验证 bookmarkIds 都属于源文件夹
3. 创建新文件夹
4. 移动指定书签到新文件夹
5. 返回结果（新文件夹 ID、移动数量）

### C.5 AI 对话示例

```
用户: 把'技术'文件夹里的 Vue 相关文章拆分出来
AI: 我在「技术」文件夹中找到了 12 篇 Vue 相关文章。
    [调用 split_folder tool]
    ⚠️ 确认操作：拆分文件夹
    - 源文件夹：技术（当前 45 篇）
    - 新文件夹：Vue（将包含 12 篇）
    - 拆分后：技术将剩余 33 篇
    [确认] [取消]
```

---

**文档结束**

> 请审核以上更新后的设计方案。Tools 数量已从 8 个增加到 **16 个**，涵盖完整的文件夹管理能力。
> 批准后将开始 Phase 1 实施。
