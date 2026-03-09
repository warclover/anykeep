/**
 * 意图到工具的映射配置
 *
 * 根据意图分类结果，智能选择需要加载的工具集
 *
 * 设计原则：
 * 1. 精确匹配优先 - 子类型精确映射优先于通用映射
 * 2. 最小工具集 - 高置信度时只加载必需工具
 * 3. 安全回退 - 低置信度时自动扩大范围
 *
 * @version 1.1.0 - 添加精确工具映射和单工具模式
 * @since 2026-01-11
 */

import type { ToolSetName } from "./tool-layers";
import { CORE_TOOLS, TOOL_SETS } from "./tool-layers";
import type { IntentType } from "@/lib/ai-skills/router/types";

// ============================================
// 精确单工具映射 (高置信度时使用)
// ============================================

/**
 * 精确意图→单工具映射
 *
 * 当置信度 >= 0.85 且子类型明确时，优先使用单工具模式
 * 格式: "type:subType" -> "tool_name"
 */
export const PRECISE_TOOL_MAP: Record<string, string> = {
  // 查询类 - 精确映射
  "query:list_folders": "list_folders",
  "query:folder": "list_folders",
  "query:count": "count_total",
  "query:stats": "get_stats",
  "query:list": "list_recent",
  "query:search": "search_bookmarks",
  "query:tag": "list_tags",
  "query:platform": "list_by_platform",

  // 操作类 - 精确映射
  "action:star": "toggle_bookmark_starred",
  "action:read": "toggle_bookmark_read",
  "action:create_folder": "create_folder",
  "action:rename_folder": "rename_folder",

  // 创建类 - 精确映射
  "create:folder": "create_folder",
  "create:bookmark": "create_bookmark",
  "create:snapshot": "create_snapshot",
};

/**
 * 精确单工具模式的置信度阈值
 */
export const PRECISE_MODE_CONFIDENCE_THRESHOLD = 0.85;

// ============================================
// 意图到工具集的映射
// ============================================

/**
 * 意图类型+子类型到工具集的映射
 *
 * 格式: "type:subType" -> ["tool_set_1", "tool_set_2"]
 * 空数组 [] 表示只使用 CORE_TOOLS 中的工具
 */
export const INTENT_TOOL_MAPPING: Record<string, ToolSetName[]> = {
  // ============================================
  // 查询类意图 - 大部分用空数组（CORE_TOOLS 已足够）
  // ============================================
  "query:list": [], // 仅用 Core
  "query:list_folders": [], // 仅用 Core (list_folders 在 Core 中)
  "query:count": [], // 仅用 Core (count_total 在 Core 中)
  "query:stats": [], // 仅用 Core (get_stats 在 Core 中)
  "query:search": [], // 仅用 Core (search_bookmarks 在 Core 中)
  "query:trust_mode": ["settings_tools"],
  "query:mastery_stats": ["learn_tools"],
  "query:folder": [], // 仅用 Core
  "query:folder_detail": ["query_tools"], // 需要 get_folder_detail
  "query:tag": [], // 仅用 Core (list_tags 在 Core 中)
  "query:platform": ["query_tools"], // 需要 list_by_platform
  "query:smart_list": ["query_tools"], // 需要 list_smart_lists
  "query:md": ["query_tools"], // 需要 MD 相关工具
  query: [], // 通用查询 - 仅用 Core

  // ============================================
  // 操作类意图
  // ============================================
  "action:tag": ["manage_tools"],
  "action:move": ["manage_tools"],
  "action:delete": ["manage_tools"],
  "action:create": ["manage_tools"],
  "action:update": ["manage_tools"],
  "action:settings": ["settings_tools"],
  "action:review_preferences": ["learn_tools"],
  "action:archive": ["manage_tools"],
  "action:star": [], // toggle_bookmark_starred 需要添加到 Core
  "action:read": [], // toggle_bookmark_read 需要添加到 Core
  action: ["manage_tools"], // 通用操作

  // ============================================
  // 整理类意图
  // ============================================
  "organize:cleanup": ["organize_tools"],
  "organize:classify": ["organize_tools"],
  "organize:dedupe": ["organize_tools"],
  "organize:merge": ["organize_tools"],
  "organize:move": ["organize_tools"],
  "organize:tag": ["organize_tools"],
  "organize:monitor": ["organize_tools"],
  organize: ["organize_tools"], // 通用整理

  // ============================================
  // 分析类意图
  // ============================================
  "analyze:report": ["analyze_tools"],
  "analyze:insight": ["analyze_tools"],
  "analyze:wechat": ["analyze_tools", "query_tools"],
  "analyze:periodic": ["analyze_tools"],
  analyze: ["analyze_tools"], // 通用分析

  // ============================================
  // 创建类意图
  // ============================================
  "create:export": ["export_tools"],
  "create:tts": [], // TTS Skill 处理，不需要额外工具
  "create:synthesis": [], // 编排模式处理
  "create:snapshot": ["organize_tools"],
  "create:smart_list": ["manage_tools"],
  "create:folder": [], // create_folder 应添加到 Core
  "create:bookmark": [], // create_bookmark 应添加到 Core
  "create:md_collection": ["manage_tools"],
  create: ["manage_tools"], // 通用创建

  // ============================================
  // 学习类意图
  // ============================================
  "learn:path": ["learn_tools"],
  "learn:extract": ["learn_tools"],
  learn: ["learn_tools"], // 通用学习

  // ============================================
  // 闲聊类意图 - 仅用 Core Tools
  // ============================================
  "chitchat:general": [],
  "chitchat:greeting": [],
  "chitchat:help": [],
  chitchat: [],
};

