# AI 助手附件感知优化方案 v2.0

> **版本**: v2.0.0
> **创建日期**: 2026-01-08
> **更新日期**: 2026-01-08
> **状态**: 待审核

---

## 一、问题诊断

### 1.1 用户反馈

用户在 AI 助手中选择附件（收藏书签）后，AI 无法感知被选择的附件内容，导致 AI 的能力无法针对附件使用。

### 1.2 现有架构分析

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          当前数据流                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. 用户选择附件                                                         │
│     └─ useAttachmentManager.toggleBookmark()                            │
│        └─ 创建 AttachmentItem { id, type, title, url, content }         │
│                                                                          │
│  2. 构建附件上下文                                                       │
│     └─ buildAttachmentContext(attachments)                              │
│        └─ content = bookmark.ai_summary || bookmark.description         │
│        └─ ⚠️ 如果两者都为空，content 为 undefined                        │
│                                                                          │
│  3. 发送到 API                                                           │
│     └─ POST /api/agent/unified { attachmentContext: string }            │
│                                                                          │
│  4. 注入到 AI Prompt                                                     │
│     └─ ExecutionCoordinator.buildAgentContext()                         │
│        └─ systemPrompt = context.attachmentContext                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 问题根因

| 问题                  | 影响                                                             | 严重程度 |
| --------------------- | ---------------------------------------------------------------- | -------- |
| **书签内容缺失**      | 书签没有 `ai_summary` 或 `description` 时，AI 只能看到标题和 URL | 🔴 高    |
| **无实时内容抓取**    | 选择附件时不抓取 URL 内容，AI 无法了解书签实际内容               | 🔴 高    |
| **附件 ID 未传递**    | AI 无法通过 Tool 查询附件书签的详细信息                          | 🟡 中    |
| **用户无反馈**        | 用户不知道附件内容是否被 AI 识别                                 | 🟡 中    |
| **多轮对话附件丢失**  | 后续对话无法引用之前的附件                                       | 🟡 中    |
| **Skills 无附件感知** | 编排模式下 Skills 无法获取附件信息                               | 🟡 中    |

---

## 二、全局架构设计

### 2.1 设计原则

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     AI 助手附件系统设计原则                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. 即时可用 (Instant Ready)                                             │
│     └─ 用户选择附件后，内容立即准备就绪，无需等待                          │
│                                                                          │
│  2. 透明反馈 (Transparent Feedback)                                      │
│     └─ 用户始终知道附件状态：加载中/就绪/错误/已使用                       │
│                                                                          │
│  3. 深度集成 (Deep Integration)                                          │
│     └─ 附件信息贯穿整个 AI 处理链路：Prompt → Tools → Skills → Response   │
│                                                                          │
│  4. 会话持久 (Session Persistent)                                        │
│     └─ 附件引用在多轮对话中保持，支持"刚才那个附件"等指代                  │
│                                                                          │
│  5. 优雅降级 (Graceful Degradation)                                      │
│     └─ 内容抓取失败时仍可使用标题/URL，并明确告知用户                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 附件生命周期

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        附件完整生命周期                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│  │  选择   │ ─→ │  验证   │ ─→ │  抓取   │ ─→ │  就绪   │ ─→ │  使用   │ │
│  │ SELECT  │    │ VALIDATE│    │  FETCH  │    │  READY  │    │   USE   │ │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘ │
│       │              │              │              │              │       │
│       ▼              ▼              ▼              ▼              ▼       │
│  用户点击书签   检查是否有    异步抓取内容    内容准备完成   注入到 AI    │
│  或上传文件    现有摘要      (如需要)       可以发送      Prompt/Tool   │
│                                                                           │
│  状态: pending → validating → loading → ready/error → used              │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                         会话结束后                                   │ │
│  │                                                                      │ │
│  │  ┌─────────┐    ┌─────────┐                                         │ │
│  │  │  归档   │ ─→ │  清理   │                                         │ │
│  │  │ ARCHIVE │    │  CLEAN  │                                         │ │
│  │  └─────────┘    └─────────┘                                         │ │
│  │       │              │                                               │ │
│  │       ▼              ▼                                               │ │
│  │  记录到会话     释放内存                                             │ │
│  │  历史记忆       清理临时文件                                          │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.3 AI 上下文层次架构

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      AI 上下文层次架构                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Layer 1: System Prompt 注入 (最高优先级)                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 【用户提供的参考资料】                                               │ │
│  │ 以下是用户主动选择的收藏/文件，请优先参考：                          │ │
│  │                                                                      │ │
│  │ 1. 📄 《Claude Skills 编程的意义》                                   │ │
│  │    来源: https://example.com/article                                │ │
│  │    内容摘要: [实际内容]                                              │ │
│  │    书签ID: 12345 (可通过 get_bookmark_detail 获取更多信息)          │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  Layer 2: 附件元数据传递 (结构化数据)                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ attachmentBookmarkIds: [12345, 12346]                               │ │
│  │ attachmentFiles: [{ name: "report.pdf", size: 1024 }]               │ │
│  │ attachmentSummary: "2 个收藏 · 1 个文件"                             │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  Layer 3: 会话记忆中的附件追踪                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ conversationAttachments: {                                          │ │
│  │   "msg-001": [{ bookmarkId: 12345, usedAt: "2026-01-08T10:00:00" }] │ │
│  │   "msg-002": [{ bookmarkId: 12346 }]                                │ │
│  │ }                                                                    │ │
│  │ // 支持"刚才那个附件"、"第一个书签"等指代解析                         │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  Layer 4: AI Skills 附件上下文                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ OrchestrationContext {                                              │ │
│  │   attachments: AttachmentItem[]                                     │ │
│  │   attachmentBookmarkIds: number[]                                   │ │
│  │   canQueryBookmarkDetails: true                                     │ │
│  │ }                                                                    │ │
│  │ // Skills 可以直接操作附件书签                                        │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.4 附件与 AI Skills 联动

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    附件与 AI Skills 联动矩阵                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Skill ID              │ 附件支持 │ 联动方式                              │
│  ──────────────────────┼──────────┼─────────────────────────────────────  │
│  knowledge_review      │ ✅ 支持  │ 对附件书签生成记忆卡片                │
│  data_export           │ ✅ 支持  │ 导出附件书签为指定格式                │
│  insight_report        │ ✅ 支持  │ 分析附件书签生成洞察报告              │
│  batch_organize        │ ✅ 支持  │ 批量整理附件书签                      │
│  quick_digest          │ ✅ 支持  │ 生成附件内容摘要                      │
│  smart_tagging         │ ✅ 支持  │ 为附件书签智能推荐标签                │
│  thematic_synthesis    │ ✅ 支持  │ 将附件书签合成主题报告                │
│  tts_synthesis         │ ✅ 支持  │ 朗读附件内容                          │
│  duplicate_cleanup     │ ⚪ 部分  │ 检测附件中的重复项                    │
│  reading_planner       │ ⚪ 部分  │ 将附件加入阅读计划                    │
│                                                                           │
│  联动机制:                                                                │
│  1. Skills 通过 context.attachmentBookmarkIds 获取附件书签 ID             │
│  2. Skills 可调用 get_bookmark_detail Tool 获取完整信息                  │
│  3. Skills 执行结果自动关联到附件书签                                     │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 三、详细实现方案

