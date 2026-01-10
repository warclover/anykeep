/**
 * Skill Feature Flag 同步模块
 *
 * 职责：
 * - 同步 Feature Flag 和 Skill 映射的启用状态
 * - 当 Feature Flag 禁用某个 Skill 时，自动禁用相关意图规则
 * - 提供统一的 Skill 可用性查询 API
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import { logger } from "@/lib/logger";

// ============================================
// 类型定义
// ============================================

/**
 * Skill 与 Feature Flag 的映射关系
 */
export interface SkillFeatureFlagMapping {
  /** Skill ID */
  skillId: string;
  /** 对应的 Feature Flag 环境变量名 */
  featureFlagEnv: string;
  /** 默认启用状态（环境变量未设置时） */
  defaultEnabled: boolean;
  /** 相关的意图规则键（intentType:subType） */
  relatedIntentKeys: string[];
}

/**
 * Skill 可用性状态
 */
export interface SkillAvailability {
  /** Skill ID */
  skillId: string;
  /** 是否可用 */
  available: boolean;
  /** 不可用的原因（如果不可用） */
  reason?: string;
}

// ============================================
// Skill → Feature Flag 映射配置
// ============================================

/**
 * Skill 与 Feature Flag 的映射关系表
 *
 * 只列出有独立 Feature Flag 控制的 Skill
 * 未列出的 Skill 默认启用
 */
export const SKILL_FEATURE_FLAG_MAPPINGS: SkillFeatureFlagMapping[] = [
  // 链接健康检测
  {
    skillId: "link_health_check",
    featureFlagEnv: "ENABLE_LINK_HEALTH_CHECK",
    defaultEnabled: true,
    relatedIntentKeys: ["action:link_health", "query:link_health"],
  },

  // TTS 语音朗读
  {
    skillId: "tts_synthesis",
    featureFlagEnv: "ENABLE_TTS_SYNTHESIS",
    defaultEnabled: true,
    relatedIntentKeys: ["create:tts"],
  },

  // 微信阅读摘要
  {
    skillId: "wechat_digest",
    featureFlagEnv: "ENABLE_WECHAT_DIGEST",
    defaultEnabled: true,
    relatedIntentKeys: ["create:wechat_digest", "query:wechat_digest"],
  },

  // B站字幕提取
  {
    skillId: "bilibili_transcript",
    featureFlagEnv: "ENABLE_BILIBILI_TRANSCRIPT",
    defaultEnabled: true,
    relatedIntentKeys: ["create:bilibili_transcript", "query:bilibili"],
  },

  // 收件箱摘要
  {
    skillId: "inbox_digest",
    featureFlagEnv: "ENABLE_INBOX_DIGEST",
    defaultEnabled: true,
    relatedIntentKeys: ["query:inbox_digest"],
  },

  // 内容变更监控
  {
    skillId: "content_change_monitor",
    featureFlagEnv: "ENABLE_CONTENT_CHANGE_MONITOR",
    defaultEnabled: true,
    relatedIntentKeys: ["action:content_monitor", "query:content_changes"],
  },

  // 主动复习 Brain-Sync
  {
    skillId: "active_recall",
    featureFlagEnv: "ENABLE_ACTIVE_RECALL",
    defaultEnabled: true,
    relatedIntentKeys: [
      "learn:active_recall_start",
      "query:mastery_stats",
      "action:review_preferences",
    ],
  },

  // 主题合成器
  {
    skillId: "thematic_synthesis",
    featureFlagEnv: "ENABLE_THEMATIC_SYNTHESIS",
    defaultEnabled: true,
    relatedIntentKeys: ["create:synthesis", "analyze:synthesis"],
  },

  // 收件箱智能分拣
  {
    skillId: "inbox_triage",
    featureFlagEnv: "ENABLE_INBOX_TRIAGE",
    defaultEnabled: true,
    relatedIntentKeys: ["organize:inbox_triage", "query:inbox_triage"],
  },

  // 文件夹智能推荐
  {
    skillId: "folder_recommend",
    featureFlagEnv: "ENABLE_FOLDER_RECOMMEND",
    defaultEnabled: true,
    relatedIntentKeys: ["query:folder_recommend", "action:folder_recommend"],
  },

  // 搜索优化助手
  {
    skillId: "search_optimize",
    featureFlagEnv: "ENABLE_SEARCH_OPTIMIZE",
    defaultEnabled: true,
    relatedIntentKeys: ["query:search_optimize"],
  },

  // 知识图谱探索
  {
    skillId: "knowledge_graph_explore",
    featureFlagEnv: "ENABLE_KNOWLEDGE_GRAPH_EXPLORE",
    defaultEnabled: true,
    relatedIntentKeys: [
      "analyze:knowledge_graph",
      "query:knowledge_graph",
      "learn:knowledge_graph",
    ],
  },

  // 文件夹健康检查
  {
    skillId: "folder_health_check",
    featureFlagEnv: "ENABLE_FOLDER_HEALTH_CHECK",
    defaultEnabled: true,
    relatedIntentKeys: ["query:folder_health", "action:folder_health"],
  },

  // 快照对比分析
  {
    skillId: "snapshot_compare",
    featureFlagEnv: "ENABLE_SNAPSHOT_COMPARE",
    defaultEnabled: true,
    relatedIntentKeys: ["analyze:snapshot_compare", "query:snapshot_compare"],
  },
];

// ============================================
// 核心同步逻辑
// ============================================

/**
 * 检查 Skill 是否因 Feature Flag 被禁用
 *
 * @param skillId - Skill ID
 * @returns 是否启用
 */
