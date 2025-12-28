/**
 * 游戏策划画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 游戏策划画像配置
 */
export const GAME_PLANNER_CONFIG: PersonaConfig = {
  id: "game_planner",
  group: "design",
  name: "游戏策划",
  icon: "🎮",
  description: "游戏设计策划师，负责游戏机制和体验设计",

  behaviorSignals: {
    tagPatterns: [
      /游戏|game|策划|设计|design/i,
      /机制|玩法|系统|数值|balance/i,
      /关卡|level|剧情|narrative/i,
      /用户体验|UX|反馈|engagement/i,
      /竞品|分析|拆解|review/i,
    ],
    platformPreferences: [
      "TapTap",
      "Steam",
      "GDC",
      "GameRes",
      "游研社",
      "Gamasutra",
    ],
    contentTypes: ["游戏分析", "策划文档", "机制拆解", "竞品报告", "设计案例"],
    folderPatterns: [/游戏/, /策划/, /设计/, /竞品/, /素材/],
    domainPatterns: [
      /taptap\.cn/,
      /store\.steampowered\.com/,
      /gdconf\.com/,
      /gameres\.com/,
      /gamedeveloper\.com/,
    ],
  },

  intentBoosts: {
    game_analysis: 1.8,
    mechanic_compare: 1.7,
    narrative_organize: 1.6,
    find_related: 1.4,
    theme_organize: 1.3,
  },

  promptKey: "design.game_planner",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "detailed",
    proactiveReminders: true,
    emojiStyle: "rich",
  },
};