### 决策确认

| 问题     | 决策                 | 理由                                  |
| -------- | -------------------- | ------------------------------------- |
| 抓取时机 | **立即抓取**         | 用户选择时即准备内容，避免发送时等待  |
| 频率限制 | **每用户 10次/分钟** | 足够正常使用（3个附件上限），防止滥用 |
| Phase 3  | **一起实施**         | 用户反馈是完整体验的必要组成部分      |

---

## Phase 1: 附件内容增强 (核心修复)

### 1.1 增强 `AttachmentItem` 类型

**文件**: `src/components/ai/attachment/types.ts`

```typescript
/**
 * 附件内容状态
 */
export type AttachmentContentStatus =
  | "pending" // 等待验证
  | "loading" // 正在抓取内容
  | "ready" // 内容就绪
  | "empty" // 无内容（仅有标题/URL）
  | "error"; // 抓取失败

/**
 * 附件内容来源
 */
export type AttachmentContentSource =
  | "ai_summary" // 来自 AI 摘要
  | "description" // 来自描述
  | "raw_content" // 来自原始内容
  | "fetched" // 实时抓取
  | "file_extracted" // 文件提取
  | "none"; // 无内容

/**
 * 附件项 - 增强版
 */
export interface AttachmentItem {
  /** 唯一标识 (字符串化的 ID 或生成的 UUID) */
  id: string;

  /** 附件类型 */
  type: "bookmark" | "file";

  /** 标题 */
  title: string;

  /** URL (仅书签) */
  url?: string;

  /** 内容摘要 */
  content?: string;

  /** 平台来源 (仅书签) */
  platform?: string;

  /** 文件对象 (仅文件) */
  fileData?: File;

  /** MIME 类型 (仅文件) */
  mimeType?: string;

  /** 文件大小 (仅文件) */
  size?: number;

  /** 内容是否被截断 */
  truncated?: boolean;

  // ========== 新增字段 ==========

  /** 原始书签 ID (数字类型，用于 API 调用) */
  bookmarkId?: number;

  /** 内容状态 */
  contentStatus: AttachmentContentStatus;

  /** 内容来源 */
  contentSource: AttachmentContentSource;

  /** 错误信息 (当 contentStatus 为 error 时) */
  errorMessage?: string;

  /** 内容字符数 */
  contentLength?: number;

  /** 添加时间 */
  addedAt: Date;
}

/**
 * 附件限制配置
 */
export const ATTACHMENT_LIMITS = {
  /** 最大附件数量 */
  MAX_COUNT: 3,

  /** 单个附件最大内容长度 (字符) */
  MAX_CONTENT_LENGTH: 8000,

  /** 上下文总最大长度 (字符) */
  MAX_CONTEXT_CONTENT_LENGTH: 20000,

  /** 最大文件大小 (5MB) */
  MAX_FILE_SIZE: 5 * 1024 * 1024,

  /** 支持的文件类型 */
  SUPPORTED_FILE_TYPES: [
    "text/plain",
    "text/markdown",
    "application/pdf",
    "image/png",
    "image/jpeg",
  ],
} as const;
```

### 1.2 增强 `useAttachmentManager` Hook

**文件**: `src/hooks/ai/use-attachment-manager.ts`

