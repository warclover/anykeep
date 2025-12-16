/**
 * 用户设置类型定义
 * 用于设置页面和 API 之间的数据传递
 */

import type { SnapshotType } from "@/lib/snapshot/snapshot.types";

/**
 * 自动快照设置 (P2-010)
 */
export interface AutoSnapshotSettings {
  /** 功能总开关 (默认: true) */
  enabled: boolean;
  /** 触发标签列表 (默认: ["优质经验"]) */
  triggerTags: string[];
  /** 快照类型 (默认: "basic") */
  snapshotType: SnapshotType;
  /** 创建前显示确认 Toast (默认: true) */
  showConfirmToast: boolean;
  /** 确认延迟时间(毫秒) (默认: 3000) */
  confirmDelayMs: number;
  /** 配额不足时静默跳过 (默认: false) */
  silentOnQuotaExceeded: boolean;
}

/**
 * 用户设置结构
 */
export interface UserSettings {
  /** 平台授权状态 */
  platforms: {
    wechat: boolean;
    bilibili: boolean;
    xiaohongshu: boolean;
    zhihu: boolean;
  };
  /** AI 功能开关 */
  ai: {
    autoTags: boolean;
    autoSummary: boolean;
    semanticSearch: boolean;
  };
  /** 隐私设置 */
  privacy: {
    dataEncryption: boolean;
    shareAnalytics: boolean;
  };
  /** 通知偏好 */
  notifications: {
    email: boolean;
    inApp: boolean;
    weeklyDigest: boolean;
  };
  /** 自动快照设置 (P2-010) */
  autoSnapshot?: AutoSnapshotSettings;
}

/**
 * 默认自动快照设置 (P2-010)
 */
export const DEFAULT_AUTO_SNAPSHOT_SETTINGS: AutoSnapshotSettings = {
  enabled: true,
  triggerTags: ["优质经验"], // 预设「优质经验」已配置
  snapshotType: "basic",
  showConfirmToast: true,
  confirmDelayMs: 3000,
  silentOnQuotaExceeded: false,
};

/**
 * 默认用户设置
 */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  platforms: {
    wechat: false,
    bilibili: false,
    xiaohongshu: false,
    zhihu: false,
  },
  ai: {
    autoTags: true,
    autoSummary: true,
    semanticSearch: false,
  },
  privacy: {
    dataEncryption: true,
    shareAnalytics: false,
  },
  notifications: {
    email: true,
    inApp: true,
    weeklyDigest: false,
  },
  autoSnapshot: DEFAULT_AUTO_SNAPSHOT_SETTINGS,
};

/**
 * 验证并合并设置（处理旧版设置结构）
 */
export function mergeWithDefaults(
  stored: Partial<UserSettings> | null | undefined,
): UserSettings {
  if (!stored) {
    return DEFAULT_USER_SETTINGS;
  }

  return {
    platforms: {
      ...DEFAULT_USER_SETTINGS.platforms,
      ...(stored.platforms || {}),
    },
    ai: {
      ...DEFAULT_USER_SETTINGS.ai,
      ...(stored.ai || {}),
    },
    privacy: {
      ...DEFAULT_USER_SETTINGS.privacy,
      ...(stored.privacy || {}),
    },
    notifications: {
      ...DEFAULT_USER_SETTINGS.notifications,
      ...(stored.notifications || {}),
    },
    autoSnapshot: {
      ...DEFAULT_AUTO_SNAPSHOT_SETTINGS,
      ...(stored.autoSnapshot || {}),
    },
  };
}
