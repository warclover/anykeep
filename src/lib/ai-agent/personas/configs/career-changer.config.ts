/**
 * 职业转型者画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 职业转型者画像配置
 */
export const CAREER_CHANGER_CONFIG: PersonaConfig = {
  id: "career_changer",
  group: "growth",
  name: "职业转型者",
  icon: "🔄",
  description: "职业转型中的人群，探索新领域和新机会",

  behaviorSignals: {
    tagPatterns: [
      /转型|转行|career change|跳槽/i,
      /求职|面试|简历|job hunting/i,
      /技能|学习|入门|入行/i,
      /行业|领域|赛道|industry/i,
      /规划|计划|路径|roadmap/i,
    ],
    platformPreferences: [
      "脉脉",
      "LinkedIn",
      "Boss直聘",
      "知乎",
      "牛客网",
      "拉勾",
    ],
    contentTypes: ["转型经验", "学习路径", "行业分析", "面试准备", "技能清单"],
    folderPatterns: [/转型/, /求职/, /学习/, /行业/, /面试/],
    domainPatterns: [
      /maimai\.cn/,
      /linkedin\.com/,
      /zhipin\.com/,
      /zhihu\.com/,
      /nowcoder\.com/,
    ],
  },

  intentBoosts: {
    skill_gap: 1.8,
    resource_integrate: 1.6,
    find_related: 1.5,
    theme_organize: 1.4,
  },

  promptKey: "growth.career_changer",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "detailed",
    proactiveReminders: true,
    emojiStyle: "minimal",
  },
};
