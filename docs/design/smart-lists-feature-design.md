# AnyKeep 智能列表功能设计方案

**版本**: v1.2
**日期**: 2025-12-13
**状态**: 待审核
**更新记录**:

- v1.2: 对标 Cubox 重新设计完整版筛选条件，更新预设模板为 6 个
- v1.1: 更新设计决策，添加详细任务分解和验收条件

---

## 设计决策确认

| 决策项            | 确认结果                                   |
| ----------------- | ------------------------------------------ |
| **筛选条件**      | 对标 Cubox + AnyKeep 特色，完整版设计      |
| **时间范围筛选**  | ✅ 本次实现，扩展现有 API 支持 dateRange   |
| **已读/未读状态** | ✅ 本次实现，bookmarks 表已有 is_read 字段 |
| **侧边栏位置**    | 智能列表区域放在「首页」下方               |
| **预设模板**      | ✅ 6 个预设模板                            |
| **工期**          | 10 天                                      |
| **测试要求**      | Phase 0 的 API 扩展需要充分测试            |

---

## 一、功能概述

### 1.1 功能定义

**智能列表**：允许用户将筛选条件组合保存为快捷入口，实现一键访问特定维度的收藏内容。支持动态更新，新符合条件的内容自动纳入。

### 1.2 对标 Cubox 筛选条件分析

| Cubox 筛选维度 | AnyKeep 对应能力                  | 说明                                   |
| -------------- | --------------------------------- | -------------------------------------- |
| 来源/收藏夹    | ✅ 平台 + 文件夹                  | AnyKeep 支持 8 种平台 + 无限层级文件夹 |
| 时间范围       | ✅ created_at                     | 支持相对时间和绝对日期范围             |
| 内容类型       | ✅ content_type + ai_content_type | 原始类型 + AI 检测类型                 |
| 标签           | ✅ 用途标签 + AI 标签 + 用户标签  | AnyKeep 标签系统更丰富                 |
| 阅读状态       | ✅ is_read                        | 已读/未读                              |
| 智能列表条件   | ✅ 条件组合保存                   | 本次实现的核心功能                     |

### 1.3 AnyKeep 特色筛选维度

| 独家维度       | 说明                            | 数据字段                           |
| -------------- | ------------------------------- | ---------------------------------- |
| **用途标签**   | 6 个预设 + 自定义，表达收藏意图 | `user_tags` (包含用途标签)         |
| **星标收藏**   | 快速标记重要内容                | `is_starred`                       |
| **评级系统**   | 1-5 星评级                      | `rating`                           |
| **分类置信度** | AI 分类的可信程度               | `classification_result.confidence` |
| **来源名称**   | 公众号名/UP主名等               | `source_name`                      |
| **有效性状态** | 链接是否失效                    | `is_invalid`                       |
| **处理状态**   | 待处理/已完成/失败              | `status`                           |

---

## 二、完整版筛选条件设计

### 2.1 筛选条件全景图

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AnyKeep 智能列表筛选维度                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🌐 来源维度                                                  │   │
│  │   ├─ 平台 (platform)         微信/B站/小红书/浏览器...       │   │
│  │   ├─ 文件夹 (folderId)       真实文件夹 + 未分类             │   │
│  │   └─ 来源名称 (sourceName)   公众号名/UP主名/作者            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🏷️ 标签维度                                                  │   │
│  │   ├─ 用途标签 (usageTags)    预设6个 + 自定义               │   │
│  │   ├─ AI 标签 (aiTags)        AI 自动生成的分类标签          │   │
│  │   └─ 用户标签 (userTags)     用户手动添加的普通标签         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📅 时间维度                                                  │   │
│  │   ├─ 收藏时间 (dateRange)    相对/绝对日期范围              │   │
│  │   └─ 发布时间 (publishTime)  原文发布时间范围               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📊 状态维度                                                  │   │
│  │   ├─ 阅读状态 (isRead)       已读/未读                      │   │
│  │   ├─ 星标状态 (isStarred)    已星标/未星标                  │   │
│  │   ├─ 有效性 (isInvalid)      有效/失效                      │   │
│  │   └─ 处理状态 (status)       处理中/已完成/失败             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ⭐ 质量维度                                                  │   │
│  │   ├─ 评级 (rating)           1-5 星 / 高价值(5星)           │   │
│  │   └─ 分类置信度 (confidence) 高(≥80)/中(60-79)/低(<60)      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📝 内容维度                                                  │   │
│  │   ├─ 内容类型 (contentType)  文章/视频/图片/教程/工具       │   │
│  │   ├─ 关键词 (keyword)        标题/描述包含的关键词          │   │
│  │   └─ 导入来源 (importSource) 浏览器导入/API/手动/分享       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 筛选条件 TypeScript 类型定义

