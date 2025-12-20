/**
 * ZIP 压缩工具函数
 */

import type { BookmarkWithFolder } from "../types";
import { ObsidianFormatter } from "../formatters/obsidian-formatter";

/**
 * 生成 Obsidian ZIP 文件
 */
export async function generateObsidianZip(
  bookmarks: BookmarkWithFolder[],
): Promise<Blob> {
  const formatter = new ObsidianFormatter({ outputMode: "zip" });
  const result = await formatter.formatAllZip(bookmarks);
  return result;
}

/**
 * 生成通用 ZIP 文件
 * 可以包含多种格式的文件
 */
export async function generateZip(
  files: Array<{ name: string; content: string | Blob }>,
): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.name, file.content);
  }

  return zip.generateAsync({ type: "blob" });
}

/**
 * 检查是否支持 ZIP
 * （检查 JSZip 是否可用）
 */
export async function isZipSupported(): Promise<boolean> {
  try {
    await import("jszip");
    return true;
  } catch {
    return false;
  }
}
