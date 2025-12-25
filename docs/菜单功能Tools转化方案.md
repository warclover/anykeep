# AnyKeep 菜单功能 Tools 转化方案

> **版本**: v1.1.0
> **日期**: 2025-12-23
> **作者**: AnyKeep 架构师
> **更新**: 新增设置类 Tools 和 MD 收藏 Tools 分析

---

## 一、现状分析

### 1.1 现有 Tools 清单 (36 个)

| 类别           | Tool 名称                 | 功能描述         |
| -------------- | ------------------------- | ---------------- |
| **查询类**     | `count-bookmarks`         | 统计书签数量     |
|                | `count-by-folder`         | 按文件夹统计     |
|                | `count-by-platform`       | 按平台统计       |
|                | `count-total`             | 总数统计         |
|                | `list-bookmarks`          | 列出书签         |
|                | `list-by-folder`          | 按文件夹列出     |
|                | `list-by-platform`        | 按平台列出       |
|                | `list-recent`             | 列出最近书签     |
|                | `get-stats`               | 获取统计数据     |
| **搜索类**     | `search`                  | 混合搜索         |
|                | `semantic-search`         | 语义搜索         |
| **读取类**     | `read-bookmark`           | 读取书签详情     |
| **文件夹类**   | `list-folders`            | 列出文件夹       |
|                | `get-folder-detail`       | 获取文件夹详情   |
|                | `get-folder-bookmarks`    | 获取文件夹书签   |
|                | `create-folder`           | 创建文件夹       |
|                | `rename-folder`           | 重命名文件夹     |
|                | `delete-folder`           | 删除文件夹       |
|                | `delete-folder-bookmarks` | 删除文件夹内书签 |
|                | `merge-folders`           | 合并文件夹       |
|                | `split-folder`            | 拆分文件夹       |
|                | `move-folder-to-group`    | 移动到分组       |
|                | `reorder-folder`          | 调整文件夹顺序   |
|                | `toggle-folder-archive`   | 切换归档状态     |
|                | `toggle-folder-lock`      | 切换锁定状态     |
|                | `auto-classify-inbox`     | 自动分类收件箱   |
| **书签操作类** | `move-bookmark`           | 移动单个书签     |
|                | `move-bookmarks-batch`    | 批量移动书签     |
|                | `move-bookmarks`          | 移动书签         |
|                | `batch-tags`              | 批量标签操作     |
| **智能列表类** | `list-smart-lists`        | 列出智能列表     |
|                | `get-smart-list-count`    | 获取智能列表数量 |
|                | `get-smart-list-items`    | 获取智能列表项   |
| **导出类**     | `export-bookmarks`        | 导出书签         |
|                | `list-export-formats`     | 列出导出格式     |
|                | `preview-export`          | 预览导出         |

### 1.2 菜单组件清单 (15 个文件)

| 组件文件                          | 菜单项数量 | 主要功能         |
| --------------------------------- | ---------- | ---------------- |
| `folder-action-menu.tsx`          | 15+        | 文件夹右键菜单   |
| `bookmark-card.tsx`               | 6          | 书签卡片操作菜单 |
| `bookmark-list-item.tsx`          | 3          | 书签列表项菜单   |
| `home-toolbar.tsx`                | 12+        | 首页工具栏菜单   |
| `header-menu.tsx`                 | 10+        | 顶部导航菜单     |
| `smart-list-item.tsx`             | 3          | 智能列表操作菜单 |
| `wechat-article-viewer.tsx`       | TBD        | 微信文章查看器   |
| `folder-content-area.tsx`         | TBD        | 文件夹内容区域   |
| `snapshot-menu-item.tsx`          | 1          | 快照菜单项       |
| `pending-confirmation-filter.tsx` | TBD        | 待确认筛选       |
| `message-item.tsx`                | TBD        | 消息项菜单       |
| `InlineNotificationBar.tsx`       | TBD        | 内联通知栏       |

---

## 二、菜单功能 vs Tools 覆盖矩阵

### 2.1 文件夹菜单 (folder-action-menu.tsx)

| 菜单功能            | 现有 Tool                 | 状态        | 优先级 |
| ------------------- | ------------------------- | ----------- | ------ |
| 重命名              | `rename-folder`           | ✅ 已覆盖   | -      |
| 导出文件夹          | `export-bookmarks`        | ✅ 已覆盖   | -      |
| 一键分类            | `auto-classify-inbox`     | ✅ 已覆盖   | -      |
| 左移/右移/置顶/置底 | `reorder-folder`          | ✅ 已覆盖   | -      |
| 移至类别            | `move-folder-to-group`    | ✅ 已覆盖   | -      |
| 合并至              | `merge-folders`           | ✅ 已覆盖   | -      |
| 停用/启用           | `toggle-folder-archive`   | ✅ 已覆盖   | -      |
| AI锁定/解锁         | `toggle-folder-lock`      | ✅ 已覆盖   | -      |
| 删除文件夹          | `delete-folder`           | ✅ 已覆盖   | -      |
| 删除书签            | `delete-folder-bookmarks` | ✅ 已覆盖   | -      |
| 拆分文件夹          | `split-folder`            | ✅ 已覆盖   | -      |
| AI协助管理          | -                         | 🔵 前端功能 | -      |

**覆盖率**: 11/12 = **91.7%** (1 项为纯前端功能)

### 2.2 书签菜单 (bookmark-card.tsx / bookmark-list-item.tsx)