```typescript
// src/types/smart-list.ts

/**
 * AnyKeep 智能列表完整版筛选条件
 * 对标 Cubox + AnyKeep 特色维度
 * 所有条件之间为 AND 关系
 */
export interface SmartListFilters {
  // ==================== 来源维度 ====================

  /**
   * 平台筛选
   * 支持单选或多选
   * 枚举值: WECHAT_OFFICIAL_ACCOUNT | BILIBILI | XIAOHONGSHU | UNKNOWN
   *        | BROWSER_CHROME | BROWSER_EDGE | BROWSER_FIREFOX | BROWSER_SAFARI
   * 特殊值: "browser" = 所有浏览器平台
   */
  platform?: string | string[];

  /**
   * 排除的平台
   * 用于「全部」视图排除浏览器书签
   */
  excludePlatforms?: string[];

  /**
   * 文件夹筛选
   * number = 真实文件夹 ID
   * 'uncategorized' = 未分类内容
   */
  folderId?: number | "uncategorized";

  /**
   * 是否包含子文件夹
   * 默认 false，仅筛选当前文件夹
   */
  includeSubfolders?: boolean;

  /**
   * 来源名称筛选
   * 公众号名、UP主名、作者名等
   * 支持模糊匹配
   */
  sourceName?: string;

  // ==================== 标签维度 ====================

  /**
   * 用途标签筛选 (AnyKeep 独家)
   * 预设: 下次分享用 | 值得复读 | 优质经验 | 值得关注 | 推荐关注 | 待阅读
   * 支持自定义标签
   * 多选时为 OR 关系（包含任意一个即匹配）
   */
  usageTags?: string[];

  /**
   * AI 标签筛选
   * AI 自动生成的分类标签
   * 多选时为 OR 关系
   */
  aiTags?: string[];

  /**
   * 用户标签筛选
   * 用户手动添加的普通标签
   * 多选时为 OR 关系
   */
  userTags?: string[];

  // ==================== 时间维度 ====================

  /**
   * 收藏时间范围
   * 基于 created_at 字段
   */
  dateRange?: {
    type: "relative" | "absolute";
    // relative 模式: 最近 N 天/周/月/年
    value?: number;
    unit?: "day" | "week" | "month" | "year";
    // absolute 模式: 具体日期范围
    from?: string; // ISO 日期字符串
    to?: string;
  };

  /**
   * 发布时间范围
   * 基于 publish_time 字段（原文发布时间）
   */
  publishTimeRange?: {
    type: "relative" | "absolute";
    value?: number;
    unit?: "day" | "week" | "month" | "year";
    from?: string;
    to?: string;
  };

  // ==================== 状态维度 ====================

  /**
   * 阅读状态
   * true = 已读, false = 未读, undefined = 不筛选
   */
  isRead?: boolean;

  /**
   * 星标状态
   * true = 已星标, false = 未星标
   */
  isStarred?: boolean;

  /**
   * 有效性状态
   * true = 仅显示失效, false = 仅显示有效
   */
  isInvalid?: boolean;

  /**
   * 处理状态
   * PROCESSING | COMPLETED | FAILED
   */
  status?: "PROCESSING" | "COMPLETED" | "FAILED";

  // ==================== 质量维度 ====================

  /**
   * 评级范围
   * 1-5 星评级
   */
  rating?: {
    min?: number; // 最低评级 (1-5)
    max?: number; // 最高评级 (1-5)
  };

  /**
   * 高价值快捷筛选
   * true = rating === 5
   */
  isHighValue?: boolean;

  /**
   * 分类置信度范围 (AnyKeep 独家)
   * 高: ≥80, 中: 60-79, 低: <60
   */
  confidenceLevel?: "high" | "medium" | "low";

  // ==================== 内容维度 ====================

  /**
   * 内容类型筛选
   * 原始类型: ARTICLE | VIDEO | IMAGE | UNKNOWN
   * AI 检测类型: article | tutorial | video | tool
   */
  contentType?: string[];

  /**
   * 关键词搜索
   * 匹配标题和描述
   */
  keyword?: string;

  /**
   * 导入来源
   * browser_chrome | browser_edge | api | share_sheet | manual 等
   */
  importSource?: string | string[];
}

/**
 * 智能列表完整模型
 */
export interface SmartList {
  id: number;
  userId: string;
  name: string;
  description?: string;
  icon: string;
  color: SmartListColor;
  filters: SmartListFilters;
  sortBy: SmartListSortBy;
  viewMode: SmartListViewMode;
  sortOrder: number;
  isPinned: boolean;
  isPreset: boolean;
  bookmarkCount: number;
  lastAccessedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// 颜色枚举
export type SmartListColor =
  | "default"
  | "blue"
  | "green"
  | "orange"
  | "purple"
  | "red"
  | "cyan"
  | "pink"
  | "amber"
  | "emerald";

// 排序枚举
export type SmartListSortBy =
  | "created_desc"
  | "created_asc"
  | "title_asc"
  | "title_desc"
  | "rating_desc"
  | "publish_time_desc";

// 视图模式枚举
export type SmartListViewMode = "inherit" | "card" | "list" | "compact";
```