export function isSkillEnabledByFeatureFlag(skillId: string): boolean {
  const mapping = SKILL_FEATURE_FLAG_MAPPINGS.find(
    (m) => m.skillId === skillId,
  );

  if (!mapping) {
    // 没有独立 Feature Flag 的 Skill 默认启用
    return true;
  }

  const envValue = process.env[mapping.featureFlagEnv];

  // 环境变量未设置时使用默认值
  if (envValue === undefined) {
    return mapping.defaultEnabled;
  }

  // 显式设置为 "false" 时禁用
  return envValue !== "false";
}

/**
 * 检查意图键是否因 Skill 被禁用而不可用
 *
 * @param intentKey - 意图键（intentType:subType）
 * @returns 是否可用
 */
export function isIntentKeyAvailable(intentKey: string): boolean {
  // 查找所有引用此意图键的 Skill
  const relatedMappings = SKILL_FEATURE_FLAG_MAPPINGS.filter((m) =>
    m.relatedIntentKeys.includes(intentKey),
  );

  // 如果没有相关映射，意图键默认可用
  if (relatedMappings.length === 0) {
    return true;
  }

  // 如果有任何一个相关 Skill 被禁用，意图键不可用
  for (const mapping of relatedMappings) {
    if (!isSkillEnabledByFeatureFlag(mapping.skillId)) {
      return false;
    }
  }

  return true;
}

/**
 * 获取所有被禁用的意图键
 *
 * @returns 被禁用的意图键列表
 */
export function getDisabledIntentKeys(): string[] {
  const disabledKeys: string[] = [];

  for (const mapping of SKILL_FEATURE_FLAG_MAPPINGS) {
    if (!isSkillEnabledByFeatureFlag(mapping.skillId)) {
      disabledKeys.push(...mapping.relatedIntentKeys);
    }
  }

  return [...new Set(disabledKeys)]; // 去重
}

/**
 * 获取 Skill 可用性状态
 *
 * @param skillId - Skill ID
 * @returns 可用性状态
 */
export function getSkillAvailability(skillId: string): SkillAvailability {
  const mapping = SKILL_FEATURE_FLAG_MAPPINGS.find(
    (m) => m.skillId === skillId,
  );

  if (!mapping) {
    return {
      skillId,
      available: true,
    };
  }

  const enabled = isSkillEnabledByFeatureFlag(skillId);

  if (enabled) {
    return {
      skillId,
      available: true,
    };
  }

  return {
    skillId,
    available: false,
    reason: `Feature Flag ${mapping.featureFlagEnv} 已禁用`,
  };
}

/**
 * 获取所有 Skill 的可用性状态
 *
 * @returns 所有 Skill 的可用性状态
 */
export function getAllSkillAvailability(): SkillAvailability[] {
  return SKILL_FEATURE_FLAG_MAPPINGS.map((m) =>
    getSkillAvailability(m.skillId),
  );
}

/**
 * 获取 Skill 的 Feature Flag 状态摘要（用于日志）
 */
export function getFeatureFlagSummary(): Record<
  string,
  {
    enabled: boolean;
    envVar: string;
    disabledIntentKeys: string[];
  }
> {
  const summary: Record<
    string,
    {
      enabled: boolean;
      envVar: string;
      disabledIntentKeys: string[];
    }
  > = {};

  for (const mapping of SKILL_FEATURE_FLAG_MAPPINGS) {
    const enabled = isSkillEnabledByFeatureFlag(mapping.skillId);
    summary[mapping.skillId] = {
      enabled,
      envVar: mapping.featureFlagEnv,
      disabledIntentKeys: enabled ? [] : mapping.relatedIntentKeys,
    };
  }

  return summary;
}

// ============================================
// 同步器类
// ============================================

/**
 * Skill Feature Flag 同步器
 *
 * 用于在启动时检查并记录 Feature Flag 状态
 */
export class SkillFeatureFlagSync {
  private initialized = false;

  /**
   * 初始化同步器（启动时调用一次）
   *
   * 记录所有 Feature Flag 状态和被禁用的意图键
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    const disabledSkills: string[] = [];
    const disabledIntentKeys = getDisabledIntentKeys();

    for (const mapping of SKILL_FEATURE_FLAG_MAPPINGS) {
      if (!isSkillEnabledByFeatureFlag(mapping.skillId)) {
        disabledSkills.push(mapping.skillId);
      }
    }

    if (disabledSkills.length > 0) {
      logger.info(
        {
          disabledSkills,
          disabledIntentKeys,
          totalSkills: SKILL_FEATURE_FLAG_MAPPINGS.length,
        },
        "SkillFeatureFlagSync: Some skills are disabled by Feature Flags",
      );
    } else {
      logger.debug(
        { totalSkills: SKILL_FEATURE_FLAG_MAPPINGS.length },
        "SkillFeatureFlagSync: All skills are enabled",
      );
    }

    this.initialized = true;
  }

  /**
   * 检查 Skill 是否可用
   */
  isSkillAvailable(skillId: string): boolean {
    return isSkillEnabledByFeatureFlag(skillId);
  }

  /**
   * 检查意图键是否可用
   */
  isIntentKeyAvailable(intentKey: string): boolean {
    return isIntentKeyAvailable(intentKey);
  }

  /**
   * 获取被禁用的意图键
   */
  getDisabledIntentKeys(): string[] {
    return getDisabledIntentKeys();
  }
}

// ============================================
// 单例实例
// ============================================

let _syncInstance: SkillFeatureFlagSync | null = null;

/**
 * 获取同步器单例
 */
export function getSkillFeatureFlagSync(): SkillFeatureFlagSync {
  if (!_syncInstance) {
    _syncInstance = new SkillFeatureFlagSync();
  }
  return _syncInstance;
}

/**
 * 重置同步器（测试用）
 */
export function resetSkillFeatureFlagSync(): void {
  _syncInstance = null;
}
