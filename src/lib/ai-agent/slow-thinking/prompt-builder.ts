/**
 * 慢思考服务 - Prompt 构建器
 *
 * 构建用于深度推理的 Prompt
 *
 * @module ai-agent/slow-thinking
 * @version 1.0.0
 * @since 2025-12-30
 */

import type {
  SlowThinkingRouteResult,
  SlowThinkingDynamicContext,
} from "./types";

/**
 * 构建慢思考 Prompt
 *
 * @param userMessage - 用户消息
 * @param routeResult - 路由结果
 * @param context - 动态上下文
 * @returns Prompt 字符串
 */
export function buildThinkingPrompt(
  userMessage: string,
  routeResult: SlowThinkingRouteResult,
  context: SlowThinkingDynamicContext,
): string {
  const topTopics = context.globalInsight?.topicDistribution
    ?.slice(0, 3)
    .map((t) => t.topic)
    .join(", ");

  return `你是一个专业的知识管理秘书，正在分析用户的请求。

## 用户请求
"${userMessage}"

## 初步分析
- 意图分类: ${routeResult.intent.type}${routeResult.intent.subType ? ` (${routeResult.intent.subType})` : ""}
- 复杂度: ${routeResult.complexity.level} (${routeResult.complexity.score}/100)
- 默认执行模式: ${routeResult.mode}

## 用户上下文
- 总收藏数: ${context.stats?.totalBookmarks ?? "未知"}
- 最近活跃: ${context.recentActivity?.lastSaved?.title ?? "无"}
- 主要关注: ${topTopics ?? "未知"}
${context.proactiveBriefing?.daysSinceLastVisit ? `- 离线天数: ${context.proactiveBriefing.daysSinceLastVisit}` : ""}

## 任务
请进行深度思考，输出你的内心独白。格式如下：

<thinking>
[你的思考过程，包括：
1. 用户字面上说了什么？
2. 用户真正想要什么？（深层意图）
3. 用户当前的状态和需求是什么？
4. 默认的执行方式是否最优？
5. 有没有更好的执行策略？]
</thinking>

<inferred_intent>
[用户的真实意图，一句话]
</inferred_intent>

<inferred_goal>
[用户的最终目标，如果能推断的话]
</inferred_goal>

<strategy>
type: [default | customized | multi_step]
description: [策略描述]
pre_processing: [可选，预处理步骤，逗号分隔]
post_processing: [可选，后处理步骤，逗号分隔]
</strategy>

<suggest_route_change>
[true | false]
</suggest_route_change>

<confidence>
[0-100]
</confidence>

<conclusion>
[一句话总结你的分析结论]
</conclusion>`;
}

/**
 * 构建快速思考 Prompt（用于简单场景）
 *
 * @param userMessage - 用户消息
 * @param routeResult - 路由结果
 * @returns Prompt 字符串
 */
export function buildQuickThinkingPrompt(
  userMessage: string,
  routeResult: SlowThinkingRouteResult,
): string {
  return `分析以下用户请求，判断默认执行策略是否合适：

请求: "${userMessage}"
意图: ${routeResult.intent.type}
复杂度: ${routeResult.complexity.level}

快速分析：
1. 用户真实意图是什么？
2. 默认策略是否合适？
3. 置信度 (0-100)?

回答格式：
<inferred_intent>[意图]</inferred_intent>
<suggest_route_change>[true/false]</suggest_route_change>
<confidence>[数字]</confidence>`;
}
