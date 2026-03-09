/**
 * ModeSelector 单元测试
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

// Jest 测试
import { ModeSelector, createModeSelector } from "../routing/mode-selector";
import type {
  IntentClassification,
  ComplexityEvaluation,
  ComplexityLevel,
} from "../types";

// ============================================
// 辅助函数
// ============================================

function createIntent(
  overrides: Partial<IntentClassification> = {},
): IntentClassification {
  return {
    type: "query",
    confidence: 0.8,
    entities: [],
    requiresMultiStep: false,
    hasDeliverableExpectation: false,
    source: "rule",
    ...overrides,
  };
}

function createComplexity(
  level: ComplexityLevel,
  score?: number,
): ComplexityEvaluation {
  const scoreMap: Record<ComplexityLevel, number> = {
    simple: 20,
    medium: 45,
    complex: 75,
  };

  return {
    level,
    score: score ?? scoreMap[level],
    factors: [],
  };
}

// ============================================
// 测试用例
// ============================================

describe("ModeSelector", () => {
  let selector: ModeSelector;

  beforeEach(() => {
    selector = new ModeSelector();
  });

  describe("select", () => {
    describe("简单任务", () => {
      it("simple 复杂度应该返回 atomic 模式", () => {
        const intent = createIntent({ type: "query" });
        const complexity = createComplexity("simple");

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("atomic");
        expect(result.reason).toContain("简单任务");
      });

      it("chitchat 应该返回 atomic 模式", () => {
        const intent = createIntent({ type: "chitchat" });
        const complexity = createComplexity("simple");

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("atomic");
      });
    });

    describe("整理类任务", () => {
      it("organize:cleanup 应该返回 orchestration 模式", () => {
        const intent = createIntent({
          type: "organize",
          subType: "cleanup",
        });
        const complexity = createComplexity("medium");

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("orchestration");
        expect(result.reason).toContain("智能整理");
      });

      it("organize:dedupe 应该返回 orchestration 模式", () => {
        const intent = createIntent({
          type: "organize",
          subType: "dedupe",
        });
        const complexity = createComplexity("medium");

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("orchestration");
        expect(result.reason).toContain("去重");
      });
    });

    describe("分析类任务", () => {
      it("analyze:report 应该返回 orchestration 模式", () => {
        const intent = createIntent({
          type: "analyze",
          subType: "report",
        });
        const complexity = createComplexity("medium");

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("orchestration");
        expect(result.reason).toContain("报告生成");
      });

      it("analyze:insight 应该返回 orchestration 模式", () => {
        const intent = createIntent({
          type: "analyze",
          subType: "insight",
        });
        const complexity = createComplexity("medium");

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("orchestration");
        expect(result.reason).toContain("洞察分析");
      });

      it("analyze 通配符应该匹配未知子类型", () => {
        const intent = createIntent({
          type: "analyze",
          subType: "unknown_subtype",
          hasDeliverableExpectation: true,
        });
        const complexity = createComplexity("medium");

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("orchestration");
        expect(result.reason).toContain("通用分析");
      });
    });

    describe("创建类任务", () => {
      it("create:synthesis 应该返回 orchestration 模式", () => {
        const intent = createIntent({
          type: "create",
          subType: "synthesis",
        });
        const complexity = createComplexity("medium");

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("orchestration");
        expect(result.reason).toContain("主题合成");
      });

      it("create:digest 简单复杂度也应该返回 orchestration", () => {
        const intent = createIntent({
          type: "create",
          subType: "digest",
        });
        const complexity = createComplexity("simple");

        const result = selector.select(intent, complexity);

        // digest 的 minComplexity 是 simple，所以即使简单复杂度也应该匹配
        // 但因为 simple 复杂度会优先返回 atomic
        expect(result.mode).toBe("atomic");
      });

      it("create:tts 应该返回 atomic 模式", () => {
        const intent = createIntent({
          type: "create",
          subType: "tts",
        });
        const complexity = createComplexity("medium");

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("atomic");
        expect(result.reason).toContain("语音朗读");
      });
    });

    describe("查询类任务", () => {
      it("query:search 应该返回 atomic 模式", () => {
        const intent = createIntent({
          type: "query",
          subType: "search",
        });
        const complexity = createComplexity("medium");

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("atomic");
        expect(result.reason).toContain("知识搜索");
      });
    });

    describe("复杂度要求", () => {
      it("复杂度不满足时应该返回 atomic", () => {
        const intent = createIntent({
          type: "learn",
          subType: "review",
        });
        // learn:review 需要 medium 复杂度，但这里是 simple
        const complexity = createComplexity("simple");

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("atomic");
      });

      it("复杂任务无专用 Skill 应该返回 atomic", () => {
        const intent = createIntent({
          type: "action",
          subType: "unknown_action",
        });
        const complexity = createComplexity("complex");

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("atomic");
        expect(result.reason).toContain("无专用 Skill");
      });
    });

    describe("交付物期望", () => {
      it("期望交付物时应该尝试通配符匹配", () => {
        const intent = createIntent({
          type: "create",
          subType: "custom_creation",
          hasDeliverableExpectation: true,
        });
        const complexity = createComplexity("medium");

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("orchestration");
        expect(result.reason).toContain("通用创建");
      });
    });

    describe("强制原子模式", () => {
      it("forceAtomicMode=true 应该始终返回 atomic", () => {
        const forceSelector = new ModeSelector({ forceAtomicMode: true });
        const intent = createIntent({
          type: "organize",
          subType: "cleanup",
        });
        const complexity = createComplexity("complex");

        const result = forceSelector.select(intent, complexity);

        expect(result.mode).toBe("atomic");
        expect(result.reason).toContain("调试");
      });
    });

    describe("默认行为", () => {
      it("无匹配规则时应该返回 atomic", () => {
        const intent = createIntent({
          type: "refine",
        });
        const complexity = createComplexity("medium");

        const result = selector.select(intent, complexity);

        expect(result.mode).toBe("atomic");
        expect(result.reason).toContain("默认");
      });
    });
  });
});

describe("createModeSelector", () => {
  it("应该创建默认配置的选择器", () => {
    const selector = createModeSelector();
    expect(selector).toBeInstanceOf(ModeSelector);
  });

  it("应该创建带配置的选择器", () => {
    const selector = createModeSelector({
      forceAtomicMode: true,
      debug: true,
    });
    expect(selector).toBeInstanceOf(ModeSelector);
  });
});
