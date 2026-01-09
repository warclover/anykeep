/**
 * Phase 1 验证工作流：书签健康巡检（精简版）
 *
 * 仅包含 2 个 Skill 步骤，用于验证核心引擎
 *
 * @version 1.1.0
 * @since 2026-01-08
 * @updated 2026-01-09 - 添加语义匹配支持
 */

import type { WorkflowDefinition } from "../types";

/**
 * 书签健康巡检工作流（精简版）
 *
 * 步骤：
 * 1. 检测失效链接
 * 2. 检测重复书签
 */
export const bookmarkHealthSimpleWorkflow: WorkflowDefinition = {
  id: "bookmark_health_simple",
  name: "书签健康巡检（简版）",
  description: "检测失效链接和重复书签，生成简要报告",
  version: "1.1.0",
  category: "builtin",

  triggers: [
    {
      type: "manual",
    },
    {
      type: "conversation",
      patterns: ["快速健康检查", "简单巡检", "快速检测"],
      // 语义匹配：覆盖更多自然语言表达
      semanticPatterns: {
        referenceTexts: [
          "帮我快速看看有没有问题",
          "简单检测一下书签状态",
          "快速扫描书签健康情况",
        ],
        threshold: 0.78,
      },
    },
  ],

  steps: [
    {
      id: "check_links",
      name: "检测失效链接",
      type: "skill",
      config: {
        skillId: "link_health_check",
        inputMapping: {
          scope: "all",
          batchSize: 50,
        },
        outputMapping: {
          brokenLinks: "brokenLinks",
          brokenCount: "brokenLinkCount",
        },
      },
      onError: "continue", // 失败不影响后续
    },
    {
      id: "detect_duplicates",
      name: "检测重复书签",
      type: "skill",
      config: {
        skillId: "duplicate_cleanup",
        inputMapping: {
          autoMerge: false,
        },
        outputMapping: {
          duplicateGroups: "duplicateGroups",
          duplicateCount: "duplicateCount",
        },
      },
      onError: "continue",
    },
  ],

  config: {
    timeout: 300000, // 5 分钟
    notifyOnComplete: true,
    notifyOnFailure: true,
  },
};