| 菜单功能      | 现有 Tool | 状态        | 优先级 |
| ------------- | --------- | ----------- | ------ |
| 打开原文      | -         | 🔵 前端功能 | -      |
| 创建快照      | -         | ❌ 需新增   | P1     |
| 标记已读/未读 | -         | ❌ 需新增   | P0     |
| 添加/取消星标 | -         | ❌ 需新增   | P0     |
| 编辑书签      | -         | ❌ 需新增   | P1     |
| 删除书签      | -         | ❌ 需新增   | P0     |

**覆盖率**: 1/6 = **16.7%** (需新增 5 个 Tools)

### 2.3 首页工具栏 (home-toolbar.tsx / header-menu.tsx)

| 菜单功能       | 现有 Tool          | 状态        | 优先级 |
| -------------- | ------------------ | ----------- | ------ |
| 视图模式切换   | -                  | 🔵 前端功能 | -      |
| 布局模式切换   | -                  | 🔵 前端功能 | -      |
| 排序切换       | -                  | 🔵 前端功能 | -      |
| 翻转卡片       | -                  | 🔵 前端功能 | -      |
| 搜索           | `search`           | ✅ 已覆盖   | -      |
| 批量导入       | -                  | ❌ 需新增   | P2     |
| 导入浏览器书签 | -                  | ❌ 需新增   | P2     |
| 导出           | `export-bookmarks` | ✅ 已覆盖   | -      |
| 批量选择       | -                  | 🔵 前端功能 | -      |
| 批量删除       | -                  | ❌ 需新增   | P1     |
| 批量移动       | `move-bookmarks`   | ✅ 已覆盖   | -      |
| 批量标签       | `batch-tags`       | ✅ 已覆盖   | -      |
| 新建收藏       | -                  | ❌ 需新增   | P0     |
| 设置           | -                  | 🔵 前端功能 | -      |

**覆盖率**: 4/14 = **28.6%** (需新增 5 个 Tools，6 项为纯前端功能)

### 2.4 智能列表菜单 (smart-list-item.tsx)

| 菜单功能      | 现有 Tool | 状态      | 优先级 |
| ------------- | --------- | --------- | ------ |
| 置顶/取消置顶 | -         | ❌ 需新增 | P2     |
| 编辑智能列表  | -         | ❌ 需新增 | P2     |
| 删除智能列表  | -         | ❌ 需新增 | P2     |

**覆盖率**: 0/3 = **0%** (需新增 3 个 Tools)

### 2.5 设置页面 (settings-page-client.tsx)

| 设置模块     | 是否转化  | 理由                              | 优先级 |
| ------------ | --------- | --------------------------------- | ------ |
| 获取用户设置 | ✅ 应转化 | AI 需了解用户偏好以提供个性化服务 | P1     |
| 信任模式设置 | ✅ 应转化 | 核心 AI 控制参数，影响自动化程度  | P0     |
| 分类设置     | ✅ 应转化 | AI 分类行为的关键配置             | P1     |
| 兴趣领域设置 | ✅ 应转化 | 影响 AI 推荐和分类建议            | P1     |
| 主题/外观    | ❌ 不转化 | 纯前端 UI 设置，无 AI 价值        | -      |
| 快捷键设置   | ❌ 不转化 | 纯前端交互设置                    | -      |
| 账户信息     | ❌ 不转化 | 敏感数据，AI 不应操作             | -      |
| 安全设置     | ❌ 不转化 | 高危操作，不适合 AI 自动化        | -      |
| 平台授权     | ❌ 不转化 | 涉及 OAuth，需人工处理            | -      |
| 隐私设置     | ❌ 不转化 | 敏感权限，需明确用户授权          | -      |
| 通知设置     | 🔵 可选   | 低 AI 价值，但可作为偏好参考      | P2     |
| AI Provider  | 🔵 可选   | 查看状态有价值，修改需谨慎        | P2     |

**推荐转化率**: 4/12 = **33.3%**（核心设置）

### 2.6 MD 收藏功能 (md-collections)

| 功能操作       | 是否转化  | 理由                               | 优先级 |
| -------------- | --------- | ---------------------------------- | ------ |
| 查询 MD 列表   | ✅ 应转化 | 基础查询能力，支持筛选和分页       | P0     |
| 获取 MD 详情   | ✅ 应转化 | 读取单条记录，AI 分析基础          | P0     |
| 语义搜索 MD    | ✅ 应转化 | 核心 AI 能力，向量检索             | P0     |
| 切换已读状态   | ✅ 应转化 | 常用操作，原子性强                 | P1     |
| 切换星标状态   | ✅ 应转化 | 常用操作，原子性强                 | P1     |
| 更新 MD 元信息 | ✅ 应转化 | 修改标题/标签/文件夹               | P1     |
| 删除 MD 收藏   | ✅ 应转化 | 需确认的危险操作                   | P2     |
| 获取 MD 统计   | ✅ 应转化 | AI 数据感知能力                    | P2     |
| 创建 MD 收藏   | 🔵 可选   | 需要传递大量内容，不适合对话式调用 | P3     |
| 上传 MD 文件   | ❌ 不转化 | 涉及文件上传，纯前端操作           | -      |
| 触发 AI 处理   | 🔵 可选   | 后台任务，可作为自动化流程一部分   | P3     |

**推荐转化率**: 8/11 = **72.7%**（核心操作）

---

## 三、待新增 Tools 清单

### 3.1 P0 优先级（核心书签操作）