### 2.3 筛选条件优先级分类

| 优先级 | 筛选维度     | 实现阶段 | 说明                         |
| ------ | ------------ | -------- | ---------------------------- |
| **P0** | 平台         | Phase 0  | 现有能力                     |
| **P0** | 文件夹       | Phase 0  | 现有能力                     |
| **P0** | 用途标签     | Phase 0  | 现有能力                     |
| **P0** | 收藏时间范围 | Phase 0  | 需扩展 API                   |
| **P0** | 阅读状态     | Phase 0  | 已有字段                     |
| **P0** | 高价值       | Phase 0  | 已有 rating 字段             |
| **P0** | 星标状态     | Phase 0  | 已有 is_starred 字段         |
| **P1** | AI 标签      | Phase 1  | 已有字段，需扩展 API         |
| **P1** | 内容类型     | Phase 1  | 已有字段，需扩展 API         |
| **P1** | 有效性状态   | Phase 1  | 已有能力（虚拟文件夹）       |
| **P1** | 评级范围     | Phase 1  | 已有字段，需扩展 API         |
| **P2** | 关键词搜索   | Phase 2  | 需集成现有搜索能力           |
| **P2** | 来源名称     | Phase 2  | 已有字段，需扩展 API         |
| **P2** | 发布时间范围 | Phase 2  | 已有字段，需扩展 API         |
| **P2** | 分类置信度   | Phase 2  | 需解析 classification_result |
| **P3** | 导入来源     | 后续版本 | 已有字段                     |
| **P3** | 用户标签     | 后续版本 | 需分离逻辑                   |
| **P3** | 处理状态     | 后续版本 | 已有字段                     |

---

## 三、预设智能列表模板（6 个）

### 3.1 模板定义

