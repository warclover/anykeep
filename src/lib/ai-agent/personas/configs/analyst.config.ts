/**
 * 行业分析师画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 行业分析师画像配置
 */
export const ANALYST_CONFIG: PersonaConfig = {
  id: "analyst",
  group: "professional",
  name: "行业分析师",
  icon: "📊",
  description: "行业研究、投资分析师",

  behaviorSignals: {
    tagPatterns: [
      /研报|券商|分析报告|行业报告/,
      /财报|年报|季报|公告/,
      /数据|指标|KPI|增速/,
      /竞品|公司|企业|上市/,
      /投资|估值|赛道|趋势/,
    ],
    platformPreferences: ["Wind", "Bloomberg", "东方财富", "雪球", "新浪财经"],
    contentTypes: ["研报", "财报数据", "行业新闻", "竞品公告", "访谈记录"],
    folderPatterns: [/研报/, /数据/, /公司/, /行业/, /投资/],
    domainPatterns: [
      /eastmoney\.com/,
      /xueqiu\.com/,
      /wind\.com\.cn/,
      /bloomberg\.com/,
    ],
  },

  intentBoosts: {
    data_tracking: 1.7,
    industry_research: 1.6,
    competitive_analysis: 1.5,
    trend_tracking: 1.4,
    generate_report: 1.3,
  },

  promptKey: "professional.analyst",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "detailed",
    proactiveReminders: true,
    emojiStyle: "none",
  },
};