/**
 * Extended Tools 触发关键词
 *
 * 当用户输入包含这些关键词时，加载对应的 Extended Tools
 */
export const EXTENDED_TOOL_TRIGGERS: Record<ToolSetName, RegExp> = {
  import_tools: /导入|import|批量添加|从.*导入/i,
  messages_tools: /消息|通知|未读|notification|message/i,
  // Layer 1 工具集不需要关键词触发（由意图映射决定）
  query_tools: /(?!)/,
  manage_tools: /(?!)/,
  organize_tools: /(?!)/,
  analyze_tools: /(?!)/,
  export_tools: /(?!)/,
  learn_tools: /(?!)/,
  settings_tools: /(?!)/,
};

// ============================================
// 回退策略配置
// ============================================

/**
 * 回退配置
 */
export const FALLBACK_CONFIG = {
  /** 低置信度阈值 - 低于此值加载更多工具 */
  lowConfidenceThreshold: 0.5,
  /** 低置信度时额外加载的工具集 */
  lowConfidenceToolSets: ["query_tools", "manage_tools"] as ToolSetName[],
  /** 调试模式下强制全量加载 */
  debugForceFullLoad: false,
  /** 启用重试时全量加载 */
  enableFullLoadRetry: true,
};

// ============================================
// 工具选择函数
// ============================================

/**
 * 工具选择结果
 */
export interface ToolSelectionResult {
  /** 工具名称列表 */
  tools: string[];
  /** 是否使用精确单工具模式 */
  isPreciseMode: boolean;
  /** 精确模式下的工具名称 */
  preciseTool?: string;
  /** 调试信息 */
  debug?: {
    intentKey: string;
    confidence: number;
    reason: string;
  };
}

/**
 * 根据意图获取工具列表
 *
 * @param intentType - 意图类型
 * @param subType - 意图子类型
 * @param confidence - 意图置信度
 * @param userInput - 用户输入（用于检测 Extended Tools）
 * @param debug - 是否调试模式
 */
export function getToolsForIntent(
  intentType: IntentType,
  subType: string | undefined,
  confidence: number,
  userInput?: string,
  debug?: boolean,
): string[] {
  const result = getToolsForIntentWithDetails(
    intentType,
    subType,
    confidence,
    userInput,
    debug,
  );
  return result.tools;
}

/**
 * 根据意图获取工具列表（带详细信息）
 *
 * 优化策略：
 * 1. 高置信度 + 精确映射 → 单工具模式（最优）
 * 2. 中置信度 → Core + 意图工具集
 * 3. 低置信度 → 扩大工具范围
 *
 * @param intentType - 意图类型
 * @param subType - 意图子类型
 * @param confidence - 意图置信度
 * @param userInput - 用户输入（用于检测 Extended Tools）
 * @param debugMode - 是否调试模式
 */
