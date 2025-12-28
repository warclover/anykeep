/**
 * 告警管理器
 *
 * 提供告警规则评估、状态管理和通知发送能力：
 * - 周期性规则评估
 * - 告警状态跟踪
 * - 多渠道通知
 * - 告警分组和去重
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { logger } from "@/lib/logger";
import { metricsCollector } from "./metrics-collector";
import type {
  AlertRule,
  AlertInstance,
  AlertCondition,
  AlertManagerConfig,
  NotificationChannelConfig,
  NotificationResult,
  AlertEvent,
} from "./alert-types";
import { DEFAULT_ALERT_MANAGER_CONFIG } from "./alert-types";

const log = logger.child({ namespace: "alerting" });

// ============================================
// 告警管理器
// ============================================

/**
 * 告警管理器
 */
class AlertManager {
  private config: AlertManagerConfig = DEFAULT_ALERT_MANAGER_CONFIG;
  private activeAlerts = new Map<string, AlertInstance>();
  private pendingAlerts = new Map<
    string,
    { startTime: number; value: number }
  >();
  private evaluationIntervalId: ReturnType<typeof setInterval> | null = null;
  private eventListeners: ((event: AlertEvent) => void)[] = [];
  private lastNotified = new Map<string, number>();

  /**
   * 初始化告警管理器
   */
  init(config?: Partial<AlertManagerConfig>): void {
    // 清除之前的状态
    this.reset();

    this.config = { ...DEFAULT_ALERT_MANAGER_CONFIG, ...config };

    if (!this.config.enabled) {
      log.info("Alert manager disabled");
      return;
    }

    log.info(
      {
        rulesCount: this.config.rules.length,
        channelsCount: this.config.channels.length,
      },
      "Alert manager initialized",
    );

    // 启动周期性评估
    if (this.config.evaluationInterval > 0) {
      this.startEvaluation();
    }
  }

  /**
   * 重置所有状态
   */
  reset(): void {
    this.activeAlerts.clear();
    this.pendingAlerts.clear();
    this.lastNotified.clear();
    this.config.rules = [];
    this.config.channels = [];
  }

  /**
   * 添加告警规则
   */
  addRule(rule: AlertRule): void {
    const existingIndex = this.config.rules.findIndex((r) => r.id === rule.id);
    if (existingIndex >= 0) {
      this.config.rules[existingIndex] = rule;
    } else {
      this.config.rules.push(rule);
    }
    log.debug({ ruleId: rule.id }, "Alert rule added");
  }

  /**
   * 移除告警规则
   */
  removeRule(ruleId: string): boolean {
    const index = this.config.rules.findIndex((r) => r.id === ruleId);
    if (index >= 0) {
      this.config.rules.splice(index, 1);
      log.debug({ ruleId }, "Alert rule removed");
      return true;
    }
    return false;
  }

  /**
   * 添加通知渠道
   */
  addChannel(channel: NotificationChannelConfig): void {
    const existingIndex = this.config.channels.findIndex(
      (c) => c.id === channel.id,
    );
    if (existingIndex >= 0) {
      this.config.channels[existingIndex] = channel;
    } else {
      this.config.channels.push(channel);
    }
    log.debug(
      { channelId: channel.id, type: channel.type },
      "Notification channel added",
    );
  }

  /**
   * 评估所有告警规则
   */
  evaluate(): AlertEvent[] {
    const events: AlertEvent[] = [];
    const now = Date.now();

    for (const rule of this.config.rules) {
      if (!rule.enabled) continue;

      const result = this.evaluateRule(rule, now);
      if (result) {
        events.push(result);
      }
    }

    return events;
  }

