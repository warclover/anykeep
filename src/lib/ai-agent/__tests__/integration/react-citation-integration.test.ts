/**
 * ReAct 循环和引用追踪集成测试
 *
 * 验证 ReAct 循环和引用追踪系统的端到端集成
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { FeatureFlags, isFeatureEnabled } from "../../config/feature-flags";
import {
  getCitationEnricher,
  resetCitationEnricher,
} from "../../citation/citation-enricher";
import { resetCitationIndexer } from "../../citation/citation-indexer";
import type { SearchResultItem } from "../../citation/types";
import type {
  ThinkingChunk,
  CitationChunk,
  UnifiedStreamChunk,
} from "@/lib/ai-skills/output/types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ============================================================================
// 测试数据
// ============================================================================

const mockSearchResults: SearchResultItem[] = [
  {
    bookmarkId: 101,
    title: "React 18 新特性详解",
    url: "https://example.com/react18",
    summary: "介绍 React 18 的并发特性",
    platform: "wechat",
    score: 0.95,
  },
  {
    bookmarkId: 102,
    title: "Vue 3 组合式 API 指南",
    url: "https://example.com/vue3",
    summary: "Vue 3 Composition API 最佳实践",
    platform: "zhihu",
    score: 0.88,
  },
  {
    bookmarkId: 103,
    title: "TypeScript 高级类型技巧",
    url: "https://example.com/ts",
    summary: "TypeScript 类型体操入门",
    platform: "bilibili",
    score: 0.82,
  },
];

// ============================================================================
// Feature Flags 测试
// ============================================================================

describe("ReAct 和引用追踪 Feature Flags", () => {
  describe("ENABLE_REACT_LOOP", () => {
    it("默认应为 false（灰度发布）", () => {
      // 在没有设置环境变量时，默认应该是 false
      const originalEnv = process.env.ENABLE_REACT_LOOP;
      delete process.env.ENABLE_REACT_LOOP;

      expect(FeatureFlags.ENABLE_REACT_LOOP).toBe(false);

      // 恢复环境变量
      if (originalEnv !== undefined) {
        process.env.ENABLE_REACT_LOOP = originalEnv;
      }
    });

    it("设置为 true 时应启用", () => {
      const originalEnv = process.env.ENABLE_REACT_LOOP;
      process.env.ENABLE_REACT_LOOP = "true";

      expect(FeatureFlags.ENABLE_REACT_LOOP).toBe(true);

      // 恢复环境变量
      if (originalEnv !== undefined) {
        process.env.ENABLE_REACT_LOOP = originalEnv;
      } else {
        delete process.env.ENABLE_REACT_LOOP;
      }
    });
  });

  describe("ENABLE_CITATION_TRACKING", () => {
    it("默认应为 true（自动启用）", () => {
      const originalEnv = process.env.ENABLE_CITATION_TRACKING;
      delete process.env.ENABLE_CITATION_TRACKING;

      expect(FeatureFlags.ENABLE_CITATION_TRACKING).toBe(true);

      if (originalEnv !== undefined) {
        process.env.ENABLE_CITATION_TRACKING = originalEnv;
      }
    });

    it("设置为 false 时应禁用", () => {
      const originalEnv = process.env.ENABLE_CITATION_TRACKING;
      process.env.ENABLE_CITATION_TRACKING = "false";

      expect(FeatureFlags.ENABLE_CITATION_TRACKING).toBe(false);

      if (originalEnv !== undefined) {
        process.env.ENABLE_CITATION_TRACKING = originalEnv;
      } else {
        delete process.env.ENABLE_CITATION_TRACKING;
      }
    });
  });

  describe("isFeatureEnabled", () => {
    it("应正确返回功能启用状态", () => {
      expect(typeof isFeatureEnabled("ENABLE_REACT_LOOP")).toBe("boolean");
      expect(typeof isFeatureEnabled("ENABLE_CITATION_TRACKING")).toBe(
        "boolean",
      );
    });
  });
});

// ============================================================================
// 引用追踪完整流程测试
// ============================================================================

describe("引用追踪完整流程", () => {
  beforeEach(() => {
    resetCitationEnricher();
    resetCitationIndexer();
  });

  it("应完成从搜索到引用标注的完整流程", () => {
    const enricher = getCitationEnricher();
    const conversationId = "integration-test-1";

    // 1. 处理搜索结果
    const citationData = enricher.processSearchResults(
      conversationId,
      mockSearchResults,
      "React Vue",
    );

    expect(citationData.indexed).toBe(true);
    expect(citationData.totalCitations).toBe(3);

    // 2. 模拟 AI 响应
    const aiResponse = `根据搜索结果，我找到了 3 条相关内容：

第一篇文章介绍了 React 18 的并发特性，这是一个重要的性能优化。
第二篇是关于 Vue 3 组合式 API 的指南，非常适合入门学习。
第三篇讲解了 TypeScript 的高级类型技巧。

总结来看，第一篇和第二篇对于前端框架学习最有帮助。`;

    // 3. 增强响应
    const result = enricher.enrichResponse(aiResponse, conversationId);

    // 4. 验证结果
    expect(result.hasCitations).toBe(true);
    expect(result.enrichedText).toContain("[^1]");
    expect(result.enrichedText).toContain("[^2]");
    expect(result.enrichedText).toContain("[^3]");
    expect(result.enrichedText).toContain("参考来源");
    expect(result.stats.total).toBeGreaterThan(0);
  });

  it("应正确生成 CitationChunk 格式", () => {
    const enricher = getCitationEnricher();
    const conversationId = "integration-test-2";

    const citationData = enricher.processSearchResults(
      conversationId,
      mockSearchResults,
    );

    // 验证 CitationChunk 数据格式
    const citationChunk: CitationChunk = {
      type: "citation",
      data: {
        indexed: citationData.indexed,
        totalCitations: citationData.totalCitations,
        citationSummary: citationData.citationSummary,
        conversationId,
        query: citationData.query,
      },
    };

    expect(citationChunk.type).toBe("citation");
    expect(citationChunk.data.indexed).toBe(true);
    expect(citationChunk.data.citationSummary.length).toBe(3);
    expect(citationChunk.data.citationSummary[0]).toEqual({
      index: 1,
      title: "React 18 新特性详解",
      bookmarkId: 101,
    });
  });
});

// ============================================================================
// ThinkingChunk 类型验证测试
// ============================================================================

describe("ThinkingChunk 类型验证", () => {
  it("应正确创建 ReAct 思考块", () => {
    const thinkingChunk: ThinkingChunk = {
      type: "thinking",
      data: {
        phase: "react_think",
        content: "分析用户意图：用户想要查找 React 相关的收藏",
        timestamp: Date.now(),
        round: 1,
        isFinal: false,
      },
    };

    expect(thinkingChunk.type).toBe("thinking");
    expect(thinkingChunk.data.phase).toBe("react_think");
    expect(thinkingChunk.data.round).toBe(1);
    expect(thinkingChunk.data.isFinal).toBe(false);
  });

  it("应正确创建 ReAct 行动块", () => {
    const actChunk: ThinkingChunk = {
      type: "thinking",
      data: {
        phase: "react_act",
        content: "调用 semantic_search 工具查找 React 相关内容",
        timestamp: Date.now(),
        round: 1,
        isFinal: false,
      },
    };

    expect(actChunk.data.phase).toBe("react_act");
  });

  it("应正确创建 ReAct 观察块", () => {
    const observeChunk: ThinkingChunk = {
      type: "thinking",
      data: {
        phase: "react_observe",
        content: "搜索返回了 3 条结果，目标已达成",
        timestamp: Date.now(),
        round: 1,
        isFinal: false,
      },
    };

    expect(observeChunk.data.phase).toBe("react_observe");
  });

  it("应正确创建 ReAct 完成块", () => {
    const completeChunk: ThinkingChunk = {
      type: "thinking",
      data: {
        phase: "react_complete",
        content: "任务完成，已找到所有相关内容",
        timestamp: Date.now(),
        round: 1,
        isFinal: true,
      },
    };

    expect(completeChunk.data.phase).toBe("react_complete");
    expect(completeChunk.data.isFinal).toBe(true);
  });

  it("应支持所有零接管模式阶段", () => {
    const phases = [
      "understanding",
      "planning",
      "deciding",
      "executing",
    ] as const;

    for (const phase of phases) {
      const chunk: ThinkingChunk = {
        type: "thinking",
        data: {
          phase,
          content: `${phase} 阶段内容`,
          timestamp: Date.now(),
        },
      };

      expect(chunk.data.phase).toBe(phase);
    }
  });
});

// ============================================================================
// UnifiedStreamChunk 类型一致性测试
// ============================================================================

describe("UnifiedStreamChunk 类型一致性", () => {
  it("ThinkingChunk 应是 UnifiedStreamChunk 的子类型", () => {
    const thinkingChunk: UnifiedStreamChunk = {
      type: "thinking",
      data: {
        phase: "react_think",
        content: "思考内容",
        timestamp: Date.now(),
        round: 1,
      },
    };

    expect(thinkingChunk.type).toBe("thinking");
  });

  it("CitationChunk 应是 UnifiedStreamChunk 的子类型", () => {
    const citationChunk: UnifiedStreamChunk = {
      type: "citation",
      data: {
        indexed: true,
        totalCitations: 3,
        citationSummary: [{ index: 1, title: "文章1", bookmarkId: 101 }],
        conversationId: "test-conv",
      },
    };

    expect(citationChunk.type).toBe("citation");
  });
});

// ============================================================================
// 多轮 ReAct 循环模拟测试
// ============================================================================

describe("多轮 ReAct 循环模拟", () => {
  it("应正确处理多轮 Think-Act-Observe 循环", () => {
    const rounds: ThinkingChunk[] = [];

    // Round 1
    rounds.push({
      type: "thinking",
      data: {
        phase: "react_think",
        content: "Round 1: 分析用户意图",
        timestamp: Date.now(),
        round: 1,
      },
    });

    rounds.push({
      type: "thinking",
      data: {
        phase: "react_act",
        content: "Round 1: 调用搜索工具",
        timestamp: Date.now(),
        round: 1,
      },
    });

    rounds.push({
      type: "thinking",
      data: {
        phase: "react_observe",
        content: "Round 1: 搜索结果不够精确，需要细化",
        timestamp: Date.now(),
        round: 1,
      },
    });

    // Round 2
    rounds.push({
      type: "thinking",
      data: {
        phase: "react_think",
        content: "Round 2: 细化搜索关键词",
        timestamp: Date.now(),
        round: 2,
      },
    });

    rounds.push({
      type: "thinking",
      data: {
        phase: "react_act",
        content: "Round 2: 使用更精确的关键词搜索",
        timestamp: Date.now(),
        round: 2,
      },
    });

    rounds.push({
      type: "thinking",
      data: {
        phase: "react_observe",
        content: "Round 2: 找到满意的结果",
        timestamp: Date.now(),
        round: 2,
      },
    });

    rounds.push({
      type: "thinking",
      data: {
        phase: "react_complete",
        content: "任务完成",
        timestamp: Date.now(),
        round: 2,
        isFinal: true,
      },
    });

    // 验证
    expect(rounds.length).toBe(7);
    expect(rounds.filter((r) => r.data.round === 1).length).toBe(3);
    expect(rounds.filter((r) => r.data.round === 2).length).toBe(4);
    expect(rounds[rounds.length - 1].data.isFinal).toBe(true);
  });
});

// ============================================================================
// 引用标注正则表达式测试
// ============================================================================

describe("引用标注正则表达式兼容性", () => {
  it("前端正则应能匹配后端生成的引用标注", () => {
    // 后端生成的格式
    const backendOutput = "根据第一篇[^1]和第二篇[^2]的内容...";

    // 前端解析正则
    const CITATION_PATTERN = /\[\^(\d+)\]/g;

    const matches = backendOutput.match(CITATION_PATTERN);
    expect(matches).toEqual(["[^1]", "[^2]"]);

    // 提取引用编号
    const numbers: number[] = [];
    CITATION_PATTERN.lastIndex = 0;
    let match;
    while ((match = CITATION_PATTERN.exec(backendOutput)) !== null) {
      numbers.push(parseInt(match[1], 10));
    }

    expect(numbers).toEqual([1, 2]);
  });
});
