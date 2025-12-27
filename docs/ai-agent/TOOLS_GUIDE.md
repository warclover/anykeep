# AI Agent Tools 完整文档

> **版本**: 1.9.0
> **更新日期**: 2025-12-27
> **适用版本**: AnyKeep v2.7.x+

---

## 概述

本文档介绍 AnyKeep AI Agent 的完整工具集。这些 Tools 是原子操作，由 KnowledgeAgent 在原子模式下调用。

### Tools 统计

| 分类          | 数量   | 说明               |
| ------------- | ------ | ------------------ |
| Query         | 8      | 数据查询           |
| Search        | 1      | 关键词/语义搜索    |
| Read          | 1      | 内容阅读           |
| Action        | 2      | 批量操作（需确认） |
| Bookmark      | 7      | 书签基本操作       |
| Folder        | 16     | 文件夹管理         |
| Smart List    | 7      | 智能列表管理       |
| Export        | 3      | 数据导出           |
| Settings      | 6      | 用户设置           |
| MD Collection | 8      | Markdown 收藏管理  |
| Import        | 3      | 书签导入           |
| **总计**      | **62** | -                  |

---

## 1. Query Tools - 数据查询 (8 个)

### 列表类

| Tool ID                | 名称         | 参数               | 说明               |
| ---------------------- | ------------ | ------------------ | ------------------ |
| `list_recent`          | 获取最近收藏 | `limit?: number`   | 默认返回 20 条     |
| `list_by_folder`       | 按文件夹列表 | `folderId: string` | 获取指定文件夹     |
| `list_by_platform`     | 按平台列表   | `platform: string` | 如 bilibili/weixin |
| `list_wechat_articles` | 微信文章列表 | `limit?: number`   | 专用微信公众号     |

### 统计类

| Tool ID             | 名称         | 参数                | 说明         |
| ------------------- | ------------ | ------------------- | ------------ |
| `count_total`       | 总数统计     | 无                  | 返回收藏总数 |
| `count_by_folder`   | 按文件夹统计 | `folderId?: string` | 各文件夹数量 |
| `count_by_platform` | 按平台统计   | 无                  | 各平台数量   |
| `get_stats`         | 详细统计     | 无                  | 完整统计概览 |

**文件位置**: `src/lib/ai-agent/tools/query/`

---

## 2. Search Tools - 搜索工具 (1 个)

| Tool ID  | 名称     | 参数                            | 说明                      |
| -------- | -------- | ------------------------------- | ------------------------- |
| `search` | 智能搜索 | `query: string, limit?: number` | 支持关键词 + 语义混合搜索 |

**特性**:

- 自动判断关键词搜索或语义搜索
- 支持结果高亮
- 支持相关性排序

**文件位置**: `src/lib/ai-agent/tools/search/`

---

## 3. Read Tools - 内容阅读 (1 个)

| Tool ID         | 名称     | 参数         | 说明                   |
| --------------- | -------- | ------------ | ---------------------- |
| `read_bookmark` | 阅读书签 | `id: number` | 获取书签完整内容和摘要 |

**文件位置**: `src/lib/ai-agent/tools/read/`

---

## 4. Action Tools - 批量操作 (2 个)

| Tool ID          | 名称       | 参数                                                    | 风险等级 | 说明             |
| ---------------- | ---------- | ------------------------------------------------------- | -------- | ---------------- |
| `batch_tags`     | 批量打标签 | `ids: number[], tags: string[], action: "add"/"remove"` | 中       | 添加/移除标签    |
| `move_bookmarks` | 批量移动   | `ids: number[], folderId: string`                       | 中       | 移动到指定文件夹 |

**注意**: 这些操作在执行前可能需要用户确认。

**文件位置**: `src/lib/ai-agent/tools/action/`

---

## 5. Bookmark Tools - 书签操作 (7 个)

### 状态切换

| Tool ID                   | 名称     | 参数         | 说明          |
| ------------------------- | -------- | ------------ | ------------- |
| `toggle_bookmark_read`    | 切换已读 | `id: number` | 标记已读/未读 |
| `toggle_bookmark_starred` | 切换星标 | `id: number` | 添加/移除星标 |

### CRUD 操作

| Tool ID           | 名称     | 参数                          | 风险等级 | 说明            |
| ----------------- | -------- | ----------------------------- | -------- | --------------- |
| `create_bookmark` | 创建书签 | `url: string, title?: string` | 低       | 快速收藏 URL    |
| `update_bookmark` | 更新书签 | `id: number, data: {...}`     | 低       | 更新标题/备注等 |
| `delete_bookmark` | 删除书签 | `id: number`                  | 高       | 永久删除        |

### 批量与快照