```typescript
// src/lib/smart-list/presets.ts

export const PRESET_SMART_LISTS: PresetSmartList[] = [
  {
    name: "最近一周",
    description: "过去7天内收藏的内容",
    icon: "calendar",
    color: "blue",
    filters: {
      dateRange: { type: "relative", value: 7, unit: "day" },
    },
    sortBy: "created_desc",
    sortOrder: 0,
  },
  {
    name: "高价值收藏",
    description: "评分为5星的精选内容",
    icon: "star",
    color: "amber",
    filters: {
      isHighValue: true,
    },
    sortBy: "created_desc",
    sortOrder: 1,
  },
  {
    name: "待阅读",
    description: "尚未阅读的收藏内容",
    icon: "book-open",
    color: "green",
    filters: {
      isRead: false,
    },
    sortBy: "created_desc",
    sortOrder: 2,
  },
  {
    name: "优质经验",
    description: "标记为优质经验的内容",
    icon: "award",
    color: "orange",
    filters: {
      usageTags: ["优质经验"],
    },
    sortBy: "created_desc",
    sortOrder: 3,
  },
  {
    name: "推荐关注",
    description: "值得持续关注的来源",
    icon: "eye",
    color: "purple",
    filters: {
      usageTags: ["值得关注"],
    },
    sortBy: "created_desc",
    sortOrder: 4,
  },
  {
    name: "值得复读",
    description: "需要反复阅读的精华内容",
    icon: "refresh-ccw",
    color: "emerald",
    filters: {
      usageTags: ["值得复读"],
    },
    sortBy: "created_desc",
    sortOrder: 5,
  },
];
```

### 3.2 预设模板特点

| 预设名称       | 筛选条件                  | 目标场景         |
| -------------- | ------------------------- | ---------------- |
| **最近一周**   | `dateRange: 7 days`       | 快速回顾近期收藏 |
| **高价值收藏** | `rating = 5`              | 精选内容管理     |
| **待阅读**     | `isRead = false`          | 阅读任务管理     |
| **优质经验**   | `usageTags: ['优质经验']` | 经验知识库       |
| **推荐关注**   | `usageTags: ['值得关注']` | 信息源管理       |
| **值得复读**   | `usageTags: ['值得复读']` | 深度学习内容     |

---

## 四、数据库设计

### 4.1 smart_lists 表结构

```sql
-- 智能列表主表
CREATE TABLE smart_lists (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- 基本信息
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'filter',
    color VARCHAR(20) DEFAULT 'default',

    -- 筛选条件 (JSONB，支持完整条件)
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- 排序设置
    sort_by VARCHAR(50) DEFAULT 'created_desc',

    -- 显示设置
    view_mode VARCHAR(20) DEFAULT 'inherit',
    sort_order INT DEFAULT 0,
    is_pinned BOOLEAN DEFAULT false,
    is_preset BOOLEAN DEFAULT false,

    -- 统计信息
    bookmark_count INT DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,

    -- 生命周期
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- 约束
    CONSTRAINT unique_user_smart_list_name
        UNIQUE(user_id, name) WHERE deleted_at IS NULL
);

-- 索引
CREATE INDEX idx_smart_lists_user_active
    ON smart_lists(user_id, sort_order)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_smart_lists_user_pinned
    ON smart_lists(user_id, is_pinned DESC, sort_order)
    WHERE deleted_at IS NULL;

-- RLS 策略
ALTER TABLE smart_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smart_lists_user_isolation" ON smart_lists
    FOR ALL
    USING (auth.uid() = user_id AND deleted_at IS NULL)
    WITH CHECK (auth.uid() = user_id);
```

### 4.2 bookmarks 表索引扩展

```sql
-- 已读状态索引（已存在 is_read 字段）
CREATE INDEX IF NOT EXISTS idx_bookmarks_is_read
ON bookmarks(user_id, is_read)
WHERE deleted_at IS NULL AND is_in_trash = false;

-- 星标状态索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_is_starred
ON bookmarks(user_id, is_starred)
WHERE deleted_at IS NULL AND is_in_trash = false;

-- 时间范围查询索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at_range
ON bookmarks(user_id, created_at DESC)
WHERE deleted_at IS NULL AND is_in_trash = false;

-- 内容类型索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_content_type
ON bookmarks(user_id, content_type)
WHERE deleted_at IS NULL AND is_in_trash = false;

-- 来源名称索引（用于模糊匹配）
CREATE INDEX IF NOT EXISTS idx_bookmarks_source_name
ON bookmarks(user_id, source_name)
WHERE deleted_at IS NULL AND is_in_trash = false AND source_name IS NOT NULL;
```

---

