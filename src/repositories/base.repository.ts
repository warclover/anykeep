/**
 * Base Repository Class
 *
 * 数据访问层基类，封装 Supabase 操作
 *
 * @module repositories
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createLogger } from "@/lib/logger";

/**
 * 分页参数
 */
export interface PaginationParams {
  limit: number;
  offset: number;
}

/**
 * 排序参数
 */
export interface SortParams {
  orderBy: string;
  orderDir: "asc" | "desc";
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

// 表名类型
type TableName = keyof Database["public"]["Tables"];

/**
 * Repository 基类
 *
 * 所有数据访问对象应继承此类
 *
 * 注意：由于 Supabase 类型系统对动态表名的限制，
 * 部分操作使用类型断言。子类应提供正确的类型注解。
 */
export abstract class BaseRepository<
  TRow extends Record<string, unknown>,
  TInsert extends Record<string, unknown>,
  TUpdate extends Record<string, unknown>,
> {
  protected readonly supabase: SupabaseClient<Database>;
  protected readonly userId: string;
  protected readonly logger: ReturnType<typeof createLogger>;
  protected abstract readonly tableName: TableName;

  constructor(
    supabase: SupabaseClient<Database>,
    userId: string,
    repositoryName: string,
  ) {
    this.supabase = supabase;
    this.userId = userId;
    this.logger = createLogger(repositoryName);
  }

  /**
   * 获取表查询构建器
   */
  protected get table() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.supabase.from(this.tableName as any);
  }

  /**
   * 根据 ID 查找
   */
  async findById(id: number): Promise<TRow | null> {
    const { data, error } = await this.table
      .select()
      .eq("id", id)
      .eq("user_id", this.userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      this.logger.error({ error, id }, "Failed to find by ID");
      throw error;
    }

    return data as unknown as TRow;
  }

  /**
   * 创建记录
   */
  async create(data: TInsert): Promise<TRow> {
    const { data: created, error } = await this.table
      .insert(data)
      .select()
      .single();

    if (error) {
      this.logger.error({ error, data }, "Failed to create");
      throw error;
    }

    return created as unknown as TRow;
  }

  /**
   * 更新记录
   */
  async update(id: number, data: TUpdate): Promise<TRow | null> {
    const { data: updated, error } = await this.table
      .update(data)
      .eq("id", id)
      .eq("user_id", this.userId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      this.logger.error({ error, id, data }, "Failed to update");
      throw error;
    }

    return updated as unknown as TRow;
  }

  /**
   * 删除记录 (硬删除)
   */
  async delete(id: number): Promise<boolean> {
    const { error, count } = await this.table
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("user_id", this.userId);

    if (error) {
      this.logger.error({ error, id }, "Failed to delete");
      throw error;
    }

    return (count ?? 0) > 0;
  }

  /**
   * 软删除记录 (设置 deleted_at)
   */
  async softDelete(id: number): Promise<boolean> {
    const { error, count } = await this.table
      .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", id)
      .eq("user_id", this.userId);

    if (error) {
      this.logger.error({ error, id }, "Failed to soft delete");
      throw error;
    }

    return (count ?? 0) > 0;
  }

  /**
   * 批量更新
   */
  async batchUpdate(ids: number[], data: TUpdate): Promise<number> {
    const { error, count } = await this.table
      .update(data, { count: "exact" })
      .in("id", ids)
      .eq("user_id", this.userId);

    if (error) {
      this.logger.error({ error, ids, data }, "Failed to batch update");
      throw error;
    }

    return count ?? 0;
  }

  /**
   * 检查记录是否存在
   */
  async exists(id: number): Promise<boolean> {
    const { count, error } = await this.table
      .select("id", { count: "exact", head: true })
      .eq("id", id)
      .eq("user_id", this.userId);

    if (error) {
      this.logger.error({ error, id }, "Failed to check existence");
      throw error;
    }

    return (count ?? 0) > 0;
  }

  /**
   * 计数
   */
  async count(filters?: Partial<TRow>): Promise<number> {
    let query = this.table
      .select("id", { count: "exact", head: true })
      .eq("user_id", this.userId);

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          query = query.eq(key, value as any);
        }
      }
    }

    const { count, error } = await query;

    if (error) {
      this.logger.error({ error, filters }, "Failed to count");
      throw error;
    }

    return count ?? 0;
  }
}
