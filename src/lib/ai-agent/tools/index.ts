/**
 * AI Agent Tools 模块导出
 *
 * @version 2.9.0
 * @since 2025-12-23
 *
 * v2.9.0 精简:
 * - 移除 pending-tasks, plugin-auth, capsules, events 工具
 *
 * v2.7.0 新增:
 * - 工具分层: tool-layers.ts（Core/Intent/Extended 三层架构）
 * - 意图映射: intent-tool-mapping.ts（意图驱动的智能工具加载）
 * - getToolsForIntentAsVercel: 按意图获取 Vercel AI SDK 格式工具
 *
 * v2.5.0 新增:
 * - Active Recall Tools: generate-flashcards, get-review-queue, submit-review-response, get-mastery-stats, update-review-preferences
 *
 * v2.4.0 新增:
 * - 知识图谱 Tools, 微信文章 Tools
 *
 * v2.2.0 新增:
 * - 信任模式 Tools: get-trust-mode, recommend-trust-mode
 */

// 类型定义
export * from "./types";

// 共享工具函数和常量
export * from "./utils";

// 工具描述模板（v1.9.0）
export * from "./tool-description-templates";

// 工具结果增强器（v1.9.0）
export * from "./tool-result-enhancer";

// 工具分层（v2.7.0 性能优化）
export * from "./tool-layers";
export * from "./intent-tool-mapping";
import {
  getToolsForIntentWithDetails,
  type ToolSelectionResult,
} from "./intent-tool-mapping";

// Tool 注册表
export { ToolRegistry, toolRegistry } from "./tool-registry";

// 查询 Tools
export * from "./query";

// 阅读 Tools
export * from "./read";

// 搜索 Tools
export * from "./search";

// 操作 Tools（需要确认）
export * from "./action";

// 智能列表 Tools
export * from "./smart-list";

// 文件夹 Tools
export * from "./folder";

// 导出 Tools
export * from "./export";

// 书签 Tools (新增 v1.6.0)
export * from "./bookmark";

// 设置 Tools (新增 v1.6.0)
export * from "./settings";

// MD 收藏 Tools (新增 v1.6.0)
export * from "./md-collection";

// 导入 Tools (新增 v1.8.0)
export * from "./import";

// 消息 Tools (新增 v2.0.0)
export * from "./messages";

// 快照 Tools (新增 v2.1.0)
export * from "./snapshot";

// 信任模式 Tools (新增 v2.2.0)
export * from "./trust-mode";

// 知识图谱 Tools (新增 v2.4.0)
export * from "./knowledge-link";

// 微信文章 Tools (新增 v2.4.0)
export * from "./wechat-article";

// 注册默认 Tools
import { toolRegistry } from "./tool-registry";
import { queryTools } from "./query";
import { readTools } from "./read";
import { searchTools } from "./search";
import { actionTools } from "./action";
import { smartListTools } from "./smart-list";
import { folderTools } from "./folder";
import { exportTools } from "./export";
import { bookmarkTools } from "./bookmark";
import { settingsTools } from "./settings";
import { mdCollectionTools } from "./md-collection";
import { importTools } from "./import";
import { messageTools } from "./messages";
import { snapshotTools } from "./snapshot";
import { trustModeTools } from "./trust-mode";
import { knowledgeLinkTools } from "./knowledge-link";
import { wechatArticleTools } from "./wechat-article";
import { logger } from "@/lib/logger";

/**
 * 标志位：防止重复注册
 * @internal
 */
let defaultToolsRegistered = false;

/**
 * 注册所有默认 Tools
 *
 * 使用标志位防止重复注册（多个模块可能同时调用此函数）
 */
export function registerDefaultTools(): void {
  // 防止重复注册
  if (defaultToolsRegistered) {
    logger.debug("Default tools already registered, skipping");
    return;
  }
  defaultToolsRegistered = true;

  toolRegistry.registerAll(queryTools);
  toolRegistry.registerAll(readTools);
  toolRegistry.registerAll(searchTools);
  toolRegistry.registerAll(actionTools);
  toolRegistry.registerAll(smartListTools);
  toolRegistry.registerAll(folderTools);
  toolRegistry.registerAll(exportTools);
  // 新增 Tools (v1.6.0)
  toolRegistry.registerAll(bookmarkTools);
  toolRegistry.registerAll(settingsTools);
  toolRegistry.registerAll(mdCollectionTools);
  // 新增 Tools (v1.8.0)
  toolRegistry.registerAll(importTools);
  // 新增 Tools (v2.0.0)
  toolRegistry.registerAll(messageTools);
  // 新增 Tools (v2.1.0)
  toolRegistry.registerAll(snapshotTools);
  // 新增 Tools (v2.2.0)
  toolRegistry.registerAll(trustModeTools);
  // 新增 Tools (v2.4.0)
  toolRegistry.registerAll(knowledgeLinkTools);
  toolRegistry.registerAll(wechatArticleTools);
  logger.info(
    { toolCount: toolRegistry.getStats().totalTools },
    "Default tools registered successfully",
  );
}

/**
 * 获取所有 Tools 作为 Vercel AI SDK 格式
 *
 * @param context - 工具执行上下文
 * @param context.userId - 用户 ID
 * @param context.conversationId - 会话 ID（可选）
 * @param context.onSearchResults - 搜索结果记录回调（可选，用于上下文保持）
 */
export function getToolsAsVercelTools(context: {
  userId: string;
  conversationId?: string;
  onSearchResults?: (info: { query: string; resultIds: number[] }) => void;
}) {
  return toolRegistry.getAsVercelTools(context);
}

/**
 * 根据意图获取 Tools 作为 Vercel AI SDK 格式（性能优化）
 *
 * 意图驱动的智能工具加载：
 * - 高置信度精确意图：单工具模式（1个工具）
 * - 简单查询：仅加载 8 个核心工具
 * - 复杂操作：按意图类型加载相关工具集
 * - Token 消耗减少 60-90%
 *
 * @param intentType - 意图类型
 * @param subType - 意图子类型
 * @param confidence - 意图置信度
 * @param userInput - 用户输入（用于检测 Extended Tools）
 * @param context - 工具执行上下文
 * @returns 工具集和选择结果信息
 */
export function getToolsForIntentAsVercel(
  intentType: string,
  subType: string | undefined,
  confidence: number,
  userInput: string,
  context: {
    userId: string;
    conversationId?: string;
    onSearchResults?: (info: { query: string; resultIds: number[] }) => void;
  },
): {
  tools: ReturnType<typeof toolRegistry.getToolsByNames>;
  selectionResult: ToolSelectionResult;
} {
  // 获取需要加载的工具名称列表（带详细信息）
  const selectionResult = getToolsForIntentWithDetails(
    intentType as Parameters<typeof getToolsForIntentWithDetails>[0],
    subType,
    confidence,
    userInput,
  );

  // 日志：工具加载决策
  logger.info(
    {
      intentType,
      subType,
      confidence: confidence.toFixed(2),
      isPreciseMode: selectionResult.isPreciseMode,
      preciseTool: selectionResult.preciseTool,
      toolCount: selectionResult.tools.length,
      tools:
        selectionResult.tools.slice(0, 5).join(", ") +
        (selectionResult.tools.length > 5
          ? ` (+${selectionResult.tools.length - 5} more)`
          : ""),
      reason: selectionResult.debug?.reason,
    },
    "Tool Selection: Intent-driven tool loading",
  );

  // 从注册表获取对应的工具
  const tools = toolRegistry.getToolsByNames(selectionResult.tools, context);

  return { tools, selectionResult };
}
