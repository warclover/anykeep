/**
 * 导出工具函数
 * 支持导出书签为 Markdown 格式
 */

import type { Bookmark } from "@/types/supabase";

/**
 * 将书签导出为 Markdown 格式
 */
export function exportBookmarksToMarkdown(
  bookmarks: Array<Bookmark & { folders?: { name: string } | null }>,
  title: string = "我的书签",
): string {
  // Markdown 文件头部
  let markdown = `# ${title}\n\n`;
  markdown += `> 导出时间：${new Date().toLocaleString("zh-CN")}\n`;
  markdown += `> 总计：${bookmarks.length} 条书签\n\n`;
  markdown += "---\n\n";

  // 按文件夹分组
  const grouped = new Map<string, typeof bookmarks>();

  bookmarks.forEach((bookmark) => {
    const folderName = bookmark.folders?.name || "未分类";
    const folderBookmarks = grouped.get(folderName);
    if (folderBookmarks) {
      folderBookmarks.push(bookmark);
    } else {
      grouped.set(folderName, [bookmark]);
    }
  });

  // 遍历每个文件夹
  grouped.forEach((items, folderName) => {
    markdown += `## ${folderName}\n\n`;

    items.forEach((bookmark, index) => {
      markdown += `### ${index + 1}. ${bookmark.title}\n\n`;

      // 元信息
      markdown += `**链接**：[${bookmark.url}](${bookmark.url})\n\n`;

      if (bookmark.author) {
        markdown += `**作者**：${bookmark.author}\n\n`;
      }

      if (bookmark.platform) {
        markdown += `**平台**：${bookmark.platform}\n\n`;
      }

      if (bookmark.created_at) {
        markdown += `**收藏时间**：${new Date(bookmark.created_at).toLocaleString("zh-CN")}\n\n`;
      }

      // AI 摘要
      if (bookmark.ai_summary) {
        markdown += `**AI 摘要**：\n\n${bookmark.ai_summary}\n\n`;
      }

      // 描述
      if (bookmark.description) {
        markdown += `**描述**：\n\n${bookmark.description}\n\n`;
      }

      // AI 标签
      if (bookmark.ai_tags && bookmark.ai_tags.length > 0) {
        markdown += `**AI 标签**：${bookmark.ai_tags.map((tag) => `\`${tag}\``).join(" ")}\n\n`;
      }

      // 用户标签
      if (bookmark.user_tags && bookmark.user_tags.length > 0) {
        markdown += `**我的标签**：${bookmark.user_tags.map((tag) => `\`${tag}\``).join(" ")}\n\n`;
      }

      // 笔记
      if (bookmark.notes) {
        markdown += `**笔记**：\n\n${bookmark.notes}\n\n`;
      }

      markdown += "---\n\n";
    });
  });

  return markdown;
}

/**
 * 触发浏览器下载文件
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string = "text/markdown",
) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 生成导出文件名
 */
export function generateExportFilename(format: "md" | "json" = "md"): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = date.toTimeString().slice(0, 5).replace(/:/g, "");
  return `anykeep_export_${dateStr}_${timeStr}.${format}`;
}

/**
 * 将书签导出为 JSON 格式
 */
export function exportBookmarksToJSON(
  bookmarks: Array<Bookmark & { folders?: { name: string } | null }>,
): string {
  // 简化数据结构，只保留必要字段
  const simplified = bookmarks.map((bookmark) => ({
    url: bookmark.url,
    title: bookmark.title,
    description: bookmark.description,
    author: bookmark.author,
    platform: bookmark.platform,
    folderId: bookmark.folder_id,
    folderName: bookmark.folders?.name,
    aiSummary: bookmark.ai_summary,
    aiTags: bookmark.ai_tags,
    userTags: bookmark.user_tags,
    notes: bookmark.notes,
    coverUrl: bookmark.cover_url,
    createdAt: bookmark.created_at,
  }));

  return JSON.stringify(simplified, null, 2);
}
