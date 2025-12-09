# AnyKeep 消息系统设计与开发计划 V2

> **状态**: 待审核
> **创建日期**: 2025-12-08
> **更新日期**: 2025-12-08
> **版本**: V2.0

---

## 目录

1. [竞品分析与借鉴](#1-竞品分析与借鉴)
2. [系统概述](#2-系统概述)
3. [消息分级体系](#3-消息分级体系)
4. [架构设计](#4-架构设计)
5. [数据库设计](#5-数据库设计)
6. [API 设计](#6-api-设计)
7. [组件设计](#7-组件设计)
8. [解耦设计](#8-解耦设计)
9. [开发计划](#9-开发计划)

---

## 1. 竞品分析与借鉴

### 1.1 主要竞品对比

| 产品         | 消息入口     | 分级策略        | 展示形式      | 用户偏好         | 亮点           |
| ------------ | ------------ | --------------- | ------------- | ---------------- | -------------- |
| **Notion**   | 侧边栏 Inbox | 按页面/线程分组 | 列表+未读筛选 | 支持每页单独设置 | 按关联对象组织 |
| **Cubox**    | 文件夹通知   | 导入/同步提醒   | Toast + 邮件  | 可关闭邮件通知   | 简洁不打扰     |
| **Raindrop** | 无独立入口   | 仅操作反馈      | Toast         | 无               | 极简主义       |
| **Eagle**    | 状态栏提示   | 导入/同步状态   | Banner        | 可隐藏           | 专注工作流     |

### 1.2 通知形式优先级矩阵

参考 [Carbon Design System](https://carbondesignsystem.com/patterns/notification-pattern/) 和 [Clarity Design](https://clarity.design/documentation/notifications) 的最佳实践：

```
┌─────────────────────────────────────────────────────────────────┐
│                     通知形式优先级矩阵                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  紧迫程度 ↑                                                      │
│           │                                                     │
│  高       │  ┌─────────┐                                        │
│  (阻断)   │  │  Modal  │  关键警告、需要立即决策                   │
│           │  └─────────┘  如：配额用尽、数据丢失风险               │
│           │                                                     │
│  中高     │  ┌─────────┐                                        │
│  (持续)   │  │ Banner  │  重要但非阻断的持续提示                   │
│           │  └─────────┘  如：同步失败、版本更新                   │
│           │                                                     │
│  中       │  ┌─────────┐                                        │
│  (临时)   │  │  Toast  │  操作反馈、状态变更                       │
│           │  └─────────┘  如：保存成功、分类完成                   │
│           │                                                     │
│  低       │  ┌─────────┐                                        │
│  (静默)   │  │  Inbox  │  仅记录，用户主动查看                     │
│           │  └─────────┘  如：自动分类日志、统计报告               │
│           │                                                     │
│  ─────────┼────────────────────────────────────────────→       │
│           │  低                 中                 高            │
│                           信息重要性                             │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 借鉴要点

| 来源              | 借鉴功能                   | AnyKeep 实现                         |
| ----------------- | -------------------------- | ------------------------------------ |
| **Notion**        | 按日期分组、按关联对象组织 | 消息列表按日期分组（今天/昨天/更早） |
| **Notion**        | 未读/已读/归档筛选         | 支持三种状态筛选                     |
| **Notion**        | 单独设置页面通知偏好       | 预留用户通知偏好设置                 |
| **SaaS 最佳实践** | 优先级队列                 | 消息分 3 级，不同级别不同展示        |
| **Carbon Design** | 按紧迫程度选择通知形式     | Modal/Toast/Inbox 三层体系           |
| **Cubox**         | 少打扰原则                 | 日常消息仅记录，不弹窗               |

---

## 2. 系统概述

### 2.1 设计原则

1. **少打扰原则**：日常消息仅记录，用户主动查看
2. **重要突出原则**：关键信息弹窗提示，不可忽略
3. **视觉区分原则**：不同等级使用不同颜色
4. **用户可控原则**：预留通知偏好设置，支持 Web Push 开关

### 2.2 核心需求

| 需求项   | 描述                             | 优先级 |
| -------- | -------------------------------- | ------ |
| 消息记录 | 全面记录系统工作产生的消息       | P0     |
| 消息分级 | 日常/重要/紧急三级，不同展示方式 | P0     |
| 消息页面 | 左侧菜单新增消息入口             | P0     |
| 日期分组 | 按今天/昨天/本周/更早分组        | P0     |
| 颜色区分 | 不同等级使用不同颜色标识         | P0     |
| 自动清理 | 30 天后自动清理过期消息          | P1     |
| 通知偏好 | 预留 Web Push 接口，用户可配置   | P1     |

### 2.3 消息类型定义（全覆盖）

```typescript
type MessageType =
  // === 分类相关 ===
  | "classification_auto" // 自动分类完成（静默）
  | "classification_batch" // 批量分类完成（静默）
  | "classification_suggest" // 分类建议待确认（普通）
  | "classification_failed" // 分类失败（普通）

  // === 导入相关 ===
  | "import_complete" // 导入完成（普通）
  | "import_partial" // 部分导入成功（普通）
  | "import_failed" // 导入失败（重要）

  // === 批量操作 ===
  | "batch_move" // 批量移动完成（静默）
  | "batch_delete" // 批量删除完成（静默）
  | "batch_tag" // 批量打标签完成（静默）
  | "batch_restore" // 批量恢复完成（静默）

  // === 书签状态 ===
  | "bookmark_saved" // 书签保存成功（静默）
  | "bookmark_invalid" // 失效链接检测（普通）
  | "bookmark_expired" // 书签过期提醒（普通）

  // === 文件夹操作 ===
  | "folder_created" // 文件夹创建（静默）
  | "folder_merged" // 文件夹合并（普通）

  // === 系统消息 ===
  | "system_announcement" // 系统公告（重要）
  | "system_maintenance" // 系统维护通知（重要）
  | "system_update" // 版本更新（普通）

  // === 配额相关 ===
  | "quota_warning" // 配额预警 80%（重要）
  | "quota_critical" // 配额临界 95%（紧急）
  | "quota_exceeded" // 配额超限（紧急）

  // === 用户反馈 ===
  | "feedback_received" // 反馈已收到（静默）
  | "feedback_response" // 反馈回复（普通）

  // === AI 处理 ===
  | "ai_summary_complete" // AI 摘要生成完成（静默）
  | "ai_tags_complete" // AI 标签生成完成（静默）
  | "ai_processing_failed"; // AI 处理失败（普通）
```

---

## 3. 消息分级体系

### 3.1 三级分类

| 等级   | 名称             | 优先级值 | 展示方式            | 颜色      | 说明                     |
| ------ | ---------------- | -------- | ------------------- | --------- | ------------------------ |
| **L1** | 静默 (Silent)    | 1-3      | 仅记录到 Inbox      | 灰色      | 日常操作记录，不打扰用户 |
| **L2** | 普通 (Normal)    | 4-6      | Toast + 记录        | 蓝色      | 需要用户知晓，不强制操作 |
| **L3** | 重要 (Important) | 7-10     | Modal/Banner + 记录 | 橙色/红色 | 需要用户关注或操作       |

### 3.2 消息类型与等级映射

```typescript
// src/lib/messages/message-levels.ts

export enum MessageLevel {
  SILENT = "silent", // L1: 仅记录
  NORMAL = "normal", // L2: Toast + 记录
  IMPORTANT = "important", // L3: Modal/Banner + 记录
}

export const MESSAGE_LEVEL_CONFIG: Record<
  MessageLevel,
  {
    priorityRange: [number, number];
    showToast: boolean;
    showModal: boolean;
    color: string;
    bgColor: string;
    icon: string;
  }
> = {
  [MessageLevel.SILENT]: {
    priorityRange: [1, 3],
    showToast: false,
    showModal: false,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    icon: "Info",
  },
  [MessageLevel.NORMAL]: {
    priorityRange: [4, 6],
    showToast: true,
    showModal: false,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    icon: "Bell",
  },
  [MessageLevel.IMPORTANT]: {
    priorityRange: [7, 10],
    showToast: true,
    showModal: true,
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    icon: "AlertTriangle",
  },
};

// 消息类型到等级的映射
export const MESSAGE_TYPE_LEVELS: Record<MessageType, MessageLevel> = {
  // 静默级别 (L1)
  classification_auto: MessageLevel.SILENT,
  classification_batch: MessageLevel.SILENT,
  batch_move: MessageLevel.SILENT,
  batch_delete: MessageLevel.SILENT,
  batch_tag: MessageLevel.SILENT,
  batch_restore: MessageLevel.SILENT,
  bookmark_saved: MessageLevel.SILENT,
  folder_created: MessageLevel.SILENT,
  feedback_received: MessageLevel.SILENT,
  ai_summary_complete: MessageLevel.SILENT,
  ai_tags_complete: MessageLevel.SILENT,

  // 普通级别 (L2)
  classification_suggest: MessageLevel.NORMAL,
  classification_failed: MessageLevel.NORMAL,
  import_complete: MessageLevel.NORMAL,
  import_partial: MessageLevel.NORMAL,
  bookmark_invalid: MessageLevel.NORMAL,
  bookmark_expired: MessageLevel.NORMAL,
  folder_merged: MessageLevel.NORMAL,
  system_update: MessageLevel.NORMAL,
  feedback_response: MessageLevel.NORMAL,
  ai_processing_failed: MessageLevel.NORMAL,

  // 重要级别 (L3)
  import_failed: MessageLevel.IMPORTANT,
  system_announcement: MessageLevel.IMPORTANT,
  system_maintenance: MessageLevel.IMPORTANT,
  quota_warning: MessageLevel.IMPORTANT,
  quota_critical: MessageLevel.IMPORTANT,
  quota_exceeded: MessageLevel.IMPORTANT,
};
```

### 3.3 展示行为矩阵

```
消息产生时的行为：

┌────────────────┬─────────┬─────────┬─────────┬─────────┐
│    消息等级     │ 记录DB  │  Toast  │  Modal  │ 角标+1  │
├────────────────┼─────────┼─────────┼─────────┼─────────┤
│ L1 静默        │    ✓    │    ✗    │    ✗    │    ✓    │
│ L2 普通        │    ✓    │    ✓    │    ✗    │    ✓    │
│ L3 重要        │    ✓    │    ✓    │    ✓    │    ✓    │
└────────────────┴─────────┴─────────┴─────────┴─────────┘

注：
- L1 静默：完全不打扰，用户主动进入消息页面才能看到
- L2 普通：右下角 Toast 提示（3秒自动消失），不阻断用户操作
- L3 重要：弹窗提示，需要用户确认/关闭后才能继续
```

### 3.4 颜色视觉体系

```typescript
// 消息列表中的视觉区分

const MESSAGE_VISUAL_STYLES = {
  silent: {
    indicator: "bg-gray-300", // 左侧指示条
    icon: "text-gray-400", // 图标颜色
    title: "text-gray-600", // 标题颜色
    background: "bg-white", // 背景色（未读时）
    unreadBg: "bg-gray-50", // 背景色（未读时）
  },
  normal: {
    indicator: "bg-blue-500",
    icon: "text-blue-500",
    title: "text-gray-900",
    background: "bg-white",
    unreadBg: "bg-blue-50/50",
  },
  important: {
    indicator: "bg-orange-500",
    icon: "text-orange-500",
    title: "text-gray-900 font-medium",
    background: "bg-white",
    unreadBg: "bg-orange-50/50",
  },
  critical: {
    // 紧急消息（quota_critical, quota_exceeded）
    indicator: "bg-red-500",
    icon: "text-red-500",
    title: "text-red-700 font-semibold",
    background: "bg-red-50/30",
    unreadBg: "bg-red-50",
  },
};
```

---

## 4. 架构设计

### 4.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          消息系统架构 V2                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Classification│  │   Import    │  │   Bookmark   │  │   System   │  │
│  │    Module     │  │   Module    │  │    Module    │  │   Events   │  │
│  └──────┬───────┘  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘  │
│         │                 │                 │                │         │
│         └─────────────────┼─────────────────┼────────────────┘         │
│                           ▼                 ▼                          │
│         ┌─────────────────────────────────────────────────────┐        │
│         │              MessageService (解耦层)                 │        │
│         │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │        │
│         │  │ Templates   │  │  Levels     │  │ Dispatcher  │  │        │
│         │  │ (消息模板)   │  │ (等级判断)   │  │ (分发策略)   │  │        │
│         │  └─────────────┘  └─────────────┘  └─────────────┘  │        │
│         └─────────────────────────┬───────────────────────────┘        │
│                                   │                                    │
│                    ┌──────────────┼──────────────┐                     │
│                    ▼              ▼              ▼                     │
│         ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│         │   Database   │  │    Toast     │  │    Modal     │          │
│         │   (记录)      │  │   (普通)     │  │   (重要)     │          │
│         └──────────────┘  └──────────────┘  └──────────────┘          │
│                                   │                                    │
│                                   ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                         展示层                                    │  │
│  │  ┌────────────┐  ┌────────────────┐  ┌────────────────────┐     │  │
│  │  │ 菜单角标    │  │ 消息页面        │  │ 通知偏好设置        │     │  │
│  │  │ (未读数)   │  │ (按日期分组)    │  │ (Web Push 开关)    │     │  │
│  │  └────────────┘  └────────────────┘  └────────────────────┘     │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 技术选型

| 组件       | 技术方案            | 理由                 |
| ---------- | ------------------- | -------------------- |
| 数据存储   | Supabase PostgreSQL | 与现有架构一致       |
| 实时更新   | 轮询（首版）        | 简单可靠，复杂度低   |
| Toast 通知 | Sonner              | 已集成，支持多种类型 |
| Modal 弹窗 | Shadcn Dialog       | 已集成，设计一致     |
| 状态管理   | SWR + Context       | 全局未读数缓存       |
| Web Push   | 预留接口            | 未来扩展             |

### 4.3 轮询策略

```typescript
// 首版采用轮询，简单可靠
const POLLING_CONFIG = {
  // 未读数轮询
  unreadCount: {
    interval: 30_000, // 30秒
    enabled: true,
  },
  // 消息列表轮询（仅在消息页面激活时）
  messageList: {
    interval: 60_000, // 60秒
    enabled: false, // 需要页面激活
  },
};
```

---

## 5. 数据库设计

### 5.1 消息表 (messages)

```sql
-- ================================================
-- 消息表设计 V2
-- 支持消息分级、自动清理、日期分组
-- ================================================

CREATE TABLE IF NOT EXISTS public.messages (
  -- 主键
  id BIGSERIAL PRIMARY KEY,

  -- 用户关联
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 消息类型（扩展后的完整列表）
  type VARCHAR(30) NOT NULL CHECK (type IN (
    -- 分类相关
    'classification_auto', 'classification_batch',
    'classification_suggest', 'classification_failed',
    -- 导入相关
    'import_complete', 'import_partial', 'import_failed',
    -- 批量操作
    'batch_move', 'batch_delete', 'batch_tag', 'batch_restore',
    -- 书签状态
    'bookmark_saved', 'bookmark_invalid', 'bookmark_expired',
    -- 文件夹操作
    'folder_created', 'folder_merged',
    -- 系统消息
    'system_announcement', 'system_maintenance', 'system_update',
    -- 配额相关
    'quota_warning', 'quota_critical', 'quota_exceeded',
    -- 用户反馈
    'feedback_received', 'feedback_response',
    -- AI 处理
    'ai_summary_complete', 'ai_tags_complete', 'ai_processing_failed'
  )),

  -- 消息等级（用于快速筛选和视觉区分）
  level VARCHAR(20) NOT NULL DEFAULT 'silent' CHECK (level IN (
    'silent',     -- L1: 仅记录
    'normal',     -- L2: Toast + 记录
    'important'   -- L3: Modal + 记录
  )),

  -- 消息内容
  title VARCHAR(200) NOT NULL,
  content TEXT,

  -- 关联实体（可选，用于跳转）
  related_bookmark_id BIGINT REFERENCES public.bookmarks(id) ON DELETE SET NULL,
  related_folder_id BIGINT REFERENCES public.folders(id) ON DELETE SET NULL,
  related_import_id BIGINT REFERENCES public.import_history(id) ON DELETE SET NULL,

  -- 操作链接
  action_url VARCHAR(500),
  action_label VARCHAR(50),

  -- 扩展元数据
  metadata JSONB DEFAULT '{}'::jsonb,

  -- 消息状态
  status VARCHAR(20) NOT NULL DEFAULT 'unread' CHECK (status IN (
    'unread',
    'read',
    'archived'
  )),

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,

  -- 优先级（1-10，数值越大越重要）
  priority SMALLINT DEFAULT 1 CHECK (priority >= 1 AND priority <= 10),

  -- 过期时间（用于自动清理）
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

-- ================================================
-- 索引设计
-- ================================================

-- 用户 + 状态复合索引
CREATE INDEX IF NOT EXISTS idx_messages_user_status
  ON public.messages(user_id, status);

-- 用户 + 等级索引（快速筛选重要消息）
CREATE INDEX IF NOT EXISTS idx_messages_user_level
  ON public.messages(user_id, level);

-- 用户 + 创建时间索引（列表排序）
CREATE INDEX IF NOT EXISTS idx_messages_user_created
  ON public.messages(user_id, created_at DESC);

-- 过期时间索引（用于清理任务）
CREATE INDEX IF NOT EXISTS idx_messages_expires
  ON public.messages(expires_at)
  WHERE status != 'archived';

-- ================================================
-- RLS 策略
-- ================================================

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can create messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
  ON public.messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ================================================
-- 表注释
-- ================================================

COMMENT ON TABLE public.messages IS '用户消息通知表 V2';
COMMENT ON COLUMN public.messages.level IS '消息等级：silent/normal/important';
COMMENT ON COLUMN public.messages.priority IS '优先级：1-3静默，4-6普通，7-10重要';
COMMENT ON COLUMN public.messages.expires_at IS '过期时间，默认30天后';
```

### 5.2 数据库函数

```sql
-- ================================================
-- 获取未读消息数量（分等级统计）
-- ================================================

CREATE OR REPLACE FUNCTION public.get_unread_message_counts(p_user_id UUID)
RETURNS TABLE (
  total INTEGER,
  silent INTEGER,
  normal INTEGER,
  important INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::INTEGER as total,
    COUNT(*) FILTER (WHERE level = 'silent')::INTEGER as silent,
    COUNT(*) FILTER (WHERE level = 'normal')::INTEGER as normal,
    COUNT(*) FILTER (WHERE level = 'important')::INTEGER as important
  FROM public.messages
  WHERE user_id = p_user_id
    AND status = 'unread';
$$;

-- ================================================
-- 批量标记已读
-- ================================================

CREATE OR REPLACE FUNCTION public.mark_messages_read(
  p_user_id UUID,
  p_message_ids BIGINT[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  IF p_message_ids IS NULL THEN
    UPDATE public.messages
    SET status = 'read', read_at = NOW()
    WHERE user_id = p_user_id AND status = 'unread';
  ELSE
    UPDATE public.messages
    SET status = 'read', read_at = NOW()
    WHERE user_id = p_user_id
      AND id = ANY(p_message_ids)
      AND status = 'unread';
  END IF;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

-- ================================================
-- 清理过期消息（定时任务调用）
-- ================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.messages
  WHERE expires_at < NOW()
    AND status != 'archived';  -- 已归档的消息不自动删除

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- ================================================
-- 获取消息列表（按日期分组）
-- ================================================

CREATE OR REPLACE FUNCTION public.get_messages_grouped(
  p_user_id UUID,
  p_status VARCHAR DEFAULT NULL,
  p_level VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  type VARCHAR,
  level VARCHAR,
  title VARCHAR,
  content TEXT,
  action_url VARCHAR,
  action_label VARCHAR,
  status VARCHAR,
  priority SMALLINT,
  created_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  metadata JSONB,
  related_bookmark_id BIGINT,
  related_folder_id BIGINT,
  date_group VARCHAR  -- 'today' | 'yesterday' | 'this_week' | 'earlier'
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    m.id,
    m.type,
    m.level,
    m.title,
    m.content,
    m.action_url,
    m.action_label,
    m.status,
    m.priority,
    m.created_at,
    m.read_at,
    m.metadata,
    m.related_bookmark_id,
    m.related_folder_id,
    CASE
      WHEN m.created_at::date = CURRENT_DATE THEN 'today'
      WHEN m.created_at::date = CURRENT_DATE - 1 THEN 'yesterday'
      WHEN m.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 'this_week'
      ELSE 'earlier'
    END as date_group
  FROM public.messages m
  WHERE m.user_id = p_user_id
    AND (p_status IS NULL OR m.status = p_status)
    AND (p_level IS NULL OR m.level = p_level)
  ORDER BY m.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- 授权
GRANT EXECUTE ON FUNCTION public.get_unread_message_counts TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_read TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_messages_grouped TO authenticated;
```

### 5.3 用户通知偏好表（预留）

```sql
-- ================================================
-- 用户通知偏好（预留，未来扩展）
-- ================================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- 各等级是否启用 Toast
  silent_toast BOOLEAN DEFAULT false,
  normal_toast BOOLEAN DEFAULT true,
  important_toast BOOLEAN DEFAULT true,

  -- 是否启用 Web Push
  web_push_enabled BOOLEAN DEFAULT false,
  web_push_subscription JSONB,  -- 存储 PushSubscription

  -- 勿扰模式
  do_not_disturb BOOLEAN DEFAULT false,
  dnd_start_time TIME,  -- 勿扰开始时间
  dnd_end_time TIME,    -- 勿扰结束时间

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON public.notification_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## 6. API 设计

### 6.1 API 端点清单

| 方法   | 路径                          | 描述                             | 权限     |
| ------ | ----------------------------- | -------------------------------- | -------- |
| GET    | `/api/messages`               | 获取消息列表（分页、筛选、分组） | 认证用户 |
| GET    | `/api/messages/unread-count`  | 获取未读消息数量（分等级）       | 认证用户 |
| PATCH  | `/api/messages/:id`           | 更新消息状态                     | 认证用户 |
| POST   | `/api/messages/batch-read`    | 批量标记已读                     | 认证用户 |
| DELETE | `/api/messages/:id`           | 删除消息                         | 认证用户 |
| POST   | `/api/messages`               | 创建消息（服务端）               | 服务端   |
| GET    | `/api/settings/notifications` | 获取通知偏好                     | 认证用户 |
| PATCH  | `/api/settings/notifications` | 更新通知偏好                     | 认证用户 |

### 6.2 API 详细设计

#### GET /api/messages

```typescript
interface GetMessagesQuery {
  status?: "unread" | "read" | "archived" | "all";
  level?: "silent" | "normal" | "important";
  page?: number;
  limit?: number;
}

interface GetMessagesResponse {
  success: true;
  data: {
    // 按日期分组的消息
    groups: {
      date_group: "today" | "yesterday" | "this_week" | "earlier";
      messages: Message[];
    }[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
}
```

#### GET /api/messages/unread-count

```typescript
interface UnreadCountResponse {
  success: true;
  data: {
    total: number;
    silent: number;
    normal: number;
    important: number;
  };
}
```

---

## 7. 页面设计详情

### 7.1 整体布局

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────┐                                                                │
│  │ AnyKeep │  ┌──────────────────────────────────────────────────────────┐  │
│  ├─────────┤  │                                                          │  │
│  │ 🏠 首页  │  │  消息                                    [全部已读] [筛选▾] │  │
│  │ 🔍 搜索  │  ├──────────────────────────────────────────────────────────┤  │
│  │ 📁 收藏夹 │  │                                                          │  │
│  │ 📊 数据  │  │  今天                                                     │  │
│  │ 🔔 消息 ⑤│  │  ├────────────────────────────────────────────────────┤  │
│  │ ⚙️ 设置  │  │  │ 🟠│ ⚠️ 存储空间即将用尽 (85%)              [升级] ▾ │  │
│  │         │  │  │   │    建议清理或升级套餐            重要   3分钟前   │  │
│  │─────────│  │  ├────────────────────────────────────────────────────┤  │
│  │ 系统文件夹│  │  │ 🔵│ 🔔 成功导入 156 条书签                  [查看] ▾ │  │
│  │ ⭐ 高价值 │  │  │   │    已保存到「浏览器书签」              1小时前   │  │
│  │ ⚠️ 已失效 │  │  ├────────────────────────────────────────────────────┤  │
│  │ 🗑️ 垃圾箱 │  │  │ ⚪│ ✅ 已自动分类到「技术」                          │  │
│  │         │  │  │   │    置信度 92%                          2小时前   │  │
│  └─────────┘  │  │                                                          │  │
│               │  │  昨天                                                     │  │
│               │  │  ├────────────────────────────────────────────────────┤  │
│               │  │  │ 🔵│ 💡 建议分类到「设计」               [确认分类] ▾ │  │
│               │  │  │   │    置信度 72%，请确认是否正确          昨天 14:30 │  │
│               │  │  ├────────────────────────────────────────────────────┤  │
│               │  │  │ ⚪│ 📦 已移动 12 条书签                              │  │
│               │  │  │   │    移动到「待读」                      昨天 10:15 │  │
│               │  │  │                                                      │  │
│               │  │  本周                                                     │  │
│               │  │  ├────────────────────────────────────────────────────┤  │
│               │  │  │ ⚪│ 🏷️ AI 标签生成完成                               │  │
│               │  │  │   │                                       周一 09:30 │  │
│               │  │  │                                                      │  │
│               │  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 页面头部设计

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  消息                                              [全部已读]  [筛选 ▾]   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                                          │         │
                                                          │         └─ 筛选下拉
                                                          │            ┌─────────────┐
                                                          │            │ 状态         │
                                                    一键标记           │  ○ 全部      │
                                                    所有已读           │  ● 未读      │
                                                                       │  ○ 已读      │
                                                                       │  ○ 已归档    │
                                                                       ├─────────────┤
                                                                       │ 等级         │
                                                                       │  ○ 全部      │
                                                                       │  ○ 重要      │
                                                                       │  ○ 普通      │
                                                                       │  ○ 静默      │
                                                                       └─────────────┘
```

### 7.3 单条消息设计（按等级区分）

#### L3 重要消息（橙色/红色）

```
┌──────────────────────────────────────────────────────────────────────────┐
│🟠│                                                                       │
│  │  ⚠️  存储空间即将用尽 (85%)                    [重要]      [升级]  ⋮  │
│  │      建议清理或升级套餐                                               │
│  │                                                          3分钟前     │
└──────────────────────────────────────────────────────────────────────────┘
  ↑                    ↑                              ↑         ↑      ↑
左侧指示条          消息标题                        等级标签   操作按钮  更多
(橙色4px)           (加粗)                          (橙色边框)
```

**样式**：左侧橙色指示条 | 背景 `bg-orange-50/50` | 图标 `text-orange-500` | 显示「重要」标签

#### L2 普通消息（蓝色）

```
┌──────────────────────────────────────────────────────────────────────────┐
│🔵│                                                                       │
│  │  🔔  成功导入 156 条书签                        ●           [查看]  ⋮  │
│  │      已保存到「浏览器书签」                                           │
│  │                                                          1小时前     │
└──────────────────────────────────────────────────────────────────────────┘
  ↑                    ↑                             ↑           ↑
左侧指示条          消息标题                     未读圆点     操作按钮
(蓝色4px)           (加粗-未读)                   (蓝色)
```

**样式**：左侧蓝色指示条 | 背景 `bg-blue-50/50` | 图标 `text-blue-500` | 未读时显示蓝色圆点

#### L1 静默消息（灰色）

```
┌──────────────────────────────────────────────────────────────────────────┐
│⚪│                                                                       │
│  │  ✅  已自动分类到「技术」                                          ⋮  │
│  │      置信度 92%                                                       │
│  │                                                          2小时前     │
└──────────────────────────────────────────────────────────────────────────┘
```

**样式**：左侧灰色指示条 | 背景白色 | 图标 `text-gray-400` | 无操作按钮

### 7.4 消息操作菜单

```
点击 ⋮ 展开：

┌─────────────┐
│ ✓ 标记已读  │  ← 仅未读消息显示
├─────────────┤
│ 📁 归档     │
├─────────────┤
│ 🗑️ 删除     │  ← 红色文字
└─────────────┘
```

### 7.5 重要消息弹窗（Modal）

L3 级别消息产生时自动弹出：

```
┌─────────────────────────────────────────────────────────────────┐
│                                                           [×]   │
│   ┌────┐                                                        │
│   │ ⚠️ │  存储空间即将用尽 (85%)                                 │
│   └────┘                                                        │
│                                                                 │
│   您的存储空间已使用 85%，建议清理不需要的内容                      │
│   或升级到 Pro 套餐获取更多空间。                                  │
│                                                                 │
│                              [稍后处理]    [立即升级]             │
└─────────────────────────────────────────────────────────────────┘
```

- 配额预警：橙色图标背景
- 配额超限/导入失败：红色图标背景
- 系统公告：蓝色图标背景

### 7.6 空状态设计

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                              ┌──────┐                                    │
│                              │  📭  │                                    │
│                              └──────┘                                    │
│                                                                          │
│                          暂无消息                                         │
│                    系统通知和操作记录将显示在这里                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 7.7 侧边栏角标

```
┌─────────────┐
│ 🔔 消息  ⑤  │  ← 红色角标，显示未读总数
└─────────────┘

规则：
- 未读数 > 0 时显示角标
- 未读数 > 99 时显示「99+」
- 包含 L3 重要消息时，角标可加动画效果
```

### 7.8 移动端适配

```
┌───────────────────────────┐
│  ← 消息            [筛选] │
├───────────────────────────┤
│  今天                     │
│  ┌───────────────────────┐│
│  │🟠│ ⚠️ 存储空间即将用尽 ││
│  │  │   建议清理...    ▾ ││
│  │  │           3分钟前  ││
│  └───────────────────────┘│
│  ┌───────────────────────┐│
│  │🔵│ 🔔 成功导入 156 条 ││
│  │  │   已保存到...    ▾ ││
│  │  │           1小时前  ││
│  └───────────────────────┘│
│  昨天                     │
│  ┌───────────────────────┐│
│  │...                    ││
│  └───────────────────────┘│
├───────────────────────────┤
│ 🏠   🔍   📁   🔔⑤   ⚙️ │
└───────────────────────────┘
```

- 左滑消息：快捷标记已读/归档
- 长按消息：显示操作菜单
- 下拉刷新：重新加载消息列表

### 7.9 设计要点总结

| 设计元素     | 实现方式                                                  |
| ------------ | --------------------------------------------------------- |
| **日期分组** | sticky 标题 + 毛玻璃背景 `bg-background/95 backdrop-blur` |
| **等级区分** | 左侧 4px 指示条 + 图标颜色 + 背景色                       |
| **未读标识** | 加粗标题 + 蓝色圆点                                       |
| **重要标签** | 橙色边框 Badge                                            |
| **操作按钮** | 右侧 action 按钮 + DropdownMenu                           |
| **重要弹窗** | Dialog 组件，阻断式提示                                   |
| **角标**     | 红色圆形 Badge（侧边栏/底部导航）                         |

---

## 8. 组件设计

### 8.1 组件结构

```
src/components/messages/
├── message-list.tsx              # 消息列表（按日期分组）
├── message-item.tsx              # 单条消息项（颜色区分）
├── message-group-header.tsx      # 日期分组标题
├── message-filter.tsx            # 筛选器（状态、等级）
├── message-empty-state.tsx       # 空状态
├── message-badge.tsx             # 未读角标
├── message-modal.tsx             # 重要消息弹窗
└── notification-settings.tsx     # 通知偏好设置

src/app/(main)/messages/
└── page.tsx                      # 消息页面
```

### 7.2 消息列表布局（按日期分组）

```typescript
// src/components/messages/message-list.tsx

export function MessageList({ groups }: { groups: MessageGroup[] }) {
  return (
    <div className="divide-y">
      {groups.map((group) => (
        <div key={group.date_group}>
          {/* 日期分组标题 */}
          <MessageGroupHeader dateGroup={group.date_group} />

          {/* 该分组下的消息 */}
          <div className="divide-y divide-border/50">
            {group.messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                onRead={handleRead}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// 日期分组标题
function MessageGroupHeader({ dateGroup }: { dateGroup: string }) {
  const labels = {
    today: '今天',
    yesterday: '昨天',
    this_week: '本周',
    earlier: '更早',
  };

  return (
    <div className="sticky top-0 bg-background/95 backdrop-blur px-4 py-2 border-b">
      <span className="text-sm font-medium text-muted-foreground">
        {labels[dateGroup] || dateGroup}
      </span>
    </div>
  );
}
```

### 7.3 消息项组件（颜色区分）

```typescript
// src/components/messages/message-item.tsx

interface MessageItemProps {
  message: Message;
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
}

export function MessageItem({ message, onRead, onDelete }: MessageItemProps) {
  const isUnread = message.status === 'unread';
  const levelConfig = MESSAGE_LEVEL_CONFIG[message.level];

  // 根据等级获取样式
  const styles = MESSAGE_VISUAL_STYLES[message.level];

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 transition-colors relative",
        isUnread ? styles.unreadBg : styles.background
      )}
    >
      {/* 左侧等级指示条 */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", styles.indicator)} />

      {/* 消息图标 */}
      <div className={cn("flex-shrink-0 mt-0.5", styles.icon)}>
        <MessageTypeIcon type={message.type} level={message.level} />
      </div>

      {/* 消息内容 */}
      <div className="flex-1 min-w-0 pl-2">
        <div className="flex items-center gap-2">
          <h4 className={cn(
            "text-sm truncate",
            styles.title,
            isUnread && "font-semibold"
          )}>
            {message.title}
          </h4>
          {isUnread && (
            <span className={cn("size-2 rounded-full", styles.indicator)} />
          )}
          {message.level === 'important' && (
            <Badge variant="outline" className="text-orange-600 border-orange-300">
              重要
            </Badge>
          )}
        </div>

        {message.content && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {message.content}
          </p>
        )}

        <p className="text-xs text-muted-foreground mt-2">
          {formatRelativeTime(message.created_at)}
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1">
        {message.action_url && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(message.action_url!)}
          >
            {message.action_label || '查看'}
          </Button>
        )}
        <MessageActions
          message={message}
          onRead={onRead}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
```

### 7.4 重要消息弹窗

```typescript
// src/components/messages/message-modal.tsx

interface MessageModalProps {
  message: Message | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction?: () => void;
}

export function MessageModal({ message, open, onOpenChange, onAction }: MessageModalProps) {
  if (!message) return null;

  const isWarning = message.type.includes('warning') || message.type.includes('critical');
  const isDanger = message.type.includes('exceeded') || message.type.includes('failed');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full",
              isDanger ? "bg-red-100" : isWarning ? "bg-orange-100" : "bg-blue-100"
            )}>
              <AlertTriangle className={cn(
                "size-5",
                isDanger ? "text-red-600" : isWarning ? "text-orange-600" : "text-blue-600"
              )} />
            </div>
            <DialogTitle>{message.title}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="py-4">
          <p className="text-muted-foreground">{message.content}</p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            稍后处理
          </Button>
          {message.action_url && (
            <Button onClick={onAction}>
              {message.action_label || '立即处理'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 7.5 通知偏好设置（预留）

```typescript
// src/components/messages/notification-settings.tsx

export function NotificationSettings() {
  const { preferences, updatePreferences } = useNotificationPreferences();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">通知设置</h3>
        <p className="text-sm text-muted-foreground">
          管理消息通知的展示方式
        </p>
      </div>

      <Separator />

      {/* Toast 通知开关 */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">弹窗通知</h4>

        <div className="flex items-center justify-between">
          <div>
            <Label>普通消息</Label>
            <p className="text-xs text-muted-foreground">
              导入完成、分类建议等
            </p>
          </div>
          <Switch
            checked={preferences.normal_toast}
            onCheckedChange={(checked) =>
              updatePreferences({ normal_toast: checked })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>重要消息</Label>
            <p className="text-xs text-muted-foreground">
              配额预警、系统公告等
            </p>
          </div>
          <Switch
            checked={preferences.important_toast}
            onCheckedChange={(checked) =>
              updatePreferences({ important_toast: checked })
            }
          />
        </div>
      </div>

      <Separator />

      {/* Web Push（预留） */}
      <div className="space-y-4 opacity-50">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">浏览器推送</h4>
            <p className="text-xs text-muted-foreground">
              即使不在页面也能收到通知（即将推出）
            </p>
          </div>
          <Switch disabled />
        </div>
      </div>
    </div>
  );
}
```

---

## 8. 解耦设计

### 8.1 MessageService 完整设计

```typescript
// src/lib/messages/message-service.ts

import { createClient } from "@/lib/supabase/server";
import { MESSAGE_TEMPLATES } from "./message-templates";
import { MESSAGE_TYPE_LEVELS, MessageLevel } from "./message-levels";
import { toast } from "sonner";

export interface CreateMessageParams {
  userId: string;
  type: MessageType;
  data: Record<string, unknown>;
  relatedBookmarkId?: number;
  relatedFolderId?: number;
  relatedImportId?: number;
}

export interface MessageResult {
  success: boolean;
  messageId?: number;
  level: MessageLevel;
  shouldShowToast: boolean;
  shouldShowModal: boolean;
}

export class MessageService {
  /**
   * 创建消息并根据等级决定展示方式
   */
  static async create(params: CreateMessageParams): Promise<MessageResult> {
    const { userId, type, data } = params;

    // 1. 获取模板
    const template = MESSAGE_TEMPLATES[type];
    if (!template) {
      console.error(`Unknown message type: ${type}`);
      return {
        success: false,
        level: MessageLevel.SILENT,
        shouldShowToast: false,
        shouldShowModal: false,
      };
    }

    // 2. 获取等级配置
    const level = MESSAGE_TYPE_LEVELS[type];
    const levelConfig = MESSAGE_LEVEL_CONFIG[level];

    // 3. 渲染消息内容
    const title = template.title(data);
    const content = template.content?.(data);
    const actionUrl = template.actionUrl?.(data);
    const actionLabel = template.actionLabel;

    // 4. 写入数据库
    const supabase = await createClient();
    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        user_id: userId,
        type,
        level,
        title,
        content,
        action_url: actionUrl,
        action_label: actionLabel,
        related_bookmark_id: params.relatedBookmarkId,
        related_folder_id: params.relatedFolderId,
        related_import_id: params.relatedImportId,
        metadata: data,
        priority: template.defaultPriority ?? levelConfig.priorityRange[0],
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create message:", error);
      return {
        success: false,
        level,
        shouldShowToast: false,
        shouldShowModal: false,
      };
    }

    return {
      success: true,
      messageId: message.id,
      level,
      shouldShowToast: levelConfig.showToast,
      shouldShowModal: levelConfig.showModal,
    };
  }

  /**
   * 创建消息并触发前端展示
   * （用于服务端调用，返回展示指令）
   */
  static async notify(params: CreateMessageParams): Promise<MessageResult> {
    const result = await this.create(params);

    // 返回展示指令，由前端决定是否展示 Toast/Modal
    return result;
  }

  // ========== 快捷方法 ==========

  /**
   * 分类完成通知
   */
  static async notifyClassificationComplete(
    userId: string,
    bookmarkId: number,
    folderName: string,
    confidence: number,
    isAuto: boolean,
  ) {
    return this.create({
      userId,
      type: isAuto ? "classification_auto" : "classification_suggest",
      data: { folderName, confidence, bookmarkId },
      relatedBookmarkId: bookmarkId,
    });
  }

  /**
   * 批量分类完成通知
   */
  static async notifyBatchClassification(
    userId: string,
    totalCount: number,
    successCount: number,
  ) {
    return this.create({
      userId,
      type: "classification_batch",
      data: { totalCount, successCount },
    });
  }

  /**
   * 导入完成通知
   */
  static async notifyImportComplete(
    userId: string,
    importId: number,
    totalCount: number,
    successCount: number,
    failedCount: number,
  ) {
    const type =
      failedCount === totalCount
        ? "import_failed"
        : failedCount > 0
          ? "import_partial"
          : "import_complete";

    return this.create({
      userId,
      type,
      data: { totalCount, successCount, failedCount },
      relatedImportId: importId,
    });
  }

  /**
   * 配额预警通知
   */
  static async notifyQuotaWarning(userId: string, usagePercent: number) {
    const type =
      usagePercent >= 100
        ? "quota_exceeded"
        : usagePercent >= 95
          ? "quota_critical"
          : "quota_warning";

    return this.create({
      userId,
      type,
      data: { usagePercent },
    });
  }

  /**
   * 系统公告
   */
  static async notifySystemAnnouncement(
    userId: string,
    title: string,
    content: string,
    actionUrl?: string,
  ) {
    return this.create({
      userId,
      type: "system_announcement",
      data: { title, content, url: actionUrl },
    });
  }
}
```

### 8.2 前端消息分发器

```typescript
// src/lib/messages/message-dispatcher.ts
// 前端使用，根据消息等级决定展示方式

import { toast } from "sonner";
import { MESSAGE_LEVEL_CONFIG, MessageLevel } from "./message-levels";

export class MessageDispatcher {
  private static modalQueue: Message[] = [];
  private static showModalCallback: ((message: Message) => void) | null = null;

  /**
   * 注册 Modal 展示回调
   */
  static registerModalHandler(callback: (message: Message) => void) {
    this.showModalCallback = callback;
  }

  /**
   * 分发消息展示
   */
  static dispatch(message: {
    title: string;
    content?: string;
    level: MessageLevel;
    actionUrl?: string;
    actionLabel?: string;
  }) {
    const config = MESSAGE_LEVEL_CONFIG[message.level];

    // Toast 展示
    if (config.showToast) {
      const toastType =
        message.level === MessageLevel.IMPORTANT ? "warning" : "info";

      toast[toastType](message.title, {
        description: message.content,
        action: message.actionUrl
          ? {
              label: message.actionLabel || "查看",
              onClick: () => (window.location.href = message.actionUrl!),
            }
          : undefined,
        duration: message.level === MessageLevel.IMPORTANT ? 8000 : 4000,
      });
    }

    // Modal 展示
    if (config.showModal && this.showModalCallback) {
      this.showModalCallback(message as Message);
    }
  }
}
```

---

## 9. 开发计划

### 9.1 阶段概览

| 阶段    | 名称     | 预估时间 | 核心交付                       |
| ------- | -------- | -------- | ------------------------------ |
| Stage 1 | 数据层   | 1 天     | 数据库表、函数、RLS            |
| Stage 2 | 服务层   | 1.5 天   | MessageService、分级系统、模板 |
| Stage 3 | API 层   | 1 天     | 消息 API + 通知偏好 API        |
| Stage 4 | 展示层   | 2 天     | 消息页面、日期分组、颜色区分   |
| Stage 5 | 集成测试 | 0.5 天   | 端到端验证、性能测试           |

**总计**: 6 天

---

### Stage 1: 数据层实现

**目标**: 创建消息表和数据库函数

**任务清单**:

- [ ] 创建迁移文件 `20251208000001_create_messages_table.sql`
- [ ] 创建 messages 表（含 level、expires_at 字段）
- [ ] 创建 notification_preferences 表（预留）
- [ ] 添加索引（user_status、user_level、expires）
- [ ] 配置 RLS 策略
- [ ] 创建数据库函数
  - [ ] `get_unread_message_counts`
  - [ ] `mark_messages_read`
  - [ ] `cleanup_expired_messages`
  - [ ] `get_messages_grouped`

**成功标准**:

- 迁移成功执行
- RLS 策略验证通过
- 所有函数可正常调用

**Status**: Not Started

---

### Stage 2: 服务层实现

**目标**: 实现解耦的消息服务和分级系统

**任务清单**:

- [ ] 创建 `src/lib/messages/` 目录结构
- [ ] 实现类型定义 `types.ts`（27 种消息类型）
- [ ] 实现分级系统 `message-levels.ts`
- [ ] 实现消息模板 `message-templates.ts`
- [ ] 实现 MessageService `message-service.ts`
- [ ] 实现前端分发器 `message-dispatcher.ts`
- [ ] 添加消息相关常量

**成功标准**:

- MessageService.create() 正确创建消息
- 分级判断逻辑正确
- 模板渲染正确

**Status**: Not Started

---

### Stage 3: API 层实现

**目标**: 实现消息相关 API

**任务清单**:

- [ ] `GET /api/messages`（支持分组返回）
- [ ] `GET /api/messages/unread-count`（分等级统计）
- [ ] `PATCH /api/messages/:id`
- [ ] `POST /api/messages/batch-read`
- [ ] `DELETE /api/messages/:id`
- [ ] `GET /api/settings/notifications`（预留）
- [ ] `PATCH /api/settings/notifications`（预留）

**成功标准**:

- 所有 API 返回正确响应
- 日期分组逻辑正确

**Status**: Not Started

---

### Stage 4: 展示层实现

**目标**: 实现消息页面和组件

**任务清单**:

- [ ] 创建 `src/components/messages/` 组件
- [ ] 实现 MessageItem（颜色区分）
- [ ] 实现 MessageList（按日期分组）
- [ ] 实现 MessageGroupHeader
- [ ] 实现 MessageFilter
- [ ] 实现 MessageEmptyState
- [ ] 实现 MessageModal（重要消息弹窗）
- [ ] 实现 NotificationSettings（预留）
- [ ] 创建 `src/app/(main)/messages/page.tsx`
- [ ] 创建 `useMessages` Hook
- [ ] 创建 `useUnreadCount` Hook（分等级）
- [ ] 修改 `app-sidebar.tsx` 添加菜单项和角标
- [ ] 集成 MessageDispatcher 到全局

**成功标准**:

- 消息按日期分组显示
- 颜色区分清晰
- 重要消息弹窗正常
- 未读角标实时更新

**Status**: Not Started

---

### Stage 5: 集成与测试

**目标**: 完成集成和验收测试

**任务清单**:

- [ ] 在分类模块集成 MessageService
- [ ] 在导入模块集成 MessageService
- [ ] 在批量操作集成 MessageService
- [ ] 端到端测试各场景
- [ ] 验证 30 天自动清理逻辑
- [ ] 性能测试

**成功标准**:

- 所有集成点正常
- 消息分级展示正确
- 无控制台错误

**Status**: Not Started

---

## 10. 文件变更清单

### 10.1 新增文件

```
supabase/migrations/
└── 20251208000001_create_messages_table.sql

src/lib/messages/
├── types.ts
├── message-levels.ts
├── message-templates.ts
├── message-service.ts
├── message-dispatcher.ts
└── index.ts

src/app/api/messages/
├── route.ts
├── unread-count/route.ts
├── batch-read/route.ts
└── [id]/route.ts

src/app/api/settings/notifications/
└── route.ts

src/components/messages/
├── message-item.tsx
├── message-list.tsx
├── message-group-header.tsx
├── message-filter.tsx
├── message-empty-state.tsx
├── message-badge.tsx
├── message-modal.tsx
└── notification-settings.tsx

src/hooks/
├── use-messages.ts
└── use-unread-count.ts

src/app/(main)/messages/
└── page.tsx
```

### 10.2 修改文件

```
src/components/layout/app-sidebar.tsx     # 添加消息菜单项 + 角标
src/contexts/navigation-context.tsx       # 添加 messages PageId
src/lib/constants/messages.ts             # 添加消息相关文案
src/types/supabase.ts                     # 添加类型定义
src/components/providers/root-providers.tsx  # 集成 MessageDispatcher
```

---

## 11. 风险与缓解

| 风险         | 影响       | 缓解措施                               |
| ------------ | ---------- | -------------------------------------- |
| 消息量过大   | 性能下降   | 分页加载、30天自动清理                 |
| 轮询频繁     | 服务器压力 | 合理间隔（30s）、页面失焦暂停          |
| 弹窗过多     | 用户打扰   | 仅 L3 重要消息弹窗，可设置偏好         |
| 颜色区分不够 | 视觉混淆   | 左侧指示条 + 图标颜色 + 背景色三重区分 |

---

## 12. 竞品参考来源

- [Notion Inbox & Notifications](https://www.notion.com/help/updates-and-notifications)
- [Carbon Design Notification Pattern](https://carbondesignsystem.com/patterns/notification-pattern/)
- [Clarity Design Notifications](https://clarity.design/documentation/notifications)
- [Toptal Notification Design Guide](https://www.toptal.com/designers/ux/notification-design)
- [Userpilot Notification Types](https://userpilot.com/blog/notification-types/)
- [SuprSend In-App Notifications Guide](https://www.suprsend.com/post/ultimate-guide-to-saas-in-app-notifications-and-in-app-inboxes---with-implementation-codes)

---

**请审核以上设计和开发计划 V2，确认无误后我将开始实施。**
