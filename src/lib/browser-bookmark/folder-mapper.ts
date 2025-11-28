/**
 * 浏览器书签文件夹映射器
 * 将浏览器书签的文件夹结构映射到 AnyKeep 文件夹
 */

import type { ParsedBookmarkNode } from "./types";

/**
 * 文件夹映射项
 */
export interface FolderMapping {
  /** 浏览器书签中的路径（如 ['书签栏', '技术', 'React']） */
  browserPath: string[];
  /** AnyKeep 中对应的文件夹 ID */
  anykeepFolderId: number | null;
  /** 文件夹名称 */
  name: string;
  /** 父文件夹在浏览器中的路径 */
  parentPath: string[];
  /** 是否需要创建（false 表示已存在） */
  needsCreation: boolean;
  /** 层级深度 */
  depth: number;
}

/**
 * 文件夹创建请求
 */
export interface FolderCreateRequest {
  name: string;
  parentId: number | null;
  browserPath: string[];
}

/**
 * 文件夹映射结果
 */
export interface FolderMappingResult {
  /** 路径到文件夹 ID 的映射 */
  pathToFolderId: Map<string, number>;
  /** 需要创建的文件夹列表（按层级排序，浅层优先） */
  foldersToCreate: FolderCreateRequest[];
  /** 已存在的文件夹数量 */
  existingCount: number;
  /** 需要创建的文件夹数量 */
  createCount: number;
}

/**
 * 从书签节点中提取所有唯一的文件夹路径
 * @param nodes 书签树节点列表
 * @returns 所有唯一的文件夹路径集合
 */
export function extractFolderPaths(nodes: ParsedBookmarkNode[]): Set<string> {
  const paths = new Set<string>();

  function traverse(nodeList: ParsedBookmarkNode[], currentPath: string[]) {
    for (const node of nodeList) {
      if (node.type === "folder") {
        const folderPath = [...currentPath, node.title];
        paths.add(folderPath.join("/"));

        if (node.children) {
          traverse(node.children, folderPath);
        }
      }
    }
  }

  traverse(nodes, []);
  return paths;
}

/**
 * 从选中的书签中提取需要的文件夹路径（完整版）
 * @param nodes 书签树节点列表
 * @param selectedIds 选中的节点 ID 集合
 * @returns 需要的文件夹路径集合
 */
export function extractRequiredFolderPathsFromTree(
  nodes: ParsedBookmarkNode[],
  selectedIds: Set<string>,
): Set<string> {
  const paths = new Set<string>();

  function traverse(
    nodeList: ParsedBookmarkNode[],
    currentPath: string[],
    parentSelected: boolean,
  ) {
    for (const node of nodeList) {
      const isSelected = parentSelected || selectedIds.has(node.id);

      if (node.type === "folder") {
        const folderPath = [...currentPath, node.title];

        // 只有当文件夹下有选中的书签时才需要创建
        if (isSelected || hasSelectedDescendant(node, selectedIds)) {
          // 添加当前文件夹及所有父路径
          for (let i = 1; i <= folderPath.length; i++) {
            paths.add(folderPath.slice(0, i).join("/"));
          }
        }

        if (node.children) {
          traverse(node.children, folderPath, isSelected);
        }
      }
    }
  }

  traverse(nodes, [], false);
  return paths;
}

/**
 * 从已过滤的书签列表中提取需要的文件夹路径
 * @param bookmarks 已过滤的书签列表（仅书签节点）
 * @returns 需要的文件夹路径集合
 */
export function extractRequiredFolderPaths(
  bookmarks: ParsedBookmarkNode[],
): Set<string> {
  const paths = new Set<string>();

  for (const bookmark of bookmarks) {
    // 书签的 path 包含自身，需要取 path.slice(0, -1) 作为文件夹路径
    const folderPath = bookmark.path.slice(0, -1);

    if (folderPath.length === 0) continue;

    // 添加所有层级的路径
    for (let i = 1; i <= folderPath.length; i++) {
      paths.add(folderPath.slice(0, i).join("/"));
    }
  }

  return paths;
}

/**
 * 检查节点是否有选中的后代
 */
function hasSelectedDescendant(
  node: ParsedBookmarkNode,
  selectedIds: Set<string>,
): boolean {
  if (node.type === "bookmark") {
    return selectedIds.has(node.id);
  }

  if (node.children) {
    return node.children.some(
      (child) =>
        selectedIds.has(child.id) || hasSelectedDescendant(child, selectedIds),
    );
  }

  return false;
}

