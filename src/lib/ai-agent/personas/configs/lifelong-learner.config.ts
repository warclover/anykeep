/**
 * 终身学习者画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 终身学习者画像配置
 */
export const LIFELONG_LEARNER_CONFIG: PersonaConfig = {
  id: "lifelong_learner",
  group: "growth",
  name: "终身学习者",
  icon: "📚",
  description: "持续学习进步者，广泛涉猎多领域知识",

  behaviorSignals: {
    tagPatterns: [
      /学习|阅读|知识|reading|learning/i,
      /书单|笔记|摘要|notes|summary/i,
      /成长|进步|提升|growth/i,
      /技能|能力|competency|skill/i,
      /思维|方法|模型|mental model/i,
    ],
    platformPreferences: [
      "微信读书",
      "得到",
      "知乎",
      "豆瓣读书",
      "Pocket",
      "Readwise",
    ],
    contentTypes: ["读书笔记", "知识卡片", "学习计划", "课程资料", "成长记录"],
    folderPatterns: [/读书/, /学习/, /笔记/, /成长/, /知识/],
    domainPatterns: [
      /weread\.qq\.com/,
      /dedao\.cn/,
      /zhihu\.com/,
      /book\.douban\.com/,
      /getpocket\.com/,
    ],
  },

  intentBoosts: {
    knowledge_map: 1.8,
    resource_integrate: 1.7,
    reading_manage: 1.6,
    batch_summarize: 1.5,
    theme_organize: 1.4,
  },

  promptKey: "growth.lifelong_learner",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "auto",
    proactiveReminders: true,
    emojiStyle: "minimal",
  },
};
