/**
 * Folder Response DTOs
 *
 * 文件夹 API 响应数据结构
 *
 * @module contracts/responses
 */

/**
 * 文件夹基础响应
 */
export interface FolderResponse {
  id: number;
  name: string;
  parentId: number | null;
  folderGroup: string | null;
  isArchived: boolean;
  isSystem: boolean;
  systemType: string | null;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string | null;
}

/**
 * 带书签数量的文件夹响应
 */
export interface FolderWithCountResponse extends FolderResponse {
  bookmarkCount: number;
}

/**
 * 文件夹树节点响应
 */
export interface FolderTreeNodeResponse extends FolderWithCountResponse {
  children: FolderTreeNodeResponse[];
  path: string[];
}

/**
 * 文件夹列表响应
 */
export interface FolderListResponse {
  folders: FolderWithCountResponse[];
  total: number;
}

/**
 * 文件夹树响应
 */
export interface FolderTreeResponse {
  tree: FolderTreeNodeResponse[];
  total: number;
}

/**
 * 文件夹路径响应
 */
export interface FolderPathResponse {
  path: FolderResponse[];
}
