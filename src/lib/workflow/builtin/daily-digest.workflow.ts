/**
 * 每日精选推送工作流
 *
 * 从未读列表推荐 3-5 条今日阅读内容
 *
 * @version 1.0.0
 * @since 2026-01-08
 *
 * @note 此工作流默认关闭，需要用户在设置中手动开启
 */

import type { WorkflowDefinition } from "../types";

/**
 * 每日精选推送工作流
 *
 * 触发条件：每天 08:00
 * 步骤：
 * 1. 获取未读列表
 * 2. 评分排序
 * 3. 生成摘要
 * 4. 组装每日精选
 * 5. 发送推送
 */
export const dailyDigestWorkflow: WorkflowDefinition = {
  id: "daily_digest",
  name: "每日精选推送",
  description: "从未读列表推荐 3-5 条今日阅读内容",
  version: "1.0.0",
  category: "builtin",

  triggers: [
    {
      type: "schedule",
      schedule: {
        type: "cron",
        value: "0 8 * * *", // 每天 08:00
      },
    },
    {
      type: "conversation",
      patterns: [
        // 直接表达
        "今日推荐",
        "每日精选",
        "今天读什么",
        "推荐阅读",
        "每日阅读",
        // 自然语言变体
        "今天看什么",
        "有什么推荐",
        "推荐内容",
        "今天读点什么",
        "给我推荐",
        "每日推送",
        "今日阅读",
      ],
    },
  ],

  steps: [
    {
      id: "get_unread",
      name: "获取未读列表",
      type: "skill",
      config: {
        skillId: "search_bookmarks",
        inputMapping: {
          filter: { read_status: "unread" },
          orderBy: "created_at",
          limit: 50,
        },
        outputMapping: {
          bookmarks: "unreadBookmarks",
          totalUnread: "unreadCount",
        },
      },
    },
    {
      id: "score_and_rank",
      name: "评分排序",
      type: "skill",
      condition: "length(unreadBookmarks) > 0",
      config: {
        skillId: "rank_bookmarks",
        inputMapping: {
          bookmarks: "${unreadBookmarks}",
          criteria: ["recency", "relevance", "diversity"],
          topN: 5,
        },
        outputMapping: {
          rankedBookmarks: "topBookmarks",
        },
      },
    },
    {
      id: "generate_summaries",
      name: "生成摘要",
      type: "skill",
      condition: "length(topBookmarks) > 0",
      config: {
        skillId: "quick_digest",
        inputMapping: {
          bookmarkIds: "${topBookmarks}",
          summaryLength: "brief",
        },
        outputMapping: {
          summaries: "bookmarkSummaries",
        },
      },
      onError: "continue",
    },
    {
      id: "compose_digest",
      name: "组装每日精选",
      type: "aggregate",
      config: {
        toolName: "compose_daily_digest",
        args: {
          template: "daily_digest",
          variables: ["unreadCount", "topBookmarks", "bookmarkSummaries"],
        },
      },
    },
    {
      id: "send_digest",
      name: "发送推送",
      type: "notification",
      config: {
        toolName: "send_notification",
        args: {
          template: "daily_digest_notification",
          priority: "normal",
        },
      },
    },
  ],

  config: {
    timeout: 60000,
    notifyOnComplete: true,
    notifyOnFailure: false, // 每日推送失败不打扰用户
  },
};