| Tool ID                  | 名称     | 参数            | 风险等级 | 说明               |
| ------------------------ | -------- | --------------- | -------- | ------------------ |
| `batch_delete_bookmarks` | 批量删除 | `ids: number[]` | 高       | 批量永久删除       |
| `create_snapshot`        | 创建快照 | `id: number`    | 低       | 保存网页快照到存储 |

**文件位置**: `src/lib/ai-agent/tools/bookmark/`

---

## 6. Folder Tools - 文件夹管理 (16 个)

### Phase 1: 查询类（无需确认）

| Tool ID                | 名称       | 参数         | 说明         |
| ---------------------- | ---------- | ------------ | ------------ |
| `list_folders`         | 列出文件夹 | 无           | 获取文件夹树 |
| `get_folder_detail`    | 文件夹详情 | `id: string` | 获取单个详情 |
| `get_folder_bookmarks` | 文件夹书签 | `id: string` | 获取夹内书签 |

### Phase 2: 基础操作（低风险）

| Tool ID                   | 名称       | 参数                                   | 说明         |
| ------------------------- | ---------- | -------------------------------------- | ------------ |
| `create_folder`           | 创建文件夹 | `name: string, parentId?: string`      | 创建新文件夹 |
| `rename_folder`           | 重命名     | `id: string, name: string`             | 重命名文件夹 |
| `move_bookmark_to_folder` | 移动书签   | `bookmarkId: number, folderId: string` | 移动单个书签 |
| `reorder_folder`          | 调整顺序   | `id: string, position: number`         | 调整显示顺序 |
| `move_folder_to_group`    | 移动到分组 | `id: string, groupId: string`          | 移动到分组下 |
| `toggle_folder_archive`   | 归档/取消  | `id: string`                           | 归档文件夹   |

### Phase 3: 高级操作（中/高风险）

| Tool ID                   | 名称         | 参数                                 | 风险 | 说明             |
| ------------------------- | ------------ | ------------------------------------ | ---- | ---------------- |
| `toggle_folder_lock`      | AI 锁定      | `id: string`                         | 低   | 禁止 AI 操作     |
| `move_bookmarks_batch`    | 批量移动     | `ids: number[], folderId: string`    | 中   | 批量移动书签     |
| `merge_folders`           | 合并文件夹   | `sourceId: string, targetId: string` | 中   | 合并两个文件夹   |
| `split_folder`            | 拆分文件夹   | `id: string, criteria: {...}`        | 中   | 按条件拆分       |
| `delete_folder`           | 删除文件夹   | `id: string`                         | 高   | 删除（保留书签） |
| `delete_folder_bookmarks` | 删除夹内书签 | `id: string`                         | 高   | 删除夹内所有书签 |
| `auto_classify_inbox`     | 一键分类     | 无                                   | 中   | 自动分类待整理   |

**文件位置**: `src/lib/ai-agent/tools/folder/`

---

## 7. Smart List Tools - 智能列表 (7 个)

### 查询类

| Tool ID                | 名称         | 参数         | 说明             |
| ---------------------- | ------------ | ------------ | ---------------- |
| `list_smart_lists`     | 列出智能列表 | 无           | 获取所有智能列表 |
| `get_smart_list_items` | 获取列表项   | `id: string` | 获取列表内书签   |
| `get_smart_list_count` | 获取数量     | `id: string` | 获取匹配数量     |

### 操作类

| Tool ID                 | 名称      | 参数                           | 风险 | 说明           |
| ----------------------- | --------- | ------------------------------ | ---- | -------------- |
| `toggle_smart_list_pin` | 置顶/取消 | `id: string`                   | 低   | 置顶到侧边栏   |
| `update_smart_list`     | 更新配置  | `id: string, config: {...}`    | 低   | 更新筛选条件   |
| `delete_smart_list`     | 删除列表  | `id: string`                   | 中   | 删除智能列表   |
| `create_smart_list`     | 创建列表  | `name: string, filters: {...}` | 低   | 创建新智能列表 |

**文件位置**: `src/lib/ai-agent/tools/smart-list/`

---

## 8. Export Tools - 数据导出 (3 个)

| Tool ID               | 名称     | 参数                             | 说明           |
| --------------------- | -------- | -------------------------------- | -------------- |
| `list_export_formats` | 列出格式 | 无                               | 获取支持的格式 |
| `preview_export`      | 预览导出 | `format: string, ids?: number[]` | 预览导出内容   |
| `export_bookmarks`    | 执行导出 | `format: string, ids?: number[]` | 生成导出文件   |

**支持格式**:

- `csv` - CSV 表格
- `markdown` - Markdown 文档
- `obsidian` - Obsidian 双链格式
- `json` - JSON 结构化
- `html` - 浏览器兼容 HTML

**文件位置**: `src/lib/ai-agent/tools/export/`

---

## 9. Settings Tools - 用户设置 (6 个)

### 读取类