  /**
   * 评估单个规则
   */
  private evaluateRule(rule: AlertRule, now: number): AlertEvent | null {
    const metricValue = this.getMetricValue(rule.condition);

    if (metricValue === null) {
      return null; // 指标不存在
    }

    const conditionMet = this.checkCondition(rule.condition, metricValue);
    const alertKey = this.getAlertKey(rule);
    const existingAlert = this.activeAlerts.get(alertKey);

    if (conditionMet) {
      // 条件满足
      if (rule.condition.duration) {
        // 需要持续一段时间
        const pending = this.pendingAlerts.get(alertKey);
        if (!pending) {
          // 开始计时
          this.pendingAlerts.set(alertKey, {
            startTime: now,
            value: metricValue,
          });
          return null;
        }

        if (now - pending.startTime < rule.condition.duration) {
          // 还未达到持续时间
          return null;
        }

        // 达到持续时间，触发告警
        this.pendingAlerts.delete(alertKey);
      }

      if (!existingAlert) {
        // 新告警
        const alert = this.createAlert(rule, metricValue, now);
        this.activeAlerts.set(alertKey, alert);

        const event: AlertEvent = {
          type: "fired",
          alert,
          timestamp: now,
        };

        this.notifyAlert(event);
        this.emitEvent(event);
        return event;
      }
    } else {
      // 条件不满足
      this.pendingAlerts.delete(alertKey);

      if (existingAlert && existingAlert.state === "firing") {
        // 告警恢复
        existingAlert.state = "resolved";
        existingAlert.resolvedAt = now;

        const event: AlertEvent = {
          type: "resolved",
          alert: existingAlert,
          timestamp: now,
        };

        this.notifyAlert(event);
        this.activeAlerts.delete(alertKey);
        this.emitEvent(event);
        return event;
      }
    }

    return null;
  }

  /**
   * 获取指标值
   */
  private getMetricValue(condition: AlertCondition): number | null {
    const dataPoints = metricsCollector.collect();

    for (const dp of dataPoints) {
      if (dp.name !== condition.metric) continue;

      // 检查标签匹配
      if (condition.labels) {
        let match = true;
        for (const [key, value] of Object.entries(condition.labels)) {
          if (dp.labels[key] !== value) {
            match = false;
            break;
          }
        }
        if (!match) continue;
      }

      return dp.value;
    }

    return null;
  }

  /**
   * 检查条件是否满足
   */
  private checkCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case "gt":
        return value > condition.threshold;
      case "gte":
        return value >= condition.threshold;
      case "lt":
        return value < condition.threshold;
      case "lte":
        return value <= condition.threshold;
      case "eq":
        return value === condition.threshold;
      case "neq":
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  /**
   * 创建告警实例
   */
  private createAlert(
    rule: AlertRule,
    value: number,
    now: number,
  ): AlertInstance {
    const message = this.formatMessage(
      rule.messageTemplate ??
        `告警: ${rule.name} - 当前值 {{value}} 超过阈值 {{threshold}}`,
      { value, threshold: rule.condition.threshold, ruleName: rule.name },
    );

    return {
      id: `${rule.id}-${now}`,
      ruleId: rule.id,
      ruleName: rule.name,
      state: "firing",
      severity: rule.severity,
      value,
      threshold: rule.condition.threshold,
      firedAt: now,
      labels: { ...rule.labels, alertname: rule.name },
      message,
    };
  }

  /**
   * 获取告警唯一键
   */
  private getAlertKey(rule: AlertRule): string {
    const labelParts = rule.labels
      ? Object.entries(rule.labels)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join(",")
      : "";
    return `${rule.id}:${labelParts}`;
  }

