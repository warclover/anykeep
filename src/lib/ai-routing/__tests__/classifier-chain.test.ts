/**
 * ClassifierChain 单元测试
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

import {
  ClassifierChain,
  createClassifierChain,
} from "../intent/classifier-chain";
import type { IntentClassifier } from "../intent/classifier-interface";
import type { ClassificationContext, ClassifierResult } from "../types";

// ============================================
// Mock 分类器
// ============================================

function createMockClassifier(
  name: string,
  priority: number,
  options: {
    canHandle?: boolean;
    result?: Partial<ClassifierResult>;
    shouldThrow?: boolean;
  } = {},
): IntentClassifier {
  const { canHandle = true, result, shouldThrow = false } = options;

  return {
    name,
    priority,
    canHandle: jest.fn().mockReturnValue(canHandle),
    classify: jest.fn().mockImplementation(async () => {
      if (shouldThrow) {
        throw new Error(`${name} failed`);
      }
      return {
        intent: "query",
        subType: "search",
        confidence: 0.8,
        entities: [],
        reasoning: `Matched by ${name}`,
        ...result,
      } as ClassifierResult;
    }),
    calibrate: jest.fn().mockImplementation((r) => r),
  };
}

// ============================================
// 测试用例
// ============================================

describe("ClassifierChain", () => {
  let chain: ClassifierChain;
  const mockContext: ClassificationContext = {
    userId: "test-user",
    sessionId: "test-session",
  };

  beforeEach(() => {
    chain = new ClassifierChain();
  });

  describe("register", () => {
    it("应该按优先级排序注册分类器", () => {
      const low = createMockClassifier("low", 100);
      const high = createMockClassifier("high", 10);
      const medium = createMockClassifier("medium", 50);

      chain.register(low);
      chain.register(high);
      chain.register(medium);

      const metadata = chain.getClassifiersMetadata();
      expect(metadata).toHaveLength(3);
      expect(metadata[0].name).toBe("high");
      expect(metadata[1].name).toBe("medium");
      expect(metadata[2].name).toBe("low");
    });

    it("应该返回正确的分类器数量", () => {
      chain.register(createMockClassifier("c1", 10));
      chain.register(createMockClassifier("c2", 20));

      expect(chain.size).toBe(2);
    });
  });

  describe("unregister", () => {
    it("应该正确注销分类器", () => {
      chain.register(createMockClassifier("c1", 10));
      chain.register(createMockClassifier("c2", 20));

      expect(chain.unregister("c1")).toBe(true);
      expect(chain.size).toBe(1);
    });

    it("注销不存在的分类器应返回 false", () => {
      expect(chain.unregister("nonexistent")).toBe(false);
    });
  });

  describe("classify", () => {
    it("应该按优先级顺序执行分类器", async () => {
      const high = createMockClassifier("high", 10, {
        result: { confidence: 0.9 },
      });
      const low = createMockClassifier("low", 100, {
        result: { confidence: 0.8 },
      });

      chain.register(low);
      chain.register(high);

      const result = await chain.classify("test message", mockContext);

      expect(high.classify).toHaveBeenCalled();
      expect(low.classify).not.toHaveBeenCalled();
      expect(result.confidence).toBe(0.9);
    });

    it("置信度不足时应尝试下一个分类器", async () => {
      const high = createMockClassifier("high", 10, {
        result: { confidence: 0.3 }, // 低于默认阈值 0.5
      });
      const low = createMockClassifier("low", 100, {
        result: { confidence: 0.8 },
      });

      chain.register(high);
      chain.register(low);

      const result = await chain.classify("test message", mockContext);

      expect(high.classify).toHaveBeenCalled();
      expect(low.classify).toHaveBeenCalled();
      expect(result.confidence).toBe(0.8);
    });

    it("canHandle 返回 false 时应跳过该分类器", async () => {
      const skipped = createMockClassifier("skipped", 10, {
        canHandle: false,
      });
      const used = createMockClassifier("used", 100, {
        result: { confidence: 0.8 },
      });

      chain.register(skipped);
      chain.register(used);

      const result = await chain.classify("test message", mockContext);

      expect(skipped.classify).not.toHaveBeenCalled();
      expect(used.classify).toHaveBeenCalled();
      expect(result.reasoning).toContain("used");
    });

    it("分类器抛出异常时应继续尝试下一个", async () => {
      const failing = createMockClassifier("failing", 10, {
        shouldThrow: true,
      });
      const working = createMockClassifier("working", 100, {
        result: { confidence: 0.8, intent: "action" },
      });

      chain.register(failing);
      chain.register(working);

      const result = await chain.classify("test message", mockContext);

      expect(result.intent).toBe("action");
    });

    it("所有分类器都失败时应返回降级结果", async () => {
      const failing1 = createMockClassifier("failing1", 10, {
        shouldThrow: true,
      });
      const failing2 = createMockClassifier("failing2", 100, {
        shouldThrow: true,
      });

      chain.register(failing1);
      chain.register(failing2);

      const result = await chain.classify("test message", mockContext);

      expect(result.confidence).toBe(0.3);
      expect(result.reasoning).toContain("Fallback");
    });

    it("问号消息降级时应返回 query 意图", async () => {
      const result = await chain.classify("这是什么？", mockContext);

      expect(result.intent).toBe("query");
    });

    it("非问号消息降级时应返回 chitchat 意图", async () => {
      const result = await chain.classify("你好啊", mockContext);

      expect(result.intent).toBe("chitchat");
    });
  });

  describe("classifyParallel", () => {
    it("应该并行执行所有分类器并选择最高置信度结果", async () => {
      const c1 = createMockClassifier("c1", 10, {
        result: { confidence: 0.7, intent: "query" },
      });
      const c2 = createMockClassifier("c2", 100, {
        result: { confidence: 0.9, intent: "action" },
      });

      chain.register(c1);
      chain.register(c2);

      const result = await chain.classifyParallel("test message", mockContext);

      expect(c1.classify).toHaveBeenCalled();
      expect(c2.classify).toHaveBeenCalled();
      expect(result.confidence).toBe(0.9);
      expect(result.intent).toBe("action");
    });

    it("无可用分类器时应返回降级结果", async () => {
      const result = await chain.classifyParallel("test", mockContext);

      expect(result.confidence).toBe(0.3);
    });
  });

  describe("clear", () => {
    it("应该清空所有分类器", () => {
      chain.register(createMockClassifier("c1", 10));
      chain.register(createMockClassifier("c2", 20));

      chain.clear();

      expect(chain.size).toBe(0);
    });
  });

  describe("getClassifiersMetadata", () => {
    it("应该返回分类器元数据", () => {
      chain.register(createMockClassifier("RuleClassifier", 10));
      chain.register(createMockClassifier("SemanticMatcher", 50));
      chain.register(createMockClassifier("LLMFallback", 100));

      const metadata = chain.getClassifiersMetadata();

      expect(metadata).toHaveLength(3);
      expect(metadata[0].type).toBe("rule");
      expect(metadata[1].type).toBe("semantic");
      expect(metadata[2].type).toBe("llm");
    });
  });
});

describe("createClassifierChain", () => {
  it("应该创建带配置的分类器链", () => {
    const chain = createClassifierChain({
      minConfidenceThreshold: 0.7,
      debug: true,
    });

    expect(chain).toBeInstanceOf(ClassifierChain);
  });
});
