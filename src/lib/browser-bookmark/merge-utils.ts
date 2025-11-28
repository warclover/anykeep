/**
 * 书签合并去重工具函数
 * 用于多文件导入时合并和去重书签
 */

import type { ParsedBookmarkFile, ParsedBookmarkNode } from "./types";

/** 合并结果 */
export interface MergeResult {
  /** 合并后的书签树 */
  roots: ParsedBookmarkNode[];
  /** 总书签数（去重后） */
  totalBookmarks: number;
  /** 总文件夹数 */
  totalFolders: number;
  /** 原始书签数（去重前） */
  originalCount: number;
  /** 重复书签数 */
  duplicateCount: number;
  /** 来源文件数量 */
  sourceFilesCount: number;
  /** 各来源的书签数量 */
  sourceBreakdown: Array<{
    fileName: string;
    bookmarkCount: number;
    duplicateCount: number;
  }>;
}

/**
 * 合并多个书签文件，去除重复
 * @param files 解析后的书签文件列表
 * @returns 合并结果
 */
export function mergeBookmarkFiles(files: ParsedBookmarkFile[]): MergeResult {
  if (files.length === 0) {
    return {
      roots: [],
      totalBookmarks: 0,
      totalFolders: 0,
      originalCount: 0,
      duplicateCount: 0,
      sourceFilesCount: 0,
      sourceBreakdown: [],
    };
  }

  // 如果只有一个文件，直接返回
  if (files.length === 1) {
    return {
      roots: files[0].roots,
      totalBookmarks: files[0].totalBookmarks,
      totalFolders: files[0].totalFolders,
      originalCount: files[0].totalBookmarks,
      duplicateCount: 0,
      sourceFilesCount: 1,
      sourceBreakdown: [
        {
          fileName: files[0].fileName,
          bookmarkCount: files[0].totalBookmarks,
          duplicateCount: 0,
        },
      ],
    };
  }

  // 用于追踪已存在的 URL
  const seenUrls = new Set<string>();
  const sourceBreakdown: MergeResult["sourceBreakdown"] = [];

  // 合并后的根节点
  const mergedRoots: ParsedBookmarkNode[] = [];

  // 遍历每个文件
  for (const file of files) {
    let fileBookmarkCount = 0;
    let fileDuplicateCount = 0;

    // 深度复制并过滤重复的书签
    const processedRoots = deduplicateNodes(
      file.roots,
      seenUrls,
      (isDuplicate) => {
        if (isDuplicate) {
          fileDuplicateCount++;
        } else {
          fileBookmarkCount++;
        }
      },
    );

    // 将处理后的根节点添加到合并结果
    mergedRoots.push(...processedRoots);

    sourceBreakdown.push({
      fileName: file.fileName,
      bookmarkCount: fileBookmarkCount,
      duplicateCount: fileDuplicateCount,
    });
  }

  // 计算统计
  const { bookmarks, folders } = countNodesInTree(mergedRoots);

  return {
    roots: mergedRoots,
    totalBookmarks: bookmarks,
    totalFolders: folders,
    originalCount: files.reduce((sum, f) => sum + f.totalBookmarks, 0),
    duplicateCount: sourceBreakdown.reduce(
      (sum, s) => sum + s.duplicateCount,
      0,
    ),
    sourceFilesCount: files.length,
    sourceBreakdown,
  };
}

/**
 * 去重节点树
 * @param nodes 节点列表
 * @param seenUrls 已见过的 URL 集合
 * @param onBookmark 书签回调（用于统计）
 * @returns 去重后的节点列表
 */
function deduplicateNodes(
  nodes: ParsedBookmarkNode[],
  seenUrls: Set<string>,
  onBookmark?: (isDuplicate: boolean) => void,
): ParsedBookmarkNode[] {
  const result: ParsedBookmarkNode[] = [];

  for (const node of nodes) {
    if (node.type === "bookmark") {
      // 书签节点：检查 URL 是否重复
      const url = node.url?.toLowerCase().trim();
      if (url) {
        const isDuplicate = seenUrls.has(url);
        onBookmark?.(isDuplicate);

        if (!isDuplicate) {
          seenUrls.add(url);
          result.push({ ...node });
        }
      } else {
        // 无 URL 的书签，保留但不计入重复
        result.push({ ...node });
      }
    } else if (node.type === "folder") {
      // 文件夹节点：递归处理子节点
      const deduplicatedChildren = node.children
        ? deduplicateNodes(node.children, seenUrls, onBookmark)
        : [];

      // 只保留有内容的文件夹
      if (deduplicatedChildren.length > 0) {
        result.push({
          ...node,
          children: deduplicatedChildren,
        });
      }
    }
  }

  return result;
}

/**
 * 统计节点树中的书签和文件夹数量
 */
function countNodesInTree(nodes: ParsedBookmarkNode[]): {
  bookmarks: number;
  folders: number;
} {
  let bookmarks = 0;
  let folders = 0;

  function traverse(nodeList: ParsedBookmarkNode[]) {
    for (const node of nodeList) {
      if (node.type === "bookmark") {
        bookmarks++;
      } else if (node.type === "folder") {
        folders++;
        if (node.children) {
          traverse(node.children);
        }
      }
    }
  }

  traverse(nodes);
  return { bookmarks, folders };
}

/**
 * 生成去重摘要文本
 */
export function generateMergeSummary(result: MergeResult): string {
  if (result.sourceFilesCount === 1) {
    return `共 ${result.totalBookmarks} 个书签`;
  }

  const parts: string[] = [];
  parts.push(`合并 ${result.sourceFilesCount} 个文件`);
  parts.push(`共 ${result.totalBookmarks} 个书签`);

  if (result.duplicateCount > 0) {
    parts.push(`已去除 ${result.duplicateCount} 个重复`);
  }

  return parts.join("，");
}
