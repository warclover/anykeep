/**
 * 附件上下文构建器
 *
 * 将附件转换为 AI 可理解的上下文文本
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import {
  ATTACHMENT_LIMITS,
  type AttachmentItem,
  type AttachmentContextOptions,
} from "@/components/ai/attachment/types";

// =============================================================================
// 默认配置
// =============================================================================

const DEFAULT_OPTIONS: Required<AttachmentContextOptions> = {
  maxContentLength: ATTACHMENT_LIMITS.MAX_CONTEXT_CONTENT_LENGTH,
  includeUrl: true,
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
  return content.slice(0, maxLength) + "...";
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
  } else {
    lines.push(`${index + 1}. ${icon} ${item.title}（上传文件）`);
  }

  // URL（仅书签）
  if (item.type === "bookmark" && item.url && options.includeUrl) {
    lines.push(`   来源: ${item.url}`);
  }

  // 内容摘要
  if (item.content) {
    const contentPreview = truncateContent(
      item.content,
      options.maxContentLength,
    );
    lines.push(`   内容摘要:`);
    lines.push(`   ${contentPreview}`);
  }

  return lines.join("\n");
}

// =============================================================================
// 主函数
// =============================================================================

/**
 * 构建附件上下文
 *
 * 将附件列表转换为 AI 可理解的结构化文本
 *
 * @param attachments 附件列表
 * @param options 配置选项
 * @returns 上下文文本
 */
export function buildAttachmentContext(
  attachments: AttachmentItem[],
  options?: AttachmentContextOptions,
): string {
  if (attachments.length === 0) {
    return "";
  }

  const opts: Required<AttachmentContextOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const header = `【用户提供的参考资料】
以下是用户主动提供的收藏/文件，请在回答时参考这些内容：
`;

  const itemsText = attachments
    .map((item, index) => formatAttachmentItem(item, index, opts))
    .join("\n\n");

  const footer = `
请在回答中适当引用这些资料，如果用户的问题与资料相关。`;

  return `${header}\n${itemsText}\n${footer}`;
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
    (item) => item.content && item.content.trim().length > 0,
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

  const parts: string[] = [];
  if (bookmarkCount > 0) {
    parts.push(`${bookmarkCount} 个收藏`);
  }
  if (fileCount > 0) {
    parts.push(`${fileCount} 个文件`);
  }

  return parts.join(" · ");
}

export default buildAttachmentContext;
