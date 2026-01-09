/**
 * 主题深挖工作流
 *
 * 聚合某主题所有书签，生成知识图谱和学习计划
 *
 * @version 1.1.0
 * @since 2026-01-08
 * @updated 2026-01-09 - 添加语义匹配支持
 */

import type { WorkflowDefinition } from "../types";

/**
 * 主题深挖工作流
 *
 * 步骤：
 * 1. 搜索相关书签
 * 2. 生成主题合成
 * 3. 生成学习路径
 * 4. 提取知识点
 * 5. 呈现学习方案
 */
export const topicDeepDiveWorkflow: WorkflowDefinition = {
  id: "topic_deep_dive",
  name: "主题深挖",
  description: "聚合某主题所有书签，生成知识图谱和学习计划",
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
        "深度学习",
        "系统学习",
        "主题深挖",
        "深入了解",
        // 正则模式（支持主题提取）
        "学习.*相关",
        "深入研究",
        "系统梳理",
        // 自然语言变体
        "帮我梳理",
        "整理学习路径",
        "生成学习计划",
        "知识图谱",
        "主题分析",
      ],
      // 语义匹配：覆盖更多自然语言表达
      semanticPatterns: {
        referenceTexts: [
          "我想系统学习这个领域的知识",
          "帮我把相关的内容都整理成学习路径",
          "想深入了解某个主题，有什么资料",
          "把我收藏的相关文章串起来形成知识体系",
          "给我规划一下这个话题的学习顺序",
          "我想看看关于这个主题我都收藏了什么",
        ],
        threshold: 0.75,
      },
    },
  ],

  steps: [
    {
      id: "search_related",
      name: "搜索相关书签",
      type: "skill",
      config: {
        skillId: "related_discovery",
        inputMapping: {
          query: "${topic}",
          maxResults: 50,
          includeContent: true,
        },
        outputMapping: {
          bookmarks: "relatedBookmarks",
          totalFound: "totalRelated",
        },
      },
    },
    {
      id: "generate_synthesis",
      name: "生成主题合成",
      type: "skill",
      condition: "length(relatedBookmarks) >= 5",
      config: {
        skillId: "thematic_synthesis",
        inputMapping: {
          bookmarkIds: "${relatedBookmarks}",
          topic: "${topic}",
          format: "comprehensive",
        },
        outputMapping: {
          synthesis: "thematicSynthesis",
          keyInsights: "insights",
        },
      },
      onError: "continue",
    },
    {
      id: "create_learning_path",
      name: "生成学习路径",
      type: "skill",
      config: {
        skillId: "learning_path",
        inputMapping: {
          bookmarkIds: "${relatedBookmarks}",
          topic: "${topic}",
          learningStyle: "progressive",
        },
        outputMapping: {
          path: "learningPath",
          estimatedDuration: "duration",
        },
      },
      onError: "continue",
    },
    {
      id: "extract_knowledge",
      name: "提取知识点",
      type: "skill",
      config: {
        skillId: "knowledge_extract",
        inputMapping: {
          bookmarkIds: "${relatedBookmarks}",
          extractType: "key_concepts",
          limit: 20,
        },
        outputMapping: {
          concepts: "keyConcepts",
          relations: "conceptRelations",
        },
      },
      onError: "continue",
    },
    {
      id: "present_result",
      name: "呈现学习方案",
      type: "aggregate",
      config: {
        toolName: "generate_learning_plan",
        args: {
          template: "deep_dive_result",
          sections: [
            { title: "主题概览", variable: "totalRelated" },
            { title: "核心洞察", variable: "insights" },
            { title: "学习路径", variable: "learningPath" },
            { title: "关键概念", variable: "keyConcepts" },
          ],
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