```typescript
/**
 * 附件管理 Hook - 增强版
 *
 * 核心改进：
 * 1. 选择附件时立即抓取内容
 * 2. 内容状态追踪
 * 3. 错误处理与重试
 *
 * @version 2.0.0
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ATTACHMENT_LIMITS,
  type AttachmentItem,
  type AttachmentContentStatus,
  type AttachmentContentSource,
} from "@/components/ai/attachment/types";
import { extractFileContent } from "@/lib/ai/attachment/file-extractor";
import type { Bookmark } from "@/types/supabase";
import { clientLogger } from "@/lib/client-logger";

// =============================================================================
// 内容抓取服务
// =============================================================================

/**
 * 抓取书签内容
 *
 * 优先级：ai_summary > description > raw_content > 实时抓取
 */
async function fetchBookmarkContent(bookmark: Bookmark): Promise<{
  content: string | null;
  source: AttachmentContentSource;
  error?: string;
}> {
  // 1. 优先使用现有摘要
  if (bookmark.ai_summary && bookmark.ai_summary.trim()) {
    return {
      content: bookmark.ai_summary,
      source: "ai_summary",
    };
  }

  // 2. 使用描述
  if (bookmark.description && bookmark.description.trim()) {
    return {
      content: bookmark.description,
      source: "description",
    };
  }

  // 3. 使用原始内容
  if (bookmark.raw_content && bookmark.raw_content.trim()) {
    const truncated =
      bookmark.raw_content.length > ATTACHMENT_LIMITS.MAX_CONTENT_LENGTH;
    return {
      content: truncated
        ? bookmark.raw_content.slice(0, ATTACHMENT_LIMITS.MAX_CONTENT_LENGTH) +
          "..."
        : bookmark.raw_content,
      source: "raw_content",
    };
  }

  // 4. 实时抓取（如果有 URL）
  if (bookmark.url) {
    try {
      const response = await fetch("/api/bookmarks/fetch-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookmarkId: bookmark.id,
          url: bookmark.url,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.content) {
          return {
            content: data.content,
            source: "fetched",
          };
        }
      }
    } catch (error) {
      clientLogger.warn(
        { bookmarkId: bookmark.id, error },
        "Failed to fetch bookmark content",
      );
      return {
        content: null,
        source: "none",
        error: "内容抓取失败",
      };
    }
  }

  // 5. 无内容
  return {
    content: null,
    source: "none",
  };
}

// =============================================================================
// Hook 实现
// =============================================================================

export interface UseAttachmentManagerOptions {
  maxCount?: number;
  initialItems?: AttachmentItem[];
}

export interface UseAttachmentManagerReturn {
  /** 附件列表 */
  attachments: AttachmentItem[];
  /** 已选书签 ID 集合 */
  selectedBookmarkIds: Set<string>;
  /** 弹出面板是否打开 */
  isPopoverOpen: boolean;
  /** 设置弹出面板状态 */
  setPopoverOpen: (open: boolean) => void;
  /** 添加书签附件 (异步，会触发内容抓取) */
  addBookmark: (bookmark: Bookmark) => Promise<void>;
  /** 移除书签附件 */
  removeBookmark: (id: string) => void;
  /** 切换书签选中状态 */
  toggleBookmark: (bookmark: Bookmark) => Promise<void>;
  /** 添加文件附件 */
  addFiles: (files: File[]) => Promise<void>;
  /** 移除文件附件 */
  removeFile: (id: string) => void;
  /** 重试抓取内容 */
  retryFetchContent: (id: string) => Promise<void>;
  /** 更新附件列表 */
  setAttachments: (items: AttachmentItem[]) => void;
  /** 清空所有附件 */
  clearAll: () => void;
  /** 是否还能添加更多 */
  canAddMore: boolean;
  /** 剩余槽位 */
  remainingSlots: number;
  /** 是否正在处理 */
  isProcessing: boolean;
  /** 就绪的附件数量 */
  readyCount: number;
  /** 加载中的附件数量 */
  loadingCount: number;
  /** 错误的附件数量 */
  errorCount: number;
  /** 是否所有附件都就绪 */
  allReady: boolean;
}

export function useAttachmentManager({
  maxCount = ATTACHMENT_LIMITS.MAX_COUNT,
  initialItems = [],
}: UseAttachmentManagerOptions = {}): UseAttachmentManagerReturn {
  // 状态
  const [attachments, setAttachments] =
    useState<AttachmentItem[]>(initialItems);
  const [isPopoverOpen, setPopoverOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 计算派生状态
  const canAddMore = attachments.length < maxCount;
  const remainingSlots = maxCount - attachments.length;

  // 状态统计
  const readyCount = useMemo(
    () => attachments.filter((a) => a.contentStatus === "ready").length,
    [attachments],
  );
  const loadingCount = useMemo(
    () => attachments.filter((a) => a.contentStatus === "loading").length,
    [attachments],
  );
  const errorCount = useMemo(
    () => attachments.filter((a) => a.contentStatus === "error").length,
    [attachments],
  );
  const allReady = useMemo(
    () =>
      attachments.length > 0 &&
      attachments.every(
        (a) => a.contentStatus === "ready" || a.contentStatus === "empty",
      ),
    [attachments],
  );

  // 已选书签 ID 集合
  const selectedBookmarkIds = useMemo(
    () =>
      new Set(
        attachments
          .filter((item) => item.type === "bookmark")
          .map((item) => item.id),
      ),
    [attachments],
  );

  // 更新单个附件
  const updateAttachment = useCallback(
    (id: string, updates: Partial<AttachmentItem>) => {
      setAttachments((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  // 添加书签 (异步，立即抓取内容)
  const addBookmark = useCallback(
    async (bookmark: Bookmark) => {
      const bookmarkId = String(bookmark.id);

      // 检查是否已存在
      if (selectedBookmarkIds.has(bookmarkId)) return;

      // 检查是否超过上限
      if (attachments.length >= maxCount) return;

      setIsProcessing(true);

      // 1. 先添加占位项（loading 状态）
      const newItem: AttachmentItem = {
        id: bookmarkId,
        type: "bookmark",
        title: bookmark.title ?? "",
        url: bookmark.url ?? undefined,
        content: undefined,
        platform: bookmark.platform ?? undefined,
        bookmarkId: bookmark.id,
        contentStatus: "loading",
        contentSource: "none",
        addedAt: new Date(),
      };

      setAttachments((prev) => [...prev, newItem]);

      // 2. 异步抓取内容
      try {
        const result = await fetchBookmarkContent(bookmark);

        // 3. 更新内容
        const contentStatus: AttachmentContentStatus = result.content
          ? "ready"
          : result.error
            ? "error"
            : "empty";

        updateAttachment(bookmarkId, {
          content: result.content ?? undefined,
          contentStatus,
          contentSource: result.source,
          contentLength: result.content?.length,
          errorMessage: result.error,
        });

        clientLogger.info(
          {
            bookmarkId: bookmark.id,
            contentStatus,
            contentSource: result.source,
            contentLength: result.content?.length ?? 0,
          },
          "Bookmark attachment added",
        );
      } catch (error) {
        updateAttachment(bookmarkId, {
          contentStatus: "error",
          errorMessage: error instanceof Error ? error.message : "内容加载失败",
        });

        clientLogger.error(
          { bookmarkId: bookmark.id, error },
          "Failed to add bookmark attachment",
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [attachments.length, maxCount, selectedBookmarkIds, updateAttachment],
  );

  // 移除书签
  const removeBookmark = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // 切换书签选中状态
  const toggleBookmark = useCallback(
    async (bookmark: Bookmark) => {
      const bookmarkId = String(bookmark.id);

      if (selectedBookmarkIds.has(bookmarkId)) {
        removeBookmark(bookmarkId);
      } else {
        await addBookmark(bookmark);
      }
    },
    [selectedBookmarkIds, addBookmark, removeBookmark],
  );

  // 重试抓取内容
  const retryFetchContent = useCallback(
    async (id: string) => {
      const attachment = attachments.find((a) => a.id === id);
      if (
        !attachment ||
        attachment.type !== "bookmark" ||
        !attachment.bookmarkId
      ) {
        return;
      }

      setIsProcessing(true);
      updateAttachment(id, {
        contentStatus: "loading",
        errorMessage: undefined,
      });

      try {
        // 重新获取书签信息
        const response = await fetch(`/api/bookmarks/${attachment.bookmarkId}`);
        if (!response.ok) throw new Error("Failed to fetch bookmark");

        const { data: bookmark } = await response.json();
        const result = await fetchBookmarkContent(bookmark);

        const contentStatus: AttachmentContentStatus = result.content
          ? "ready"
          : result.error
            ? "error"
            : "empty";

        updateAttachment(id, {
          content: result.content ?? undefined,
          contentStatus,
          contentSource: result.source,
          contentLength: result.content?.length,
          errorMessage: result.error,
        });
      } catch (error) {
        updateAttachment(id, {
          contentStatus: "error",
          errorMessage: error instanceof Error ? error.message : "重试失败",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [attachments, updateAttachment],
  );

  // 添加文件
  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const slotsToUse = Math.min(files.length, remainingSlots);
      if (slotsToUse === 0) return;

      setIsProcessing(true);

      try {
        const filesToProcess = files.slice(0, slotsToUse);
        const newItems: AttachmentItem[] = [];

        for (const file of filesToProcess) {
          const extracted = await extractFileContent(file);

          const fileItem: AttachmentItem = {
            id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: "file",
            title: file.name,
            content: extracted.text,
            fileData: file,
            mimeType: file.type,
            size: file.size,
            truncated: extracted.truncated,
            contentStatus: extracted.text ? "ready" : "empty",
            contentSource: "file_extracted",
            contentLength: extracted.text?.length,
            addedAt: new Date(),
          };

          newItems.push(fileItem);
        }

        setAttachments((prev) => [...prev, ...newItems]);
      } finally {
        setIsProcessing(false);
      }
    },
    [remainingSlots],
  );

  // 移除文件
  const removeFile = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // 清空所有
  const clearAll = useCallback(() => {
    setAttachments([]);
  }, []);

  return {
    attachments,
    selectedBookmarkIds,
    isPopoverOpen,
    setPopoverOpen,
    addBookmark,
    removeBookmark,
    toggleBookmark,
    addFiles,
    removeFile,
    retryFetchContent,
    setAttachments,
    clearAll,
    canAddMore,
    remainingSlots,
    isProcessing,
    readyCount,
    loadingCount,
    errorCount,
    allReady,
  };
}
```

