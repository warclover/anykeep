/**
 * 记者画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 记者画像配置
 */
export const JOURNALIST_CONFIG: PersonaConfig = {
  id: "journalist",
  group: "professional",
  name: "记者",
  icon: "📰",
  description: "新闻媒体从业者，采写新闻和深度报道",

  behaviorSignals: {
    tagPatterns: [
      /新闻|报道|调查|采访|news/i,
      /信源|素材|核查|fact-check/i,
      /时事|热点|事件|breaking/i,
      /深度|专题|特稿|feature/i,
      /媒体|发布|传播|press/i,
    ],
    platformPreferences: [
      "财新",
      "界面新闻",
      "澎湃新闻",
      "路透社",
      "BBC",
      "纽约时报",
    ],
    contentTypes: ["新闻报道", "深度专题", "调查素材", "采访记录", "信源资料"],
    folderPatterns: [/新闻/, /素材/, /调查/, /信源/, /专题/],
    domainPatterns: [
      /caixin\.com/,
      /jiemian\.com/,
      /thepaper\.cn/,
      /reuters\.com/,
      /bbc\.com/,
    ],
  },

  intentBoosts: {
    source_manage: 1.8,
    fact_check: 1.7,
    timeline_organize: 1.6,
    trend_tracking: 1.5,
    find_related: 1.4,
  },

  promptKey: "professional.journalist",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "concise",
    proactiveReminders: true,
    emojiStyle: "none",
  },
};
