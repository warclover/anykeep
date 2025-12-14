/**
 * Enhanced Summary Provider Tests
 *
 * 验证增强版 Provider 的核心功能：
 * - Prompt 构建
 * - 响应解析
 * - 实体提取
 * - 错误处理
 *
 * @version 3.0.0
 * @since 2025-12-14
 */

import {
  EnhancedSummaryProvider,
  ENHANCED_SYSTEM_PROMPT,
  ENHANCED_SYSTEM_PROMPT_LITE,
  getEnhancedPromptConfig,
  buildEnhancedUserPrompt,
  type SummaryInput,
} from "../index";

// ============================================================================
// Mock Data
// ============================================================================

const mockInput: SummaryInput = {
  bookmarkId: 123,
  userId: "test-user-uuid",
  title: "深入理解 React Hooks 原理与最佳实践",
  description: "本文详细介绍 React Hooks 的工作原理、常见陷阱及优化技巧",
  content: `
    React Hooks 是 React 16.8 引入的新特性，允许在函数组件中使用状态和其他 React 特性。

    ## useState 原理
    useState 底层使用链表结构存储状态，每次调用时按顺序读取。这就是为什么 Hooks 不能在条件语句中使用。

    ## useEffect 最佳实践
    1. 始终指定依赖数组
    2. 避免过度使用
    3. 清理副作用

    ## 性能优化
    - 使用 useMemo 缓存计算结果
    - 使用 useCallback 缓存函数引用
    - 合理拆分组件

    作者：张三，React 核心贡献者
  `,
  url: "https://example.com/react-hooks-guide",
};

const mockExistingFolders = ["前端开发", "React", "编程技术", "工具资源"];

// ============================================================================
// Test: Enhanced Prompts
// ============================================================================

