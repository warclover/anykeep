/**
 * 详情页洞察卡片 UI 文本常量
 *
 * @version 1.0.0
 * @since 2026-03-17
 */

export const DETAIL_INSIGHTS_TEXT = {
  // ============================
  // 分类解释
  // ============================
  classification: {
    sectionTitle: "分类解释",
    classifiedTo: "归入",
    confidence: "置信度",
    expandLabel: "查看详情",
    collapseLabel: "收起",
    matchSourceLabel: "匹配方式",
    alternativesTitle: "其他候选文件夹",
    factorsTitle: "相关因素",
    status: {
      classified: "已分类",
      inbox: "待整理",
      pending: "等待处理",
      uncategorized: "未分类",
    } as Record<string, string>,
    impact: {
      positive: "positive",
      negative: "negative",
      neutral: "neutral",
    },
    noClassification: "暂无分类信息",
    loadError: "获取分类信息失败",
  },

  // ============================
  // 快速对比
  // ============================
  quickCompare: {
    sectionTitle: "快速对比",
    subtitle: "发现高度相似内容",
    compareButton: "一键对比",
    similarity: "相似度",
    generating: "正在生成对比报告...",
    compareComplete: "对比完成",
    compareError: "对比生成失败",
  },

  // ============================
  // 综述入口
  // ============================
  synthesisEntry: {
    sectionTitle: "主题综述",
    folderDescription: (name: string, count: number) =>
      `文件夹「${name}」共 ${count} 篇`,
    tagDescription: (tag: string, count: number) =>
      `标签「${tag}」匹配 ${count} 篇`,
    createButton: "生成综合报告",
    viewExisting: "查看已有报告",
  },

  // ============================
  // 知识定位（Phase 3）
  // ============================
  knowledgePosition: {
    sectionTitle: "知识定位",
    topicLabel: "所属主题",
    bookmarkCount: (n: number) => `${n} 篇内容`,
    emergingBadge: "新兴主题",
    keywordsLabel: "关键词",
  },
} as const;
