/**
 * 策展人画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 策展人画像配置
 */
export const CURATOR_CONFIG: PersonaConfig = {
  id: "curator",
  group: "content",
  name: "策展人",
  icon: "🎨",
  description: "内容策展、资讯整合者，精选和组织优质内容",

  behaviorSignals: {
    tagPatterns: [
      /精选|推荐|优质|收录|curated/i,
      /周刊|日报|早报|newsletter/i,
      /整理|汇总|合集|专题/i,
      /资讯|信息源|订阅|RSS/i,
      /趋势|热点|榜单|排行/i,
    ],
    platformPreferences: [
      "即刻",
      "Twitter/X",
      "微信公众号",
      "少数派",
      "Product Hunt",
      "Hacker News",
    ],
    contentTypes: ["精选文章", "周刊合集", "资讯汇总", "专题策划", "榜单推荐"],
    folderPatterns: [/精选/, /周刊/, /专题/, /信息源/, /推荐/],
    domainPatterns: [
      /okjike\.com/,
      /sspai\.com/,
      /producthunt\.com/,
      /news\.ycombinator\.com/,
    ],
  },

  intentBoosts: {
    content_curation: 1.8,
    trend_tracking: 1.6,
    source_manage: 1.5,
    theme_organize: 1.4,
    batch_summarize: 1.3,
  },

  promptKey: "content.curator",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "concise",
    proactiveReminders: true,
    emojiStyle: "rich",
  },
};
