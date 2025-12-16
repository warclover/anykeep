/**
 * Folder List Hook
 * 文件夹列表获取 Hook（用于下拉选择器）
 *
 * @description
 * 轻量级 hook，只获取文件夹基本信息用于下拉选择
 * - 支持缓存，避免重复请求
 * - 扁平化列表，带层级缩进前缀
 *
 * @version 1.0.0
 * @since 2025-12-16
 */

import { useState, useEffect, useCallback, useRef } from "react";

/** 文件夹选项类型 */
export interface FolderOption {
  id: number;
  name: string;
  /** 显示名称（带层级缩进） */
  displayName: string;
  /** 层级深度 */
  depth: number;
  /** 是否为系统文件夹 */
  isSystem: boolean;
}

interface FolderListState {
  folders: FolderOption[];
  isLoading: boolean;
  error: string | null;
}

/** API 返回的文件夹节点类型 */
interface ApiFolderNode {
  id: number;
  name: string;
  parent_id: number | null;
  is_system: boolean;
  children?: ApiFolderNode[];
}

/**
 * 文件夹列表 Hook
 * @returns 文件夹选项列表、加载状态、错误信息
 */
export function useFolderList() {
  const [state, setState] = useState<FolderListState>({
    folders: [],
    isLoading: true,
    error: null,
  });

  // 缓存标记，避免重复请求
  const fetchedRef = useRef(false);

  const fetchFolders = useCallback(async () => {
    // 已经请求过则跳过（除非手动 refetch）
    if (fetchedRef.current) {
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch("/api/folders");
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || "获取文件夹失败");
      }

      // 将树形结构扁平化为选项列表
      const options = flattenFolderTree(result.data || []);
      fetchedRef.current = true;

      setState({
        folders: options,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "获取文件夹失败",
      }));
    }
  }, []);

  const refetch = useCallback(() => {
    fetchedRef.current = false;
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  return {
    ...state,
    refetch,
  };
}

/**
 * 将文件夹树扁平化为选项列表
 * @param tree - 文件夹树
 * @param depth - 当前深度
 * @returns 扁平化的文件夹选项列表
 */
function flattenFolderTree(
  tree: ApiFolderNode[],
  depth: number = 0,
): FolderOption[] {
  const result: FolderOption[] = [];

  // 系统文件夹排在前面
  const sorted = [...tree].sort((a, b) => {
    if (a.is_system && !b.is_system) return -1;
    if (!a.is_system && b.is_system) return 1;
    return 0;
  });

  for (const folder of sorted) {
    // 生成带缩进的显示名称
    const prefix = depth > 0 ? "　".repeat(depth) + "└ " : "";
    const displayName = prefix + folder.name;

    result.push({
      id: folder.id,
      name: folder.name,
      displayName,
      depth,
      isSystem: folder.is_system,
    });

    // 递归处理子文件夹
    if (folder.children && folder.children.length > 0) {
      result.push(...flattenFolderTree(folder.children, depth + 1));
    }
  }

  return result;
}

export default useFolderList;