| Tool 名称                 | 功能描述         | 关联菜单      | 复杂度 |
| ------------------------- | ---------------- | ------------- | ------ |
| `toggle-bookmark-read`    | 切换书签已读状态 | 书签卡片      | 低     |
| `toggle-bookmark-starred` | 切换书签星标状态 | 书签卡片      | 低     |
| `delete-bookmark`         | 删除单个书签     | 书签卡片/列表 | 低     |
| `create-bookmark`         | 创建新书签       | 顶部菜单      | 中     |
| `update-trust-mode`       | 更新信任模式     | 设置页面      | 低     |
| `list-md-collections`     | 查询 MD 收藏列表 | MD 收藏       | 中     |
| `get-md-collection`       | 获取 MD 收藏详情 | MD 收藏       | 低     |
| `search-md-collections`   | 语义搜索 MD 收藏 | MD 收藏       | 中     |

### 3.2 P1 优先级（扩展功能）

| Tool 名称                        | 功能描述         | 关联菜单   | 复杂度 |
| -------------------------------- | ---------------- | ---------- | ------ |
| `update-bookmark`                | 更新书签信息     | 书签编辑   | 中     |
| `create-snapshot`                | 创建书签快照     | 书签卡片   | 高     |
| `batch-delete-bookmarks`         | 批量删除书签     | 首页工具栏 | 中     |
| `get-user-settings`              | 获取用户设置     | 设置页面   | 低     |
| `get-classification-settings`    | 获取分类设置     | 设置页面   | 低     |
| `update-classification-settings` | 更新分类设置     | 设置页面   | 中     |
| `get-user-interests`             | 获取用户兴趣领域 | 设置页面   | 低     |
| `update-user-interests`          | 更新用户兴趣领域 | 设置页面   | 中     |
| `toggle-md-read`                 | 切换 MD 已读状态 | MD 收藏    | 低     |
| `toggle-md-starred`              | 切换 MD 星标状态 | MD 收藏    | 低     |
| `update-md-collection`           | 更新 MD 元信息   | MD 收藏    | 中     |

### 3.3 P2 优先级（完善功能）

| Tool 名称                  | 功能描述         | 关联菜单   | 复杂度 |
| -------------------------- | ---------------- | ---------- | ------ |
| `import-bookmarks`         | 批量导入书签     | 首页工具栏 | 高     |
| `import-browser-bookmarks` | 导入浏览器书签   | 首页工具栏 | 高     |
| `toggle-smart-list-pin`    | 切换智能列表置顶 | 智能列表   | 低     |
| `update-smart-list`        | 更新智能列表     | 智能列表   | 中     |
| `delete-smart-list`        | 删除智能列表     | 智能列表   | 低     |
| `create-smart-list`        | 创建智能列表     | 智能列表   | 中     |
| `delete-md-collection`     | 删除 MD 收藏     | MD 收藏    | 低     |
| `get-md-stats`             | 获取 MD 统计数据 | MD 收藏    | 中     |

---

## 四、实施计划

### 4.1 Phase 1: P0 核心操作 (2-3 天)

**目标**: 补全书签基础操作 + 信任模式 + MD 收藏核心查询

```
新增 8 个 Tools:
├── bookmark/
│   ├── toggle-bookmark-read.tool.ts    (0.25 天)
│   ├── toggle-bookmark-starred.tool.ts (0.25 天)
│   ├── delete-bookmark.tool.ts         (0.25 天)
│   └── create-bookmark.tool.ts         (0.5 天)
├── settings/
│   └── update-trust-mode.tool.ts       (0.25 天)
└── md-collection/
    ├── list-md-collections.tool.ts     (0.5 天)
    ├── get-md-collection.tool.ts       (0.25 天)
    └── search-md-collections.tool.ts   (0.75 天)
```

### 4.2 Phase 2: P1 扩展功能 (3-4 天)

**目标**: 补全编辑、批量操作、设置管理和 MD 收藏操作

```
新增 11 个 Tools:
├── bookmark/
│   ├── update-bookmark.tool.ts             (0.5 天)
│   ├── create-snapshot.tool.ts             (0.75 天)
│   └── batch-delete-bookmarks.tool.ts      (0.25 天)
├── settings/
│   ├── get-user-settings.tool.ts           (0.25 天)
│   ├── get-classification-settings.tool.ts (0.25 天)
│   ├── update-classification-settings.tool.ts (0.5 天)
│   ├── get-user-interests.tool.ts          (0.25 天)
│   └── update-user-interests.tool.ts       (0.5 天)
└── md-collection/
    ├── toggle-md-read.tool.ts              (0.25 天)
    ├── toggle-md-starred.tool.ts           (0.25 天)
    └── update-md-collection.tool.ts        (0.25 天)
```

### 4.3 Phase 3: P2 完善功能 (2-3 天)

**目标**: 补全导入、智能列表操作和 MD 收藏管理

```
新增 8 个 Tools:
├── import/
│   ├── import-bookmarks.tool.ts            (1 天)
│   └── import-browser-bookmarks.tool.ts    (1 天，可选)
├── smart-list/
│   ├── toggle-smart-list-pin.tool.ts       (0.25 天)
│   ├── update-smart-list.tool.ts           (0.25 天)
│   ├── delete-smart-list.tool.ts           (0.25 天)
│   └── create-smart-list.tool.ts           (0.25 天)
└── md-collection/
    ├── delete-md-collection.tool.ts        (0.25 天)
    └── get-md-stats.tool.ts                (0.25 天)
```

---

## 五、Tool 代码模板

