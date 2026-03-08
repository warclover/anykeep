/**
 * Folder Repository
 *
 * 文件夹数据访问层，封装所有文件夹相关的数据库操作
 *
 * @module repositories
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type {
  GetFolderDescendantIdsParams,
  CascadeDeleteFolderParams,
  CascadeDeleteFolderReturn,
  FolderWithCountRow,
} from "@/types/rpc-manual";
import { BaseRepository } from "./base.repository";

// Type aliases
type FolderRow = Database["public"]["Tables"]["folders"]["Row"];
type FolderInsert = Database["public"]["Tables"]["folders"]["Insert"];
type FolderUpdate = Database["public"]["Tables"]["folders"]["Update"];

/**
 * 文件夹与书签数量
 */
export interface FolderWithCount extends FolderRow {
  bookmarkCount: number;
}

/**
 * 文件夹树节点
 */
export interface FolderTreeNode extends FolderRow {
  children: FolderTreeNode[];
  bookmarkCount?: number;
}

/**
 * Folder Repository
 */
export class FolderRepository extends BaseRepository<
  FolderRow,
  FolderInsert,
  FolderUpdate
> {
  protected readonly tableName = "folders" as const;

  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, userId, "FolderRepository");
  }

  /**
   * 获取所有文件夹（扁平列表）
   */
  async findAll(options?: {
    includeArchived?: boolean;
    includeSystem?: boolean;
  }): Promise<FolderRow[]> {
    const { includeArchived = false, includeSystem = true } = options ?? {};

    let query = this.supabase
      .from(this.tableName)
      .select()
      .eq("user_id", this.userId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (!includeArchived) {
      query = query.eq("is_archived", false);
    }

    if (!includeSystem) {
      query = query.or("is_system.is.null,is_system.eq.false");
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error({ error }, "Failed to find all folders");
      throw error;
    }

    return data || [];
  }

  /**
   * 获取文件夹及书签数量
   *
   * 优先使用 RPC 函数获取，如果不可用则回退到手动计算
   */
  async findAllWithCounts(): Promise<FolderWithCount[]> {
    try {
      // 使用类型安全的 RPC 调用
      const { data, error } = await this.supabase.rpc(
        "get_folders_with_counts",
        {
          p_user_id: this.userId,
        },
      );

      if (!error && data) {
        return (data as FolderWithCountRow[]).map((row) => ({
          ...row,
          bookmarkCount: row.bookmarkCount,
        })) as FolderWithCount[];
      }

      // RPC 不可用，回退到手动计算
      this.logger.debug(
        "RPC get_folders_with_counts not available, using fallback",
      );
      return this.findAllWithCountsFallback();
    } catch {
      // 出错时回退到手动计算
      return this.findAllWithCountsFallback();
    }
  }

  /**
   * 备用：手动获取文件夹及数量
   */
  private async findAllWithCountsFallback(): Promise<FolderWithCount[]> {
    const folders = await this.findAll();

    // 获取每个文件夹的书签数量
    const countPromises = folders.map(async (folder) => {
      const { count } = await this.supabase
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", this.userId)
        .eq("folder_id", folder.id)
        .is("deleted_at", null)
        .eq("is_in_trash", false);

      return {
        ...folder,
        bookmarkCount: count || 0,
      };
    });

    return Promise.all(countPromises);
  }

  /**
   * 构建文件夹树
   */
  async getTree(): Promise<FolderTreeNode[]> {
    const folders = await this.findAllWithCounts();
    return this.buildTree(folders);
  }

  /**
   * 构建树结构
   */
  private buildTree(folders: FolderWithCount[]): FolderTreeNode[] {
    const nodeMap = new Map<number, FolderTreeNode>();
    const roots: FolderTreeNode[] = [];

    // 创建节点映射
    for (const folder of folders) {
      nodeMap.set(folder.id, {
        ...folder,
        children: [],
        bookmarkCount: folder.bookmarkCount,
      });
    }

    // 构建树
    for (const folder of folders) {
      const node = nodeMap.get(folder.id);
      if (!node) continue;

      if (folder.parent_id) {
        const parent = nodeMap.get(folder.parent_id);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * 根据名称查找文件夹
   */
  async findByName(
    name: string,
    parentId?: number | null,
  ): Promise<FolderRow | null> {
    let query = this.supabase
      .from(this.tableName)
      .select()
      .eq("user_id", this.userId)
      .eq("name", name)
      .is("deleted_at", null);

    if (parentId !== undefined) {
      if (parentId === null) {
        query = query.is("parent_id", null);
      } else {
        query = query.eq("parent_id", parentId);
      }
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      this.logger.error({ error, name }, "Failed to find folder by name");
      throw error;
    }

    return data;
  }

  /**
   * 获取子文件夹
   */
  async getChildren(parentId: number | null): Promise<FolderRow[]> {
    let query = this.supabase
      .from(this.tableName)
      .select()
      .eq("user_id", this.userId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (parentId === null) {
      query = query.is("parent_id", null);
    } else {
      query = query.eq("parent_id", parentId);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error({ error, parentId }, "Failed to get children");
      throw error;
    }

    return data || [];
  }

  /**
   * 获取祖先路径
   */
  async getAncestors(folderId: number): Promise<FolderRow[]> {
    const ancestors: FolderRow[] = [];
    let currentId: number | null = folderId;

    while (currentId !== null) {
      const folder = await this.findById(currentId);

      if (!folder) break;

      // 跳过当前文件夹
      if (folder.id !== folderId) {
        ancestors.unshift(folder);
      }

      currentId = folder.parent_id;
    }

    return ancestors;
  }

  /**
   * 移动文件夹
   */
  async move(
    id: number,
    newParentId: number | null,
  ): Promise<FolderRow | null> {
    // 检查循环引用
    if (newParentId !== null) {
      const descendants = await this.getAllDescendantIds(id);
      if (descendants.includes(newParentId)) {
        throw new Error("Cannot move folder to its own descendant");
      }
    }

    return this.update(id, { parent_id: newParentId });
  }

  /**
   * 获取所有后代 ID（使用 RPC 优化性能）
   */
  async getAllDescendantIds(folderId: number): Promise<number[]> {
    try {
      // 使用类型安全的 RPC 调用
      const { data, error } = await this.supabase.rpc(
        "get_folder_descendant_ids" as keyof Database["public"]["Functions"],
        {
          p_folder_id: folderId,
          p_user_id: this.userId,
        } as GetFolderDescendantIdsParams,
      );

      if (error) {
        this.logger.warn(
          { error, folderId },
          "RPC get_folder_descendant_ids failed, using fallback",
        );
        return this.getAllDescendantIdsFallback(folderId);
      }

      return (data as number[]) || [];
    } catch {
      // intentionally empty: RPC 不可用时回退到递归查询
      return this.getAllDescendantIdsFallback(folderId);
    }
  }

  /**
   * 获取所有后代 ID（回退方法）
   */
  private async getAllDescendantIdsFallback(
    folderId: number,
  ): Promise<number[]> {
    const ids: number[] = [];
    const queue = [folderId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (currentId === undefined) break;
      const children = await this.getChildren(currentId);

      for (const child of children) {
        ids.push(child.id);
        queue.push(child.id);
      }
    }

    return ids;
  }

  /**
   * 级联删除文件夹（事务性 RPC）
   *
   * 原子操作：移动书签到根目录 + 软删除所有后代文件夹
   */
  async cascadeDelete(
    id: number,
  ): Promise<{ deletedFolders: number; movedBookmarks: number }> {
    try {
      // 使用类型安全的 RPC 调用
      const { data, error } = await this.supabase.rpc(
        "cascade_delete_folder" as keyof Database["public"]["Functions"],
        {
          p_folder_id: id,
          p_user_id: this.userId,
        } as CascadeDeleteFolderParams,
      );

      if (error) {
        this.logger.error({ error, id }, "RPC cascade_delete_folder failed");
        throw error;
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        return { deletedFolders: 0, movedBookmarks: 0 };
      }

      const result = (Array.isArray(data)
        ? data[0]
        : data) as unknown as CascadeDeleteFolderReturn;
      return {
        deletedFolders: result.deleted_folder_count || 0,
        movedBookmarks: result.moved_bookmark_count || 0,
      };
    } catch (err) {
      this.logger.error({ error: err, id }, "Cascade delete failed");
      throw err;
    }
  }

  /**
   * 归档文件夹
   */
  async archive(id: number): Promise<boolean> {
    const { error, count } = await this.supabase
      .from(this.tableName)
      .update({ is_archived: true })
      .eq("id", id)
      .eq("user_id", this.userId);

    if (error) {
      this.logger.error({ error, id }, "Failed to archive folder");
      throw error;
    }

    return (count ?? 0) > 0;
  }

  /**
   * 取消归档文件夹
   */
  async unarchive(id: number): Promise<boolean> {
    const { error, count } = await this.supabase
      .from(this.tableName)
      .update({ is_archived: false })
      .eq("id", id)
      .eq("user_id", this.userId);

    if (error) {
      this.logger.error({ error, id }, "Failed to unarchive folder");
      throw error;
    }

    return (count ?? 0) > 0;
  }

  /**
   * 更新排序顺序
   */
  async updateSortOrder(
    orderings: Array<{ id: number; sortOrder: number }>,
  ): Promise<void> {
    for (const { id, sortOrder } of orderings) {
      await this.update(id, { sort_order: sortOrder });
    }
  }
}
