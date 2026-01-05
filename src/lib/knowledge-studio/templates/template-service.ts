/**
 * Knowledge Studio - 模板管理服务
 * @module knowledge-studio/templates
 * @description P4 实现 - 用户自建蓝图模板管理
 * @version 1.0.0
 * @since 2026-01-02
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  ITemplateService,
  CustomTemplate,
  TemplateVersion,
  TemplateUsage,
} from "./types";
import { parseTemplateVariables, parsePromptSections } from "./types";
import type { Database, Json } from "@/types/supabase";

// ============================================================================
// 数据库行类型 - 使用 Database 类型确保类型安全
// ============================================================================

// 使用 Database 类型定义
type TemplateRow = Database["public"]["Tables"]["ks_custom_templates"]["Row"];
type TemplateInsert =
  Database["public"]["Tables"]["ks_custom_templates"]["Insert"];
type TemplateUpdate =
  Database["public"]["Tables"]["ks_custom_templates"]["Update"];
type VersionInsert =
  Database["public"]["Tables"]["ks_template_versions"]["Insert"];

interface VersionRow {
  id: string;
  template_id: string;
  version: number;
  changelog: string;
  variables: Json;
  prompt_sections: Json;
  created_at: string;
  created_by: string;
}

// ============================================================================
// 类型转换工具
// ============================================================================

function rowToTemplate(row: TemplateRow): CustomTemplate {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    icon: row.icon ?? undefined,
    baseBlueprint: row.base_blueprint ?? undefined,
    variables: parseTemplateVariables(row.variables, `template:${row.id}`),
    promptSections: parsePromptSections(
      row.prompt_sections,
      `template:${row.id}`,
    ),
    outputFormat: row.output_format ?? undefined,
    visibility: row.visibility as "private" | "shared" | "public",
    status: row.status as "draft" | "active" | "archived",
    version: row.version,
    usageCount: row.usage_count,
    tags: row.tags ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToVersion(row: VersionRow): TemplateVersion {
  return {
    id: row.id,
    templateId: row.template_id,
    version: row.version,
    changelog: row.changelog,
    variables: parseTemplateVariables(
      row.variables,
      `version:${row.template_id}:${row.version}`,
    ),
    promptSections: parsePromptSections(
      row.prompt_sections,
      `version:${row.template_id}:${row.version}`,
    ),
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
  };
}

// ============================================================================
// 模板管理服务实现
// ============================================================================

/**
 * 模板管理服务
 *
 * @example
 * ```typescript
 * const service = new TemplateService();
 *
 * // 创建模板
 * const template = await service.createTemplate({
 *   userId: 'user-123',
 *   name: '我的博客模板',
 *   description: '个性化博客大纲生成器',
 *   variables: [...],
 *   promptSections: [...],
 *   visibility: 'private',
 *   status: 'draft',
 * });
 *
 * // 获取用户模板
 * const templates = await service.getUserTemplates('user-123');
 * ```
 */
export class TemplateService implements ITemplateService {
  /**
   * 创建模板
   */
  async createTemplate(
    template: Omit<
      CustomTemplate,
      "id" | "createdAt" | "updatedAt" | "version" | "usageCount"
    >,
  ): Promise<CustomTemplate> {
    const supabase = await createClient();

    // 插入模板
    const insertData: TemplateInsert = {
      user_id: template.userId,
      name: template.name,
      description: template.description,
      icon: template.icon ?? null,
      base_blueprint: template.baseBlueprint ?? null,
      variables: template.variables as unknown as Json,
      prompt_sections: template.promptSections as unknown as Json,
      output_format: template.outputFormat ?? null,
      visibility: template.visibility,
      status: template.status,
      tags: template.tags ?? null,
      version: 1,
      usage_count: 0,
    };

    const { data, error } = await supabase
      .from("ks_custom_templates")
      .insert(insertData)
      .select()
      .single();

    if (error || !data) {
      logger.error({ error: error?.message }, "Failed to create template");
      throw new Error(`创建模板失败: ${error?.message}`);
    }

    // 创建初始版本记录
    const versionInsertData: VersionInsert = {
      template_id: data.id,
      version: 1,
      changelog: "初始版本",
      variables: template.variables as unknown as Json,
      prompt_sections: template.promptSections as unknown as Json,
      created_by: template.userId,
    };

    await supabase.from("ks_template_versions").insert(versionInsertData);

    logger.info(
      { templateId: data.id, name: template.name },
      "Template created",
    );

    return rowToTemplate(data);
  }