> **⚠️ 重要说明 (2025-12-23 更新)**
>
> 本章节原模板使用了 `createToolDefinition()` 辅助函数，但该函数在项目中**不存在**。
>
> **正确的 Tool 实现模式**：使用 `Tool<TParams, TResult>` 接口
>
> 参考实现：`src/lib/ai-agent/tools/folder/toggle-folder-lock.tool.ts`
>
> 关键结构：
>
> ```typescript
> export const myTool: Tool<MyParams, MyResult> = {
>   definition: {
>     name: "tool_name",
>     description: "...",
>     parameters: paramsSchema,  // Zod schema
>     category: "action" | "query" | "read",
>     requiresConfirmation?: boolean,  // 危险操作设为 true
>     estimatedDurationMs?: number,
>   },
>   async execute(params, context): Promise<ToolResult<MyResult>> { ... }
> };
> ```

### 5.1 toggle-bookmark-read.tool.ts (参考设计)

> 以下为概念设计，实际实现见 `src/lib/ai-agent/tools/bookmark/toggle-bookmark-read.tool.ts`

```typescript
/**
 * ToggleBookmarkRead Tool - 切换书签已读状态
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// 参数 Schema
const paramsSchema = z.object({
  bookmarkId: z.number().int().positive().describe("书签ID"),
  isRead: z.boolean().optional().describe("目标状态，不传则切换"),
});

type ToggleBookmarkReadParams = z.infer<typeof paramsSchema>;

// 结果类型
interface ToggleBookmarkReadResult {
  bookmarkId: number;
  isRead: boolean;
  message: string;
}

export const toggleBookmarkReadTool: Tool<
  ToggleBookmarkReadParams,
  ToggleBookmarkReadResult
> = {
  definition: {
    name: "toggle_bookmark_read",
    description:
      "切换书签的已读/未读状态。可以明确指定目标状态，或自动切换当前状态。",
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 100,
  },

  async execute(
    params,
    context,
  ): Promise<ToolResult<ToggleBookmarkReadResult>> {
    const supabase = await createClient();

    // 获取当前状态
    const { data: bookmark, error: fetchError } = await supabase
      .from("bookmarks")
      .select("id, is_read")
      .eq("id", params.bookmarkId)
      .eq("user_id", context.userId)
      .single();

    if (fetchError || !bookmark) {
      return {
        success: false,
        error: "书签不存在或无权访问",
        errorCode: "NOT_FOUND",
      };
    }

    // 计算目标状态
    const targetState = params.isRead ?? !bookmark.is_read;

    // 更新状态
    const { error: updateError } = await supabase
      .from("bookmarks")
      .update({ is_read: targetState, updated_at: new Date().toISOString() })
      .eq("id", params.bookmarkId)
      .eq("user_id", context.userId);

    if (updateError) {
      logger.error(
        { error: updateError },
        "Failed to toggle bookmark read status",
      );
      return {
        success: false,
        error: "更新失败",
        errorCode: "UPDATE_ERROR",
      };
    }

    return {
      success: true,
      data: {
        bookmarkId: params.bookmarkId,
        isRead: targetState,
        message: targetState ? "已标记为已读" : "已标记为未读",
      },
    };
  },
};
```

### 5.2 toggle-bookmark-starred.tool.ts

```typescript
/**
 * ToggleBookmarkStarred Tool - 切换书签星标状态
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import { createToolDefinition } from "../tool-definition";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const inputSchema = z.object({
  bookmarkId: z.number().int().positive().describe("书签ID"),
  isStarred: z.boolean().optional().describe("目标状态，不传则切换"),
});

const outputSchema = z.object({
  success: z.boolean(),
  bookmarkId: z.number(),
  isStarred: z.boolean(),
  message: z.string(),
});

export const toggleBookmarkStarredTool = createToolDefinition({
  name: "toggle_bookmark_starred",
  description: "切换书签的星标状态。可以添加或取消星标，用于标记重要内容。",
  inputSchema,
  outputSchema,

  async execute(params, context) {
    const supabase = await createClient();

    // 获取当前状态
    const { data: bookmark, error: fetchError } = await supabase
      .from("bookmarks")
      .select("id, is_starred")
      .eq("id", params.bookmarkId)
      .eq("user_id", context.userId)
      .single();

    if (fetchError || !bookmark) {
      return {
        success: false,
        bookmarkId: params.bookmarkId,
        isStarred: false,
        message: "书签不存在或无权访问",
      };
    }

    // 计算目标状态
    const targetState = params.isStarred ?? !bookmark.is_starred;

    // 更新状态
    const { error: updateError } = await supabase
      .from("bookmarks")
      .update({ is_starred: targetState, updated_at: new Date().toISOString() })
      .eq("id", params.bookmarkId)
      .eq("user_id", context.userId);

    if (updateError) {
      logger.error(
        { error: updateError },
        "Failed to toggle bookmark starred status",
      );
      return {
        success: false,
        bookmarkId: params.bookmarkId,
        isStarred: bookmark.is_starred ?? false,
        message: "更新失败",
      };
    }

    return {
      success: true,
      bookmarkId: params.bookmarkId,
      isStarred: targetState,
      message: targetState ? "已添加星标" : "已取消星标",
    };
  },
});
```

### 5.3 delete-bookmark.tool.ts