| Tool ID                       | 名称         | 参数 | 说明         |
| ----------------------------- | ------------ | ---- | ------------ |
| `get_user_settings`           | 获取用户设置 | 无   | 获取完整设置 |
| `get_classification_settings` | 获取分类设置 | 无   | 获取分类配置 |
| `get_user_interests`          | 获取兴趣领域 | 无   | 获取用户兴趣 |

### 更新类

| Tool ID                          | 名称         | 参数                  | 说明             |
| -------------------------------- | ------------ | --------------------- | ---------------- |
| `update_trust_mode`              | 更新信任模式 | `mode: string`        | 设置 AI 信任等级 |
| `update_classification_settings` | 更新分类设置 | `settings: {...}`     | 更新分类配置     |
| `update_user_interests`          | 更新兴趣领域 | `interests: string[]` | 更新兴趣标签     |

**文件位置**: `src/lib/ai-agent/tools/settings/`

---

## 10. MD Collection Tools - Markdown 收藏 (8 个)

### 查询类

| Tool ID                 | 名称         | 参数             | 说明            |
| ----------------------- | ------------ | ---------------- | --------------- |
| `list_md_collections`   | 列出 MD 收藏 | `limit?: number` | 获取收藏列表    |
| `get_md_collection`     | 获取 MD 详情 | `id: number`     | 获取单个详情    |
| `search_md_collections` | 搜索 MD 收藏 | `query: string`  | 关键词/语义搜索 |
| `get_md_stats`          | 获取 MD 统计 | 无               | 获取收藏统计    |

### 操作类

| Tool ID                | 名称         | 参数                      | 风险 | 说明          |
| ---------------------- | ------------ | ------------------------- | ---- | ------------- |
| `toggle_md_read`       | 切换已读     | `id: number`              | 低   | 标记已读/未读 |
| `toggle_md_starred`    | 切换星标     | `id: number`              | 低   | 添加/移除星标 |
| `update_md_collection` | 更新 MD 收藏 | `id: number, data: {...}` | 低   | 更新内容/标签 |
| `delete_md_collection` | 删除 MD 收藏 | `id: number`              | 高   | 永久删除      |

**文件位置**: `src/lib/ai-agent/tools/md-collection/`

---

## 11. Import Tools - 书签导入 (3 个)

| Tool ID                    | 名称           | 参数             | 说明               |
| -------------------------- | -------------- | ---------------- | ------------------ |
| `import_bookmarks`         | 批量导入 URL   | `urls: string[]` | 批量导入 URL 列表  |
| `import_browser_bookmarks` | 导入浏览器书签 | `file: File`     | 导入 HTML 书签文件 |
| `import_wechat_article`    | 导入微信文章   | `url: string`    | 导入公众号文章     |

**文件位置**: `src/lib/ai-agent/tools/import/`

---

## 风险分级与确认机制

### 风险等级定义

| 等级 | 操作类型                         | 处理策略             |
| ---- | -------------------------------- | -------------------- |
| 低   | search, list, count, get, toggle | 直接执行             |
| 中   | add_tag, move, classify, export  | 执行 + 结果确认      |
| 高   | delete, batch_delete, remove     | 必须确认（显示影响） |

### 批量操作阈值

当操作影响超过 **20 条** 记录时，强制显示数量确认。

---

## 工具增强功能 (v1.9.0)

### 工具描述模板

文件: `tool-description-templates.ts`

提供增强型工具描述，帮助 LLM 更准确地选择工具：

```typescript
interface EnhancedToolDescription {
  name: string;
  description: string; // 详细描述
  whenToUse: string[]; // 使用场景
  whenNotToUse: string[]; // 不适用场景
  examples: string[]; // 使用示例
}
```

### 工具结果增强器

文件: `tool-result-enhancer.ts`

对工具执行结果进行后处理：

- **结果摘要**: 生成人类可读的摘要
- **错误分析**: 分析错误原因和解决方案
- **下一步建议**: 根据结果推荐后续操作

---

## 版本历史

| 版本  | 日期       | 变更                                             |
| ----- | ---------- | ------------------------------------------------ |
| 1.9.0 | 2025-12-23 | 添加工具描述模板和结果增强器                     |
| 1.8.0 | 2025-12-24 | 添加导入 Tools（URL/浏览器/微信）                |
| 1.7.0 | 2025-12-23 | 添加 P1/P2 优先级 Tools（书签/设置/MD）          |
| 1.6.0 | 2025-12-23 | 添加 Bookmark/Settings/MD Collection             |
| 1.2.0 | 2025-12-27 | 添加 list_wechat_articles, import_wechat_article |

---

## 相关文档

- [AI Skills 功能文档](./NEW_SKILLS_GUIDE.md)
- [AI 能力配置指南](./AI_CAPABILITY_CONFIG.md)
- [任务理解层规范](../specs/task-understanding-v2-implementation.md)