  /**
   * 更新模板
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<CustomTemplate>,
  ): Promise<CustomTemplate> {
    const supabase = await createClient();

    // 获取当前模板
    const { data: current, error: fetchError } = await supabase
      .from("ks_custom_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (fetchError || !current) {
      throw new Error(`模板不存在: ${templateId}`);
    }

    // 检查是否有内容变更需要新版本
    const contentChanged =
      (updates.variables &&
        JSON.stringify(updates.variables) !==
          JSON.stringify(current.variables)) ||
      (updates.promptSections &&
        JSON.stringify(updates.promptSections) !==
          JSON.stringify(current.prompt_sections));

    const newVersion = contentChanged ? current.version + 1 : current.version;

    // 构建更新数据
    const updateData: TemplateUpdate = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.icon !== undefined) updateData.icon = updates.icon;
    if (updates.baseBlueprint !== undefined)
      updateData.base_blueprint = updates.baseBlueprint;
    if (updates.variables !== undefined)
      updateData.variables = updates.variables as unknown as Json;
    if (updates.promptSections !== undefined)
      updateData.prompt_sections = updates.promptSections as unknown as Json;
    if (updates.outputFormat !== undefined)
      updateData.output_format = updates.outputFormat;
    if (updates.visibility !== undefined)
      updateData.visibility = updates.visibility;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (contentChanged) updateData.version = newVersion;

    // 执行更新
    const { data, error } = await supabase
      .from("ks_custom_templates")
      .update(updateData)
      .eq("id", templateId)
      .select()
      .single();

    if (error || !data) {
      logger.error({ error: error?.message }, "Failed to update template");
      throw new Error(`更新模板失败: ${error?.message}`);
    }

    // 如果内容变更，创建新版本记录
    if (contentChanged) {
      const versionInsertData: VersionInsert = {
        template_id: templateId,
        version: newVersion,
        changelog: updates.name ? `更新: ${updates.name}` : "内容更新",
        variables: (updates.variables ?? current.variables) as unknown as Json,
        prompt_sections: (updates.promptSections ??
          current.prompt_sections) as unknown as Json,
        created_by: current.user_id,
      };

      await supabase.from("ks_template_versions").insert(versionInsertData);
    }

    logger.info({ templateId, newVersion, contentChanged }, "Template updated");

    return rowToTemplate(data);
  }

  /**
   * 删除模板
   * @param templateId 模板 ID
   * @param userId 用户 ID（用于所有权验证）
   */
  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from("ks_custom_templates")
      .delete()
      .eq("id", templateId)
      .eq("user_id", userId);

    if (error) {
      logger.error({ error: error.message }, "Failed to delete template");
      throw new Error(`删除模板失败: ${error.message}`);
    }