### 1.3 新增内容抓取 API

**文件**: `src/app/api/bookmarks/fetch-content/route.ts`

```typescript
/**
 * POST /api/bookmarks/fetch-content
 *
 * 抓取书签 URL 的内容并生成摘要
 *
 * 频率限制: 每用户 10 次/分钟
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { fetchAndExtractContent } from "@/lib/content-extractor";
import { generateQuickSummary } from "@/lib/ai-agent/summary";

const requestSchema = z.object({
  bookmarkId: z.number().int().positive(),
  url: z.string().url(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { success: false, error: "请先登录" },
        { status: 401 },
      );
    }

    // 2. 频率限制
    const rateLimitResult = checkRateLimit(
      user.id,
      "/api/bookmarks/fetch-content",
      {
        maxRequests: 10,
        windowMs: 60 * 1000, // 1 分钟
      },
    );

    if (!rateLimitResult.allowed) {
      return Response.json(
        {
          success: false,
          error: "请求过于频繁，请稍后再试",
          retryAfter: Math.ceil(rateLimitResult.resetMs / 1000),
        },
        { status: 429 },
      );
    }

    // 3. 验证请求
    const body = await request.json();
    const validation = requestSchema.safeParse(body);

    if (!validation.success) {
      return Response.json(
        { success: false, error: "参数无效", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { bookmarkId, url } = validation.data;

    // 4. 验证书签所有权
    const { data: bookmark, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select("id, user_id")
      .eq("id", bookmarkId)
      .single();

    if (bookmarkError || !bookmark || bookmark.user_id !== user.id) {
      return Response.json(
        { success: false, error: "书签不存在或无权限" },
        { status: 404 },
      );
    }

    // 5. 抓取内容
    const extracted = await fetchAndExtractContent(url, {
      maxLength: 8000,
      timeout: 10000,
    });

    if (!extracted.success) {
      return Response.json(
        { success: false, error: extracted.error || "内容抓取失败" },
        { status: 500 },
      );
    }

    // 6. 生成摘要（如果内容较长）
    let content = extracted.content;
    if (content && content.length > 2000) {
      try {
        const summary = await generateQuickSummary(content);
        content = summary || content.slice(0, 2000) + "...";
      } catch (error) {
        // 摘要生成失败，使用截断内容
        content = content.slice(0, 2000) + "...";
        logger.warn(
          { bookmarkId, error },
          "Failed to generate summary, using truncated content",
        );
      }
    }

    // 7. 可选：更新书签的 ai_summary
    await supabase
      .from("bookmarks")
      .update({ ai_summary: content })
      .eq("id", bookmarkId);

    logger.info(
      { bookmarkId, contentLength: content?.length },
      "Bookmark content fetched successfully",
    );

    return Response.json({
      success: true,
      content,
      source: "fetched",
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "POST /api/bookmarks/fetch-content error",
    );

    return Response.json(
      { success: false, error: "服务器错误" },
      { status: 500 },
    );
  }
}
```