export function getToolsForIntentWithDetails(
  intentType: IntentType,
  subType: string | undefined,
  confidence: number,
  userInput?: string,
  debugMode?: boolean,
): ToolSelectionResult {
  const intentKey = subType ? `${intentType}:${subType}` : intentType;

  // 调试模式强制全量
  if (debugMode && FALLBACK_CONFIG.debugForceFullLoad) {
    return {
      tools: getAllRegisteredToolNames(),
      isPreciseMode: false,
      debug: {
        intentKey,
        confidence,
        reason: "debug_force_full_load",
      },
    };
  }

  // ============================================
  // 策略1: 高置信度精确单工具模式
  // ============================================
  if (confidence >= PRECISE_MODE_CONFIDENCE_THRESHOLD && subType) {
    const preciseTool = PRECISE_TOOL_MAP[intentKey];
    if (preciseTool) {
      return {
        tools: [preciseTool],
        isPreciseMode: true,
        preciseTool,
        debug: {
          intentKey,
          confidence,
          reason: `precise_single_tool: ${preciseTool}`,
        },
      };
    }
  }

  // ============================================
  // 策略2: 标准模式 - Core + 意图工具集
  // ============================================
  const tools = new Set<string>(CORE_TOOLS);

  const toolSetNames =
    INTENT_TOOL_MAPPING[intentKey] ?? INTENT_TOOL_MAPPING[intentType] ?? [];

  for (const setName of toolSetNames) {
    const setTools = TOOL_SETS[setName];
    if (setTools) {
      for (const tool of setTools) {
        tools.add(tool);
      }
    }
  }

  // ============================================
  // 策略3: 低置信度时扩大工具范围
  // ============================================
  if (confidence < FALLBACK_CONFIG.lowConfidenceThreshold) {
    for (const setName of FALLBACK_CONFIG.lowConfidenceToolSets) {
      const setTools = TOOL_SETS[setName];
      if (setTools) {
        for (const tool of setTools) {
          tools.add(tool);
        }
      }
    }
  }

  // ============================================
  // 策略4: 检查 Extended Tools 触发条件
  // ============================================
  if (userInput) {
    const extendedSets: ToolSetName[] = ["import_tools", "messages_tools"];

    for (const setName of extendedSets) {
      const trigger = EXTENDED_TOOL_TRIGGERS[setName];
      if (trigger && trigger.test(userInput)) {
        const setTools = TOOL_SETS[setName];
        if (setTools) {
          for (const tool of setTools) {
            tools.add(tool);
          }
        }
      }
    }
  }

  return {
    tools: Array.from(tools),
    isPreciseMode: false,
    debug: {
      intentKey,
      confidence,
      reason:
        toolSetNames.length > 0
          ? `standard_mode: core + ${toolSetNames.join(", ")}`
          : "standard_mode: core_only",
    },
  };
}

/**
 * 获取全量工具名称列表（用于回退）
 *
 * 注意：此函数仅返回静态定义的工具名，实际工具需从 ToolRegistry 获取
 */
function getAllRegisteredToolNames(): string[] {
  const all = new Set<string>();

  // Core
  for (const tool of CORE_TOOLS) {
    all.add(tool);
  }

  // All sets
  for (const tools of Object.values(TOOL_SETS)) {
    for (const tool of tools) {
      all.add(tool);
    }
  }

  return Array.from(all);
}

/**
 * 获取意图对应的工具集名称（用于日志）
 */
export function getToolSetNamesForIntent(
  intentType: IntentType,
  subType: string | undefined,
): ToolSetName[] {
  const intentKey = subType ? `${intentType}:${subType}` : intentType;
  return (
    INTENT_TOOL_MAPPING[intentKey] ?? INTENT_TOOL_MAPPING[intentType] ?? []
  );
}

/**
 * 检查是否需要加载 Extended Tools
 */
export function shouldLoadExtendedTools(
  userInput: string,
): { setName: ToolSetName; reason: string }[] {
  const result: { setName: ToolSetName; reason: string }[] = [];

  const extendedSets: ToolSetName[] = ["import_tools", "messages_tools"];

  for (const setName of extendedSets) {
    const trigger = EXTENDED_TOOL_TRIGGERS[setName];
    if (trigger && trigger.test(userInput)) {
      result.push({
        setName,
        reason: `匹配关键词: ${trigger.source}`,
      });
    }
  }

  return result;
}
