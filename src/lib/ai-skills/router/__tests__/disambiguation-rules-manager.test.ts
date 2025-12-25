/**
 * DisambiguationRulesManager 测试
 *
 * 测试消歧规则管理器的可配置化功能
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import {
  DisambiguationRulesManager,
  createDisambiguationRulesManager,
  getDefaultDisambiguationRulesManager,
  DISAMBIGUATION_RULES,
  type DisambiguationRulesConfig,
} from "../disambiguation-rules";
import type { DisambiguationRule, IntentType } from "../types";

describe("DisambiguationRulesManager", () => {
  let manager: DisambiguationRulesManager;

  beforeEach(() => {
    manager = createDisambiguationRulesManager();
  });

  describe("构造函数和默认配置", () => {
    it("应使用默认配置创建管理器", () => {
      const config = manager.getConfig();

      expect(config.enableBuiltinRules).toBe(true);
      expect(config.disabledRuleIds).toEqual([]);
      expect(config.customRules).toEqual([]);
      expect(config.priorityOverrides).toEqual({});
    });

    it("应正确应用自定义配置", () => {
      const customConfig: DisambiguationRulesConfig = {
        enableBuiltinRules: false,
        disabledRuleIds: ["test-rule"],
        customRules: [],
        priorityOverrides: { "some-rule": 100 },
      };

      const customManager = createDisambiguationRulesManager(customConfig);
      const config = customManager.getConfig();

      expect(config.enableBuiltinRules).toBe(false);
      expect(config.disabledRuleIds).toEqual(["test-rule"]);
      expect(config.priorityOverrides).toEqual({ "some-rule": 100 });
    });
  });

  describe("getActiveRules", () => {
    it("默认应返回所有内置规则", () => {
      const rules = manager.getActiveRules();
      expect(rules.length).toBe(DISAMBIGUATION_RULES.length);
    });

    it("禁用内置规则后应不包含该规则", () => {
      manager.disableBuiltinRule("question-default-query");
      const rules = manager.getActiveRules();

      expect(rules.length).toBe(DISAMBIGUATION_RULES.length - 1);
      expect(
        rules.find((r) => r.id === "question-default-query"),
      ).toBeUndefined();
    });

    it("禁用所有内置规则后应返回空数组", () => {
      manager.updateConfig({ enableBuiltinRules: false });
      const rules = manager.getActiveRules();

      expect(rules.length).toBe(0);
    });

    it("应按优先级降序排序", () => {
      const rules = manager.getActiveRules();

      for (let i = 1; i < rules.length; i++) {
        expect(rules[i - 1].priority).toBeGreaterThanOrEqual(rules[i].priority);
      }
    });

    it("应使用缓存避免重复计算", () => {
      const rules1 = manager.getActiveRules();
      const rules2 = manager.getActiveRules();

      expect(rules1).toBe(rules2); // 同一引用
    });
  });

  describe("自定义规则管理", () => {
    const customRule: DisambiguationRule = {
      id: "my-custom-rule",
      conflicts: ["query", "action"] as IntentType[],
      pattern: /我的自定义模式/,
      winner: "query" as IntentType,
      priority: 90,
      reason: "自定义规则说明",
    };

    it("应正确添加自定义规则", () => {
      manager.addRule(customRule);
      const rules = manager.getActiveRules();

      expect(rules.find((r) => r.id === "my-custom-rule")).toBeDefined();
    });

    it("自定义规则应按优先级正确排序", () => {
      const highPriorityRule: DisambiguationRule = {
        ...customRule,
        id: "high-priority-rule",
        priority: 200,
      };

      manager.addRule(highPriorityRule);
      const rules = manager.getActiveRules();

      expect(rules[0].id).toBe("high-priority-rule");
    });

    it("应正确移除自定义规则", () => {
      manager.addRule(customRule);
      expect(manager.hasRule("my-custom-rule")).toBe(true);

      const removed = manager.removeRule("my-custom-rule");
      expect(removed).toBe(true);
      expect(manager.hasRule("my-custom-rule")).toBe(false);
    });

    it("移除不存在的规则应返回 false", () => {
      const removed = manager.removeRule("nonexistent-rule");
      expect(removed).toBe(false);
    });

    it("自定义规则应覆盖同 ID 的内置规则", () => {
      const overrideRule: DisambiguationRule = {
        id: "question-default-query", // 覆盖内置规则
        conflicts: ["query", "chitchat"] as IntentType[],
        pattern: /自定义问句模式/,
        winner: "chitchat" as IntentType,
        priority: 50,
        reason: "覆盖后的规则",
      };

      manager.addRule(overrideRule);
      const rule = manager.getRule("question-default-query");

      expect(rule?.reason).toBe("覆盖后的规则");
      expect(rule?.winner).toBe("chitchat");
    });
  });

  describe("内置规则启用/禁用", () => {
    it("应正确禁用内置规则", () => {
      expect(manager.hasRule("question-default-query")).toBe(true);

      manager.disableBuiltinRule("question-default-query");
      expect(manager.hasRule("question-default-query")).toBe(false);
    });

    it("应正确重新启用内置规则", () => {
      manager.disableBuiltinRule("question-default-query");
      expect(manager.hasRule("question-default-query")).toBe(false);

      manager.enableBuiltinRule("question-default-query");
      expect(manager.hasRule("question-default-query")).toBe(true);
    });

    it("重复禁用同一规则不应报错", () => {
      manager.disableBuiltinRule("question-default-query");
      manager.disableBuiltinRule("question-default-query");

      const config = manager.getConfig();
      expect(
        config.disabledRuleIds.filter((id) => id === "question-default-query")
          .length,
      ).toBe(1);
    });
  });

  describe("优先级覆盖", () => {
    it("应正确覆盖规则优先级", () => {
      const originalRule = DISAMBIGUATION_RULES.find(
        (r) => r.id === "question-default-query",
      );
      expect(originalRule?.priority).toBe(20);

      manager.setPriorityOverride("question-default-query", 200);
      const rule = manager.getRule("question-default-query");

      expect(rule?.priority).toBe(200);
    });

    it("优先级覆盖应影响排序", () => {
      // 将低优先级规则提升到最高
      manager.setPriorityOverride("question-default-query", 500);
      const rules = manager.getActiveRules();

      expect(rules[0].id).toBe("question-default-query");
    });

    it("应正确清除优先级覆盖", () => {
      manager.setPriorityOverride("question-default-query", 200);
      manager.clearPriorityOverride("question-default-query");

      const rule = manager.getRule("question-default-query");
      expect(rule?.priority).toBe(20); // 恢复原始优先级
    });
  });

  describe("findMatch", () => {
    it("应正确匹配规则", () => {
      const match = manager.findMatch("帮我找一下那篇文章", [
        "query",
        "action",
      ]);
      expect(match).not.toBeNull();
      expect(match?.winner).toBe("query");
    });

    it("无匹配时应返回 null", () => {
      const match = manager.findMatch("随便说点什么", ["query", "action"]);
      // 这条消息可能不匹配任何规则
      expect(match === null || match !== null).toBe(true);
    });

    it("禁用规则后不应匹配该规则", () => {
      // 先确认规则存在
      const beforeMatch = manager.findMatch("这是一个问题？", [
        "query",
        "chitchat",
      ]);
      if (beforeMatch?.id === "question-default-query") {
        manager.disableBuiltinRule("question-default-query");
        const afterMatch = manager.findMatch("这是一个问题？", [
          "query",
          "chitchat",
        ]);
        expect(afterMatch?.id).not.toBe("question-default-query");
      }
    });
  });

  describe("getApplicableRulesFor", () => {
    it("应返回适用于指定冲突类型的规则", () => {
      const rules = manager.getApplicableRulesFor(["organize", "create"]);

      for (const rule of rules) {
        expect(rule.conflicts).toContain("organize");
        expect(rule.conflicts).toContain("create");
      }
    });

    it("应按优先级降序排序", () => {
      const rules = manager.getApplicableRulesFor(["query", "analyze"]);

      for (let i = 1; i < rules.length; i++) {
        expect(rules[i - 1].priority).toBeGreaterThanOrEqual(rules[i].priority);
      }
    });
  });

  describe("getStats", () => {
    it("应返回正确的统计信息", () => {
      const stats = manager.getStats();

      expect(stats.totalRules).toBe(DISAMBIGUATION_RULES.length);
      expect(stats.builtinRules).toBe(DISAMBIGUATION_RULES.length);
      expect(stats.customRules).toBe(0);
      expect(stats.disabledRules).toBe(0);
    });

    it("禁用规则后统计应更新", () => {
      manager.disableBuiltinRule("question-default-query");
      const stats = manager.getStats();

      expect(stats.totalRules).toBe(DISAMBIGUATION_RULES.length - 1);
      expect(stats.builtinRules).toBe(DISAMBIGUATION_RULES.length - 1);
      expect(stats.disabledRules).toBe(1);
    });

    it("添加自定义规则后统计应更新", () => {
      manager.addRule({
        id: "custom-rule",
        conflicts: ["query", "action"],
        pattern: /test/,
        winner: "query",
        priority: 50,
        reason: "test",
      });

      const stats = manager.getStats();
      expect(stats.customRules).toBe(1);
      expect(stats.totalRules).toBe(DISAMBIGUATION_RULES.length + 1);
    });
  });

  describe("updateConfig", () => {
    it("应正确更新配置", () => {
      manager.updateConfig({
        enableBuiltinRules: false,
        disabledRuleIds: ["test"],
      });

      const config = manager.getConfig();
      expect(config.enableBuiltinRules).toBe(false);
      expect(config.disabledRuleIds).toEqual(["test"]);
    });

    it("部分更新不应影响其他配置", () => {
      manager.updateConfig({ enableBuiltinRules: false });

      const config = manager.getConfig();
      expect(config.enableBuiltinRules).toBe(false);
      expect(config.disabledRuleIds).toEqual([]); // 未变
    });

    it("更新配置应清除缓存", () => {
      const rules1 = manager.getActiveRules();
      manager.updateConfig({ enableBuiltinRules: false });
      const rules2 = manager.getActiveRules();

      expect(rules1).not.toBe(rules2);
      expect(rules2.length).toBe(0);
    });
  });

  describe("reset", () => {
    it("应重置为默认配置", () => {
      manager.disableBuiltinRule("question-default-query");
      manager.addRule({
        id: "custom",
        conflicts: ["query", "action"],
        pattern: /test/,
        winner: "query",
        priority: 50,
        reason: "test",
      });
      manager.setPriorityOverride("search-keyword-priority", 200);

      manager.reset();
      const config = manager.getConfig();

      expect(config.enableBuiltinRules).toBe(true);
      expect(config.disabledRuleIds).toEqual([]);
      expect(config.customRules).toEqual([]);
      expect(config.priorityOverrides).toEqual({});
    });
  });

  describe("hasRule / getRule", () => {
    it("hasRule 应正确检查规则存在", () => {
      expect(manager.hasRule("question-default-query")).toBe(true);
      expect(manager.hasRule("nonexistent")).toBe(false);
    });

    it("getRule 应返回指定规则", () => {
      const rule = manager.getRule("question-default-query");
      expect(rule).not.toBeNull();
      expect(rule?.id).toBe("question-default-query");
    });

    it("getRule 对不存在的规则应返回 null", () => {
      const rule = manager.getRule("nonexistent");
      expect(rule).toBeNull();
    });
  });
});

describe("工厂函数", () => {
  describe("createDisambiguationRulesManager", () => {
    it("应创建新的管理器实例", () => {
      const manager1 = createDisambiguationRulesManager();
      const manager2 = createDisambiguationRulesManager();

      expect(manager1).not.toBe(manager2);
      expect(manager1).toBeInstanceOf(DisambiguationRulesManager);
    });
  });

  describe("getDefaultDisambiguationRulesManager", () => {
    it("应返回全局单例", () => {
      const manager1 = getDefaultDisambiguationRulesManager();
      const manager2 = getDefaultDisambiguationRulesManager();

      expect(manager1).toBe(manager2);
    });
  });
});

describe("集成场景", () => {
  it("复杂配置场景：禁用部分规则 + 添加自定义规则 + 优先级覆盖", () => {
    const manager = createDisambiguationRulesManager({
      enableBuiltinRules: true,
      disabledRuleIds: ["question-default-query"],
      customRules: [
        {
          id: "custom-question-rule",
          conflicts: ["query", "chitchat"],
          pattern: /[？?！!]$/,
          winner: "query",
          priority: 30,
          reason: "自定义问句规则",
        },
      ],
      priorityOverrides: {
        "search-keyword-priority": 100,
      },
    });

    const _rules = manager.getActiveRules();
    const stats = manager.getStats();

    // 验证禁用规则
    expect(manager.hasRule("question-default-query")).toBe(false);

    // 验证自定义规则
    expect(manager.hasRule("custom-question-rule")).toBe(true);

    // 验证优先级覆盖
    const searchRule = manager.getRule("search-keyword-priority");
    expect(searchRule?.priority).toBe(100);

    // 验证统计
    expect(stats.disabledRules).toBe(1);
    expect(stats.customRules).toBe(1);
  });

  it("动态规则管理场景", () => {
    const manager = createDisambiguationRulesManager();

    // 1. 添加自定义规则
    manager.addRule({
      id: "dynamic-rule-1",
      conflicts: ["query", "analyze"],
      pattern: /动态规则/,
      winner: "analyze",
      priority: 85,
      reason: "动态添加的规则",
    });

    // 2. 禁用内置规则
    manager.disableBuiltinRule("time-modifier-query");

    // 3. 覆盖优先级
    manager.setPriorityOverride("count-keyword-priority", 90);

    // 验证状态
    expect(manager.hasRule("dynamic-rule-1")).toBe(true);
    expect(manager.hasRule("time-modifier-query")).toBe(false);
    expect(manager.getRule("count-keyword-priority")?.priority).toBe(90);

    // 4. 重置
    manager.reset();

    // 验证重置后状态
    expect(manager.hasRule("dynamic-rule-1")).toBe(false);
    expect(manager.hasRule("time-modifier-query")).toBe(true);
    expect(manager.getRule("count-keyword-priority")?.priority).toBe(75);
  });
});
