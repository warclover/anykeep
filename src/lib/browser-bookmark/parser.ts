/**
 * Netscape Bookmark HTML 解析器
 * 解析 Chrome/Edge/Firefox/Safari 导出的书签文件
 */

import type { ParsedBookmarkNode, ParsedBookmarkFile } from "./types";
import { BROWSER_SOURCE_TO_PLATFORM } from "./types";
import { detectBrowserSource } from "./detector";

/**
 * 解析书签 HTML 文件
 *
 * @param fileName 文件名
 * @param htmlContent HTML 内容
 * @returns 解析后的书签文件对象
 * @throws Error 如果 HTML 格式无效
 */
export function parseBookmarkHtml(
  fileName: string,
  htmlContent: string,
): ParsedBookmarkFile {
  // 检测浏览器来源
  const source = detectBrowserSource(fileName, htmlContent);
  const platform = BROWSER_SOURCE_TO_PLATFORM[source];

  // 使用 DOMParser 解析 HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");

  // 查找根 DL 元素（书签列表容器）
  const rootDl = doc.querySelector("dl");
  if (!rootDl) {
    throw new Error("无效的书签文件格式：未找到书签列表 (DL 元素)");
  }

  // 统计变量
  let totalBookmarks = 0;
  let totalFolders = 0;
  let maxDepth = 0;

  /**
   * 递归解析书签列表
   */
  function parseBookmarkList(
    dl: Element,
    parentPath: string[],
    depth: number,
  ): ParsedBookmarkNode[] {
    const nodes: ParsedBookmarkNode[] = [];
    maxDepth = Math.max(maxDepth, depth);

    // 遍历 DL 的子元素
    const children = dl.children;
    for (let i = 0; i < children.length; i++) {
      const element = children[i];

      // 只处理 DT 元素
      if (element.tagName !== "DT") continue;

      // 检查是文件夹还是书签
      const h3 = element.querySelector(":scope > h3");
      const a = element.querySelector(":scope > a");
      const nestedDl = element.querySelector(":scope > dl");

      if (h3) {
        // 文件夹节点
        const folderName = h3.textContent?.trim() || "未命名文件夹";
        const path = [...parentPath, folderName];
        totalFolders++;

        nodes.push({
          type: "folder",
          title: folderName,
          addDate: parseTimestamp(h3.getAttribute("ADD_DATE")),
          lastModified: parseTimestamp(h3.getAttribute("LAST_MODIFIED")),
          children: nestedDl
            ? parseBookmarkList(nestedDl, path, depth + 1)
            : [],
          path,
          id: crypto.randomUUID(),
          depth,
        });
      } else if (a) {
        // 书签节点
        const title = a.textContent?.trim() || "未命名书签";
        const url = a.getAttribute("HREF") || "";
        const path = [...parentPath, title];
        totalBookmarks++;

        // 获取描述（下一个 DD 元素）
        let description: string | undefined;
        const nextSibling = element.nextElementSibling;
        if (nextSibling?.tagName === "DD") {
          description = nextSibling.textContent?.trim() || undefined;
        }

        nodes.push({
          type: "bookmark",
          title,
          url,
          addDate: parseTimestamp(a.getAttribute("ADD_DATE")),
          icon:
            a.getAttribute("ICON") || a.getAttribute("ICON_URI") || undefined,
          description,
          path,
          id: crypto.randomUUID(),
          depth,
        });
      }
    }

    return nodes;
  }

  // 解析根节点
  const roots = parseBookmarkList(rootDl, [], 1);

  return {
    fileName,
    source,
    platform,
    roots,
    totalBookmarks,
    totalFolders,
    maxDepth,
    parsedAt: new Date(),
  };
}

/**
 * 解析时间戳
 * Netscape 书签格式使用 Unix 时间戳（秒）
 */
function parseTimestamp(value: string | null): number | undefined {
  if (!value) return undefined;
  const timestamp = parseInt(value, 10);
  return isNaN(timestamp) ? undefined : timestamp;
}