---

## Phase 2: 附件与 AI 深度集成

### 2.1 增强 API Schema

**文件**: `src/app/api/agent/unified/route.ts`

```typescript
const unifiedChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  messageHistory: z.array(messageSchema).max(50).optional(),
  bookmarkIds: z.array(z.number().int().positive()).max(100).optional(),
  folderId: z.number().int().positive().optional(),
  explicitTool: explicitToolSchema.optional(),
  contextReferences: contextReferencesSchema.optional(),

  // ========== 附件相关 (增强) ==========

  /** 附件上下文文本 (格式化后的内容) */
  attachmentContext: z.string().max(20000).optional(),

  /** 附件书签 ID 数组 (用于 Tool 查询和 Skill 操作) */
  attachmentBookmarkIds: z.array(z.number().int().positive()).max(3).optional(),

  /** 附件元数据 (用于追踪和展示) */
  attachmentMetadata: z
    .object({
      /** 书签附件数量 */
      bookmarkCount: z.number().int().min(0).max(3),
      /** 文件附件数量 */
      fileCount: z.number().int().min(0).max(3),
      /** 总内容长度 */
      totalContentLength: z.number().int().min(0),
      /** 是否所有附件内容都就绪 */
      allReady: z.boolean(),
    })
    .optional(),

  options: z
    .object({
      enableUnified: z.boolean().optional().default(true),
      streaming: z.boolean().optional().default(true),
      includeRoutingInfo: z.boolean().optional().default(false),
      forceMode: z.enum(["atomic", "orchestration"]).optional(),
      forceSkill: z.string().optional(),
      maxToolRounds: z.number().int().min(1).max(10).optional(),
      temperature: z.number().min(0).max(1).optional(),
    })
    .optional(),
});
```

### 2.2 增强附件上下文构建

**文件**: `src/lib/ai-agent/context/attachment-context-builder.ts`

```typescript
/**
 * 附件上下文构建器 - 增强版
 *
 * 关键改进：
 * 1. 显式标注书签 ID，支持 Tool 查询
 * 2. 内容状态透明，AI 知道哪些附件有完整内容
 * 3. 强化指令，让 AI 优先参考附件
 *
 * @version 2.0.0
 */

import {
  ATTACHMENT_LIMITS,
  type AttachmentItem,
} from "@/components/ai/attachment/types";

// =============================================================================
// 类型定义
// =============================================================================

export interface AttachmentContextOptions {
  maxContentLength?: number;
  includeUrl?: boolean;
  includeBookmarkIds?: boolean;
}

export interface AttachmentContextResult {
  /** 格式化的上下文文本 */
  context: string;
  /** 书签 ID 数组 */
  bookmarkIds: number[];
  /** 元数据 */
  metadata: {
    bookmarkCount: number;
    fileCount: number;
    totalContentLength: number;
    allReady: boolean;
  };
}

// =============================================================================
// 默认配置
// =============================================================================

const DEFAULT_OPTIONS: Required<AttachmentContextOptions> = {
  maxContentLength: ATTACHMENT_LIMITS.MAX_CONTEXT_CONTENT_LENGTH,
  includeUrl: true,
  includeBookmarkIds: true,
};

// =============================================================================
// 工具函数
// =============================================================================

function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.slice(0, maxLength) + "...（内容已截断）";
}

function getTypeIcon(item: AttachmentItem): string {
  if (item.type === "bookmark") {
    return "📄";
  }
  if (item.mimeType?.startsWith("image/")) {
    return "🖼️";
  }
  if (item.mimeType === "application/pdf") {
    return "📑";
  }
  return "📎";
}

function getContentStatusLabel(item: AttachmentItem): string {
  switch (item.contentStatus) {
    case "ready":
      return "✅ 内容已就绪";
    case "loading":
      return "⏳ 内容加载中";
    case "empty":
      return "⚠️ 无内容摘要";
    case "error":
      return `❌ ${item.errorMessage || "内容加载失败"}`;
    default:
      return "";
  }
}

function formatAttachmentItem(
  item: AttachmentItem,
  index: number,
  options: Required<AttachmentContextOptions>,
): string {
  const icon = getTypeIcon(item);
  const lines: string[] = [];

  // 标题行
  if (item.type === "bookmark") {
    lines.push(`${index + 1}. ${icon} 《${item.title}》`);
    // 书签 ID（如果启用）
    if (options.includeBookmarkIds && item.bookmarkId) {
      lines.push(`   📌 书签ID: ${item.bookmarkId}`);
    }
  } else {
    lines.push(`${index + 1}. ${icon} ${item.title}（上传文件）`);
  }

  // URL（仅书签）
  if (item.type === "bookmark" && item.url && options.includeUrl) {
    lines.push(`   🔗 来源: ${item.url}`);
  }

  // 内容状态
  const statusLabel = getContentStatusLabel(item);
  if (statusLabel) {
    lines.push(`   ${statusLabel}`);
  }

  // 内容摘要
  if (item.content && item.contentStatus === "ready") {
    const contentPreview = truncateContent(
      item.content,
      options.maxContentLength / 3, // 单个附件最多占 1/3 总长度
    );
    lines.push(`   📝 内容摘要:`);
    lines.push(`   ${contentPreview}`);
  }

  return lines.join("\n");
}

// =============================================================================
// 主函数
// =============================================================================

/**
 * 构建附件上下文（完整版）
 *
 * @param attachments 附件列表
 * @param options 配置选项
 * @returns 上下文结果（包含文本、书签ID、元数据）
 */
export function buildAttachmentContextFull(
  attachments: AttachmentItem[],
  options?: AttachmentContextOptions,
): AttachmentContextResult {
  // 空结果
  if (attachments.length === 0) {
    return {
      context: "",
      bookmarkIds: [],
      metadata: {
        bookmarkCount: 0,
        fileCount: 0,
        totalContentLength: 0,
        allReady: true,
      },
    };
  }

  const opts: Required<AttachmentContextOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  // 提取书签 ID
  const bookmarkIds = attachments
    .filter((a) => a.type === "bookmark" && a.bookmarkId)
    .map((a) => a.bookmarkId as number);

  // 计算元数据
  const bookmarkCount = attachments.filter((a) => a.type === "bookmark").length;
  const fileCount = attachments.filter((a) => a.type === "file").length;
  const totalContentLength = attachments.reduce(
    (sum, a) => sum + (a.contentLength || 0),
    0,
  );
  const allReady = attachments.every(
    (a) => a.contentStatus === "ready" || a.contentStatus === "empty",
  );

  // 构建上下文
  const header = `【用户选择的参考资料】

