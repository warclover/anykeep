/**
 * 文件夹清理工作流
 *
 * 检测空文件夹、合并相似文件夹、优化结构
 *
 * @version 1.1.0
 * @since 2026-01-08
 * @updated 2026-01-09 - 添加语义匹配支持
 */

import type { WorkflowDefinition } from "../types";

/**
 * 文件夹清理工作流
 *
 * 步骤：
 * 1. 分析文件夹结构
 * 2. 检测重复结构
 * 3. 呈现分析结果
 * 4. 删除空文件夹（需确认）
 * 5. 合并相似文件夹（需确认）
 * 6. 生成清理报告
 */
export const folderCleanupWorkflow: WorkflowDefinition = {
  id: "folder_cleanup",
  name: "文件夹清理",
  description: "检测空文件夹、合并相似文件夹、优化结构",
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
        "清理文件夹",
        "整理文件夹",
        "文件夹优化",
        "合并文件夹",
        "删除空文件夹",
        // 自然语言变体
        "优化目录",
        "合并分类",
        "清理重复分类",
        "文件夹整理",
        "目录清理",
        "分类优化",
        "整理目录结构",
      ],
      // 语义匹配：覆盖更多自然语言表达
      semanticPatterns: {
        referenceTexts: [
          "我的文件夹有点乱，帮我整理一下",
          "有些分类好像重复了，能合并吗",
          "看看有没有空的文件夹可以删掉",
          "帮我优化一下目录结构",
          "分类太多太杂了，需要精简",
          "有些文件夹名字很像，应该合并",
        ],
        threshold: 0.77,
      },
    },
  ],

  steps: [
    {
      id: "analyze_folders",
      name: "分析文件夹结构",
      type: "skill",
      config: {
        skillId: "folder_health_check",
        inputMapping: {
          includeEmpty: true,
          includeSimilarity: true,
          includeStats: true,
        },
        outputMapping: {
          emptyFolders: "emptyFolders",
          similarPairs: "similarFolders",
          healthReport: "folderHealthReport",
        },
      },
    },
    {
      id: "detect_duplicates",
      name: "检测重复结构",
      type: "skill",
      config: {
        skillId: "analyze_folder_overlap",
        inputMapping: {
          similarityThreshold: 0.7,
        },
        outputMapping: {
          overlappingFolders: "overlappingFolders",
          mergeSuggestions: "mergeSuggestions",
        },
      },
      onError: "continue",
    },
    {
      id: "present_findings",
      name: "呈现分析结果",
      type: "aggregate",
      requiresConfirmation: true,
      confirmationMessage: "文件夹分析完成，请确认要执行的操作：",
      config: {
        toolName: "present_folder_analysis",
        args: {
          template: "folder_cleanup_report",
          sections: [
            {
              title: "空文件夹",
              variable: "emptyFolders",
              action: "delete_empty",
              actionLabel: "删除空文件夹",
            },
            {
              title: "相似文件夹",
              variable: "similarFolders",
              action: "merge_similar",
              actionLabel: "查看合并建议",
            },
            {
              title: "结构优化建议",
              variable: "folderHealthReport",
              action: "view_suggestions",
            },
          ],
        },
      },
    },
    {
      id: "delete_empty",
      name: "删除空文件夹",
      type: "skill",
      condition: "confirmationResult.actions.delete_empty == true",
      config: {
        skillId: "delete_folders",
        inputMapping: {
          folderIds: "${emptyFolders}",
          confirmRequired: false, // 已在上一步确认
        },
        outputMapping: {
          deletedCount: "deletedEmptyCount",
        },
      },
    },
    {
      id: "merge_similar",
      name: "合并相似文件夹",
      type: "skill",
      condition: "confirmationResult.actions.merge_similar == true",
      config: {
        skillId: "merge_folders",
        inputMapping: {
          mergePairs: "${mergeSuggestions}",
          strategy: "keep_larger",
        },
        outputMapping: {
          mergedCount: "mergedFolderCount",
        },
      },
    },
    {
      id: "final_report",
      name: "生成清理报告",
      type: "aggregate",
      config: {
        toolName: "generate_cleanup_report",
        args: {
          template: "cleanup_complete",
          variables: ["deletedEmptyCount", "mergedFolderCount"],
        },
      },
    },
  ],

  config: {
    timeout: 120000,
    notifyOnComplete: true,
    notifyOnFailure: true,
  },
};
