/**
 * 技术架构师画像配置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type { PersonaConfig } from "../types";
import { DEFAULT_PERSONA_PREFERENCES } from "../types";

/**
 * 技术架构师画像配置
 */
export const ARCHITECT_CONFIG: PersonaConfig = {
  id: "architect",
  group: "tech",
  name: "技术架构师",
  icon: "🏗️",
  description: "系统架构设计者，负责技术选型和架构决策",

  behaviorSignals: {
    tagPatterns: [
      /架构|architecture|设计模式|pattern/i,
      /微服务|分布式|云原生|kubernetes/i,
      /性能|scalability|高可用|容灾/i,
      /技术选型|评估|对比|benchmark/i,
      /系统设计|领域驱动|DDD|重构/i,
    ],
    platformPreferences: [
      "InfoQ",
      "美团技术团队",
      "阿里技术",
      "Martin Fowler",
      "ThoughtWorks",
      "Medium",
    ],
    contentTypes: ["架构文档", "技术博客", "设计规范", "性能报告", "案例分析"],
    folderPatterns: [/架构/, /设计/, /技术/, /方案/, /评估/],
    domainPatterns: [
      /infoq\.cn/,
      /tech\.meituan\.com/,
      /martinfowler\.com/,
      /thoughtworks\.com/,
    ],
  },

  intentBoosts: {
    tech_compare: 1.8,
    best_practice: 1.7,
    find_related: 1.5,
    trend_tracking: 1.4,
    theme_organize: 1.3,
  },

  promptKey: "tech.architect",

  defaultPreferences: {
    ...DEFAULT_PERSONA_PREFERENCES,
    responseStyle: "detailed",
    proactiveReminders: true,
    codeBlocks: true,
    emojiStyle: "minimal",
  },
};