## 五、API 设计

### 5.1 书签 API 扩展（完整版）

```typescript
// GET /api/bookmarks 完整查询参数

interface BookmarkQueryParams {
  // === 现有参数 ===
  platform?: string; // 平台筛选
  excludeBrowser?: boolean; // 排除浏览器
  folder?: string; // 文件夹/虚拟文件夹
  usageTags?: string; // 用途标签（逗号分隔）
  sort?: string; // 排序方式
  cursor?: string; // 分页游标
  limit?: number; // 分页大小

  // === 新增参数 (Phase 0) ===
  dateFrom?: string; // 收藏时间起始
  dateTo?: string; // 收藏时间结束
  isRead?: "true" | "false"; // 阅读状态
  isStarred?: "true" | "false"; // 星标状态
  isHighValue?: "true" | "false"; // 高价值（rating=5）

  // === 新增参数 (Phase 1) ===
  aiTags?: string; // AI 标签（逗号分隔）
  contentType?: string; // 内容类型（逗号分隔）
  ratingMin?: string; // 最低评级
  ratingMax?: string; // 最高评级

  // === 新增参数 (Phase 2) ===
  keyword?: string; // 关键词搜索
  sourceName?: string; // 来源名称
  publishTimeFrom?: string; // 发布时间起始
  publishTimeTo?: string; // 发布时间结束
}
```

### 5.2 智能列表 API 端点

| 方法     | 端点                            | 说明                   |
| -------- | ------------------------------- | ---------------------- |
| `GET`    | `/api/smart-lists`              | 获取智能列表（含预设） |
| `POST`   | `/api/smart-lists`              | 创建智能列表           |
| `GET`    | `/api/smart-lists/:id`          | 获取详情               |
| `PATCH`  | `/api/smart-lists/:id`          | 更新                   |
| `DELETE` | `/api/smart-lists/:id`          | 删除（软删除）         |
| `POST`   | `/api/smart-lists/preview`      | 预览筛选结果数量       |
| `POST`   | `/api/smart-lists/reorder`      | 批量排序               |
| `POST`   | `/api/smart-lists/init-presets` | 初始化 6 个预设模板    |

---

## 六、整体架构设计

### 6.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        前端层 (Next.js App Router)                   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  AppSidebar  │  │ HomePageClient│ │  SmartListDialog        │  │
│  │  ├─ 首页     │  │  ├─ 筛选工具栏 │ │  ├─ 条件编辑器          │  │
│  │  ├─ 智能列表 │  │  └─ 保存按钮  │ │  │   ├─ 来源维度        │  │
│  │  │  ├─ 6预设 │  │              │ │  │   ├─ 标签维度        │  │
│  │  │  └─ 自定义│  │              │ │  │   ├─ 时间维度        │  │
│  │  └─ ...      │  │              │ │  │   ├─ 状态维度        │  │
│  └──────────────┘  └──────────────┘ │  │   ├─ 质量维度        │  │
│                                      │  │   └─ 内容维度        │  │
│                                      │  └─ 预览/保存           │  │
│                                      └──────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        API 层 (Route Handlers)                       │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ smart-lists  │  │ bookmarks    │  │ 新增筛选参数:            │  │
│  │ CRUD API     │  │ (扩展版)     │  │ dateFrom/dateTo          │  │
│  │              │  │              │  │ isRead/isStarred         │  │
│  │              │  │              │  │ aiTags/contentType       │  │
│  │              │  │              │  │ rating/keyword/source    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        数据层 (Supabase)                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌─────────────────────────────────┐   │
│  │  smart_lists 表         │  │  bookmarks 表                    │   │
│  │  ├─ filters (JSONB)     │  │  ├─ 完整字段支持筛选             │   │
│  │  ├─ 6 预设模板          │  │  ├─ 新增索引优化                 │   │
│  │  └─ RLS + 索引          │  │  └─ RLS 策略                     │   │
│  └─────────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 侧边栏布局

