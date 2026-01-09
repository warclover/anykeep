/**
 * 新用户导入整理工作流
 *
 * 导入浏览器书签后自动去重、分类、打标签，快速完成首次整理
 *
 * @version 1.1.0
 * @since 2026-01-08
 * @updated 2026-01-09 - 添加语义匹配支持
 */

import type { WorkflowDefinition } from "../types";

/**
 * 新用户导入整理工作流
 *
 * 触发条件：首次导入浏览器书签
 * 步骤：
 * 1. 分析导入数据
 * 2. 智能去重
 * 3. 智能分类
 * 4. 智能打标签
 * 5. 生成整理报告
 * 6. 应用整理结果（需确认）
 */
export const newUserOnboardingWorkflow: WorkflowDefinition = {
  id: "new_user_onboarding",
  name: "新用户导入整理",
  description: "导入浏览器书签后自动去重、分类、打标签，快速完成首次整理",
  version: "1.1.0",
  category: "builtin",

  triggers: [
    {
      type: "event",
      eventType: "browser_bookmark_import_completed",
      condition: "event.isFirstImport == true",
    },
    {
      type: "manual",
    },
    {
      type: "conversation",
      patterns: [
        // 直接表达
        "整理导入的书签",
        "导入书签整理",
        "帮我整理刚导入的",
        // 自然语言变体
        "帮我整理",
        "刚导入怎么整理",
        "整理新导入",
        "处理导入数据",
        "导入后整理",
        "快速整理书签",
        "自动整理",
      ],
      // 语义匹配：覆盖更多自然语言表达
      semanticPatterns: {
        referenceTexts: [
          "刚从浏览器导入了书签，帮我分类一下",
          "导入的书签太多了，帮我去去重",
          "新导入的东西需要打标签和分类",
          "这些刚导入的书签怎么快速整理",
          "帮我把刚导入的内容自动分好类",
          "导入完成了，接下来怎么整理比较好",
        ],
        threshold: 0.76,
      },
    },
  ],

  steps: [
    {
      id: "analyze_imported",
      name: "分析导入数据",
      type: "skill",
      config: {
        skillId: "count_bookmarks",
        inputMapping: {
          scope: "imported",
          includeStats: true,
        },
        outputMapping: {
          totalCount: "importedCount",
          platformDistribution: "platforms",
        },
      },
    },
    {
      id: "remove_duplicates",
      name: "智能去重",
      type: "skill",
      config: {
        skillId: "duplicate_cleanup",
        inputMapping: {
          scope: "imported",
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
      id: "classify_bookmarks",
      name: "智能分类",
      type: "skill",
      config: {
        skillId: "batch_organize",
        inputMapping: {
          scope: "imported",
          maxItems: 500,
          autoExecute: false,
        },
        outputMapping: {
          suggestions: "classifySuggestions",
          suggestedFolders: "suggestedFolders",
        },
      },
      onError: "continue",
    },
    {
      id: "generate_tags",
      name: "智能打标签",
      type: "skill",
      config: {
        skillId: "smart_tagging",
        inputMapping: {
          scope: "imported",
          autoApply: false,
          maxTagsPerBookmark: 5,
        },
        outputMapping: {
          tagSuggestions: "tagSuggestions",
          tagCount: "suggestedTagCount",
        },
      },
      onError: "continue",
    },
    {
      id: "present_summary",
      name: "生成整理报告",
      type: "aggregate",
      requiresConfirmation: true,
      confirmationMessage: "导入整理建议已生成，请确认应用以下调整：",
      config: {
        toolName: "generate_summary",
        args: {
          template: "onboarding_summary",
          sections: [
            {
              title: "导入统计",
              variable: "importedCount",
            },
            {
              title: "重复检测",
              variable: "duplicateCount",
            },
            {
              title: "分类建议",
              variable: "suggestedFolders",
            },
            {
              title: "标签推荐",
              variable: "suggestedTagCount",
            },
          ],
        },
      },
    },
  ],

  config: {
    timeout: 180000,
    notifyOnComplete: true,
    notifyOnFailure: true,
  },
};