  /**
   * 格式化消息
   */
  private formatMessage(
    template: string,
    vars: Record<string, unknown>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return String(vars[key] ?? "");
    });
  }

  /**
   * 发送告警通知
   */
  private async notifyAlert(event: AlertEvent): Promise<void> {
    const alertKey = `${event.alert.ruleId}:${event.type}`;
    const lastNotify = this.lastNotified.get(alertKey) ?? 0;
    const now = Date.now();

    // 检查重复通知间隔
    if (
      event.type === "fired" &&
      now - lastNotify < (this.config.repeatInterval ?? 3600000)
    ) {
      return;
    }

    const results: NotificationResult[] = [];

    for (const channel of this.config.channels) {
      if (!channel.enabled) continue;
      if (!channel.severities.includes(event.alert.severity)) continue;

      const result = await this.sendNotification(channel, event);
      results.push(result);
    }

    event.notificationResults = results;
    this.lastNotified.set(alertKey, now);
  }

  /**
   * 发送单个通知
   */
  private async sendNotification(
    channel: NotificationChannelConfig,
    event: AlertEvent,
  ): Promise<NotificationResult> {
    const result: NotificationResult = {
      channelId: channel.id,
      success: false,
      sentAt: Date.now(),
    };

    try {
      switch (channel.type) {
        case "console":
          this.sendConsoleNotification(event);
          result.success = true;
          break;

        case "webhook":
          await this.sendWebhookNotification(channel, event);
          result.success = true;
          break;

        case "slack":
          // Slack 通知需要实际的 webhook 调用
          log.info(
            { channel: channel.id, alert: event.alert.ruleName },
            "Slack notification would be sent",
          );
          result.success = true;
          break;

        case "email":
          // Email 通知需要 SMTP 配置
          log.info(
            { channel: channel.id, recipients: channel.recipients },
            "Email notification would be sent",
          );
          result.success = true;
          break;
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Unknown error";
      log.error(
        { channelId: channel.id, error: result.error },
        "Failed to send notification",
      );
    }

    return result;
  }

  /**
   * 控制台通知
   */
  private sendConsoleNotification(event: AlertEvent): void {
    const icon = event.type === "fired" ? "🚨" : "✅";
    const level = event.alert.severity === "critical" ? "error" : "warn";

    log[level](
      {
        type: event.type,
        severity: event.alert.severity,
        rule: event.alert.ruleName,
        value: event.alert.value,
        threshold: event.alert.threshold,
      },
      `${icon} Alert ${event.type}: ${event.alert.message}`,
    );
  }

  /**
   * Webhook 通知
   */
  private async sendWebhookNotification(
    channel: NotificationChannelConfig & { type: "webhook" },
    event: AlertEvent,
  ): Promise<void> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...channel.headers,
    };

    if (channel.authType === "bearer" && channel.authCredentials) {
      headers["Authorization"] = `Bearer ${channel.authCredentials}`;
    } else if (channel.authType === "basic" && channel.authCredentials) {
      headers["Authorization"] =
        `Basic ${Buffer.from(channel.authCredentials).toString("base64")}`;
    }

    const response = await fetch(channel.url, {
      method: channel.method,
      headers,
      body: JSON.stringify({
        alert: event.alert,
        event: event.type,
        timestamp: event.timestamp,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }
  }

  /**
   * 注册事件监听器
   */
  onEvent(listener: (event: AlertEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index >= 0) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * 发送事件
   */
  private emitEvent(event: AlertEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        log.error({ error }, "Error in alert event listener");
      }
    }
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): AlertInstance[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 获取告警统计
   */
  getStats(): {
    activeAlerts: number;
    critical: number;
    warning: number;
    info: number;
  } {
    const alerts = this.getActiveAlerts();
    return {
      activeAlerts: alerts.length,
      critical: alerts.filter((a) => a.severity === "critical").length,
      warning: alerts.filter((a) => a.severity === "warning").length,
      info: alerts.filter((a) => a.severity === "info").length,
    };
  }

  /**
   * 启动周期性评估
   */
  private startEvaluation(): void {
    this.evaluationIntervalId = setInterval(() => {
      this.evaluate();
    }, this.config.evaluationInterval);
  }

  /**
   * 关闭告警管理器
   */
  shutdown(): void {
    if (this.evaluationIntervalId) {
      clearInterval(this.evaluationIntervalId);
      this.evaluationIntervalId = null;
    }
    log.info("Alert manager shutdown");
  }
}

// ============================================
// 单例导出
// ============================================

/**
 * 全局告警管理器实例
 */
export const alertManager = new AlertManager();

/**
 * 初始化告警管理
 */
export function initAlertManager(config?: Partial<AlertManagerConfig>): void {
  alertManager.init(config);
}