```typescript
/**
 * DeleteBookmark Tool - 删除书签
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import { createToolDefinition } from "../tool-definition";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const inputSchema = z.object({
  bookmarkId: z.number().int().positive().describe("书签ID"),
  permanent: z
    .boolean()
    .optional()
    .default(false)
    .describe("是否永久删除（true跳过回收站）"),
});

const outputSchema = z.object({
  success: z.boolean(),
  bookmarkId: z.number(),
  message: z.string(),
  deletedAt: z.string().optional(),
});

export const deleteBookmarkTool = createToolDefinition({
  name: "delete_bookmark",
  description: "删除指定的书签。默认移动到回收站，可选择永久删除。",
  inputSchema,
  outputSchema,
  requiresConfirmation: true, // 危险操作需要确认

  async execute(params, context) {
    const supabase = await createClient();

    // 验证书签存在且属于当前用户
    const { data: bookmark, error: fetchError } = await supabase
      .from("bookmarks")
      .select("id, title")
      .eq("id", params.bookmarkId)
      .eq("user_id", context.userId)
      .single();

    if (fetchError || !bookmark) {
      return {
        success: false,
        bookmarkId: params.bookmarkId,
        message: "书签不存在或无权访问",
      };
    }

    if (params.permanent) {
      // 永久删除
      const { error: deleteError } = await supabase
        .from("bookmarks")
        .delete()
        .eq("id", params.bookmarkId)
        .eq("user_id", context.userId);

      if (deleteError) {
        logger.error(
          { error: deleteError },
          "Failed to delete bookmark permanently",
        );
        return {
          success: false,
          bookmarkId: params.bookmarkId,
          message: "删除失败",
        };
      }

      return {
        success: true,
        bookmarkId: params.bookmarkId,
        message: `已永久删除书签「${bookmark.title}」`,
        deletedAt: new Date().toISOString(),
      };
    } else {
      // 软删除（移动到回收站）
      const { error: updateError } = await supabase
        .from("bookmarks")
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.bookmarkId)
        .eq("user_id", context.userId);

      if (updateError) {
        logger.error({ error: updateError }, "Failed to soft delete bookmark");
        return {
          success: false,
          bookmarkId: params.bookmarkId,
          message: "删除失败",
        };
      }

      return {
        success: true,
        bookmarkId: params.bookmarkId,
        message: `已将书签「${bookmark.title}」移动到回收站`,
        deletedAt: new Date().toISOString(),
      };
    }
  },
});
```

### 5.4 create-bookmark.tool.ts

```typescript
/**
 * CreateBookmark Tool - 创建书签
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import { createToolDefinition } from "../tool-definition";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const inputSchema = z.object({
  url: z.string().url().describe("书签URL"),
  title: z
    .string()
    .min(1)
    .max(500)
    .optional()
    .describe("书签标题，不传则自动获取"),
  description: z.string().max(2000).optional().describe("书签描述"),
  folderId: z.number().int().positive().optional().describe("目标文件夹ID"),
  tags: z.array(z.string().max(50)).max(20).optional().describe("用户标签列表"),
  isStarred: z.boolean().optional().default(false).describe("是否添加星标"),
});

const outputSchema = z.object({
  success: z.boolean(),
  bookmarkId: z.number().optional(),
  title: z.string().optional(),
  url: z.string().optional(),
  folderId: z.number().nullable().optional(),
  message: z.string(),
});

export const createBookmarkTool = createToolDefinition({
  name: "create_bookmark",
  description:
    "创建新的书签。可以指定标题、描述、文件夹和标签。如果不提供标题，系统会尝试自动获取。",
  inputSchema,
  outputSchema,

  async execute(params, context) {
    const supabase = await createClient();

    // 检查URL是否已存在
    const { data: existing } = await supabase
      .from("bookmarks")
      .select("id, title")
      .eq("url", params.url)
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .single();

    if (existing) {
      return {
        success: false,
        bookmarkId: existing.id,
        title: existing.title,
        url: params.url,
        message: `该URL已存在于收藏中：「${existing.title}」`,
      };
    }

    // 如果指定了文件夹，验证文件夹存在
    if (params.folderId) {
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id, name")
        .eq("id", params.folderId)
        .eq("user_id", context.userId)
        .single();

      if (folderError || !folder) {
        return {
          success: false,
          message: "指定的文件夹不存在",
        };
      }
    }

    // 创建书签
    const now = new Date().toISOString();
    const { data: bookmark, error: insertError } = await supabase
      .from("bookmarks")
      .insert({
        user_id: context.userId,
        url: params.url,
        title: params.title || "正在获取标题...",
        description: params.description || null,
        folder_id: params.folderId || null,
        user_tags: params.tags || [],
        is_starred: params.isStarred || false,
        is_read: false,
        status: params.title ? "COMPLETED" : "PENDING", // 需要获取标题
        platform: detectPlatform(params.url),
        created_at: now,
        updated_at: now,
      })
      .select("id, title, url, folder_id")
      .single();

    if (insertError || !bookmark) {
      logger.error({ error: insertError }, "Failed to create bookmark");
      return {
        success: false,
        message: "创建书签失败",
      };
    }

    return {
      success: true,
      bookmarkId: bookmark.id,
      title: bookmark.title,
      url: bookmark.url,
      folderId: bookmark.folder_id,
      message: `已创建书签「${bookmark.title}」`,
    };
  },
});

/**
 * 检测URL平台
 */
function detectPlatform(url: string): string {
  const hostname = new URL(url).hostname.toLowerCase();

  if (hostname.includes("weixin") || hostname.includes("mp.weixin"))
    return "wechat";
  if (hostname.includes("bilibili")) return "bilibili";
  if (hostname.includes("zhihu")) return "zhihu";
  if (hostname.includes("xiaohongshu") || hostname.includes("xhslink"))
    return "xiaohongshu";
  if (hostname.includes("douyin")) return "douyin";
  if (hostname.includes("github")) return "github";
  if (hostname.includes("juejin")) return "juejin";
  if (hostname.includes("csdn")) return "csdn";

  return "web";
}
```

