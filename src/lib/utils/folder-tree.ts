/**
 * 文件夹树工具函数
 *
 * 提供文件夹树形结构的扁平化、缩进显示、搜索过滤等通用能力。
 * 从 move-to-folder-dialog.tsx 提取为共享模块，供 FolderCombobox 等组件复用。
 *
 * @module folder-tree
 */

import type { FolderTreeNode } from "@/types/supabase";

/**
 * 扁平化文件夹项（带层级信息）
 */
export interface FlattenedFolder {
  id: number;
  name: string;
  /** 层级深度（0 为根节点） */
  level: number;
}

/**
 * 递归扁平化文件夹树，添加层级信息。
 * 按深度优先顺序遍历，跳过系统文件夹（is_system = true）。
 */
export function flattenFolderTree(
  nodes: FolderTreeNode[],
  level: number = 0,
): FlattenedFolder[] {
  const result: FlattenedFolder[] = [];

  for (const node of nodes) {
    // 跳过系统文件夹（INBOX 等）
    if (node.is_system) {
      continue;
    }

    result.push({
      id: node.id,
      name: node.name,
      level,
    });

    // 递归处理子文件夹
    if (node.children && node.children.length > 0) {
      result.push(...flattenFolderTree(node.children, level + 1));
    }
  }

  return result;
}

/**
 * 生成带缩进的文件夹名称（用于纯文本场景，如 Select 选项）。
 * 使用全角空格实现视觉缩进。
 */
export function getIndentedName(folder: FlattenedFolder): string {
  const indent = "\u3000".repeat(folder.level); // 全角空格
  return `${indent}${folder.name}`;
}

/**
 * 搜索过滤（层级感知）：匹配子节点时自动包含祖先路径。
 *
 * 算法利用 DFS 扁平列表的顺序特性：祖先节点一定在子节点之前，
 * 因此可以通过向前回溯找到每个匹配节点的所有祖先。
 *
 * @returns list - 过滤后的文件夹列表（保持原序）
 * @returns matchedIds - 直接匹配的节点 ID 集合（用于 UI 高亮区分）
 */
export function filterFoldersWithAncestors(
  flatList: FlattenedFolder[],
  query: string,
): { list: FlattenedFolder[]; matchedIds: Set<number> } {
  if (!query.trim()) {
    return { list: flatList, matchedIds: new Set() };
  }

  const q = query.trim().toLowerCase();
  const matchedIds = new Set<number>();

  // 第一轮：标记直接匹配���节点
  for (const folder of flatList) {
    if (folder.name.toLowerCase().includes(q)) {
      matchedIds.add(folder.id);
    }
  }

  // 第二轮：回溯祖先 — 利用扁平列表的 DFS 顺序
  const ancestorIds = new Set<number>();
  for (let i = 0; i < flatList.length; i++) {
    if (matchedIds.has(flatList[i].id) && flatList[i].level > 0) {
      let currentLevel = flatList[i].level;
      for (let j = i - 1; j >= 0 && currentLevel > 0; j--) {
        if (flatList[j].level === currentLevel - 1) {
          ancestorIds.add(flatList[j].id);
          currentLevel--;
        }
      }
    }
  }

  // 合并匹配节点和祖先节点，保持原序
  const resultIds = new Set([...matchedIds, ...ancestorIds]);
  return {
    list: flatList.filter((f) => resultIds.has(f.id)),
    matchedIds,
  };
}
