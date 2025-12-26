/**
 * 文件内容提取工具
 *
 * 支持 TXT、MD、PDF、图片等格式
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import {
  ATTACHMENT_LIMITS,
  ATTACHMENT_TEXT,
  type ExtractedContent,
} from "@/components/ai/attachment/types";

// =============================================================================
// 文本文件提取
// =============================================================================

/**
 * 提取文本文件内容
 */
async function extractTextFile(file: File): Promise<ExtractedContent> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      const truncated = text.length > ATTACHMENT_LIMITS.MAX_CONTENT_LENGTH;
      const content = truncated
        ? text.slice(0, ATTACHMENT_LIMITS.MAX_CONTENT_LENGTH)
        : text;

      resolve({
        text: content,
        truncated,
      });
    };

    reader.onerror = () => {
      resolve({
        text: "",
        truncated: false,
        error: ATTACHMENT_TEXT.ERROR_EXTRACT_FAILED,
      });
    };

    reader.readAsText(file);
  });
}

// =============================================================================
// 图片文件提取
// =============================================================================

/**
 * 提取图片文件（转为 base64）
 */
async function extractImageFile(file: File): Promise<ExtractedContent> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const base64 = e.target?.result as string;

      // 图片内容用特殊格式表示
      resolve({
        text: `[图片: ${file.name}]\n${base64}`,
        truncated: false,
      });
    };

    reader.onerror = () => {
      resolve({
        text: `[图片: ${file.name}]`,
        truncated: false,
        error: ATTACHMENT_TEXT.ERROR_EXTRACT_FAILED,
      });
    };

    reader.readAsDataURL(file);
  });
}

// =============================================================================
// PDF 文件提取
// =============================================================================

/**
 * 提取 PDF 文件内容
 *
 * 注意：PDF 提取功能需要安装 pdfjs-dist 依赖
 * 目前返回占位内容，后续可以通过安装依赖启用完整功能
 */
async function extractPdfFile(file: File): Promise<ExtractedContent> {
  // PDF 提取暂时返回占位内容
  // 完整功能需要安装 pdfjs-dist 依赖
  return {
    text: `[PDF 文档: ${file.name}]\n(PDF 内容提取功能暂未启用，请参考文档手动安装 pdfjs-dist 依赖)`,
    truncated: false,
  };
}

// =============================================================================
// 主提取函数
// =============================================================================

/**
 * 提取文件内容
 *
 * @param file 文件对象
 * @returns 提取的内容
 */
export async function extractFileContent(
  file: File,
): Promise<ExtractedContent> {
  const mimeType = file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() || "";

  // 文本文件
  if (
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    extension === "txt" ||
    extension === "md"
  ) {
    return extractTextFile(file);
  }

  // 图片文件
  if (mimeType.startsWith("image/")) {
    return extractImageFile(file);
  }

  // PDF 文件
  if (mimeType === "application/pdf" || extension === "pdf") {
    return extractPdfFile(file);
  }

  // 未知类型
  return {
    text: `[文件: ${file.name}]\n(不支持的文件类型)`,
    truncated: false,
    error: ATTACHMENT_TEXT.ERROR_FILE_TYPE,
  };
}

/**
 * 批量提取文件内容
 *
 * @param files 文件数组
 * @returns 提取结果数组
 */
export async function extractFilesContent(
  files: File[],
): Promise<ExtractedContent[]> {
  return Promise.all(files.map((file) => extractFileContent(file)));
}

export default extractFileContent;