### 5.5 update-trust-mode.tool.ts (设置类)

```typescript
/**
 * UpdateTrustMode Tool - 更新信任模式
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import { createToolDefinition } from "../tool-definition";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const inputSchema = z.object({
  mode: z
    .enum(["full_auto", "semi_auto", "manual"])
    .describe(
      "信任模式：full_auto(全自动)、semi_auto(半自动)、manual(手动确认)",
    ),
});

const outputSchema = z.object({
  success: z.boolean(),
  previousMode: z.string(),
  currentMode: z.string(),
  message: z.string(),
});

const modeLabels: Record<string, string> = {
  full_auto: "全自动模式",
  semi_auto: "半自动模式",
  manual: "手动确认模式",
};

export const updateTrustModeTool = createToolDefinition({
  name: "update_trust_mode",
  description:
    "更新 AI 信任模式。full_auto: AI 完全自主执行；semi_auto: 批量操作需确认；manual: 所有操作需确认。",
  inputSchema,
  outputSchema,

  async execute(params, context) {
    const supabase = await createClient();

    // 获取当前设置
    const { data: config, error: fetchError } = await supabase
      .from("user_classification_configs")
      .select("trust_mode")
      .eq("user_id", context.userId)
      .single();

    const previousMode = config?.trust_mode || "semi_auto";

    if (previousMode === params.mode) {
      return {
        success: true,
        previousMode,
        currentMode: params.mode,
        message: `当前已是${modeLabels[params.mode]}`,
      };
    }

    // 更新信任模式
    const { error: updateError } = await supabase
      .from("user_classification_configs")
      .upsert({
        user_id: context.userId,
        trust_mode: params.mode,
        updated_at: new Date().toISOString(),
      });

    if (updateError) {
      logger.error({ error: updateError }, "Failed to update trust mode");
      return {
        success: false,
        previousMode,
        currentMode: previousMode,
        message: "更新失败",
      };
    }

    return {
      success: true,
      previousMode,
      currentMode: params.mode,
      message: `已从${modeLabels[previousMode]}切换到${modeLabels[params.mode]}`,
    };
  },
});
```

### 5.6 list-md-collections.tool.ts (MD 收藏类)

```typescript
/**
 * ListMdCollections Tool - 查询 MD 收藏列表
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import { createToolDefinition } from "../tool-definition";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const inputSchema = z.object({
  page: z.number().int().positive().optional().default(1).describe("页码"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("每页数量"),
  folderId: z.number().int().positive().optional().describe("文件夹 ID 筛选"),
  contentType: z.string().optional().describe("内容类型筛选"),
  isRead: z.boolean().optional().describe("已读状态筛选"),
  isStarred: z.boolean().optional().describe("星标状态筛选"),
  sort: z
    .enum(["created_desc", "created_asc", "title_asc", "updated_desc"])
    .optional()
    .default("created_desc")
    .describe("排序方式"),
});

const outputSchema = z.object({
  success: z.boolean(),
  data: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      wordCount: z.number(),
      contentType: z.string().nullable(),
      aiSummary: z.string().nullable(),
      isRead: z.boolean(),
      isStarred: z.boolean(),
      createdAt: z.string(),
    }),
  ),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
  message: z.string(),
});

export const listMdCollectionsTool = createToolDefinition({
  name: "list_md_collections",
  description: "查询用户的 MD 收藏列表，支持分页、筛选和排序。",
  inputSchema,
  outputSchema,

  async execute(params, context) {
    const supabase = await createClient();

    // 构建查询
    let query = supabase
      .from("md_collections")
      .select("*", { count: "exact" })
      .eq("user_id", context.userId)
      .is("deleted_at", null);

    // 应用筛选条件
    if (params.folderId) {
      query = query.eq("folder_id", params.folderId);
    }
    if (params.contentType) {
      query = query.eq("content_type", params.contentType);
    }
    if (params.isRead !== undefined) {
      query = query.eq("is_read", params.isRead);
    }
    if (params.isStarred !== undefined) {
      query = query.eq("is_starred", params.isStarred);
    }

    // 应用排序
    const sortMap: Record<string, { column: string; ascending: boolean }> = {
      created_desc: { column: "created_at", ascending: false },
      created_asc: { column: "created_at", ascending: true },
      title_asc: { column: "title", ascending: true },
      updated_desc: { column: "updated_at", ascending: false },
    };
    const sortConfig = sortMap[params.sort || "created_desc"];
    query = query.order(sortConfig.column, { ascending: sortConfig.ascending });

    // 应用分页
    const offset = (params.page - 1) * params.limit;
    query = query.range(offset, offset + params.limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error({ error }, "Failed to list MD collections");
      return {
        success: false,
        data: [],
        pagination: {
          page: params.page,
          limit: params.limit,
          total: 0,
          totalPages: 0,
        },
        message: "查询失败",
      };
    }

    const total = count || 0;
    return {
      success: true,
      data: (data || []).map((item) => ({
        id: item.id,
        title: item.title,
        wordCount: item.word_count,
        contentType: item.content_type,
        aiSummary: item.ai_summary,
        isRead: item.is_read,
        isStarred: item.is_starred,
        createdAt: item.created_at,
      })),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
      message: `共找到 ${total} 条 MD 收藏`,
    };
  },
});
```

