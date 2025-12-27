/**
 * 页面监控配额常量
 *
 * 定义不同会员等级的监控配额限制
 */

// 检查间隔类型
export type CheckInterval =
  | "every_6h"
  | "twice_daily"
  | "daily"
  | "weekly"
  | "custom";

// 监控配额配置
export const MONITOR_QUOTA = {
  FREE: {
    maxCount: 5,
    maxVersions: 1,
    allowedIntervals: ["daily", "weekly"] as CheckInterval[],
  },
  PRO: {
    maxCount: 50,
    maxVersions: 3,
    allowedIntervals: [
      "every_6h",
      "twice_daily",
      "daily",
      "weekly",
      "custom",
    ] as CheckInterval[],
  },
} as const;

// 检查间隔显示标签
export const CHECK_INTERVAL_LABELS: Record<CheckInterval, string> = {
  every_6h: "每 6 小时",
  twice_daily: "每天 2 次",
  daily: "每天",
  weekly: "每周",
  custom: "自定义",
};

// 检查间隔对应的小时数
export const CHECK_INTERVAL_HOURS: Record<CheckInterval, number> = {
  every_6h: 6,
  twice_daily: 12,
  daily: 24,
  weekly: 168,
  custom: 24, // 默认值
};

// 保护机制常量
export const MONITOR_PROTECTION = {
  /** 系统每分钟最多检查数 */
  MAX_CHECKS_PER_MINUTE: 100,
  /** 单用户同时检查数 */
  MAX_CONCURRENT_PER_USER: 3,
  /** 失败后重试延迟（小时） */
  RETRY_DELAY_HOURS: 1,
  /** 连续失败暂停阈值 */
  MAX_CONSECUTIVE_FAILURES: 3,
  /** 单次检查超时（毫秒） */
  CHECK_TIMEOUT_MS: 30000,
} as const;

// 日志保留天数
export const CHECK_LOG_RETENTION_DAYS = 30;

// 版本保留策略
export const VERSION_RETENTION = {
  FREE: 1,
  PRO: 3,
} as const;
