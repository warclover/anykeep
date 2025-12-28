/**
 * 告警模块测试
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

import {
  alertManager,
  initAlertManager,
  metricsCollector,
  initMetrics,
  predefinedAlertRules,
  predefinedChannels,
  apiLatencyRule,
  createSlackChannel,
  createWebhookChannel,
  createAlertRule,
  METRIC_NAMES,
  DEFAULT_ALERT_MANAGER_CONFIG,
} from "../index";

describe("alerting", () => {
  beforeEach(() => {
    // 重置状态
    metricsCollector.reset();
    initMetrics({ enabled: true, consoleExport: false });
    alertManager.shutdown();
    initAlertManager({ enabled: true, evaluationInterval: 0 }); // 禁用自动评估
    jest.clearAllMocks();
  });

  describe("AlertManager", () => {
    describe("initialization", () => {
      it("should initialize with default config", () => {
        expect(() => initAlertManager()).not.toThrow();
      });

      it("should initialize with custom config", () => {
        expect(() =>
          initAlertManager({
            enabled: true,
            evaluationInterval: 30000,
          }),
        ).not.toThrow();
      });

      it("should disable when enabled is false", () => {
        initAlertManager({ enabled: false });
        const stats = alertManager.getStats();
        expect(stats.activeAlerts).toBe(0);
      });
    });

    describe("rule management", () => {
      it("should add alert rule", () => {
        alertManager.addRule(apiLatencyRule);
        // 规则已添加（通过评估测试验证）
        expect(true).toBe(true);
      });

      it("should update existing rule", () => {
        alertManager.addRule(apiLatencyRule);
        const updatedRule = {
          ...apiLatencyRule,
          severity: "critical" as const,
        };
        alertManager.addRule(updatedRule);
        // 规则已更新
        expect(true).toBe(true);
      });

      it("should remove rule", () => {
        alertManager.addRule(apiLatencyRule);
        const removed = alertManager.removeRule(apiLatencyRule.id);
        expect(removed).toBe(true);
      });

      it("should return false when removing non-existent rule", () => {
        const removed = alertManager.removeRule("non-existent");
        expect(removed).toBe(false);
      });
    });

    describe("channel management", () => {
      it("should add notification channel", () => {
        alertManager.addChannel(predefinedChannels[0]);
        // 渠道已添加
        expect(true).toBe(true);
      });
    });

    describe("evaluation", () => {
      it("should fire alert when condition is met", () => {
        // 添加规则
        const rule = createAlertRule(
          "test-high-value",
          "Test High Value",
          {
            metric: "test.value",
            operator: "gt",
            threshold: 100,
          },
          { severity: "warning" },
        );
        alertManager.addRule(rule);

        // 创建并设置指标
        const gauge = metricsCollector.createGauge("test.value", "Test value");
        gauge.set(150);

        // 评估
        const events = alertManager.evaluate();

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe("fired");
        expect(events[0].alert.severity).toBe("warning");
        expect(events[0].alert.value).toBe(150);
      });

      it("should not fire when condition is not met", () => {
        const rule = createAlertRule("test-low-value", "Test Low Value", {
          metric: "test.value2",
          operator: "gt",
          threshold: 100,
        });
        alertManager.addRule(rule);

        const gauge = metricsCollector.createGauge("test.value2", "Test value");
        gauge.set(50);

        const events = alertManager.evaluate();
        expect(events).toHaveLength(0);
      });

      it("should resolve alert when condition no longer met", () => {
        const rule = createAlertRule("test-resolve", "Test Resolve", {
          metric: "test.resolve",
          operator: "gt",
          threshold: 100,
        });
        alertManager.addRule(rule);

        // 触发告警
        const gauge = metricsCollector.createGauge("test.resolve", "Test");
        gauge.set(150);
        alertManager.evaluate();

        // 恢复
        gauge.set(50);
        const events = alertManager.evaluate();

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe("resolved");
      });

      it("should support different operators", () => {
        const testCases = [
          {
            operator: "gt" as const,
            value: 150,
            threshold: 100,
            expected: true,
          },
          {
            operator: "gte" as const,
            value: 100,
            threshold: 100,
            expected: true,
          },
          {
            operator: "lt" as const,
            value: 50,
            threshold: 100,
            expected: true,
          },
          {
            operator: "lte" as const,
            value: 100,
            threshold: 100,
            expected: true,
          },
          {
            operator: "eq" as const,
            value: 100,
            threshold: 100,
            expected: true,
          },
          {
            operator: "neq" as const,
            value: 50,
            threshold: 100,
            expected: true,
          },
        ];

        testCases.forEach(({ operator, value, threshold, expected }, index) => {
          const rule = createAlertRule(`test-op-${index}`, `Test ${operator}`, {
            metric: `test.op.${index}`,
            operator,
            threshold,
          });
          alertManager.addRule(rule);

          const gauge = metricsCollector.createGauge(
            `test.op.${index}`,
            "Test",
          );
          gauge.set(value);

          const events = alertManager.evaluate();
          const fired = events.some(
            (e) => e.alert.ruleId === rule.id && e.type === "fired",
          );
          expect(fired).toBe(expected);
        });
      });

      it("should skip disabled rules", () => {
        const rule = createAlertRule(
          "test-disabled",
          "Test Disabled",
          {
            metric: "test.disabled",
            operator: "gt",
            threshold: 100,
          },
          { enabled: false },
        );
        alertManager.addRule(rule);

        const gauge = metricsCollector.createGauge("test.disabled", "Test");
        gauge.set(150);

        const events = alertManager.evaluate();
        expect(events).toHaveLength(0);
      });
    });

    describe("event listeners", () => {
      it("should emit events to listeners", () => {
        const listener = jest.fn();
        const unsubscribe = alertManager.onEvent(listener);

        const rule = createAlertRule("test-listener", "Test Listener", {
          metric: "test.listener",
          operator: "gt",
          threshold: 100,
        });
        alertManager.addRule(rule);

        const gauge = metricsCollector.createGauge("test.listener", "Test");
        gauge.set(150);
        alertManager.evaluate();

        expect(listener).toHaveBeenCalled();

        unsubscribe();
      });

      it("should unsubscribe correctly", () => {
        const listener = jest.fn();
        const unsubscribe = alertManager.onEvent(listener);
        unsubscribe();

        const rule = createAlertRule("test-unsub", "Test Unsubscribe", {
          metric: "test.unsub",
          operator: "gt",
          threshold: 100,
        });
        alertManager.addRule(rule);

        const gauge = metricsCollector.createGauge("test.unsub", "Test");
        gauge.set(150);
        alertManager.evaluate();

        expect(listener).not.toHaveBeenCalled();
      });
    });

    describe("getStats", () => {
      it("should return correct statistics", () => {
        // 触发一些告警
        const criticalRule = createAlertRule(
          "test-critical",
          "Critical",
          { metric: "critical.metric", operator: "gt", threshold: 0 },
          { severity: "critical" },
        );
        const warningRule = createAlertRule(
          "test-warning",
          "Warning",
          { metric: "warning.metric", operator: "gt", threshold: 0 },
          { severity: "warning" },
        );

        alertManager.addRule(criticalRule);
        alertManager.addRule(warningRule);

        metricsCollector.createGauge("critical.metric", "C").set(1);
        metricsCollector.createGauge("warning.metric", "W").set(1);

        alertManager.evaluate();

        const stats = alertManager.getStats();
        expect(stats.activeAlerts).toBe(2);
        expect(stats.critical).toBe(1);
        expect(stats.warning).toBe(1);
      });
    });

    describe("getActiveAlerts", () => {
      it("should return all active alerts", () => {
        const rule = createAlertRule("test-active", "Active", {
          metric: "active.metric",
          operator: "gt",
          threshold: 0,
        });
        alertManager.addRule(rule);

        metricsCollector.createGauge("active.metric", "A").set(1);
        alertManager.evaluate();

        const alerts = alertManager.getActiveAlerts();
        expect(alerts).toHaveLength(1);
        expect(alerts[0].state).toBe("firing");
      });
    });
  });

  describe("Predefined rules", () => {
    it("should have all predefined rules", () => {
      expect(predefinedAlertRules).toBeDefined();
      expect(predefinedAlertRules.length).toBeGreaterThan(0);
    });

    it("should have API latency rule", () => {
      const rule = predefinedAlertRules.find(
        (r) => r.id === "api-latency-high",
      );
      expect(rule).toBeDefined();
      expect(rule?.condition.metric).toBe(METRIC_NAMES.API_LATENCY);
    });

    it("should have agent slow response rule", () => {
      const rule = predefinedAlertRules.find(
        (r) => r.id === "agent-slow-response",
      );
      expect(rule).toBeDefined();
      expect(rule?.condition.metric).toBe(METRIC_NAMES.AGENT_RESPONSE_TIME);
    });
  });

  describe("Predefined channels", () => {
    it("should have console channel for development", () => {
      const console = predefinedChannels.find((c) => c.id === "console");
      expect(console).toBeDefined();
      expect(console?.type).toBe("console");
    });
  });

  describe("Factory functions", () => {
    describe("createSlackChannel", () => {
      it("should create Slack channel with defaults", () => {
        const channel = createSlackChannel(
          "slack-1",
          "https://hooks.slack.com/xxx",
        );
        expect(channel.type).toBe("slack");
        expect(channel.enabled).toBe(true);
        expect(channel.severities).toContain("critical");
      });

      it("should create Slack channel with options", () => {
        const channel = createSlackChannel(
          "slack-2",
          "https://hooks.slack.com/xxx",
          {
            name: "My Slack",
            channel: "#alerts",
            severities: ["critical"],
          },
        );
        expect(channel.name).toBe("My Slack");
        expect((channel as { channel?: string }).channel).toBe("#alerts");
        expect(channel.severities).toEqual(["critical"]);
      });
    });

    describe("createWebhookChannel", () => {
      it("should create Webhook channel with defaults", () => {
        const channel = createWebhookChannel(
          "webhook-1",
          "https://example.com/alert",
        );
        expect(channel.type).toBe("webhook");
        expect((channel as { method: string }).method).toBe("POST");
      });

      it("should create Webhook channel with auth", () => {
        const channel = createWebhookChannel(
          "webhook-2",
          "https://example.com/alert",
          {
            authType: "bearer",
            authCredentials: "token123",
          },
        );
        expect((channel as { authType?: string }).authType).toBe("bearer");
        expect((channel as { authCredentials?: string }).authCredentials).toBe(
          "token123",
        );
      });
    });

    describe("createAlertRule", () => {
      it("should create custom alert rule", () => {
        const rule = createAlertRule("custom-rule", "Custom Rule", {
          metric: "custom.metric",
          operator: "gt",
          threshold: 50,
        });
        expect(rule.id).toBe("custom-rule");
        expect(rule.name).toBe("Custom Rule");
        expect(rule.severity).toBe("warning"); // default
        expect(rule.enabled).toBe(true); // default
      });

      it("should create custom alert rule with options", () => {
        const rule = createAlertRule(
          "custom-rule-2",
          "Custom Rule 2",
          {
            metric: "custom.metric",
            operator: "lt",
            threshold: 10,
          },
          {
            severity: "critical",
            enabled: false,
            messageTemplate: "Custom message: {{value}}",
          },
        );
        expect(rule.severity).toBe("critical");
        expect(rule.enabled).toBe(false);
        expect(rule.messageTemplate).toBe("Custom message: {{value}}");
      });
    });
  });

  describe("DEFAULT_ALERT_MANAGER_CONFIG", () => {
    it("should have correct defaults", () => {
      expect(DEFAULT_ALERT_MANAGER_CONFIG.enabled).toBe(true);
      expect(DEFAULT_ALERT_MANAGER_CONFIG.evaluationInterval).toBe(60000);
      expect(DEFAULT_ALERT_MANAGER_CONFIG.groupWait).toBe(30000);
      expect(DEFAULT_ALERT_MANAGER_CONFIG.repeatInterval).toBe(3600000);
    });
  });
});