⚠️ 重要：以下是用户主动选择希望你参考的内容，请在回答时：
1. 优先基于这些资料回答问题
2. 如果资料与问题相关，直接引用和分析这些内容
3. 如果需要更多信息，可以使用 get_bookmark_detail 工具查询书签详情

共 ${attachments.length} 个附件（${bookmarkCount} 个收藏，${fileCount} 个文件）：
`;

  const itemsText = attachments
    .map((item, index) => formatAttachmentItem(item, index, opts))
    .join("\n\n");

  // 尾部提示
  const footer =
    bookmarkIds.length > 0
      ? `
---
💡 提示：上述书签的 ID 为 [${bookmarkIds.join(", ")}]，如需获取完整内容或执行操作，可使用相应工具。`
      : "";

  const context = `${header}\n${itemsText}${footer}`;

  return {
    context,
    bookmarkIds,
    metadata: {
      bookmarkCount,
      fileCount,
      totalContentLength,
      allReady,
    },
  };
}

/**
 * 构建附件上下文（兼容旧版，仅返回字符串）
 */
export function buildAttachmentContext(
  attachments: AttachmentItem[],
  options?: AttachmentContextOptions,
): string {
  return buildAttachmentContextFull(attachments, options).context;
}

/**
 * 检查是否有有效的附件内容
 */
export function hasValidAttachmentContent(
  attachments: AttachmentItem[],
): boolean {
  return attachments.some(
    (item) =>
      item.contentStatus === "ready" &&
      item.content &&
      item.content.trim().length > 0,
  );
}

/**
 * 获取附件摘要描述
 */
export function getAttachmentSummary(attachments: AttachmentItem[]): string {
  if (attachments.length === 0) {
    return "";
  }

  const bookmarkCount = attachments.filter((a) => a.type === "bookmark").length;
  const fileCount = attachments.filter((a) => a.type === "file").length;
  const readyCount = attachments.filter(
    (a) => a.contentStatus === "ready",
  ).length;

  const parts: string[] = [];
  if (bookmarkCount > 0) {
    parts.push(`${bookmarkCount} 个收藏`);
  }
  if (fileCount > 0) {
    parts.push(`${fileCount} 个文件`);
  }

  const statusPart =
    readyCount === attachments.length
      ? "全部就绪"
      : `${readyCount}/${attachments.length} 就绪`;

  return `${parts.join(" · ")} (${statusPart})`;
}

export default buildAttachmentContext;
```

### 2.3 增强前端发送逻辑

**文件**: `src/components/ai/ai-panel-content-enhanced.tsx`

关键修改点：

```typescript
// 在 sendMessage 函数中，使用增强版构建器
const sendMessage = useCallback(
  async (content: string, tool: ToolType = "auto") => {
    if (!content.trim() || isLoading) return;

    // ... 创建消息等代码 ...

    // 构建附件上下文（使用增强版）
    const attachmentResult = buildAttachmentContextFull(attachments);

    // 构建请求体
    const requestBody: Record<string, unknown> = {
      message: userMessage.content,
      conversationId,
      messageHistory,
      bookmarkIds,
      folderId,

      // 附件上下文
      attachmentContext: attachmentResult.context || undefined,

      // 附件书签 ID (用于 Tool 和 Skill)
      attachmentBookmarkIds:
        attachmentResult.bookmarkIds.length > 0
          ? attachmentResult.bookmarkIds
          : undefined,

      // 附件元数据 (用于追踪)
      attachmentMetadata:
        attachments.length > 0 ? attachmentResult.metadata : undefined,

      options: {
        streaming: true,
        enableUnified: useUnifiedEngine,
      },
    };

    // ... 其余代码 ...
  },
  [
    /* deps */
  ],
);
```

### 2.4 增强 EngineContext 类型

**文件**: `src/lib/ai-skills/engine/types.ts`

```typescript
/**
 * 引擎上下文 - 增强附件支持
 */
export interface EngineContext {
  userId: string;
  conversationId?: string;
  bookmarkIds?: number[];
  folderId?: number;
  messageHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  totalBookmarks?: number;
  totalFolders?: number;
  traceId?: string;
  debug?: boolean;

  // ========== 附件相关 ==========

  /** 附件上下文文本 */
  attachmentContext?: string;

  /** 附件书签 ID 数组 */
  attachmentBookmarkIds?: number[];

  /** 附件元数据 */
  attachmentMetadata?: {
    bookmarkCount: number;
    fileCount: number;
    totalContentLength: number;
    allReady: boolean;
  };

  // ========== 其他上下文 ==========

  /** 情景记忆 */
  episodicMemory?: EpisodicMemoryContext;

  /** 最近搜索结果 */
  lastSearchResults?: {
    query: string;
    resultIds: number[];
    searchedAt: Date;
  };

  /** 搜索结果回调 */
  onSearchResults?: (query: string, resultIds: number[]) => void;

  /** 取消信号 */
  signal?: AbortSignal;

  /** 取消令牌 */
  cancellationToken?: CancellationToken;

  /** 请求 ID */
  requestId?: string;
}
```

