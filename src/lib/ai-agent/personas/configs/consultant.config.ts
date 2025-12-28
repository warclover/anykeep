/**
 * 咨询顾问画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 咨询顾问画像配置
 */
export const CONSULTANT_CONFIG: PersonaConfig = {
  id: "consultant",
  group: "professional",
  name: "咨询顾问",
  icon: "💼",
  description: "管理/战略咨询顾问，服务企业客户",

  behaviorSignals: {
    tagPatterns: [
      /行业(报告|研究|分析|洞察)/,
      /案例|最佳实践|方法论|框架/,
      /麦肯锡|BCG|贝恩|德勤|埃森哲/,
      /战略|咨询|转型|变革/,
      /数字化|组织|管理|运营/,
    ],
    platformPreferences: ["麦肯锡", "BCG", "哈佛商业评论", "36氪", "虎嗅"],
    contentTypes: ["行业报告", "咨询案例", "方法论", "PPT模板", "数据来源"],
    folderPatterns: [/案例/, /行业/, /方法论/, /报告/, /咨询/],
    domainPatterns: [/mckinsey\.com/, /bcg\.com/, /hbr\.org/, /hbrchina\.org/],
  },

  intentBoosts: {
    industry_research: 1.7,
    case_library: 1.6,
    methodology_organize: 1.5,
    theme_organize: 1.3,
    data_export: 1.2,
  },

  promptKey: "professional.consultant",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "detailed",
    proactiveReminders: true,
    emojiStyle: "minimal",
  },
};
