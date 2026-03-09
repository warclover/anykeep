/**
 * 意图槽位 Schema 定义
 *
 * 定义每个意图类型所需的槽位（参数）结构
 *
 * @version 1.2.0
 * @since 2026-01-09
 * @updated 2026-01-10 - 添加 refine 意图槽位定义 (Code Review P2-3)
 * @updated 2026-01-10 - 为多个意图添加 timeRange 槽位（时间范围修复）
 */

import { z } from "zod";
import type { IntentType } from "./types";

/**
 * 槽位值类型
 */
export type SlotValueType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object";

/**
 * 槽位来源
 */
export type SlotSource = "extracted" | "inferred" | "default" | "context";

/**
 * 槽位定义 Schema
 */
export const SlotSchema = z.object({
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.unknown()),
    z.record(z.string(), z.unknown()),
  ]),
  type: z.enum(["string", "number", "boolean", "array", "object"]),
  confidence: z.number().min(0).max(1),
  source: z.enum(["extracted", "inferred", "default", "context"]),
});

export type Slot = z.infer<typeof SlotSchema>;

/**
 * 意图槽位映射 Schema
 */
export const IntentSlotsSchema = z.record(z.string(), SlotSchema);

export type IntentSlots = z.infer<typeof IntentSlotsSchema>;

/**
 * 核心意图槽位定义
 *
 * 设计说明 (Code Review #7):
 * - organize:move vs action:move 的区别：
 *   - organize:move: 批量整理场景，支持 filter 筛选条件
 *   - action:move: 单次操作场景，针对特定书签
 * - 两者槽位结构保持一致，便于统一处理
 */
export const INTENT_SLOT_DEFINITIONS: Record<
  string,
  {
    required: string[];
    optional: string[];
    description: string;
  }
> = {
  // ============================================
  // 整理类 (organize) - 批量操作场景
  // ============================================
  "organize:move": {
    required: ["targetFolder"],
    optional: ["sourceFolder", "bookmarkIds", "filter", "timeRange"],
    description: "批量移动书签到指定文件夹（支持筛选条件和时间范围）",
  },
  "organize:cleanup": {
    required: [],
    optional: ["scope", "strategy", "dryRun", "timeRange"],
    description: "清理书签（去重、过期检测等，支持时间范围）",
  },
  "organize:dedupe": {
    required: [],
    optional: ["scope", "strategy", "timeRange"],
    description: "去除重复书签（支持时间范围）",
  },
  "organize:classify": {
    required: [],
    optional: ["scope", "autoTag", "timeRange"],
    description: "自动分类书签（支持时间范围）",
  },
  "organize:tag": {
    required: ["tags"],
    optional: ["bookmarkIds", "scope", "timeRange"],
    description: "为书签添加标签（支持时间范围）",
  },

  // ============================================
  // 查询类 - 支持 timeRange 时间范围过滤
  // ============================================
  "query:search": {
    required: ["query"],
    optional: ["filters", "limit", "sortBy", "timeRange"],
    description: "搜索书签（支持时间范围过滤）",
  },
  "query:list": {
    required: [],
    optional: ["folder", "tags", "platform", "limit", "timeRange"],
    description: "列出书签（支持时间范围过滤）",
  },
  "query:count": {
    required: [],
    optional: ["folder", "tags", "platform", "timeRange"],
    description: "统计书签数量（支持时间范围过滤）",
  },

  // ============================================
  // 操作类 (action) - 单次操作场景
  // ============================================
  "action:tag": {
    required: ["tags"],
    optional: ["bookmarkIds", "scope"],
    description: "为特定书签添加标签",
  },
  "action:move": {
    required: ["targetFolder"],
    optional: ["bookmarkIds", "sourceFolder"],
    description: "移动特定书签到目标文件夹（单次操作）",
  },
  "action:delete": {
    required: [],
    optional: ["bookmarkIds", "scope", "confirm"],
    description: "删除书签",
  },
  "action:rename": {
    required: ["newTitle"],
    optional: ["bookmarkId"],
    description: "重命名书签",
  },

  // ============================================
  // 创建类 - 支持 timeRange 时间范围过滤
  // ============================================
  "create:export": {
    required: ["format"],
    optional: ["bookmarkIds", "fields", "outputPath", "timeRange"],
    description: "导出书签（支持时间范围过滤）",
  },
  "create:digest": {
    required: [],
    optional: ["bookmarkIds", "scope", "format", "timeRange"],
    description: "生成摘要（支持时间范围过滤）",
  },
  "create:note": {
    required: ["content"],
    optional: ["folder", "tags"],
    description: "创建笔记",
  },
  "create:synthesis": {
    required: [],
    optional: ["bookmarkIds", "topic", "format", "timeRange"],
    description: "主题合成（支持时间范围过滤）",
  },

  // ============================================
  // 分析类 - 支持 timeRange 时间范围过滤
  // ============================================
  "analyze:report": {
    required: [],
    optional: ["scope", "period", "format", "timeRange"],
    description: "生成分析报告（支持时间范围过滤）",
  },
  "analyze:insight": {
    required: [],
    optional: ["scope", "dimension", "timeRange"],
    description: "生成洞察分析（支持时间范围过滤）",
  },

  // ============================================
  // 过滤/筛选类 (Code Review P2-3)
  // ============================================
  "refine:filter": {
    required: [],
    optional: ["criteria", "topic", "platform", "timeRange", "tags", "limit"],
    description: "在当前结果中筛选（基于上下文的搜索结果）",
  },
  "refine:check": {
    required: ["criteria"],
    optional: ["scope"],
    description: "检查是否存在特定类型的内容",
  },
};

/**
 * 获取意图的槽位定义
 */
export function getSlotDefinition(
  intentType: IntentType,
  subType?: string,
): {
  required: string[];
  optional: string[];
  description: string;
} | null {
  const key = subType ? `${intentType}:${subType}` : `${intentType}:*`;
  return INTENT_SLOT_DEFINITIONS[key] || null;
}

/**
 * 验证槽位完整性
 */
export function validateSlotCompleteness(
  intentType: IntentType,
  subType: string | undefined,
  slots: IntentSlots,
): {
  complete: boolean;
  missing: string[];
  completeness: number;
} {
  const definition = getSlotDefinition(intentType, subType);
  if (!definition) {
    return {
      complete: true, // 无定义则视为完整
      missing: [],
      completeness: 1.0,
    };
  }

  const missing = definition.required.filter(
    (slotName) => !(slotName in slots),
  );

  const total = definition.required.length + definition.optional.length;
  const provided = Object.keys(slots).length;
  const completeness = total > 0 ? provided / total : 1.0;

  return {
    complete: missing.length === 0,
    missing,
    completeness,
  };
}