### 2.5 会话附件追踪

**文件**: `src/lib/ai-memory/conversation-attachments.ts` (新建)

```typescript
/**
 * 会话附件追踪器
 *
 * 跟踪会话中使用的附件，支持：
 * - 多轮对话中的附件引用
 * - "刚才那个附件"等指代解析
 * - 附件使用统计
 */

export interface ConversationAttachment {
  /** 书签 ID */
  bookmarkId?: number;
  /** 文件名 */
  fileName?: string;
  /** 类型 */
  type: "bookmark" | "file";
  /** 标题 */
  title: string;
  /** 使用的消息 ID */
  messageId: string;
  /** 使用时间 */
  usedAt: Date;
}

export interface ConversationAttachmentStore {
  /** 会话 ID */
  conversationId: string;
  /** 附件记录（按消息 ID 分组） */
  attachmentsByMessage: Map<string, ConversationAttachment[]>;
  /** 所有附件（按添加顺序） */
  allAttachments: ConversationAttachment[];
  /** 创建时间 */
  createdAt: Date;
  /** 最后更新时间 */
  updatedAt: Date;
}

class ConversationAttachmentTracker {
  private stores = new Map<string, ConversationAttachmentStore>();

  /**
   * 记录附件使用
   */
  recordAttachments(
    conversationId: string,
    messageId: string,
    attachments: Array<{
      bookmarkId?: number;
      fileName?: string;
      type: "bookmark" | "file";
      title: string;
    }>,
  ): void {
    if (!this.stores.has(conversationId)) {
      this.stores.set(conversationId, {
        conversationId,
        attachmentsByMessage: new Map(),
        allAttachments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const store = this.stores.get(conversationId)!;
    const now = new Date();

    const records: ConversationAttachment[] = attachments.map((a) => ({
      ...a,
      messageId,
      usedAt: now,
    }));

    store.attachmentsByMessage.set(messageId, records);
    store.allAttachments.push(...records);
    store.updatedAt = now;
  }

  /**
   * 获取最近的附件
   */
  getRecentAttachments(
    conversationId: string,
    limit = 5,
  ): ConversationAttachment[] {
    const store = this.stores.get(conversationId);
    if (!store) return [];

    return store.allAttachments.slice(-limit);
  }

  /**
   * 解析附件指代
   *
   * 支持：
   * - "刚才那个附件" → 最后一个附件
   * - "第一个书签" → 第一个书签类型附件
   * - "那个 PDF" → 最近的 PDF 文件
   */
  resolveAttachmentReference(
    conversationId: string,
    reference: string,
  ): ConversationAttachment | null {
    const store = this.stores.get(conversationId);
    if (!store || store.allAttachments.length === 0) return null;

    const lowerRef = reference.toLowerCase();

    // 最后一个
    if (lowerRef.includes("刚才") || lowerRef.includes("那个附件")) {
      return store.allAttachments[store.allAttachments.length - 1];
    }

    // 第 N 个
    const ordinalMatch = lowerRef.match(/第([一二三四五1-5])个/);
    if (ordinalMatch) {
      const ordinalMap: Record<string, number> = {
        一: 0,
        二: 1,
        三: 2,
        四: 3,
        五: 4,
        "1": 0,
        "2": 1,
        "3": 2,
        "4": 3,
        "5": 4,
      };
      const index = ordinalMap[ordinalMatch[1]] ?? 0;
      return store.allAttachments[index] ?? null;
    }

    // 按类型
    if (lowerRef.includes("书签") || lowerRef.includes("收藏")) {
      return store.allAttachments.find((a) => a.type === "bookmark") ?? null;
    }
    if (lowerRef.includes("文件") || lowerRef.includes("pdf")) {
      return store.allAttachments.find((a) => a.type === "file") ?? null;
    }

    return null;
  }

  /**
   * 清理会话
   */
  clearConversation(conversationId: string): void {
    this.stores.delete(conversationId);
  }
}

export const conversationAttachmentTracker =
  new ConversationAttachmentTracker();
```

---

## Phase 3: 用户反馈增强

### 3.1 附件状态指示器增强

**文件**: `src/components/ai/attachment/attachment-indicator.tsx`

