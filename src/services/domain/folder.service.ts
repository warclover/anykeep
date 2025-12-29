/**
 * Folder Service
 *
 * 文件夹业务逻辑层
 *
 * @module services/domain
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { BaseService, ServiceError } from "../core/base.service";
import type {
  FolderWithCount,
  FolderTreeNode,
} from "@/repositories/folder.repository";
import { FolderRepository } from "@/repositories/folder.repository";
import type {
  CreateFolderInput,
  UpdateFolderInput,
} from "@/contracts/schemas/folder.schema";
import type {
  FolderResponse,
  FolderWithCountResponse,
  FolderTreeNodeResponse,
  FolderListResponse,
  FolderTreeResponse,
  FolderPathResponse,
} from "@/contracts/responses/folder.response";

// Type alias
type FolderRow = Database["public"]["Tables"]["folders"]["Row"];

/**
 * Folder Service
 */
export class FolderService extends BaseService {
  private readonly repository: FolderRepository;

  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, userId, "FolderService");
    this.repository = new FolderRepository(supabase, userId);
  }

  /**
   * 获取文件夹列表（扁平）
   */
  async list(options?: {
    includeArchived?: boolean;
    includeSystem?: boolean;
  }): Promise<FolderListResponse> {
    return this.withLogging("list", async () => {
      const folders = await this.repository.findAllWithCounts();

      // 应用过滤
      let filtered = folders;

      if (!options?.includeArchived) {
        filtered = filtered.filter((f) => !f.is_archived);
      }

      if (!options?.includeSystem) {
        filtered = filtered.filter((f) => !f.is_system);
      }

      return {
        folders: filtered.map(this.toWithCountResponse),
        total: filtered.length,
      };
    });
  }

  /**
   * 获取文件夹树
   */
  async getTree(): Promise<FolderTreeResponse> {
    return this.withLogging("getTree", async () => {
      const tree = await this.repository.getTree();

      return {
        tree: tree.map((node) => this.toTreeNodeResponse(node, [])),
        total: this.countTreeNodes(tree),
      };
    });
  }

  /**
   * 获取单个文件夹
   */
  async getById(id: number): Promise<FolderWithCountResponse> {
    return this.withLogging(
      "getById",
      async () => {
        const folder = await this.repository.findById(id);

        if (!folder) {
          throw new ServiceError("NOT_FOUND", `Folder ${id} not found`);
        }

        // 获取书签数量
        const { count } = await this.supabase
          .from("bookmarks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", this.userId)
          .eq("folder_id", id)
          .is("deleted_at", null)
          .eq("is_in_trash", false);

        return this.toWithCountResponse({
          ...folder,
          bookmarkCount: count || 0,
        });
      },
      { id },
    );
  }

  /**
   * 创建文件夹
   */
  async create(input: CreateFolderInput): Promise<FolderResponse> {
    return this.withLogging(
      "create",
      async () => {
        // 检查同名文件夹
        const existing = await this.repository.findByName(
          input.name,
          input.parentId,
        );
        if (existing) {
          throw new ServiceError(
            "DUPLICATE",
            "Folder with this name already exists in the same location",
          );
        }

        // 验证父文件夹存在
        if (input.parentId) {
          const parent = await this.repository.findById(input.parentId);
          if (!parent) {
            throw new ServiceError("NOT_FOUND", "Parent folder not found");
          }
        }

        const folder = await this.repository.create({
          name: input.name,
          parent_id: input.parentId,
          folder_group: input.folderGroup,
          user_id: this.userId,
          is_archived: false,
        });

        return this.toResponse(folder);
      },
      { name: input.name },
    );
  }

  /**
   * 更新文件夹
   */
  async update(id: number, input: UpdateFolderInput): Promise<FolderResponse> {
    return this.withLogging(
      "update",
      async () => {
        // 检查名称冲突
        if (input.name) {
          const current = await this.repository.findById(id);
          if (!current) {
            throw new ServiceError("NOT_FOUND", `Folder ${id} not found`);
          }

          const parentId =
            input.parentId !== undefined ? input.parentId : current.parent_id;
          const existing = await this.repository.findByName(
            input.name,
            parentId,
          );

          if (existing && existing.id !== id) {
            throw new ServiceError(
              "DUPLICATE",
              "Folder with this name already exists in the same location",
            );
          }
        }

        const updateData: Database["public"]["Tables"]["folders"]["Update"] =
          {};

        if (input.name !== undefined) updateData.name = input.name;
        if (input.parentId !== undefined) updateData.parent_id = input.parentId;
        if (input.isArchived !== undefined)
          updateData.is_archived = input.isArchived;
        if (input.sortOrder !== undefined)
          updateData.sort_order = input.sortOrder;

        const folder = await this.repository.update(id, updateData);

        if (!folder) {
          throw new ServiceError("NOT_FOUND", `Folder ${id} not found`);
        }

        return this.toResponse(folder);
      },
      { id },
    );
  }

  /**
   * 删除文件夹
   *
   * cascade=true 时使用事务性 RPC 确保原子性
   */
  async delete(id: number, options?: { cascade?: boolean }): Promise<void> {
    return this.withLogging(
      "delete",
      async () => {
        const folder = await this.repository.findById(id);

        if (!folder) {
          throw new ServiceError("NOT_FOUND", `Folder ${id} not found`);
        }

        // 检查是否为系统文件夹
        if (folder.is_system) {
          throw new ServiceError("FORBIDDEN", "Cannot delete system folder");
        }

        // 检查是否有子文件夹
        const children = await this.repository.getChildren(id);
        if (children.length > 0 && !options?.cascade) {
          throw new ServiceError(
            "VALIDATION",
            "Folder has children. Use cascade=true to delete all.",
          );
        }

        // 检查是否有书签
        const { count } = await this.supabase
          .from("bookmarks")
          .select("id", { count: "exact", head: true })
          .eq("folder_id", id)
          .eq("user_id", this.userId)
          .is("deleted_at", null);

        if ((count ?? 0) > 0 && !options?.cascade) {
          throw new ServiceError(
            "VALIDATION",
            "Folder has bookmarks. Use cascade=true to move them to root.",
          );
        }

        // 级联删除 - 使用事务性 RPC
        if (options?.cascade) {
          try {
            const result = await this.repository.cascadeDelete(id);
            this.logger.info(
              { id, ...result },
              "Cascade delete completed via RPC",
            );
            return;
          } catch (err) {
            // RPC 失败时回退到手动级联删除
            this.logger.warn(
              { err, id },
              "Cascade delete RPC failed, using fallback",
            );
            await this.cascadeDeleteFallback(id, children);
            return;
          }
        }

        // 非级联删除 - 直接软删除
        await this.repository.softDelete(id);
      },
      { id },
    );
  }

  /**
   * 级联删除回退方法（非事务性）
   */
  private async cascadeDeleteFallback(
    id: number,
    children: Array<{ id: number }>,
  ): Promise<void> {
    // 移动书签到根目录
    await this.supabase
      .from("bookmarks")
      .update({ folder_id: null })
      .eq("folder_id", id)
      .eq("user_id", this.userId);

    // 递归删除子文件夹
    for (const child of children) {
      await this.delete(child.id, { cascade: true });
    }

    // 软删除文件夹
    await this.repository.softDelete(id);
  }

  /**
   * 移动文件夹
   */
  async move(
    id: number,
    targetParentId: number | null,
  ): Promise<FolderResponse> {
    return this.withLogging(
      "move",
      async () => {
        const folder = await this.repository.findById(id);

        if (!folder) {
          throw new ServiceError("NOT_FOUND", `Folder ${id} not found`);
        }

        // 检查目标父文件夹存在
        if (targetParentId !== null) {
          const parent = await this.repository.findById(targetParentId);
          if (!parent) {
            throw new ServiceError(
              "NOT_FOUND",
              "Target parent folder not found",
            );
          }
        }

        // 检查名称冲突
        const existing = await this.repository.findByName(
          folder.name,
          targetParentId,
        );
        if (existing && existing.id !== id) {
          throw new ServiceError(
            "DUPLICATE",
            "Folder with this name already exists in target location",
          );
        }

        const moved = await this.repository.move(id, targetParentId);

        if (!moved) {
          throw new ServiceError("INTERNAL_ERROR", "Failed to move folder");
        }

        return this.toResponse(moved);
      },
      { id, targetParentId },
    );
  }

  /**
   * 获取文件夹路径（面包屑）
   */
  async getPath(id: number): Promise<FolderPathResponse> {
    return this.withLogging(
      "getPath",
      async () => {
        const folder = await this.repository.findById(id);

        if (!folder) {
          throw new ServiceError("NOT_FOUND", `Folder ${id} not found`);
        }

        const ancestors = await this.repository.getAncestors(id);

        return {
          path: [...ancestors, folder].map(this.toResponse),
        };
      },
      { id },
    );
  }

  /**
   * 归档文件夹
   */
  async archive(id: number): Promise<FolderResponse> {
    return this.withLogging(
      "archive",
      async () => {
        const success = await this.repository.archive(id);

        if (!success) {
          throw new ServiceError("NOT_FOUND", `Folder ${id} not found`);
        }

        const folder = await this.repository.findById(id);
        return this.toResponse(folder!);
      },
      { id },
    );
  }

  /**
   * 取消归档文件夹
   */
  async unarchive(id: number): Promise<FolderResponse> {
    return this.withLogging(
      "unarchive",
      async () => {
        const success = await this.repository.unarchive(id);

        if (!success) {
          throw new ServiceError("NOT_FOUND", `Folder ${id} not found`);
        }

        const folder = await this.repository.findById(id);
        return this.toResponse(folder!);
      },
      { id },
    );
  }

  /**
   * 批量更新排序
   */
  async batchSort(
    orderings: Array<{ id: number; sortOrder: number }>,
  ): Promise<void> {
    return this.withLogging(
      "batchSort",
      async () => {
        await this.repository.updateSortOrder(orderings);
      },
      { count: orderings.length },
    );
  }

  // ============== Private Methods ==============

  private toResponse(folder: FolderRow): FolderResponse {
    return {
      id: folder.id,
      name: folder.name,
      parentId: folder.parent_id,
      folderGroup: folder.folder_group,
      isArchived: folder.is_archived,
      isSystem: folder.is_system ?? false,
      systemType: folder.system_type,
      sortOrder: folder.sort_order,
      createdAt: folder.created_at ?? new Date().toISOString(),
      updatedAt: folder.updated_at,
    };
  }

  private toWithCountResponse(
    folder: FolderWithCount,
  ): FolderWithCountResponse {
    return {
      ...this.toResponse(folder),
      bookmarkCount: folder.bookmarkCount,
    };
  }

  private toTreeNodeResponse(
    node: FolderTreeNode,
    parentPath: string[],
  ): FolderTreeNodeResponse {
    const currentPath = [...parentPath, node.name];

    return {
      ...this.toResponse(node),
      bookmarkCount: node.bookmarkCount ?? 0,
      children: node.children.map((child) =>
        this.toTreeNodeResponse(child, currentPath),
      ),
      path: currentPath,
    };
  }

  private countTreeNodes(nodes: FolderTreeNode[]): number {
    let count = nodes.length;
    for (const node of nodes) {
      count += this.countTreeNodes(node.children);
    }
    return count;
  }
}
