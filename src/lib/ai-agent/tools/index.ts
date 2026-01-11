/**
 * AI Agent Tools 模块导出
 *
 * @version 2.7.1
 * @since 2025-12-23
 *
 * v2.7.1 新增:
 * - 修复 registerDefaultTools 重复注册问题（添加标志位）
 *
 * v2.7.0 新增:
 * - 工具分层: tool-layers.ts（Core/Intent/Extended 三层架构）
 * - 意图映射: intent-tool-mapping.ts（意图驱动的智能工具加载）
 * - getToolsForIntentAsVercel: 按意图获取 Vercel AI SDK 格式工具
 *
 * v2.6.0 新增:
 * - 工具调用事件: tool-event-emitter（工具执行事件发射，P2-3）
 *
 * v2.5.0 新增:
 * - Active Recall Tools: generate-flashcards, get-review-queue, submit-review-response, get-mastery-stats, update-review-preferences
 *
 * v2.4.0 新增:
 * - 知识图谱 Tools: get-knowledge-graph（知识图谱数据）, find-related-by-topic（主题关联查找）
 * - 微信文章 Tools: list-wechat-articles（微信文章列表）, get-wechat-article-stats（微信文章统计）
 *
 * v2.3.0 新增:
 * - 插件授权 Tools: list-plugin-authorizations, revoke-plugin-authorization, revoke-all-plugin-authorizations, get-plugin-auth-stats
 *
 * v2.2.0 新增:
 * - 信任模式 Tools: get-trust-mode（获取信任模式）, recommend-trust-mode（智能推荐信任模式）
 *
 * v2.1.0 新增:
 * - 快照 Tools: compare-snapshots（快照对比）
 *
 * v2.0.0 新增:
 * - 消息 Tools: list-messages, summarize-unread, batch-mark-read
 *
 * v1.9.0 新增:
 * - 工具描述模板: tool-description-templates.ts（增强型描述，提升 LLM 工具选择准确性）
 * - 工具结果增强器: tool-result-enhancer.ts（结果摘要、错误分析、下一步建议）
 *
 * v1.8.0 新增:
 * - 设置: get-user-interests, update-user-interests
 * - 导入: import-bookmarks, import-browser-bookmarks
 *
 * v1.7.0 新增 P1/P2 Tools:
 * - 书签: update-bookmark, batch-delete-bookmarks, create-snapshot
 * - 设置: get-user-settings, get-classification-settings, update-classification-settings
 * - MD 收藏: toggle-md-read, toggle-md-starred, update-md-collection, delete-md-collection, get-md-stats
 * - 智能列表: toggle-smart-list-pin, update-smart-list, delete-smart-list, create-smart-list
 */

// 类型定义
export * from "./types";

// 共享工具函数和常量
export * from "./utils";

// 工具描述模板（v1.9.0）
export * from "./tool-description-templates";

// 工具结果增强器（v1.9.0）
export * from "./tool-result-enhancer";

// 工具调用事件（v2.6.0 P2-3）
export * from "./events";

// 工具分层（v2.7.0 性能优化）
export * from "./tool-layers";
export * from "./intent-tool-mapping";
import { getToolsForIntent } from "./intent-tool-mapping";

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

// 插件授权 Tools (新增 v2.3.0)
export * from "./plugin-auth";

// 知识图谱 Tools (新增 v2.4.0)
export * from "./knowledge-link";

// 微信文章 Tools (新增 v2.4.0)
export * from "./wechat-article";

// Active Recall Tools (新增 v2.5.0)
export * from "./active-recall";

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
import { pluginAuthTools } from "./plugin-auth";
import { knowledgeLinkTools } from "./knowledge-link";
import { wechatArticleTools } from "./wechat-article";
import { activeRecallTools } from "./active-recall";
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
  // 新增 Tools (v2.3.0)
  toolRegistry.registerAll(pluginAuthTools);
  // 新增 Tools (v2.4.0)
  toolRegistry.registerAll(knowledgeLinkTools);
  toolRegistry.registerAll(wechatArticleTools);
  // 新增 Tools (v2.5.0)
  toolRegistry.registerAll(activeRecallTools);

  logger.info(
    { toolCount: toolRegistry.getStats().total },
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
 * - 简单查询只加载 8 个核心工具
 * - 复杂操作按意图类型加载相关工具集
 * - Token 消耗减少 60-90%
 *
 * @param intentType - 意图类型
 * @param subType - 意图子类型
 * @param confidence - 意图置信度
 * @param userInput - 用户输入（用于检测 Extended Tools）
 * @param context - 工具执行上下文
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
) {
  // 获取需要加载的工具名称列表
  const toolNames = getToolsForIntent(
    intentType,
    subType,
    confidence,
    userInput,
  );

  // 从注册表获取对应的工具
  return toolRegistry.getToolsByNames(toolNames, context);
}
