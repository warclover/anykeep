/**
 * 用户设置类型定义
 * 用于设置页面和 API 之间的数据传递
 */

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
}

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
  };
}
