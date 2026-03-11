/**
 * 文件夹别名管理器（精简版）
 *
 * 仅保留 addAlias 功能，供 folder-profile/manager.ts 使用。
 * 完整版本已归档。
 *
 * @version 2.0.0 (simplified)
 */

import { createLogger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FolderId } from "@/lib/shared/types";

const logger = createLogger("folder-alias-manager");

/**
 * 激进标准化标签名
 * 去除所有可能导致不匹配的字符，用于别名比较
 */
function normalizeTag(tag: string): string {
  if (!tag || typeof tag !== "string") return "";
  return tag
    .toLowerCase()
    .replace(/\+\+/g, "pp")
    .replace(/#/g, "sharp")
    .replace(/[\s\-_.·/|&@!?()[\]{}'"`,;:]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "")
    .trim();
}

/**
 * 文件夹别名管理器
 */
export class FolderAliasManager {
  constructor(private supabase: SupabaseClient) {}

  /**
   * 添加文件夹别名
   */
  async addAlias(
    userId: string,
    folderId: FolderId,
    alias: string,
  ): Promise<void> {
    const normalizedAlias = normalizeTag(alias);
    if (!normalizedAlias) {
      logger.warn({ alias }, "无效的别名，跳过添加");
      return;
    }

    const { data: existing } = await this.supabase
      .from("folder_tag_profiles")
      .select("aliases")
      .eq("user_id", userId)
      .eq("folder_id", Number(folderId))
      .single();

    const currentAliases: string[] = (existing?.aliases as string[]) || [];

    if (!currentAliases.includes(normalizedAlias)) {
      currentAliases.push(normalizedAlias);

      const { error } = await this.supabase
        .from("folder_tag_profiles")
        .update({ aliases: currentAliases })
        .eq("user_id", userId)
        .eq("folder_id", Number(folderId));

      if (error) {
        logger.error(
          { error, userId, folderId, alias: normalizedAlias },
          "更新别名失败",
        );
        throw error;
      }
    }

    logger.info(
      { userId, folderId, alias: normalizedAlias },
      "已添加文件夹别名",
    );
  }
}
