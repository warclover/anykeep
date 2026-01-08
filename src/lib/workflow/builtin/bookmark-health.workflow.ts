/**
 * 书签健康巡检工作流
 *
 * 检测失效链接、内容变更、重复书签，生成健康报告
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import type { WorkflowDefinition } from "../types";

/**
 * 书签健康巡检工作流
 *
 * 步骤：
 * 1. 检测失效链接
 * 2. 检测重复书签
 * 3. 生成健康报告
 */
export const bookmarkHealthWorkflow: WorkflowDefinition = {
  id: "bookmark_health",
  name: "书签健康巡检",
  description: "检测失效链接、内容变更、重复书签，生成健康报告",
  version: "1.0.0",
  category: "builtin",

  triggers: [
    {
      type: "manual",
    },
    {
      type: "conversation",
      patterns: [
        "检查书签健康",
        "书签巡检",
        "链接检查",
        "检测失效链接",
        "检查死链",
      ],
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
          timeout: 10000,
        },
        outputMapping: {
          brokenLinks: "brokenLinks",
          brokenCount: "brokenLinkCount",
          checkedCount: "checkedCount",
        },
      },
      onError: "continue",
    },
    {
      id: "detect_duplicates",
      name: "检测重复书签",
      type: "skill",
      config: {
        skillId: "duplicate_cleanup",
        inputMapping: {
          autoMerge: false,
          similarity_threshold: 0.85,
        },
        outputMapping: {
          duplicateGroups: "duplicateGroups",
          duplicateCount: "duplicateCount",
        },
      },
      onError: "continue",
    },
    {
      id: "generate_report",
      name: "生成健康报告",
      type: "aggregate",
      config: {
        toolName: "generate_health_report",
        args: {
          template: "health_report",
          sections: [
            {
              title: "链接检测",
              variables: ["brokenLinkCount", "checkedCount"],
            },
            {
              title: "重复检测",
              variables: ["duplicateCount", "duplicateGroups"],
            },
          ],
        },
      },
    },
  ],

  config: {
    timeout: 300000, // 5 分钟
    notifyOnComplete: true,
    notifyOnFailure: true,
  },
};
