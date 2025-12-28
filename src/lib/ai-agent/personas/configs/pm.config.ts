/**
 * 产品经理画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 产品经理画像配置
 */
export const PM_CONFIG: PersonaConfig = {
  id: "pm",
  group: "design",
  name: "产品经理",
  icon: "🚀",
  description: "B端/C端产品经理，负责产品规划和设计",

  behaviorSignals: {
    tagPatterns: [
      /竞品|竞对|产品分析|功能对比/,
      /PRD|需求文档|功能设计|产品设计/,
      /用户(反馈|调研|画像|访谈|需求)/,
      /数据(分析|指标|埋点|看板|驱动)/,
      /产品(规划|路线|迭代|优化)/,
    ],
    platformPreferences: [
      "即刻",
      "人人都是产品经理",
      "ProductHunt",
      "36氪",
      "少数派",
    ],
    contentTypes: ["竞品截图", "产品案例", "行业报告", "PRD模板", "数据报表"],
    folderPatterns: [/竞品/, /需求/, /用研/, /数据/, /产品/],
    domainPatterns: [
      /woshipm\.com/,
      /36kr\.com/,
      /producthunt\.com/,
      /sspai\.com/,
    ],
  },

  intentBoosts: {
    competitive_analysis: 1.7,
    feedback_cluster: 1.6,
    prd_material: 1.5,
    data_tracking: 1.4,
    trend_tracking: 1.3,
    industry_research: 1.2,
  },

  promptKey: "design.pm",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "detailed",
    proactiveReminders: true,
    emojiStyle: "rich",
  },
};
