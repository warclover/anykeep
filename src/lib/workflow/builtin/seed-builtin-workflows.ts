/**
 * 初始化内置工作流到数据库
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { builtinWorkflows } from "./index";
import type { WorkflowDefinition } from "../types";

/**
 * 内置工作流列表
 *
 * 使用 index.ts 导出的完整列表，确保所有工作流都被注册
 */
const BUILTIN_WORKFLOWS: WorkflowDefinition[] = builtinWorkflows;

/**
 * 初始化内置工作流到数据库
 */
export async function seedBuiltinWorkflows(): Promise<void> {
  const supabase = await createClient();

  for (const workflow of BUILTIN_WORKFLOWS) {
    try {
      // 检查是否已存在
      const { data: existing } = await supabase
        .from("workflows")
        .select("id")
        .eq("definition->>id", workflow.id)
        .single();

      if (existing) {
        // 更新现有工作流
        const { error } = await supabase
          .from("workflows")
          .update({
            name: workflow.name,
            description: workflow.description,
            definition: workflow as unknown as Record<string, never>,
          })
          .eq("id", existing.id);

        if (error) {
          logger.error(
            { error, workflowId: workflow.id },
            "Failed to update builtin workflow",
          );
        } else {
          logger.info({ workflowId: workflow.id }, "Updated builtin workflow");
        }
      } else {
        // 插入新工作流
        const { error } = await supabase.from("workflows").insert({
          user_id: null, // 内置工作流无 user_id
          name: workflow.name,
          description: workflow.description,
          definition: workflow as unknown as Record<string, never>,
          category: "builtin",
          enabled: true,
        });

        if (error) {
          logger.error(
            { error, workflowId: workflow.id },
            "Failed to insert builtin workflow",
          );
        } else {
          logger.info({ workflowId: workflow.id }, "Inserted builtin workflow");
        }
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          workflowId: workflow.id,
        },
        "Error seeding builtin workflow",
      );
    }
  }
}

/**
 * 获取所有内置工作流定义
 */
export function getBuiltinWorkflows(): WorkflowDefinition[] {
  return [...BUILTIN_WORKFLOWS];
}