```
AppSidebar
├─ 品牌区域
├─ 主导航
│   ├─ 首页 (/home)
│   ├─ ⭐ 智能列表区域 (首页下方)
│   │   ├─ 预设列表 (6个，可编辑/删除)
│   │   │   ├─ 📅 最近一周
│   │   │   ├─ ⭐ 高价值收藏
│   │   │   ├─ 📖 待阅读
│   │   │   ├─ 🏆 优质经验
│   │   │   ├─ 👁️ 推荐关注
│   │   │   └─ 🔄 值得复读
│   │   ├─ 自定义列表 (用户创建)
│   │   └─ + 新建按钮
│   ├─ 搜索 (/search)
│   ├─ 收藏夹 (/folders)
│   └─ ...
├─ 系统文件夹
└─ 底部信息
```

---

## 七、阶段性实现计划

### Phase 0: 基础设施准备 (1.5 天)

**目标**: 完成数据库扩展和 API 基础能力

#### 任务 0.1: 扩展书签 API 支持时间范围筛选

- **文件**: `src/app/api/bookmarks/route.ts`
- **内容**:
  - 新增 `dateFrom`、`dateTo` 参数解析
  - SQL: `created_at >= :dateFrom AND created_at <= :dateTo`
- **验收条件**:
  - [ ] GET `/api/bookmarks?dateFrom=2025-12-01&dateTo=2025-12-13` 返回正确结果
  - [ ] 参数缺失时不影响现有查询
  - [ ] 现有功能回归测试通过

#### 任务 0.2: 扩展书签 API 支持阅读状态筛选

- **文件**: `src/app/api/bookmarks/route.ts`, `src/lib/validation/index.ts`
- **内容**:
  - 新增 `isRead` 参数解析
  - SQL: `is_read = :isRead`
- **验收条件**:
  - [ ] GET `/api/bookmarks?isRead=false` 返回未读书签
  - [ ] GET `/api/bookmarks?isRead=true` 返回已读书签
  - [ ] 现有功能回归测试通过

#### 任务 0.3: 扩展书签 API 支持星标和高价值筛选

- **文件**: `src/app/api/bookmarks/route.ts`
- **内容**:
  - 新增 `isStarred`、`isHighValue` 参数解析
  - SQL: `is_starred = :isStarred`, `rating = 5`
- **验收条件**:
  - [ ] GET `/api/bookmarks?isStarred=true` 返回星标书签
  - [ ] GET `/api/bookmarks?isHighValue=true` 返回 rating=5 的书签
  - [ ] 现有功能回归测试通过

#### 任务 0.4: 创建数据库索引

- **文件**: `supabase/migrations/20251213000001_add_smart_list_indexes.sql`
- **内容**:
  - 创建 is_read、is_starred、created_at 等索引
- **验收条件**:
  - [ ] 迁移执行成功
  - [ ] 查询性能提升

---

### Phase 1: 智能列表数据层 (2 天)

**目标**: 完成智能列表表和 CRUD API

#### 任务 1.1: 创建 smart_lists 数据库迁移

- **文件**: `supabase/migrations/20251213000002_create_smart_lists.sql`
- **验收条件**:
  - [ ] 迁移执行成功
  - [ ] RLS 策略生效
  - [ ] 软删除逻辑正常

#### 任务 1.2: 定义 TypeScript 类型

- **文件**: `src/types/smart-list.ts`
- **验收条件**:
  - [ ] SmartListFilters 完整定义
  - [ ] SmartList 接口完整
  - [ ] 导出到 `src/types/index.ts`

#### 任务 1.3: 创建验证 Schema

- **文件**: `src/lib/validation/smart-list.ts`
- **验收条件**:
  - [ ] 所有筛选条件验证正确
  - [ ] 边界条件处理

#### 任务 1.4: 实现智能列表 CRUD API

- **文件**: `src/app/api/smart-lists/**`
- **验收条件**:
  - [ ] POST/GET/PATCH/DELETE 全部可用
  - [ ] 认证保护生效

#### 任务 1.5: 实现筛选预览 API

- **文件**: `src/app/api/smart-lists/preview/route.ts`
- **验收条件**:
  - [ ] 返回匹配数量和预览数据

#### 任务 1.6: 实现 6 个预设模板初始化 API

