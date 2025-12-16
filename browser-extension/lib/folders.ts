/**
 * AnyKeep 浏览器扩展 - 文件夹管理
 * 获取用户文件夹列表用于收藏时选择
 */

import { api } from "./api";

/** 文件夹树节点 */
export interface FolderTreeNode {
  id: number;
  name: string;
  parentId: number | null;
  children: FolderTreeNode[];
  bookmarkCount?: number;
}

/** 展平的文件夹项（用于下拉列表） */
export interface FlatFolderItem {
  id: number;
  name: string;
  depth: number;
  fullPath: string;
}

/**
 * 获取用户文件夹树
 */
export async function getFolders(): Promise<FolderTreeNode[]> {
  try {
    const response = await api.get<FolderTreeNode[]>("/api/folders");
    return response.data ?? [];
  } catch (error) {
    console.error("[Folders] Failed to fetch folders:", error);
    return [];
  }
}

/**
 * 展平文件夹树为列表（用于简单下拉选择）
 * @param folders 文件夹树
 * @param depth 当前深度
 * @param parentPath 父级路径
 */
export function flattenFolders(
  folders: FolderTreeNode[],
  depth = 0,
  parentPath = "",
): FlatFolderItem[] {
  const result: FlatFolderItem[] = [];

  for (const folder of folders) {
    const fullPath = parentPath
      ? `${parentPath} / ${folder.name}`
      : folder.name;

    result.push({
      id: folder.id,
      name: folder.name,
      depth,
      fullPath,
    });

    if (folder.children?.length) {
      result.push(...flattenFolders(folder.children, depth + 1, fullPath));
    }
  }

  return result;
}

/**
 * 根据 ID 查找文件夹
 */
export function findFolderById(
  folders: FolderTreeNode[],
  id: number,
): FolderTreeNode | null {
  for (const folder of folders) {
    if (folder.id === id) {
      return folder;
    }
    if (folder.children?.length) {
      const found = findFolderById(folder.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 获取文件夹完整路径
 */
export function getFolderPath(folders: FolderTreeNode[], id: number): string {
  const flat = flattenFolders(folders);
  const item = flat.find((f) => f.id === id);
  return item?.fullPath ?? "";
}

const foldersApi = {
  getFolders,
  flattenFolders,
  findFolderById,
  getFolderPath,
};

export default foldersApi;
