/**
 * 通用用户画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 通用用户画像配置
 *
 * 作为兜底画像，适用于无法明确分类的用户
 */
export const GENERAL_CONFIG: PersonaConfig = {
  id: "general",
  group: "general",
  name: "通用用户",
  icon: "👤",
  description: "默认画像，提供通用的收藏管理和智能助手服务",

  behaviorSignals: {
    tagPatterns: [
      // 通用模式：匹配常见的收藏行为
      /收藏|保存|稍后|todo|bookmark/i,
      /有用|有趣|分享|推荐/i,
    ],
    platformPreferences: [
      // 广泛覆盖主流平台
      "微信公众号",
      "知乎",
      "B站",
      "小红书",
      "Twitter/X",
    ],
    contentTypes: ["文章", "视频", "图片", "链接", "笔记"],
    folderPatterns: [/收藏/, /稍后/, /待读/, /重要/],
    domainPatterns: [
      // 通用不限制域名
    ],
  },

  intentBoosts: {
    // 通用画像不加权特定意图
    search: 1.0,
    organize: 1.0,
    export: 1.0,
  },

  promptKey: "general",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "auto",
    proactiveReminders: true,
    emojiStyle: "minimal",
  },
};