```typescript
/**
 * 附件状态指示器 - 增强版
 *
 * 显示附件数量和状态，提供快速预览
 */

"use client";

import { Paperclip, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AttachmentItem } from "./types";

interface AttachmentIndicatorProps {
  attachments: AttachmentItem[];
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function AttachmentIndicator({
  attachments,
  disabled,
  onClick,
  className,
}: AttachmentIndicatorProps) {
  if (attachments.length === 0) return null;

  // 计算状态
  const readyCount = attachments.filter(
    (a) => a.contentStatus === "ready"
  ).length;
  const loadingCount = attachments.filter(
    (a) => a.contentStatus === "loading"
  ).length;
  const errorCount = attachments.filter(
    (a) => a.contentStatus === "error"
  ).length;
  const emptyCount = attachments.filter(
    (a) => a.contentStatus === "empty"
  ).length;

  // 状态判断
  const isAllReady = readyCount === attachments.length;
  const hasLoading = loadingCount > 0;
  const hasError = errorCount > 0;
  const hasEmpty = emptyCount > 0;

  // 状态描述
  const getStatusText = () => {
    if (hasLoading) return `正在加载 ${loadingCount} 个附件...`;
    if (hasError) return `${errorCount} 个附件加载失败`;
    if (hasEmpty) return `${emptyCount} 个附件无内容摘要`;
    if (isAllReady) return `${readyCount} 个附件已就绪`;
    return `${attachments.length} 个附件`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors",
              "hover:bg-muted/80",
              isAllReady && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
              hasLoading && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
              hasError && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
              hasEmpty && !hasError && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
              disabled && "opacity-50 cursor-not-allowed",
              className
            )}
          >
            <Paperclip className="size-3.5" />
            <span>{attachments.length}</span>

            {/* 状态图标 */}
            {hasLoading && (
              <Loader2 className="size-3 animate-spin" />
            )}
            {hasError && !hasLoading && (
              <AlertCircle className="size-3" />
            )}
            {hasEmpty && !hasError && !hasLoading && (
              <AlertCircle className="size-3" />
            )}
            {isAllReady && (
              <CheckCircle className="size-3" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-sm">
            <p className="font-medium">{getStatusText()}</p>
            {attachments.length > 0 && (
              <p className="text-muted-foreground text-xs mt-1">
                点击查看详情
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

### 3.2 AI 响应附件标注

**文件**: `src/components/ai/ai-message-enhanced.tsx`

在消息组件中添加附件引用显示：

```typescript
// 在消息内容下方添加附件引用标注
{message.role === "assistant" && message.usedAttachments && message.usedAttachments.length > 0 && (
  <div className="mt-2 pt-2 border-t border-muted flex items-center gap-2 text-xs text-muted-foreground">
    <Paperclip className="size-3" />
    <span>
      参考了 {message.usedAttachments.length} 个附件：
      {message.usedAttachments.map((a, i) => (
        <span key={a.id}>
          {i > 0 && "、"}
          <span className="text-foreground font-medium">{a.title}</span>
        </span>
      ))}
    </span>
  </div>
)}
```

### 3.3 DisplayMessage 类型扩展

**文件**: `src/components/ai/types.ts`

```typescript
export interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: MessageStatus;
  createdAt: Date;
  // ... 其他字段

  // 新增：使用的附件
  usedAttachments?: Array<{
    id: string;
    type: "bookmark" | "file";
    title: string;
    bookmarkId?: number;
  }>;
}
```

---

## 四、实现计划

### 文件变更清单

```
修改文件:
├── src/components/ai/attachment/types.ts              # 类型定义增强
├── src/hooks/ai/use-attachment-manager.ts             # Hook 增强
├── src/components/ai/ai-panel-content-enhanced.tsx    # 面板组件增强
├── src/app/api/agent/unified/route.ts                 # API Schema 增强
├── src/lib/ai-agent/context/attachment-context-builder.ts # 上下文构建增强
├── src/lib/ai-skills/engine/types.ts                  # EngineContext 增强
├── src/lib/ai-skills/engine/execution-coordinator.ts  # 执行协调器增强
├── src/components/ai/attachment/attachment-indicator.tsx # 状态指示器增强
├── src/components/ai/ai-message-enhanced.tsx          # 消息组件增强
├── src/components/ai/types.ts                         # DisplayMessage 类型扩展

新增文件:
├── src/app/api/bookmarks/fetch-content/route.ts       # 内容抓取 API
├── src/lib/ai-memory/conversation-attachments.ts      # 会话附件追踪
```

### 实施顺序

| 步骤 | 内容                                    | 预估  |
| ---- | --------------------------------------- | ----- |
| 1    | 类型定义增强 (`types.ts`)               | 30min |
| 2    | 内容抓取 API                            | 1.5h  |
| 3    | Hook 增强 (`use-attachment-manager.ts`) | 2h    |
| 4    | 上下文构建增强                          | 1h    |
| 5    | API Schema 增强                         | 30min |
| 6    | 前端发送逻辑增强                        | 1h    |
| 7    | EngineContext 增强                      | 30min |
| 8    | 状态指示器增强                          | 1h    |
| 9    | 消息组件附件标注                        | 1h    |
| 10   | 会话附件追踪                            | 1.5h  |
| 11   | 集成测试                                | 2h    |

**总预估**: 12.5 小时

---

## 五、测试验收标准

### 功能测试

| 测试场景                   | 预期结果                                 |
| -------------------------- | ---------------------------------------- |
| 选择有摘要的书签           | 立即显示"就绪"状态，AI 能引用摘要内容    |
| 选择无摘要的书签           | 显示"加载中"，然后抓取内容或显示"无内容" |
| 抓取失败                   | 显示"错误"状态，提供重试按钮             |
| 发送"帮我总结附件"         | AI 正确总结所有附件内容                  |
| 发送"分析第一个书签"       | AI 正确识别并分析第一个书签              |
| 多轮对话引用"刚才那个附件" | 正确解析指代                             |

### 性能测试

| 测试场景         | 预期结果                |
| ---------------- | ----------------------- |
| 内容抓取响应时间 | < 5 秒                  |
| 频率限制触发     | 第 11 次请求返回 429    |
| 3 个附件同时加载 | 并行加载，总时间 < 8 秒 |

---

## 六、风险与缓解

| 风险           | 影响            | 缓解措施                   |
| -------------- | --------------- | -------------------------- |
| 内容抓取延迟   | 用户等待        | 并行加载 + Loading 状态    |
| 抓取内容过大   | Token 消耗高    | 智能截断 + 摘要提取        |
| API 调用失败   | 附件内容为空    | 优雅降级 + 错误提示 + 重试 |
| 指代解析不准确 | AI 操作错误对象 | 多种解析规则 + 确认机制    |

---

## 七、审核确认

请审核更新后的方案，确认后我将按以下顺序实施：

1. **Phase 1**: 类型定义 → API → Hook → 上下文构建
2. **Phase 2**: API Schema → 前端发送 → EngineContext
3. **Phase 3**: 状态指示器 → 消息标注 → 会话追踪
4. **集成测试**

您是否有其他需要调整或补充的地方？