/**
 * 将书签树扁平化为书签列表
 * 只返回书签节点，不返回文件夹节点
 *
 * @param nodes 书签树节点列表
 * @returns 扁平化的书签列表
 */
export function flattenBookmarks(
  nodes: ParsedBookmarkNode[],
): ParsedBookmarkNode[] {
  const result: ParsedBookmarkNode[] = [];

  function traverse(nodeList: ParsedBookmarkNode[]) {
    for (const node of nodeList) {
      if (node.type === "bookmark") {
        result.push(node);
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return result;
}

/**
 * 根据选中的 ID 过滤书签
 * 如果选中了文件夹，则包含其所有子书签
 *
 * @param nodes 书签树节点列表
 * @param selectedIds 选中的节点 ID 集合
 * @returns 过滤后的书签列表（仅书签节点）
 */
export function filterSelectedBookmarks(
  nodes: ParsedBookmarkNode[],
  selectedIds: Set<string>,
): ParsedBookmarkNode[] {
  const result: ParsedBookmarkNode[] = [];

  function traverse(nodeList: ParsedBookmarkNode[], parentSelected: boolean) {
    for (const node of nodeList) {
      const isSelected = parentSelected || selectedIds.has(node.id);

      if (node.type === "bookmark" && isSelected) {
        result.push(node);
      }

      if (node.children) {
        traverse(node.children, isSelected);
      }
    }
  }

  traverse(nodes, false);
  return result;
}

/**
 * 统计节点数量
 *
 * @param nodes 书签树节点列表
 * @returns 书签数量和文件夹数量
 */
export function countNodes(nodes: ParsedBookmarkNode[]): {
  bookmarks: number;
  folders: number;
} {
  let bookmarks = 0;
  let folders = 0;

  function traverse(nodeList: ParsedBookmarkNode[]) {
    for (const node of nodeList) {
      if (node.type === "bookmark") {
        bookmarks++;
      } else {
        folders++;
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return { bookmarks, folders };
}

/**
 * 获取选中节点的书签数量
 *
 * @param nodes 书签树节点列表
 * @param selectedIds 选中的节点 ID 集合
 * @returns 选中的书签数量
 */
export function countSelectedBookmarks(
  nodes: ParsedBookmarkNode[],
  selectedIds: Set<string>,
): number {
  return filterSelectedBookmarks(nodes, selectedIds).length;
}

/**
 * 检测最大层级深度
 *
 * @param nodes 书签树节点列表
 * @returns 最大层级深度
 */
export function getMaxDepth(nodes: ParsedBookmarkNode[]): number {
  let maxDepth = 0;

  function traverse(nodeList: ParsedBookmarkNode[]) {
    for (const node of nodeList) {
      maxDepth = Math.max(maxDepth, node.depth);
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return maxDepth;
}

/**
 * 获取超过指定深度的文件夹
 *
 * @param nodes 书签树节点列表
 * @param maxAllowedDepth 允许的最大深度
 * @returns 超过深度限制的文件夹列表
 */
export function getFoldersExceedingDepth(
  nodes: ParsedBookmarkNode[],
  maxAllowedDepth: number,
): Array<{ path: string[]; depth: number }> {
  const result: Array<{ path: string[]; depth: number }> = [];

  function traverse(nodeList: ParsedBookmarkNode[]) {
    for (const node of nodeList) {
      if (node.type === "folder" && node.depth > maxAllowedDepth) {
        result.push({ path: node.path, depth: node.depth });
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return result;
}

/**
 * 验证书签文件内容
 *
 * @param htmlContent HTML 内容
 * @returns 是否为有效的 Netscape 书签文件
 */
export function isValidBookmarkFile(htmlContent: string): boolean {
  // 检查 Netscape 书签文件标识
  const hasDoctype = htmlContent.includes(
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
  );
  const hasDlElement =
    htmlContent.includes("<DL>") || htmlContent.includes("<dl>");

  return hasDoctype || hasDlElement;
}
