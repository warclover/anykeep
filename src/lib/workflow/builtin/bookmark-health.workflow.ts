/**
 * 书签健康巡检工作流
 *
 * 检测失效链接、内容变更、重复书签，生成健康报告
 *
 * @version 1.1.0
 * @since 2026-01-08
 * @updated 2026-01-09 - 添加语义匹配支持
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
  version: "1.1.0",
  category: "builtin",

  triggers: [
    {
      type: "manual",
    },
    {
      type: "conversation",
      patterns: [
        // 直接表达
        "检查书签健康",
        "书签巡检",
        "链接检查",
        "检测失效链接",
        "检查死链",
        // 自然语言变体
        "检查失效",
        "哪些链接坏了",
        "清理无效",
        "失效链接",
        "死链检测",
        "链接是否有效",
        "书签健康检查",
      ],
      // 语义匹配：覆盖更多自然语言表达
      semanticPatterns: {
        referenceTexts: [
          "帮我看看有没有打不开的链接",
          "哪些收藏的网页已经失效了",
          "检查我的书签是否还能正常访问",
          "有些网站可能已经关闭了，帮我找出来",
          "我的收藏夹里有没有坏掉的链接",
          "扫描一下看看哪些书签已经过期了",
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