### 5.7 search-md-collections.tool.ts (MD 收藏类)

```typescript
/**
 * SearchMdCollections Tool - 语义搜索 MD 收藏
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import { createToolDefinition } from "../tool-definition";
import { createClient } from "@/lib/supabase/server";
import { getEmbedding } from "@/lib/ai/embedding";
import { logger } from "@/lib/logger";

const inputSchema = z.object({
  query: z.string().min(1).max(500).describe("搜索查询文本"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe("返回结果数量"),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.5)
    .describe("相似度阈值"),
});

const outputSchema = z.object({
  success: z.boolean(),
  data: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      snippet: z.string(),
      similarity: z.number(),
      contentType: z.string().nullable(),
    }),
  ),
  message: z.string(),
});

export const searchMdCollectionsTool = createToolDefinition({
  name: "search_md_collections",
  description: "使用语义搜索在 MD 收藏中查找相关内容。基于向量相似度匹配。",
  inputSchema,
  outputSchema,

  async execute(params, context) {
    const supabase = await createClient();

    try {
      // 生成查询向量
      const queryEmbedding = await getEmbedding(params.query);

      // 执行向量搜索
      const { data, error } = await supabase.rpc("search_md_collections", {
        query_embedding: queryEmbedding,
        match_threshold: params.threshold,
        match_count: params.limit,
        p_user_id: context.userId,
      });

      if (error) {
        logger.error({ error }, "Failed to search MD collections");
        return {
          success: false,
          data: [],
          message: "搜索失败",
        };
      }

      return {
        success: true,
        data: (data || []).map((item) => ({
          id: item.id,
          title: item.title,
          snippet: item.raw_content?.substring(0, 200) + "..." || "",
          similarity: Math.round(item.similarity * 100) / 100,
          contentType: item.content_type,
        })),
        message: `找到 ${data?.length || 0} 条相关结果`,
      };
    } catch (error) {
      logger.error({ error }, "Failed to generate embedding for search");
      return {
        success: false,
        data: [],
        message: "搜索失败：无法生成查询向量",
      };
    }
  },
});
```

### 5.8 get-user-settings.tool.ts (设置类)

```typescript
/**
 * GetUserSettings Tool - 获取用户设置信息
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

import { z } from "zod";
import { createToolDefinition } from "../tool-definition";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

const inputSchema = z.object({});

const outputSchema = z.object({
  success: z.boolean(),
  settings: z
    .object({
      trustMode: z.string(),
      classificationEnabled: z.boolean(),
      autoCreateFolders: z.boolean(),
      backfillEnabled: z.boolean(),
      confidenceThreshold: z.number(),
      presetInterests: z.array(z.string()),
    })
    .optional(),
  message: z.string(),
});

export const getUserSettingsTool = createToolDefinition({
  name: "get_user_settings",
  description: "获取用户的 AI 相关设置，包括信任模式、分类配置和兴趣领域。",
  inputSchema,
  outputSchema,

  async execute(_params, context) {
    const supabase = await createClient();

    const { data: config, error } = await supabase
      .from("user_classification_configs")
      .select("*")
      .eq("user_id", context.userId)
      .single();

    if (error && error.code !== "PGRST116") {
      logger.error({ error }, "Failed to get user settings");
      return {
        success: false,
        message: "获取设置失败",
      };
    }

    return {
      success: true,
      settings: {
        trustMode: config?.trust_mode || "semi_auto",
        classificationEnabled: config?.classification_enabled ?? true,
        autoCreateFolders: config?.auto_create_folders ?? false,
        backfillEnabled: config?.backfill_enabled ?? false,
        confidenceThreshold: config?.confidence_threshold ?? 0.7,
        presetInterests: config?.preset_interests || [],
      },
      message: "获取设置成功",
    };
  },
});
```

---

## 六、总结

### 6.1 覆盖率统计

| 菜单区域     | 总功能数 | 已覆盖 | 需新增 | 前端功能 | 覆盖率    |
| ------------ | -------- | ------ | ------ | -------- | --------- |
| 文件夹菜单   | 12       | 11     | 0      | 1        | 91.7%     |
| 书签菜单     | 6        | 1      | 5      | 0        | 16.7%     |
| 首页工具栏   | 14       | 4      | 5      | 5        | 28.6%     |
| 智能列表菜单 | 3        | 0      | 3      | 0        | 0%        |
| 设置页面     | 12       | 0      | 6      | 6        | 0%        |
| MD 收藏      | 11       | 0      | 8      | 3        | 0%        |
| **总计**     | **58**   | **16** | **27** | **15**   | **27.6%** |

### 6.2 新增 Tools 统计

| 优先级    | 数量   | 类别                       | 预计工时    |
| --------- | ------ | -------------------------- | ----------- |
| P0 (核心) | 8      | 书签 4 + 设置 1 + MD 3     | 2-3 天      |
| P1 (扩展) | 11     | 书签 3 + 设置 5 + MD 3     | 3-4 天      |
| P2 (完善) | 8      | 导入 2 + 智能列表 4 + MD 2 | 2-3 天      |
| **总计**  | **27** | -                          | **7-10 天** |

### 6.3 实施建议

1. **第一周**: 完成 P0 共 8 个 Tools
   - 书签核心操作 (4)
   - 信任模式设置 (1)
   - MD 收藏查询 (3)

