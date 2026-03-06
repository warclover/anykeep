/**
 * AI 学习洞察页面 - UI 文本常量
 */

export const TEXT = {
  title: "AI 学习洞察",
  subtitle: "查看 AI 从你的分类行为中学到了什么",
  loading: "加载学习数据中...",
  refresh: "刷新",
  noData: "暂无学习数据",
  noDataHint: "当你手动分类收藏时，AI 会自动学习你的偏好",
  tabs: {
    overview: "学习概览",
    exclusions: "排除规则",
    folders: "文件夹偏好",
    sources: "来源偏好",
  },
  stats: {
    totalEvents: "学习事件",
    accuracy: "分类准确率",
    healthScore: "系统健康",
    exclusionCount: "排除规则",
    confirmations: "确认",
    rejections: "拒绝",
    modifications: "修正",
  },
  exclusions: {
    title: "排除规则",
    description: "AI 学到的「不应该做什么」—— 这些内容不应被分到对应文件夹",
    empty: "暂无排除规则",
    emptyHint: "当你将收藏从一个文件夹移到另一个时，AI 会自动创建排除规则",
    tag: "标签",
    source: "来源",
    keyword: "关键词",
    createdFrom: {
      user_move: "手动移动",
      user_reject: "拒绝分类",
      bulk_move: "批量移动",
      auto_learn: "自动学习",
    } as Record<string, string>,
  },
  folders: {
    title: "文件夹偏好",
    description: "AI 理解的每个文件夹最适合什么类型的内容",
    empty: "暂无文件夹偏好数据",
    bookmarks: "收藏",
    topTags: "关联标签",
    topSources: "关联来源",
  },
  sources: {
    title: "来源偏好",
    description: "AI 学到的各内容来源偏好归入哪个文件夹",
    empty: "暂无来源偏好",
    samples: "样本",
    confidence: "置信度",
  },
  health: {
    title: "系统建议",
    accuracy: "分类准确率",
    confirmation: "确认率",
    fastPath: "快速路径命中",
    satisfaction: "满意度",
  },
  trends: {
    improving: "上升中",
    stable: "稳定",
    declining: "下降中",
    increasing: "增长中",
    decreasing: "减少中",
  } as Record<string, string>,
} as const;