describe("Enhanced Prompts", () => {
  describe("ENHANCED_SYSTEM_PROMPT", () => {
    it("should be a non-empty string", () => {
      expect(typeof ENHANCED_SYSTEM_PROMPT).toBe("string");
      expect(ENHANCED_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });

    it("should contain entity extraction instructions", () => {
      expect(ENHANCED_SYSTEM_PROMPT).toMatch(/实体/);
      expect(ENHANCED_SYSTEM_PROMPT).toMatch(/person|company|tech|concept/i);
    });

    it("should contain key data extraction instructions", () => {
      expect(ENHANCED_SYSTEM_PROMPT).toMatch(/关键数据|key_data/i);
    });

    it("should contain difficulty assessment instructions", () => {
      expect(ENHANCED_SYSTEM_PROMPT).toMatch(/难度|difficulty/i);
    });
  });

  describe("ENHANCED_SYSTEM_PROMPT_LITE", () => {
    it("should be a non-empty string", () => {
      expect(typeof ENHANCED_SYSTEM_PROMPT_LITE).toBe("string");
      expect(ENHANCED_SYSTEM_PROMPT_LITE.length).toBeGreaterThan(100);
    });

    it("should be shorter than full prompt", () => {
      expect(ENHANCED_SYSTEM_PROMPT_LITE.length).toBeLessThan(
        ENHANCED_SYSTEM_PROMPT.length,
      );
    });
  });

  describe("getEnhancedPromptConfig", () => {
    it("should return valid config for article type", () => {
      const config = getEnhancedPromptConfig("article");
      expect(config).toBeDefined();
      expect(config.temperature).toBeGreaterThan(0);
      expect(config.maxTokens).toBeGreaterThan(0);
    });

    it("should return valid config for tutorial type", () => {
      const config = getEnhancedPromptConfig("tutorial");
      expect(config).toBeDefined();
      expect(config.temperature).toBeLessThanOrEqual(1);
    });

    it("should use default for unknown type", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = getEnhancedPromptConfig("unknown" as any);
      expect(config).toBeDefined();
      expect(config.temperature).toBeGreaterThan(0);
    });
  });

  describe("buildEnhancedUserPrompt", () => {
    it("should include title in prompt", () => {
      const prompt = buildEnhancedUserPrompt(
        mockInput.title!,
        mockInput.description,
        mockInput.content,
        mockExistingFolders,
      );
      expect(prompt).toContain(mockInput.title);
    });

    it("should include existing folders when provided", () => {
      const prompt = buildEnhancedUserPrompt(
        mockInput.title!,
        mockInput.description,
        mockInput.content,
        mockExistingFolders,
      );
      expect(prompt).toContain("前端开发");
      expect(prompt).toContain("React");
    });

    it("should handle missing description", () => {
      const prompt = buildEnhancedUserPrompt(
        mockInput.title!,
        undefined,
        mockInput.content,
      );
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("should handle missing content", () => {
      const prompt = buildEnhancedUserPrompt(
        mockInput.title!,
        mockInput.description,
        undefined,
      );
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Test: Enhanced Provider
// ============================================================================

describe("EnhancedSummaryProvider", () => {
  describe("Provider instantiation", () => {
    it("should create instance with default config", () => {
      const provider = new EnhancedSummaryProvider();
      expect(provider).toBeDefined();
      expect(provider.name).toBe("deepseek");
      expect(provider.priority).toBe(1);
    });

    it("should create instance with custom config", () => {
      const provider = new EnhancedSummaryProvider(undefined, {
        extractEntities: true,
        extractKeyData: true,
        evaluateDifficulty: true,
        identifyContentType: true,
        maxEntities: 5,
        maxKeyData: 3,
        entityConfidenceThreshold: 0.8,
      });
      expect(provider).toBeDefined();
    });
  });

  describe("supportsStreaming", () => {
    it("should return false", () => {
      const provider = new EnhancedSummaryProvider();
      expect(provider.supportsStreaming()).toBe(false);
    });
  });

  describe("estimateCost", () => {
    it("should return a positive number", () => {
      const provider = new EnhancedSummaryProvider();
      const cost = provider.estimateCost(10000);
      expect(cost).toBeGreaterThan(0);
    });

    it("should scale with token count", () => {
      const provider = new EnhancedSummaryProvider();
      // Use larger token counts to see scaling effect (due to Math.ceil)
      const cost10000 = provider.estimateCost(10000);
      const cost50000 = provider.estimateCost(50000);
      expect(cost50000).toBeGreaterThan(cost10000);
    });
  });

  describe("getConfig", () => {
    it("should return provider config", () => {
      const provider = new EnhancedSummaryProvider();
      const config = provider.getConfig();
      expect(config).toBeDefined();
      // Check model field exists (ProviderConfig has model, not name)
      expect(config.model).toBeDefined();
    });

    it("should hide API key in config", () => {
      const provider = new EnhancedSummaryProvider();
      const config = provider.getConfig();
      // API key should be masked as "***"
      expect(config.apiKey).toBe("***");
    });
  });

  describe("parseResponse", () => {
    const provider = new EnhancedSummaryProvider();

    it("should parse valid enhanced response", () => {
      const mockResponse = JSON.stringify({
        tldr: "React Hooks 详细教程",
        key_points: ["useState 原理", "useEffect 最佳实践", "性能优化"],
        sentiment: "neutral",
        keywords: ["React", "Hooks", "前端开发"],
        folder_suggestion: "前端开发",
        entities: [
          { name: "React", type: "tech", confidence: 0.95 },
          { name: "张三", type: "person", confidence: 0.8 },
        ],
        key_data: [{ label: "React 版本", value: "16.8" }],
        difficulty: "medium",
        content_type: "tutorial",
      });

      const result = provider.parseResponse(mockResponse);
      expect(result.version).toBe(3);
      expect(result.summary).toBeDefined();
      expect(result.tags).toContain("React");
      expect(result.enhanced).toBeDefined();
      // Note: entities may be filtered by confidence threshold (0.6)
      expect(result.enhanced?.entities?.length).toBeGreaterThan(0);
      expect(result.enhanced?.key_data).toHaveLength(1);
      expect(result.enhanced?.difficulty).toBe("medium");
    });

    it("should handle response without entities", () => {
      const mockResponse = JSON.stringify({
        tldr: "简单摘要",
        key_points: ["要点1"],
        sentiment: "neutral",
        keywords: ["标签"],
        folder_suggestion: "文件夹",
      });

      const result = provider.parseResponse(mockResponse);
      expect(result.version).toBe(3);
      expect(result.enhanced?.entities).toEqual([]);
    });

    it("should handle response with empty entities", () => {
      const mockResponse = JSON.stringify({
        tldr: "简单摘要",
        key_points: ["要点1"],
        sentiment: "neutral",
        keywords: ["标签"],
        folder_suggestion: "文件夹",
        entities: [],
        key_data: [],
      });

      const result = provider.parseResponse(mockResponse);
      expect(result.version).toBe(3);
      expect(result.enhanced?.entities).toEqual([]);
      expect(result.enhanced?.key_data).toEqual([]);
    });

    it("should normalize entity types", () => {
      const mockResponse = JSON.stringify({
        tldr: "摘要",
        key_points: ["要点"],
        sentiment: "neutral",
        keywords: ["标签"],
        folder_suggestion: "文件夹",
        entities: [
          { name: "Unknown Entity", type: "unknown_type", confidence: 0.7 },
        ],
      });

      const result = provider.parseResponse(mockResponse);
      // Unknown type should be normalized to "other"
      expect(result.enhanced?.entities?.[0]?.type).toBe("other");
    });

    it("should handle malformed JSON gracefully", () => {
      const malformedResponse = "not valid json {";

      expect(() => {
        provider.parseResponse(malformedResponse);
      }).toThrow();
    });
  });
});

// ============================================================================
// Test: Module Exports
// ============================================================================

describe("Module Exports", () => {
  it("should export EnhancedSummaryProvider", () => {
    expect(EnhancedSummaryProvider).toBeDefined();
    expect(typeof EnhancedSummaryProvider).toBe("function");
  });

  it("should export enhanced prompt functions", () => {
    expect(ENHANCED_SYSTEM_PROMPT).toBeDefined();
    expect(ENHANCED_SYSTEM_PROMPT_LITE).toBeDefined();
    expect(getEnhancedPromptConfig).toBeDefined();
    expect(buildEnhancedUserPrompt).toBeDefined();
  });
});