/**
 * 构建文件夹映射
 * @param requiredPaths 需要的文件夹路径集合
 * @param existingFolders 已存在的 AnyKeep 文件夹列表
 * @param targetFolderId 目标父文件夹 ID（导入到哪个文件夹下）
 * @returns 文件夹映射结果
 */
export function buildFolderMapping(
  requiredPaths: Set<string>,
  existingFolders: Array<{
    id: number;
    name: string;
    parent_id: number | null;
  }>,
  targetFolderId: number | null = null,
): FolderMappingResult {
  const pathToFolderId = new Map<string, number>();
  const foldersToCreate: FolderCreateRequest[] = [];

  // 构建现有文件夹的名称到 ID 映射（仅在目标文件夹下）
  const existingByName = new Map<string, number>();
  for (const folder of existingFolders) {
    // 简化匹配：只按名称匹配根级文件夹
    if (folder.parent_id === targetFolderId) {
      existingByName.set(folder.name, folder.id);
    }
  }

  // 将路径转换为数组并按深度排序
  const sortedPaths = Array.from(requiredPaths)
    .map((path) => path.split("/"))
    .sort((a, b) => a.length - b.length);

  for (const pathParts of sortedPaths) {
    const pathKey = pathParts.join("/");
    const name = pathParts[pathParts.length - 1];
    const depth = pathParts.length;

    // 检查是否已经有映射
    if (pathToFolderId.has(pathKey)) {
      continue;
    }

    // 确定父文件夹 ID
    let parentId: number | null = targetFolderId;
    if (depth > 1) {
      const parentPath = pathParts.slice(0, -1).join("/");
      parentId = pathToFolderId.get(parentPath) ?? targetFolderId;
    }

    // 检查是否已存在同名文件夹
    // 对于第一级，检查 existingByName
    // 对于更深层级，假设需要创建（因为结构可能不同）
    if (depth === 1 && existingByName.has(name)) {
      pathToFolderId.set(pathKey, existingByName.get(name)!);
    } else {
      // 需要创建，先用临时 ID（负数）
      const tempId = -(foldersToCreate.length + 1);
      pathToFolderId.set(pathKey, tempId);

      foldersToCreate.push({
        name,
        parentId,
        browserPath: pathParts,
      });
    }
  }

  // 计算统计
  const existingCount = sortedPaths.length - foldersToCreate.length;
  const createCount = foldersToCreate.length;

  return {
    pathToFolderId,
    foldersToCreate,
    existingCount,
    createCount,
  };
}

/**
 * 更新映射中的临时 ID 为真实 ID
 * @param mapping 原始映射结果
 * @param createdFolders 创建后的文件夹列表（按创建顺序）
 * @returns 更新后的映射结果
 */
export function updateMappingWithCreatedFolders(
  mapping: FolderMappingResult,
  createdFolders: Array<{ id: number; browserPath: string[] }>,
): FolderMappingResult {
  // 创建新的 Map 以避免直接修改原对象
  const newPathToFolderId = new Map(mapping.pathToFolderId);

  for (const folder of createdFolders) {
    const pathKey = folder.browserPath.join("/");
    newPathToFolderId.set(pathKey, folder.id);
  }

  return {
    ...mapping,
    pathToFolderId: newPathToFolderId,
  };
}

/**
 * 获取书签应该归属的文件夹 ID
 * @param bookmark 书签节点
 * @param mapping 文件夹映射
 * @param defaultFolderId 默认目标文件夹 ID（可选，默认为 null）
 * @returns 文件夹 ID
 */
export function getFolderIdForBookmark(
  bookmark: ParsedBookmarkNode,
  mapping: FolderMappingResult,
  defaultFolderId: number | null = null,
): number | null {
  // 书签的路径不包含自身，所以使用 path 的前 n-1 个元素
  const folderPath = bookmark.path.slice(0, -1);

  if (folderPath.length === 0) {
    return defaultFolderId;
  }

  const pathKey = folderPath.join("/");
  const folderId = mapping.pathToFolderId.get(pathKey);

  // 如果找到映射且不是临时 ID（负数），返回真实 ID
  if (folderId !== undefined && folderId > 0) {
    return folderId;
  }

  return defaultFolderId;
}

/**
 * 生成文件夹创建摘要
 */
export function generateFolderSummary(mapping: FolderMappingResult): string {
  if (mapping.createCount === 0) {
    return `将使用 ${mapping.existingCount} 个已有文件夹`;
  }

  if (mapping.existingCount === 0) {
    return `将创建 ${mapping.createCount} 个新文件夹`;
  }

  return `将创建 ${mapping.createCount} 个新文件夹，复用 ${mapping.existingCount} 个已有文件夹`;
}
