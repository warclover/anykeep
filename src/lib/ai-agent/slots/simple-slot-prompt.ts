/**
 * 简单槽位提示 - 非交互式
 *
 * 设计原则：
 * 1. 参数缺失时直接返回提示，不做多轮对话
 * 2. 静态 Schema 定义，无 LLM 分析
 * 3. 支持默认值和示例
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

import { logger } from "@/lib/logger";

const log = logger.child({ namespace: "slot-prompt" });

/**
 * 槽位定义
 */
export interface SlotSchema {
  /** 槽位名称 */
  name: string;
  /** 是否必需 */
  required: boolean;
  /** 缺失时的提示语 */
  prompt: string;
  /** 默认值（可选） */
  defaultValue?: unknown;
  /** 示例值（用于提示） */
  examples?: string[];
  /** 值类型 */
  type: "string" | "number" | "boolean" | "array" | "date";
}

/**
 * 工具槽位 Schema 定义
 *
 * 按工具 ID 索引，定义每个工具的必需参数
 */
export const SLOT_SCHEMAS: Record<string, SlotSchema[]> = {
  // ============================================
  // 搜索类
  // ============================================
  search: [
    {
      name: "query",
      required: true,
      prompt: "请输入搜索关键词",
      examples: ["React 教程", "TypeScript 最佳实践"],
      type: "string",
    },
  ],
  semantic_search: [
    {
      name: "query",
      required: true,
      prompt: "请输入搜索内容",
      examples: ["如何优化性能", "学习路线图"],
      type: "string",
    },
  ],

  // ============================================
  // 书签操作类
  // ============================================
  move_bookmark: [
    {
      name: "bookmarkId",
      required: true,
      prompt: "请指定要移动的书签",
      type: "number",
    },
    {
      name: "targetFolder",
      required: true,
      prompt: "请指定目标文件夹",
      examples: ["技术文章", "待读"],
      type: "string",
    },
  ],
  move_bookmarks: [
    {
      name: "bookmarkIds",
      required: true,
      prompt: "请指定要移动的书签（可多选）",
      type: "array",
    },
    {
      name: "targetFolder",
      required: true,
      prompt: "请指定目标文件夹",
      type: "string",
    },
  ],
  delete_bookmark: [
    {
      name: "bookmarkId",
      required: true,
      prompt: "请指定要删除的书签",
      type: "number",
    },
  ],
  batch_delete_bookmarks: [
    {
      name: "bookmarkIds",
      required: true,
      prompt: "请指定要删除的书签列表",
      type: "array",
    },
  ],

  // ============================================
  // 标签类
  // ============================================
  batch_add_tags: [
    {
      name: "bookmarkIds",
      required: true,
      prompt: "请指定要添加标签的书签",
      type: "array",
    },
    {
      name: "tags",
      required: true,
      prompt: "请输入要添加的标签",
      examples: ["前端", "后端", "学习"],
      type: "array",
    },
  ],
  batch_remove_tags: [
    {
      name: "bookmarkIds",
      required: true,
      prompt: "请指定要移除标签的书签",
      type: "array",
    },
    {
      name: "tags",
      required: true,
      prompt: "请输入要移除的标签",
      type: "array",
    },
  ],

  // ============================================
  // 文件夹类
  // ============================================
  create_folder: [
    {
      name: "name",
      required: true,
      prompt: "请输入文件夹名称",
      examples: ["技术文章", "生活随笔"],
      type: "string",
    },
  ],
  rename_folder: [
    {
      name: "folderId",
      required: true,
      prompt: "请指定要重命名的文件夹",
      type: "number",
    },
    {
      name: "newName",
      required: true,
      prompt: "请输入新名称",
      type: "string",
    },
  ],
  delete_folder: [
    {
      name: "folderId",
      required: true,
      prompt: "请指定要删除的文件夹",
      type: "number",
    },
  ],

  // ============================================
  // 导出类
  // ============================================
  export_bookmarks: [
    {
      name: "format",
      required: true,
      prompt: "请指定导出格式",
      examples: ["CSV", "Markdown", "JSON", "HTML"],
      defaultValue: "markdown",
      type: "string",
    },
  ],

  // ============================================
  // 列表查询类
  // ============================================
  list_by_folder: [
    {
      name: "folderName",
      required: true,
      prompt: "请指定文件夹名称",
      type: "string",
    },
  ],
  list_by_platform: [
    {
      name: "platform",
      required: true,
      prompt: "请指定平台",
      examples: ["微信", "B站", "知乎", "小红书"],
      type: "string",
    },
  ],
  count_by_folder: [
    {
      name: "folderName",
      required: true,
      prompt: "请指定文件夹名称",
      type: "string",
    },
  ],
  count_by_platform: [
    {
      name: "platform",
      required: true,
      prompt: "请指定平台",
      type: "string",
    },
  ],
};

