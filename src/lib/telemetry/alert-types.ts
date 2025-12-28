/**
 * 告警类型定义
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

// ============================================
// 告警级别
// ============================================

/**
 * 告警严重级别
 */
export type AlertSeverity = "critical" | "warning" | "info";

/**
 * 告警状态
 */
export type AlertState = "firing" | "resolved" | "pending";

// ============================================
// 告警规则
// ============================================

/**
 * 告警规则条件
 */
export interface AlertCondition {
  /** 指标名称 */
  metric: string;
  /** 操作符 */
  operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
  /** 阈值 */
  threshold: number;
  /** 持续时间（毫秒）- 可选 */
  duration?: number;
  /** 标签过滤 */
  labels?: Record<string, string>;
}

/**
 * 告警规则定义
 */
export interface AlertRule {
  /** 规则唯一标识 */
  id: string;
  /** 规则名称 */
  name: string;
  /** 规则描述 */
  description: string;
  /** 告警条件 */
  condition: AlertCondition;
  /** 严重级别 */
  severity: AlertSeverity;
  /** 是否启用 */
  enabled: boolean;
  /** 附加标签 */
  labels?: Record<string, string>;
  /** 告警消息模板 */
  messageTemplate?: string;
  /** 恢复消息模板 */
  resolveTemplate?: string;
}

// ============================================
// 告警实例
// ============================================

/**
 * 告警实例
 */
export interface AlertInstance {
  /** 实例唯一标识 */
  id: string;
  /** 关联的规则 ID */
  ruleId: string;
  /** 规则名称 */
  ruleName: string;
  /** 当前状态 */
  state: AlertState;
  /** 严重级别 */
  severity: AlertSeverity;
  /** 当前值 */
  value: number;
  /** 阈值 */
  threshold: number;
  /** 触发时间 */
  firedAt?: number;
  /** 解决时间 */
  resolvedAt?: number;
  /** 附加标签 */
  labels: Record<string, string>;
  /** 告警消息 */
  message: string;
  /** 注解/附加信息 */
  annotations?: Record<string, string>;
}

// ============================================
// 通知渠道
// ============================================

/**
 * 通知渠道类型
 */
export type NotificationChannelType = "slack" | "email" | "webhook" | "console";

/**
 * 通知渠道配置基类
 */
export interface NotificationChannelBase {
  /** 渠道唯一标识 */
  id: string;
  /** 渠道名称 */
  name: string;
  /** 渠道类型 */
  type: NotificationChannelType;
  /** 是否启用 */
  enabled: boolean;
  /** 接收的严重级别 */
  severities: AlertSeverity[];
}

/**
 * Slack 通知渠道配置
 */
export interface SlackChannelConfig extends NotificationChannelBase {
  type: "slack";
  /** Webhook URL */
  webhookUrl: string;
  /** 频道名称（可选） */
  channel?: string;
  /** 用户名（可选） */
  username?: string;
  /** 图标 Emoji（可选） */
  iconEmoji?: string;
}

/**
 * Email 通知渠道配置
 */
export interface EmailChannelConfig extends NotificationChannelBase {
  type: "email";
  /** 收件人列表 */
  recipients: string[];
  /** 发件人地址 */
  from?: string;
  /** SMTP 配置（可选，使用默认配置时省略） */
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  };
}

/**
 * Webhook 通知渠道配置
 */
export interface WebhookChannelConfig extends NotificationChannelBase {
  type: "webhook";
  /** Webhook URL */
  url: string;
  /** HTTP 方法 */
  method: "POST" | "PUT";
  /** 请求头 */
  headers?: Record<string, string>;
  /** 认证类型 */
  authType?: "none" | "basic" | "bearer";
  /** 认证凭据 */
  authCredentials?: string;
}

/**
 * 控制台通知渠道配置（用于开发调试）
 */
export interface ConsoleChannelConfig extends NotificationChannelBase {
  type: "console";
}

/**
 * 通知渠道配置联合类型
 */
export type NotificationChannelConfig =
  | SlackChannelConfig
  | EmailChannelConfig
  | WebhookChannelConfig
  | ConsoleChannelConfig;

// ============================================
// 告警管理器配置
// ============================================

/**
 * 告警管理器配置
 */
export interface AlertManagerConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 评估间隔（毫秒） */
  evaluationInterval: number;
  /** 告警规则 */
  rules: AlertRule[];
  /** 通知渠道 */
  channels: NotificationChannelConfig[];
  /** 告警分组键 */
  groupByKeys?: string[];
  /** 分组等待时间（毫秒） */
  groupWait?: number;
  /** 分组间隔时间（毫秒） */
  groupInterval?: number;
  /** 重复通知间隔（毫秒） */
  repeatInterval?: number;
}

/**
 * 默认告警管理器配置
 */
export const DEFAULT_ALERT_MANAGER_CONFIG: AlertManagerConfig = {
  enabled: true,
  evaluationInterval: 60000, // 1 分钟
  rules: [],
  channels: [],
  groupByKeys: ["alertname", "severity"],
  groupWait: 30000, // 30 秒
  groupInterval: 300000, // 5 分钟
  repeatInterval: 3600000, // 1 小时
};

// ============================================
// 通知结果
// ============================================

/**
 * 通知发送结果
 */
export interface NotificationResult {
  /** 渠道 ID */
  channelId: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（如果失败） */
  error?: string;
  /** 发送时间 */
  sentAt: number;
}

// ============================================
// 告警事件
// ============================================

/**
 * 告警事件类型
 */
export type AlertEventType = "fired" | "resolved" | "pending" | "silenced";

/**
 * 告警事件
 */
export interface AlertEvent {
  /** 事件类型 */
  type: AlertEventType;
  /** 告警实例 */
  alert: AlertInstance;
  /** 事件时间 */
  timestamp: number;
  /** 通知结果（如果已发送） */
  notificationResults?: NotificationResult[];
}