- **文件**: `src/app/api/smart-lists/init-presets/route.ts`
- **验收条件**:
  - [ ] 首次调用创建 6 个预设
  - [ ] 幂等性：重复调用不重复创建

---

### Phase 2: 前端 Hook 和组件 (3 天)

**目标**: 完成核心前端组件

#### 任务 2.1: 实现 useSmartLists Hook

- **验收条件**:
  - [ ] CRUD 操作完整
  - [ ] 乐观更新

#### 任务 2.2: 实现 useSmartListFilters Hook

- **验收条件**:
  - [ ] 时间范围转换正确
  - [ ] 所有条件正确映射

#### 任务 2.3: 实现 SmartListNav 侧边栏组件

- **验收条件**:
  - [ ] 6 个预设正确显示
  - [ ] 自定义列表正确显示

#### 任务 2.4: 实现 SmartListItem 列表项组件

- **验收条件**:
  - [ ] 图标、颜色、数量显示
  - [ ] 菜单操作功能

#### 任务 2.5: 实现 SmartListDialog 对话框

- **验收条件**:
  - [ ] 3 步骤流程完整
  - [ ] 创建/编辑模式

#### 任务 2.6: 实现 SmartListFilterEditor 条件编辑器

- **验收条件**:
  - [ ] 6 个维度分组显示
  - [ ] 条件变更触发预览

---

### Phase 3: 侧边栏和首页集成 (2 天)

#### 任务 3.1: 集成 SmartListNav 到 AppSidebar

- **验收条件**:
  - [ ] 位于首页下方
  - [ ] 响应式适配

#### 任务 3.2: HomePageClient 支持 smartList 参数

- **验收条件**:
  - [ ] URL 参数正确解析
  - [ ] 筛选条件正确应用

#### 任务 3.3: 实现 SmartListQuickSave 快速保存

- **验收条件**:
  - [ ] 有筛选时显示按钮
  - [ ] 保存后刷新侧边栏

#### 任务 3.4: 智能列表激活状态 UI

- **验收条件**:
  - [ ] 顶部显示名称
  - [ ] 编辑/清除按钮

#### 任务 3.5: 首次访问预设初始化

- **验收条件**:
  - [ ] 新用户自动创建 6 个预设
  - [ ] 老用户不受影响

---

### Phase 4: 优化与完善 (1.5 天)

#### 任务 4.1: 拖拽排序

- **验收条件**: 排序持久化

#### 任务 4.2: 书签数量缓存

- **验收条件**: 数量准确

#### 任务 4.3: 移动端适配

- **验收条件**: 体验良好

#### 任务 4.4: 错误处理

- **验收条件**: 友好提示

---

## 八、测试计划

### 8.1 API 扩展回归测试（Phase 0 重点）

| 测试场景 | 测试用例                           | 预期结果       |
| -------- | ---------------------------------- | -------------- |
| 现有筛选 | 平台筛选、文件夹筛选、用途标签筛选 | 功能正常       |
| 新增筛选 | dateFrom/dateTo 参数               | 时间范围正确   |
| 新增筛选 | isRead 参数                        | 阅读状态正确   |
| 新增筛选 | isStarred 参数                     | 星标状态正确   |
| 新增筛选 | isHighValue 参数                   | 高价值筛选正确 |
| 组合筛选 | 多参数组合                         | AND 逻辑正确   |
| 边界情况 | 空结果、无效参数                   | 优雅处理       |

### 8.2 验收清单

#### Phase 0 验收

- [ ] 所有现有功能回归测试通过
- [ ] dateFrom/dateTo 筛选正常
- [ ] isRead 筛选正常
- [ ] isStarred 筛选正常
- [ ] isHighValue 筛选正常
- [ ] 索引创建成功

#### Phase 1 验收

- [ ] smart_lists 表创建成功
- [ ] 6 个预设模板初始化正常
- [ ] CRUD API 全部可用
- [ ] RLS 策略生效

#### Phase 2 验收

- [ ] 条件编辑器 6 个维度完整
- [ ] useSmartLists Hook 功能完整

