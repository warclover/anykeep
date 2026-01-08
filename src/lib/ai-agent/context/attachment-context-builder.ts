/**
 * 附件上下文构建器 - 增强版
 *
 * 关键改进：
 * 1. 显式标注书签 ID，支持 Tool 查询
 * 2. 内容状态透明，AI 知道哪些附件有完整内容
 * 3. 强化指令，让 AI 优先参考附件
 * 4. 返回结构化结果（上下文 + 元数据）
 *
 * @version 2.0.0
 * @since 2025-12-26
 * @updated 2026-01-08 - 增强版上下文构建
 */

import {
  ATTACHMENT_LIMITS,
  type AttachmentItem,
} from "@/components/ai/attachment/types";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 附件上下文构建选项
 */
export interface AttachmentContextOptions {
  /** 单个附件最大内容长度，默认 MAX_CONTEXT_CONTENT_LENGTH / 3 */
  maxContentLength?: number;
  /** 是否包含 URL，默认 true */
  includeUrl?: boolean;
  /** 是否包含书签 ID，默认 true */
  includeBookmarkIds?: boolean;
}

/**
 * 附件上下文构建结果
 */
export interface AttachmentContextResult {
  /** 格式化的上下文文本（用于 System Prompt） */
  context: string;
  /** 书签 ID 数组（用于 Tool 和 Skill） */
  bookmarkIds: number[];
  /** 元数据 */
  metadata: {
    /** 书签附件数量 */
    bookmarkCount: number;
    /** 文件附件数量 */
    fileCount: number;
    /** 总内容长度 */
    totalContentLength: number;
    /** 是否所有附件内容都就绪 */
    allReady: boolean;
  };
}

// =============================================================================
// 默认配置
// =============================================================================

const DEFAULT_OPTIONS: Required<AttachmentContextOptions> = {
  maxContentLength: Math.floor(
    ATTACHMENT_LIMITS.MAX_CONTEXT_CONTENT_LENGTH / 3,
  ),
  includeUrl: true,
  includeBookmarkIds: true,
};

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 截断内容并添加省略标记
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.slice(0, maxLength) + "...（内容已截断）";
}

/**
 * 获取附件类型图标
 */
function getTypeIcon(item: AttachmentItem): string {
  if (item.type === "bookmark") {
    return "📄";
  }

  // 文件类型
  if (item.mimeType?.startsWith("image/")) {
    return "🖼️";
  }
  if (item.mimeType === "application/pdf") {
    return "📑";
  }
  return "📎";
}

/**
 * 获取内容状态标签
 */
function getContentStatusLabel(item: AttachmentItem): string {
  switch (item.contentStatus) {
    case "ready":
      return "✅ 内容已就绪";
    case "loading":
      return "⏳ 内容加载中";
    case "empty":
      return "⚠️ 无内容摘要（仅有标题/URL）";
    case "error":
      return `❌ ${item.errorMessage || "内容加载失败"}`;
    default:
      return "";
  }
}

/**
 * 格式化单个附件
 */
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

  // 内容摘要（仅显示非空内容）
  if (item.content?.trim() && item.contentStatus === "ready") {
    const contentPreview = truncateContent(
      item.content,
      options.maxContentLength,
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
 *
 * @param attachments 附件列表
 * @param options 配置选项
 * @returns 上下文文本
 */
export function buildAttachmentContext(
  attachments: AttachmentItem[],
  options?: AttachmentContextOptions,
): string {
  return buildAttachmentContextFull(attachments, options).context;
}

/**
 * 检查是否有有效的附件内容
 *
 * @param attachments 附件列表
 * @returns 是否有有效内容
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
 *
 * @param attachments 附件列表
 * @returns 摘要描述
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

/**
 * 获取附件书签 ID 数组
 *
 * @param attachments 附件列表
 * @returns 书签 ID 数组
 */
export function getAttachmentBookmarkIds(
  attachments: AttachmentItem[],
): number[] {
  return attachments
    .filter((a) => a.type === "bookmark" && a.bookmarkId)
    .map((a) => a.bookmarkId as number);
}

export default buildAttachmentContext;