    logger.info({ templateId, userId }, "Template deleted");
  }

  /**
   * 获取模板
   */
  async getTemplate(templateId: string): Promise<CustomTemplate | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ks_custom_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // 未找到
      }
      logger.error({ error: error.message }, "Failed to get template");
      throw new Error(`获取模板失败: ${error.message}`);
    }

    return rowToTemplate(data);
  }

  /**
   * 获取用户模板列表
   */
  async getUserTemplates(userId: string): Promise<CustomTemplate[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ks_custom_templates")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      logger.error({ error: error.message }, "Failed to get user templates");
      throw new Error(`获取用户模板失败: ${error.message}`);
    }

    return (data ?? []).map((row) => rowToTemplate(row));
  }

  /**
   * 搜索公开模板
   */
  async searchPublicTemplates(query: string): Promise<CustomTemplate[]> {
    const supabase = await createClient();

    // 转义特殊字符防止 SQL 注入
    const escapedQuery = query.replace(/[%_\\]/g, "\\$&");

    // 使用 RPC 函数进行全文搜索
    const { data, error } = await supabase.rpc("search_public_templates", {
      p_query: escapedQuery,
      p_limit: 50,
    });

    if (error) {
      // 回退到简单搜索，使用转义后的查询
      logger.warn(
        { error: error.message },
        "RPC search failed, falling back to simple search",
      );

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("ks_custom_templates")
        .select("*")
        .eq("visibility", "public")
        .eq("status", "active")
        .or(`name.ilike.%${escapedQuery}%,description.ilike.%${escapedQuery}%`)
        .order("usage_count", { ascending: false })
        .limit(50);

      if (fallbackError) {
        throw new Error(`搜索模板失败: ${fallbackError.message}`);
      }

      return (fallbackData ?? []).map((row) => rowToTemplate(row));
    }

    // 将 RPC 返回的数据转换为 TemplateRow 格式
    type RpcResult = {
      id: string;
      name: string;
      description: string;
      icon: string | null;
      base_blueprint: string | null;
      usage_count: number;
      tags: string[] | null;
      user_id: string;
      created_at: string;
    };
    const templateRows: TemplateRow[] = (
      (data as RpcResult[] | null) ?? []
    ).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      base_blueprint: row.base_blueprint,
      variables: {} as Json, // RPC 不返回完整数据
      prompt_sections: {} as Json,
      output_format: null,
      visibility: "public" as const,
      status: "active" as const,
      version: 1,
      usage_count: row.usage_count,
      tags: row.tags,
      created_at: row.created_at,
      updated_at: row.created_at,
    }));

    return templateRows.map((row) => rowToTemplate(row));
  }

  /**
   * 复制模板
   */
  async cloneTemplate(
    templateId: string,
    userId: string,
  ): Promise<CustomTemplate> {
    const supabase = await createClient();

    // 尝试使用 RPC 函数
    const { data: newTemplateId, error } = await supabase.rpc(
      "clone_template",
      {
        p_template_id: templateId,
        p_new_name: undefined,
      },
    );

    if (error || !newTemplateId) {
      // 回退到手动克隆
      logger.warn(
        { error: error?.message },
        "RPC clone failed, falling back to manual clone",
      );

      const original = await this.getTemplate(templateId);
      if (!original) {
        throw new Error(`原模板不存在: ${templateId}`);
      }

      return this.createTemplate({
        userId,
        name: `${original.name} (副本)`,
        description: original.description,
        icon: original.icon,
        baseBlueprint: original.baseBlueprint,
        variables: original.variables,
        promptSections: original.promptSections,
        outputFormat: original.outputFormat,
        visibility: "private",
        status: "draft",
        tags: original.tags,
      });
    }

    // 增加原模板使用计数
    // 注意：克隆操作不会触发 ks_template_usages 插入，需要直接更新
    // 但由于克隆会记录到使用记录中，触发器会自动处理

    // 获取克隆后的模板
    const clonedTemplate = await this.getTemplate(newTemplateId as string);
    if (!clonedTemplate) {
      throw new Error(`克隆模板后无法获取: ${newTemplateId}`);
    }

    logger.info(
      { originalId: templateId, newId: newTemplateId, userId },
      "Template cloned",
    );

    return clonedTemplate;
  }

  /**
   * 获取模板版本历史
   */
  async getVersionHistory(templateId: string): Promise<TemplateVersion[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ks_template_versions")
      .select("*")
      .eq("template_id", templateId)
      .order("version", { ascending: false });

    if (error) {
      logger.error({ error: error.message }, "Failed to get version history");
      throw new Error(`获取版本历史失败: ${error.message}`);
    }

    return (data ?? []).map((row) => rowToVersion(row as VersionRow));
  }

  /**
   * 回滚到指定版本
   */
  async rollbackToVersion(
    templateId: string,
    version: number,
  ): Promise<CustomTemplate> {
    const supabase = await createClient();

    // 获取目标版本
    const { data: versionData, error: versionError } = await supabase
      .from("ks_template_versions")
      .select("*")
      .eq("template_id", templateId)
      .eq("version", version)
      .single();

    if (versionError || !versionData) {
      throw new Error(`版本不存在: ${templateId} v${version}`);
    }

    // 获取当前模板信息
    const { data: current } = await supabase
      .from("ks_custom_templates")
      .select("version, user_id")
      .eq("id", templateId)
      .single();

    if (!current) {
      throw new Error(`模板不存在: ${templateId}`);
    }

    const newVersion = current.version + 1;

    // 更新模板内容
    const updateData: TemplateUpdate = {
      variables: versionData.variables,
      prompt_sections: versionData.prompt_sections,
      version: newVersion,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("ks_custom_templates")
      .update(updateData)
      .eq("id", templateId)
      .select()
      .single();

    if (error || !data) {
      logger.error({ error: error?.message }, "Failed to rollback template");
      throw new Error(`回滚模板失败: ${error?.message}`);
    }

    // 创建新版本记录
    const versionInsertData: VersionInsert = {
      template_id: templateId,
      version: newVersion,
      changelog: `回滚到版本 ${version}`,
      variables: versionData.variables,
      prompt_sections: versionData.prompt_sections,
      created_by: current.user_id,
    };

    await supabase.from("ks_template_versions").insert(versionInsertData);

    logger.info(
      { templateId, fromVersion: version, toVersion: newVersion },
      "Template rolled back",
    );

    return rowToTemplate(data);
  }

  /**
   * 记录模板使用
   */
  async recordUsage(usage: Omit<TemplateUsage, "id">): Promise<void> {
    const supabase = await createClient();

    // 插入使用记录
    type TemplateUsageInsert =
      Database["public"]["Tables"]["ks_template_usages"]["Insert"];
    const usageInsertData: TemplateUsageInsert = {
      template_id: usage.templateId,
      user_id: usage.userId,
      variable_values: usage.variableValues as unknown as Json,
      report_id: usage.reportId ?? null,
      rating: usage.rating ?? null,
      feedback: usage.feedback ?? null,
      created_at: usage.timestamp.toISOString(),
    };

    const { error } = await supabase
      .from("ks_template_usages")
      .insert(usageInsertData);

    if (error) {
      logger.error({ error: error.message }, "Failed to record template usage");
      throw new Error(`记录模板使用失败: ${error.message}`);
    }

    // 使用计数由触发器自动更新（trigger_increment_template_usage）

    logger.info(
      { templateId: usage.templateId, userId: usage.userId },
      "Template usage recorded",
    );
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建模板管理服务实例
 */
export function createTemplateService(): ITemplateService {
  return new TemplateService();
}

// 保留旧名称以兼容
export { TemplateService as TemplateServiceStub };