/**
 * 槽位检查结果
 */
export interface SlotCheckResult {
  /** 是否完整 */
  isComplete: boolean;
  /** 缺失的槽位列表 */
  missingSlots: SlotSchema[];
  /** 合并后的提示语 */
  prompt: string | null;
  /** 带默认值填充后的参数 */
  filledParams: Record<string, unknown>;
}

/**
 * 检查缺失槽位
 *
 * @param toolId - 工具 ID
 * @param params - 当前参数
 * @returns 检查结果
 */
export function checkMissingSlots(
  toolId: string,
  params: Record<string, unknown>,
): SlotCheckResult {
  const schema = SLOT_SCHEMAS[toolId];

  // 无 Schema 定义，认为完整
  if (!schema) {
    return {
      isComplete: true,
      missingSlots: [],
      prompt: null,
      filledParams: params,
    };
  }

  const missingSlots: SlotSchema[] = [];
  const filledParams = { ...params };

  for (const slot of schema) {
    const value = params[slot.name];

    // 检查是否缺失
    if (value === undefined || value === null || value === "") {
      // 有默认值则填充
      if (slot.defaultValue !== undefined) {
        filledParams[slot.name] = slot.defaultValue;
      } else if (slot.required) {
        missingSlots.push(slot);
      }
    }
  }

  // 构建提示语
  let prompt: string | null = null;
  if (missingSlots.length > 0) {
    const prompts = missingSlots.map((slot) => {
      let text = slot.prompt;
      if (slot.examples && slot.examples.length > 0) {
        text += `（如：${slot.examples.slice(0, 3).join("、")}）`;
      }
      return text;
    });
    prompt = prompts.join("；");
  }

  const result: SlotCheckResult = {
    isComplete: missingSlots.length === 0,
    missingSlots,
    prompt,
    filledParams,
  };

  if (!result.isComplete) {
    log.debug(
      {
        toolId,
        missingCount: missingSlots.length,
        missingNames: missingSlots.map((s) => s.name),
      },
      "Missing slots detected",
    );
  }

  return result;
}

/**
 * 获取工具的槽位 Schema
 *
 * @param toolId - 工具 ID
 * @returns 槽位 Schema 列表
 */
export function getSlotSchema(toolId: string): SlotSchema[] {
  return SLOT_SCHEMAS[toolId] || [];
}

/**
 * 检查是否有槽位 Schema
 *
 * @param toolId - 工具 ID
 */
export function hasSlotSchema(toolId: string): boolean {
  return toolId in SLOT_SCHEMAS;
}

/**
 * 获取所有定义了 Schema 的工具 ID
 */
export function getAllToolIdsWithSchema(): string[] {
  return Object.keys(SLOT_SCHEMAS);
}

/**
 * 获取槽位统计信息
 */
export function getSlotSchemaStats(): {
  toolCount: number;
  totalSlots: number;
  requiredSlots: number;
} {
  let totalSlots = 0;
  let requiredSlots = 0;

  for (const schema of Object.values(SLOT_SCHEMAS)) {
    totalSlots += schema.length;
    requiredSlots += schema.filter((s) => s.required).length;
  }

  return {
    toolCount: Object.keys(SLOT_SCHEMAS).length,
    totalSlots,
    requiredSlots,
  };
}