2. **第二周**: 完成 P1 共 11 个 Tools
   - 书签扩展功能 (3)
   - 设置管理 (5)
   - MD 收藏操作 (3)

3. **第三周**: 完成 P2 共 8 个 Tools
   - 导入功能 (2，可选 1)
   - 智能列表管理 (4)
   - MD 收藏管理 (2)

4. **持续优化**: 根据用户反馈调整 Tool 参数和描述

### 6.4 预期成果

完成后 Tools 总数将从 **36 → 63**，功能 AI 覆盖率将从 **27.6% → 74.1%**。

| 指标         | 当前  | 完成后 | 提升       |
| ------------ | ----- | ------ | ---------- |
| Tools 总数   | 36    | 63     | +27 (+75%) |
| 书签操作覆盖 | 16.7% | 100%   | +83.3%     |
| 设置功能覆盖 | 0%    | 50%    | +50%       |
| MD 收藏覆盖  | 0%    | 72.7%  | +72.7%     |

---

## 附录：文件位置参考

### 现有 Tools 目录结构

```
src/lib/ai-agent/tools/
├── action/
│   ├── batch-tags.tool.ts
│   └── move-bookmarks.tool.ts
├── export/
│   ├── export-bookmarks.tool.ts
│   ├── list-export-formats.tool.ts
│   └── preview-export.tool.ts
├── folder/
│   ├── auto-classify-inbox.tool.ts
│   ├── create-folder.tool.ts
│   ├── delete-folder-bookmarks.tool.ts
│   ├── delete-folder.tool.ts
│   ├── get-folder-bookmarks.tool.ts
│   ├── get-folder-detail.tool.ts
│   ├── list-folders.tool.ts
│   ├── merge-folders.tool.ts
│   ├── move-bookmark.tool.ts
│   ├── move-bookmarks-batch.tool.ts
│   ├── move-folder-to-group.tool.ts
│   ├── rename-folder.tool.ts
│   ├── reorder-folder.tool.ts
│   ├── split-folder.tool.ts
│   ├── toggle-folder-archive.tool.ts
│   └── toggle-folder-lock.tool.ts
├── query/
│   ├── count-bookmarks.tool.ts
│   ├── count-by-folder.tool.ts
│   ├── count-by-platform.tool.ts
│   ├── count-total.tool.ts
│   ├── get-stats.tool.ts
│   ├── list-bookmarks.tool.ts
│   ├── list-by-folder.tool.ts
│   ├── list-by-platform.tool.ts
│   └── list-recent.tool.ts
├── read/
│   └── read-bookmark.tool.ts
├── search/
│   ├── search.tool.ts
│   └── semantic-search.tool.ts
└── smart-list/
    ├── get-smart-list-count.tool.ts
    ├── get-smart-list-items.tool.ts
    └── list-smart-lists.tool.ts
```

### 建议新增 Tools 目录结构

```
src/lib/ai-agent/tools/
├── bookmark/                      # 新增目录
│   ├── toggle-bookmark-read.tool.ts
│   ├── toggle-bookmark-starred.tool.ts
│   ├── delete-bookmark.tool.ts
│   ├── create-bookmark.tool.ts
│   ├── update-bookmark.tool.ts
│   ├── create-snapshot.tool.ts
│   └── batch-delete-bookmarks.tool.ts
├── import/                        # 新增目录
│   ├── import-bookmarks.tool.ts
│   └── import-browser-bookmarks.tool.ts
├── settings/                      # 新增目录
│   ├── get-user-settings.tool.ts
│   ├── update-trust-mode.tool.ts
│   ├── get-classification-settings.tool.ts
│   ├── update-classification-settings.tool.ts
│   ├── get-user-interests.tool.ts
│   └── update-user-interests.tool.ts
├── md-collection/                 # 新增目录
│   ├── list-md-collections.tool.ts
│   ├── get-md-collection.tool.ts
│   ├── search-md-collections.tool.ts
│   ├── toggle-md-read.tool.ts
│   ├── toggle-md-starred.tool.ts
│   ├── update-md-collection.tool.ts
│   ├── delete-md-collection.tool.ts
│   └── get-md-stats.tool.ts
└── smart-list/                    # 扩展现有目录
    ├── toggle-smart-list-pin.tool.ts
    ├── update-smart-list.tool.ts
    ├── delete-smart-list.tool.ts
    └── create-smart-list.tool.ts
```

---

## 附录 B：MD 收藏数据模型参考

```typescript
// MD 收藏记录核心字段
interface MdCollection {
  id: number;
  user_id: string;
  title: string;
  raw_content: string;
  content_hash: string;
  word_count: number;
  code_block_count: number;
  reading_time_minutes: number;

  // AI 处理结果
  ai_summary: string | null;
  ai_tags: string[] | null;
  content_type: MdContentType | null;
  embedding: number[] | null;

  // 用户数据
  folder_id: number | null;
  user_tags: string[] | null;
  notes: string | null;

  // 状态标记
  processing_status: "pending" | "processing" | "completed" | "failed";
  is_read: boolean;
  is_starred: boolean;

  // 时间戳
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// 内容类型枚举
type MdContentType =
  | "TUTORIAL"
  | "CODE_SNIPPET"
  | "ANALYSIS"
  | "SUMMARY"
  | "QA"
  | "DOCUMENTATION"
  | "OTHER"
  | "article"
  | "tutorial"
  | "code"
  | "note"
  | "documentation";
```