#### Phase 3 验收

- [ ] 侧边栏 6 个预设显示
- [ ] 首页智能列表筛选生效

---

## 九、文件清单

### 新增文件 (22 个)

| 路径                                                            | 说明             |
| --------------------------------------------------------------- | ---------------- |
| `supabase/migrations/20251213000001_add_smart_list_indexes.sql` | 索引迁移         |
| `supabase/migrations/20251213000002_create_smart_lists.sql`     | 智能列表表       |
| `src/types/smart-list.ts`                                       | 完整类型定义     |
| `src/lib/validation/smart-list.ts`                              | 验证 Schema      |
| `src/lib/smart-list/presets.ts`                                 | 6 个预设模板     |
| `src/lib/smart-list/date-utils.ts`                              | 时间范围工具     |
| `src/lib/smart-list/filter-utils.ts`                            | 筛选条件转换     |
| `src/app/api/smart-lists/route.ts`                              | 列表 API         |
| `src/app/api/smart-lists/[id]/route.ts`                         | 单个 API         |
| `src/app/api/smart-lists/preview/route.ts`                      | 预览 API         |
| `src/app/api/smart-lists/reorder/route.ts`                      | 排序 API         |
| `src/app/api/smart-lists/init-presets/route.ts`                 | 初始化 API       |
| `src/hooks/use-smart-lists.ts`                                  | Hook             |
| `src/hooks/use-smart-list-filters.ts`                           | Hook             |
| `src/components/smart-list/index.ts`                            | 导出             |
| `src/components/smart-list/SmartListNav.tsx`                    | 侧边栏           |
| `src/components/smart-list/SmartListItem.tsx`                   | 列表项           |
| `src/components/smart-list/SmartListDialog.tsx`                 | 对话框           |
| `src/components/smart-list/SmartListFilterEditor.tsx`           | 条件编辑器       |
| `src/components/smart-list/SmartListPreview.tsx`                | 预览             |
| `src/components/smart-list/SmartListQuickSave.tsx`              | 快速保存         |
| `src/components/smart-list/filter-sections/*.tsx`               | 6 个筛选维度组件 |

### 修改文件 (5 个)

| 路径                                       | 修改内容            |
| ------------------------------------------ | ------------------- |
| `src/app/api/bookmarks/route.ts`           | 新增筛选参数支持    |
| `src/lib/validation/index.ts`              | 新增验证 Schema     |
| `src/components/layout/app-sidebar.tsx`    | 集成 SmartListNav   |
| `src/components/home/home-page-client.tsx` | 支持 smartList 参数 |
| `src/types/index.ts`                       | 导出新类型          |

---

## 十、时间估算汇总

| 阶段              | 任务数 | 预计时间  |
| ----------------- | ------ | --------- |
| Phase 0: 基础设施 | 4      | 1.5 天    |
| Phase 1: 数据层   | 6      | 2 天      |
| Phase 2: 前端组件 | 6      | 3 天      |
| Phase 3: 集成     | 5      | 2 天      |
| Phase 4: 优化     | 4      | 1.5 天    |
| **总计**          | **25** | **10 天** |

---

## 十一、Cubox vs AnyKeep 智能列表对比

| 功能点     | Cubox                       | AnyKeep              | 说明         |
| ---------- | --------------------------- | -------------------- | ------------ |
| 基础筛选   | ✅ 来源/时间/类型/标签/状态 | ✅ 完整支持          | 对标实现     |
| 用途标签   | ❌                          | ✅ 6 个预设 + 自定义 | AnyKeep 独家 |
| 星标筛选   | ✅                          | ✅                   | 相同         |
| 评级筛选   | ❌                          | ✅ 1-5 星            | AnyKeep 独家 |
| 分类置信度 | ❌                          | ✅ 高/中/低          | AnyKeep 独家 |
| 预设模板   | 未知                        | ✅ 6 个              | AnyKeep 特色 |
| 条件保存   | ✅                          | ✅                   | 相同         |
| 动态更新   | ✅                          | ✅                   | 相同         |

---

**文档结束**

请审核以上更新后的设计方案。
