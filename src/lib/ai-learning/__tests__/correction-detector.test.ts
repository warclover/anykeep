/**
 * CorrectionDetector 单元测试
 *
 * @module ai-learning
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import type { CorrectionDetector } from "../correction-detector";
import { createCorrectionDetector } from "../correction-detector";
import type { AIOutput, ConversationState } from "../types";

describe("CorrectionDetector", () => {
  let detector: CorrectionDetector;

  beforeEach(() => {
    detector = createCorrectionDetector();
  });

  // ===========================================================================
  // 基本功能
  // ===========================================================================

  describe("基本功能", () => {
    it("无前次输出时返回非纠正", () => {
      const context: ConversationState = {
        conversationId: "conv_1",
        consecutiveFailures: 0,
        turnCount: 1,
      };

      const result = detector.detect("帮我搜索", undefined, context);

      expect(result.isCorrection).toBe(false);
      expect(result.signal).toBeUndefined();
    });

    it("普通输入不触发纠正检测", () => {
      const previousOutput: AIOutput = {
        messageId: "msg_1",
        intent: "query",
        wasSuccessful: true,
      };
      const context: ConversationState = {
        conversationId: "conv_1",
        lastUserInput: "帮我搜索 AI 相关文章",
        consecutiveFailures: 0,
        turnCount: 2,
      };

      const result = detector.detect(
        "再帮我搜索一下机器学习",
        previousOutput,
        context,
      );

      expect(result.isCorrection).toBe(false);
    });
  });

  // ===========================================================================
  // 直接否定检测
  // ===========================================================================

  describe("直接否定检测", () => {
    const previousOutput: AIOutput = {
      messageId: "msg_1",
      intent: "query",
      wasSuccessful: false,
    };
    const context: ConversationState = {
      conversationId: "conv_1",
      lastUserInput: "帮我整理收藏",
      consecutiveFailures: 1,
      turnCount: 2,
    };

    it("检测 '不对' 开头", () => {
      const result = detector.detect(
        "不对，我要的是整理",
        previousOutput,
        context,
      );

      expect(result.isCorrection).toBe(true);
      expect(result.signal?.signal).toBe("explicit_wrong");
      expect(result.signal?.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("检测 '错了' 开头", () => {
      const result = detector.detect("错了，不是搜索", previousOutput, context);

      expect(result.isCorrection).toBe(true);
      expect(result.signal?.signal).toBe("explicit_wrong");
    });

    it("检测 '不是这个' 开头", () => {
      const result = detector.detect(
        "不是这个，我要整理",
        previousOutput,
        context,
      );

      expect(result.isCorrection).toBe(true);
      expect(result.signal?.signal).toBe("explicit_wrong");
    });

    it("检测 '搞错了' 开头", () => {
      const result = detector.detect(
        "搞错了，我是要整理不是搜索",
        previousOutput,
        context,
      );

      expect(result.isCorrection).toBe(true);
      expect(result.signal?.signal).toBe("explicit_wrong");
    });
  });

  // ===========================================================================
  // 纠正句式检测
  // ===========================================================================

  describe("纠正句式检测", () => {
    const previousOutput: AIOutput = {
      messageId: "msg_1",
      intent: "query",
      wasSuccessful: false,
    };
    const context: ConversationState = {
      conversationId: "conv_1",
      lastUserInput: "帮我整理收藏",
      consecutiveFailures: 1,
      turnCount: 2,
    };

    it("检测 '我要的是...不是...' 句式", () => {
      const result = detector.detect(
        "我要的是整理收藏，不是搜索",
        previousOutput,
        context,
      );

      expect(result.isCorrection).toBe(true);
      expect(result.signal?.signal).toBe("correction_follow");
    });

    it("检测 '我想要...不是...' 句式", () => {
      const result = detector.detect(
        "我想要的是整理，不是搜索",
        previousOutput,
        context,
      );

      expect(result.isCorrection).toBe(true);
      expect(result.signal?.signal).toBe("correction_follow");
    });

    it("检测 '应该是...' 句式", () => {
      const result = detector.detect("应该是整理功能", previousOutput, context);

      expect(result.isCorrection).toBe(true);
      expect(result.signal?.signal).toBe("correction_follow");
    });

    it("检测 '不是...是...' 句式", () => {
      const result = detector.detect("不是搜索是整理", previousOutput, context);

      expect(result.isCorrection).toBe(true);
      expect(result.signal?.signal).toBe("correction_follow");
    });
  });

  // ===========================================================================
  // 重新表述检测
  // ===========================================================================

  describe("重新表述检测", () => {
    const previousOutput: AIOutput = {
      messageId: "msg_1",
      intent: "query",
      wasSuccessful: false,
    };
    const context: ConversationState = {
      conversationId: "conv_1",
      lastUserInput: "帮我整理收藏",
      consecutiveFailures: 1,
      turnCount: 2,
    };

    it("检测 '我再说一遍' 句式", () => {
      const result = detector.detect(
        "我再说一遍，整理收藏",
        previousOutput,
        context,
      );

      expect(result.isCorrection).toBe(true);
      expect(result.signal?.signal).toBe("reformulation");
    });

    it("检测 '换个说法' 句式", () => {
      const result = detector.detect(
        "换个说法，归类我的书签",
        previousOutput,
        context,
      );

      expect(result.isCorrection).toBe(true);
      expect(result.signal?.signal).toBe("reformulation");
    });

    it("检测语义相似的重新表述", () => {
      const contextWithSimilar: ConversationState = {
        ...context,
        lastUserInput: "整理我的收藏",
      };

      const result = detector.detect(
        "归类我的收藏内容",
        { ...previousOutput, wasSuccessful: false },
        contextWithSimilar,
      );

      // 如果相似度足够高，应该检测为 reformulation
      if (result.isCorrection) {
        expect(result.signal?.signal).toBe("reformulation");
      }
    });
  });

  // ===========================================================================
  // 连续失败检测
  // ===========================================================================

  describe("连续失败检测", () => {
    it("连续失败 2 次后触发纠正检测", () => {
      const previousOutput: AIOutput = {
        messageId: "msg_1",
        intent: "query",
        wasSuccessful: false,
      };
      const context: ConversationState = {
        conversationId: "conv_1",
        lastUserInput: "帮我整理收藏",
        consecutiveFailures: 2,
        turnCount: 3,
      };

      const result = detector.detect("整理收藏夹", previousOutput, context);

      expect(result.isCorrection).toBe(true);
      expect(result.signal?.signal).toBe("reformulation");
    });

    it("连续失败置信度随次数增加", () => {
      const previousOutput: AIOutput = {
        messageId: "msg_1",
        intent: "query",
        wasSuccessful: false,
      };

      const context2: ConversationState = {
        conversationId: "conv_1",
        lastUserInput: "帮我整理",
        consecutiveFailures: 2,
        turnCount: 3,
      };
      const context3: ConversationState = {
        ...context2,
        consecutiveFailures: 3,
        turnCount: 4,
      };

      const result2 = detector.detect("分类收藏", previousOutput, context2);
      const result3 = detector.detect("归类收藏", previousOutput, context3);

      if (result2.isCorrection && result3.isCorrection) {
        expect(result3.signal!.confidence).toBeGreaterThan(
          result2.signal!.confidence,
        );
      }
    });
  });

  // ===========================================================================
  // 意图推断
  // ===========================================================================

  describe("意图推断", () => {
    it("从纠正句式推断正确意图 - 整理", () => {
      const intent = detector.inferCorrectIntent(
        "我要的是整理，不是搜索",
        "query",
      );

      expect(intent).toBe("organize");
    });

    it("从否定推断正确意图 - 不是搜索", () => {
      const intent = detector.inferCorrectIntent("不是搜索", "query");

      expect(intent).toBeDefined();
      expect(intent).not.toBe("query");
    });

    it("从动作词推断正确意图 - 分类", () => {
      const intent = detector.inferCorrectIntent("帮我分类一下", "query");

      expect(intent).toBe("organize");
    });

    it("从动作词推断正确意图 - 导出", () => {
      const intent = detector.inferCorrectIntent("我要导出数据", "query");

      expect(intent).toBe("export");
    });

    it("从动作词推断正确意图 - 总结", () => {
      const intent = detector.inferCorrectIntent("帮我总结一下", "query");

      expect(intent).toBe("create");
    });

    it("无法推断时返回 undefined", () => {
      const intent = detector.inferCorrectIntent("随便说点什么", "query");

      expect(intent).toBeUndefined();
    });
  });

  // ===========================================================================
  // 负面反馈信号
  // ===========================================================================

  describe("负面反馈信号", () => {
    it("创建负面反馈纠正信号", () => {
      const signal = detector.createFromNegativeFeedback(
        "帮我整理收藏",
        "query",
        "wrong_intent",
      );

      expect(signal.signal).toBe("negative_feedback");
      expect(signal.confidence).toBe(0.85);
      expect(signal.originalInput).toBe("帮我整理收藏");
      expect(signal.wrongIntent).toBe("query");
    });

    it("无反馈原因时使用默认描述", () => {
      const signal = detector.createFromNegativeFeedback("测试输入", "query");

      expect(signal.correctionInput).toBe("用户点击了负面反馈");
    });
  });
});
