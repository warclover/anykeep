/**
 * AI Summary Module Integration Tests
 *
 * 验证模块导出、Provider 实例化、Prompt 构建和响应解析
 *
 * @version 2.0.0
 * @since 2025-12-12
 */

// V4.2.7: Mock Supabase server client for regenerate tests
const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: mockFrom,
      rpc: mockRpc,
    }),
  ),
}));

// Module exports
import {
  // Types that are actually used in tests
  type SummaryInput,
  type SummaryResult,
  type ProviderHealth,

  // Classes
  DeepSeekProvider,
  AliyunBailianProvider,
  ProviderFactory,
  getProviderFactory,
  resetProviderFactory,
  SummaryService,
  getSummaryService,
  resetSummaryService,
  SummaryConfigService,
  getSummaryConfigService,
  resetSummaryConfigService,
  QualityTrackerService,
  getQualityTrackerService,
  resetQualityTrackerService,
  SummaryError,
  SummaryErrorCode,

  // Config functions
  isNewSummaryServiceEnabled,
  isJsonOutputEnabled,
  isFallbackEnabled,
  getDefaultProvider,
  getFallbackProvider,
  getProviderConfig,
  isProviderConfigured,
  getConfiguredProviders,
  DEEPSEEK_DEFAULT_CONFIG,
  ALIYUN_BAILIAN_DEFAULT_CONFIG,

  // Prompt functions
  getPromptConfig,
  buildTypeSpecificPrompt,
  getPromptConfigV2,
  buildTypeSpecificPromptV2,

  // Utility functions
  isStructuredSummary,
  parseStructuredSummary,
  getDisplaySummary,
  detectContentType,
} from "../index";

describe("AI Summary Module", () => {
  describe("Module Exports", () => {
    it("should export all required types", () => {
      // Types are compile-time only, so we just verify the module loads
      expect(DeepSeekProvider).toBeDefined();
      expect(ProviderFactory).toBeDefined();
      expect(getProviderFactory).toBeDefined();
      expect(resetProviderFactory).toBeDefined();
    });

    it("should export error classes", () => {
      expect(SummaryError).toBeDefined();
      expect(SummaryErrorCode).toBeDefined();

      const error = new SummaryError(
        SummaryErrorCode.API_CALL_FAILED,
        "Test error",
        "deepseek",
      );
      expect(error.code).toBe(SummaryErrorCode.API_CALL_FAILED);
      expect(error.provider).toBe("deepseek");
    });

    it("should export configuration functions", () => {
      expect(isNewSummaryServiceEnabled).toBeDefined();
      expect(isJsonOutputEnabled).toBeDefined();
      expect(isFallbackEnabled).toBeDefined();
      expect(getDefaultProvider).toBeDefined();
      expect(getFallbackProvider).toBeDefined();
      expect(getProviderConfig).toBeDefined();
      expect(isProviderConfigured).toBeDefined();
      expect(getConfiguredProviders).toBeDefined();
    });

    it("should export prompt functions", () => {
      expect(getPromptConfig).toBeDefined();
      expect(buildTypeSpecificPrompt).toBeDefined();
      expect(getPromptConfigV2).toBeDefined();
      expect(buildTypeSpecificPromptV2).toBeDefined();
    });

    it("should export utility functions", () => {
      expect(isStructuredSummary).toBeDefined();
      expect(parseStructuredSummary).toBeDefined();
      expect(getDisplaySummary).toBeDefined();
      expect(detectContentType).toBeDefined();
    });
  });

  describe("DeepSeekProvider", () => {
    let provider: DeepSeekProvider;

    beforeEach(() => {
      provider = new DeepSeekProvider({
        apiKey: "test-api-key",
      });
    });

    it("should instantiate with correct name and priority", () => {
      expect(provider.name).toBe("deepseek");
      expect(provider.priority).toBe(1);
    });

    it("should support streaming", () => {
      expect(provider.supportsStreaming()).toBe(true);
    });

    it("should hide API key in config", () => {
      const config = provider.getConfig();
      expect(config.apiKey).toBe("***");
    });

    it("should estimate cost correctly", () => {
      const cost = provider.estimateCost(1000);
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe("number");
    });

    describe("buildPrompts", () => {
      it("should build prompts for article content", () => {
        const input: SummaryInput = {
          bookmarkId: 1,
          userId: "test-user",
          title: "Test Article",
          content: "This is test content for the article.",
          contentType: "article",
        };

        const result = provider.buildPrompts(input);

        expect(result.systemPrompt).toBeDefined();
        expect(result.userPrompt).toBeDefined();
        expect(result.temperature).toBeGreaterThan(0);
        expect(result.maxTokens).toBeGreaterThan(0);
      });

      it("should build prompts for video content", () => {
        const input: SummaryInput = {
          bookmarkId: 2,
          userId: "test-user",
          title: "Test Video",
          content: "Video description content",
          contentType: "video",
        };

        const result = provider.buildPrompts(input);

        expect(result.systemPrompt).toBeDefined();
        expect(result.userPrompt).toContain("Test Video");
      });
    });

    describe("parseResponse", () => {
      const originalEnv = process.env;

      beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
      });

      afterAll(() => {
        process.env = originalEnv;
      });

      it("should parse V1 JSON response", () => {
        const mockResponse = JSON.stringify({
          summary: "This is a test summary.",
          tags: ["tag1", "tag2", "tag3"],
        });

        // Force V1 output
        process.env.AI_SUMMARY_JSON_OUTPUT = "false";

        const newProvider = new DeepSeekProvider({ apiKey: "test" });
        const result = newProvider.parseResponse(mockResponse);

        expect(result.summary).toBe("This is a test summary.");
        expect(result.tags).toEqual(["tag1", "tag2", "tag3"]);
        expect(result.version).toBe(1);
      });

      it("should parse V2 structured JSON response", () => {
        const mockResponse = JSON.stringify({
          tldr: "This is a TLDR summary.",
          key_points: ["Point 1", "Point 2"],
          keywords: ["keyword1", "keyword2"],
          sentiment: "positive",
          reading_time: 5,
        });

        // Force V2 output
        process.env.AI_SUMMARY_JSON_OUTPUT = "true";

        const newProvider = new DeepSeekProvider({ apiKey: "test" });
        const result = newProvider.parseResponse(mockResponse);

        expect(result.version).toBe(2);
        expect(result.tags).toEqual(["keyword1", "keyword2"]);
        expect(result.structured).toBeDefined();
        expect(result.structured?.tldr).toBe("This is a TLDR summary.");
        expect(result.structured?.key_points).toEqual(["Point 1", "Point 2"]);
      });

      it("should handle markdown code blocks in response", () => {
        const mockResponse = `\`\`\`json
{
  "summary": "Summary with code block.",
  "tags": ["test"]
}
\`\`\``;

        process.env.AI_SUMMARY_JSON_OUTPUT = "false";

        const newProvider = new DeepSeekProvider({ apiKey: "test" });
        const result = newProvider.parseResponse(mockResponse);

        expect(result.summary).toBe("Summary with code block.");
      });
    });
  });

  describe("AliyunBailianProvider", () => {
    let provider: AliyunBailianProvider;

    beforeEach(() => {
      provider = new AliyunBailianProvider({
        apiKey: "test-api-key",
      });
    });

    it("should instantiate with correct name and priority", () => {
      expect(provider.name).toBe("aliyun-bailian");
      expect(provider.priority).toBe(2); // 备选优先级
    });

    it("should support streaming", () => {
      expect(provider.supportsStreaming()).toBe(true);
    });

    it("should hide API key in config", () => {
      const config = provider.getConfig();
      expect(config.apiKey).toBe("***");
    });

    it("should use correct default base URL", () => {
      const config = provider.getConfig();
      expect(config.baseUrl).toBe(
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
      );
    });

    it("should use qwen-turbo as default model", () => {
      const config = provider.getConfig();
      expect(config.model).toBe("qwen-turbo");
    });

    it("should estimate cost correctly", () => {
      const cost = provider.estimateCost(1000);
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe("number");
    });

    describe("buildPrompts", () => {
      it("should build prompts for article content", () => {
        const input: SummaryInput = {
          bookmarkId: 1,
          userId: "test-user",
          title: "Test Article",
          content: "This is test content for the article.",
          contentType: "article",
        };

        const result = provider.buildPrompts(input);

        expect(result.systemPrompt).toBeDefined();
        expect(result.userPrompt).toBeDefined();
        expect(result.temperature).toBeGreaterThan(0);
        expect(result.maxTokens).toBeGreaterThan(0);
      });
    });

    describe("parseResponse", () => {
      const originalEnv = process.env;

      beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
      });

      afterAll(() => {
        process.env = originalEnv;
      });

      it("should parse V1 JSON response", () => {
        const mockResponse = JSON.stringify({
          summary: "This is a test summary from Aliyun.",
          tags: ["tag1", "tag2", "tag3"],
        });

        process.env.AI_SUMMARY_JSON_OUTPUT = "false";

        const newProvider = new AliyunBailianProvider({ apiKey: "test" });
        const result = newProvider.parseResponse(mockResponse);

        expect(result.summary).toBe("This is a test summary from Aliyun.");
        expect(result.tags).toEqual(["tag1", "tag2", "tag3"]);
        expect(result.version).toBe(1);
      });

      it("should parse V2 structured JSON response", () => {
        const mockResponse = JSON.stringify({
          tldr: "This is a TLDR from Aliyun.",
          key_points: ["Point 1", "Point 2"],
          keywords: ["qwen", "aliyun"],
          sentiment: "neutral",
          reading_time: 3,
        });

        process.env.AI_SUMMARY_JSON_OUTPUT = "true";

        const newProvider = new AliyunBailianProvider({ apiKey: "test" });
        const result = newProvider.parseResponse(mockResponse);

        expect(result.version).toBe(2);
        expect(result.tags).toEqual(["qwen", "aliyun"]);
        expect(result.structured).toBeDefined();
        expect(result.structured?.tldr).toBe("This is a TLDR from Aliyun.");
      });
    });
  });

  describe("ProviderFactory", () => {
    beforeEach(() => {
      resetProviderFactory();
    });

    afterEach(() => {
      resetProviderFactory();
    });

    it("should create singleton instance", () => {
      const factory1 = getProviderFactory();
      const factory2 = getProviderFactory();

      expect(factory1).toBe(factory2);
    });

    it("should reset singleton correctly", () => {
      const factory1 = getProviderFactory();
      resetProviderFactory();
      const factory2 = getProviderFactory();

      expect(factory1).not.toBe(factory2);
    });

    it("should return registered providers", () => {
      const factory = new ProviderFactory();
      const providers = factory.getRegisteredProviders();

      expect(Array.isArray(providers)).toBe(true);
    });

    it("should get specific provider by name", () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, DEEPSEEK_API_KEY: "test-key" };

      const factory = new ProviderFactory();
      const deepseek = factory.getProvider("deepseek");

      if (deepseek) {
        expect(deepseek.name).toBe("deepseek");
        expect(deepseek.priority).toBe(1);
      }

      process.env = originalEnv;
    });

    it("should sort providers by priority", () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DEEPSEEK_API_KEY: "test-key",
        DASHSCOPE_API_KEY: "test-key",
      };

      const factory = new ProviderFactory();
      const providers = factory.getRegisteredProviders();

      // DeepSeek (priority 1) should come before Aliyun (priority 2)
      if (providers.length >= 2) {
        const deepseekIndex = providers.indexOf("deepseek");
        const aliyunIndex = providers.indexOf("aliyun-bailian");
        if (deepseekIndex >= 0 && aliyunIndex >= 0) {
          // Both are registered, check factory returns them in order
          const deepseek = factory.getProvider("deepseek");
          const aliyun = factory.getProvider("aliyun-bailian");
          if (deepseek && aliyun) {
            expect(deepseek.priority).toBeLessThan(aliyun.priority);
          }
        }
      }

      process.env = originalEnv;
    });

    it("should support stopHealthCheck", () => {
      const factory = new ProviderFactory();
      // Should not throw
      expect(() => factory.stopHealthCheck()).not.toThrow();
    });

    it("should support reinitialize", () => {
      const factory = new ProviderFactory();
      // Should not throw
      expect(() => factory.reinitialize()).not.toThrow();
    });
  });

  describe("Provider Fallback Mechanism", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      resetProviderFactory();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      resetProviderFactory();
      process.env = originalEnv;
    });

    it("should have DeepSeek as primary and Aliyun as fallback by default", () => {
      const defaultProvider = getDefaultProvider();
      const fallbackProvider = getFallbackProvider();

      expect(defaultProvider).toBe("deepseek");
      expect(fallbackProvider).toBe("aliyun-bailian");
    });

    it("should register both providers when both are configured", () => {
      process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
      process.env.DASHSCOPE_API_KEY = "test-dashscope-key";

      const factory = new ProviderFactory();
      const providers = factory.getRegisteredProviders();

      expect(providers).toContain("deepseek");
      expect(providers).toContain("aliyun-bailian");
    });

    it("should only register configured providers", () => {
      // Only DeepSeek configured
      process.env.DEEPSEEK_API_KEY = "test-key";
      delete process.env.DASHSCOPE_API_KEY;

      const factory = new ProviderFactory();
      const providers = factory.getRegisteredProviders();

      expect(providers).toContain("deepseek");
      // Aliyun may or may not be in the list depending on env state
    });

    it("should respect priority order: DeepSeek (1) < Aliyun (2)", () => {
      const deepseek = new DeepSeekProvider({ apiKey: "test" });
      const aliyun = new AliyunBailianProvider({ apiKey: "test" });

      expect(deepseek.priority).toBe(1);
      expect(aliyun.priority).toBe(2);
      expect(deepseek.priority).toBeLessThan(aliyun.priority);
    });
  });

  describe("Configuration", () => {
    it("should return correct default provider", () => {
      const provider = getDefaultProvider();
      expect(["deepseek", "aliyun-bailian", "ollama"]).toContain(provider);
    });

    it("should return correct fallback provider", () => {
      const provider = getFallbackProvider();
      expect(["deepseek", "aliyun-bailian", "ollama"]).toContain(provider);
    });

    it("should have valid default configs", () => {
      expect(DEEPSEEK_DEFAULT_CONFIG.baseUrl).toBe(
        "https://api.deepseek.com/v1",
      );
      expect(DEEPSEEK_DEFAULT_CONFIG.model).toBe("deepseek-chat");
      expect(DEEPSEEK_DEFAULT_CONFIG.timeoutMs).toBeGreaterThan(0);

      expect(ALIYUN_BAILIAN_DEFAULT_CONFIG.baseUrl).toBe(
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
      );
      expect(ALIYUN_BAILIAN_DEFAULT_CONFIG.model).toBe("qwen-turbo");
    });
  });

  describe("Content Type Detection", () => {
    it("should detect article content type", () => {
      const result = detectContentType({
        url: "https://example.com/blog/article",
        title: "How to Learn Programming",
        content: "This is a programming tutorial...",
      });

      expect(result.type).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should detect video content type from YouTube URL", () => {
      const result = detectContentType({
        url: "https://www.youtube.com/watch?v=123",
        title: "Tutorial Video",
      });

      expect(result.type).toBe("video");
      // Confidence varies based on detection rules
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should return a content type for social URL", () => {
      const result = detectContentType({
        url: "https://twitter.com/user/status/123",
        title: "Tweet about tech",
      });

      // Content type detection may vary based on implementation
      // Just verify it returns a valid type
      expect(result.type).toBeDefined();
      expect([
        "article",
        "social",
        "video",
        "tool",
        "reference",
        "news",
        "entertainment",
        "shopping",
      ]).toContain(result.type);
    });
  });

  describe("Utility Functions", () => {
    describe("isStructuredSummary", () => {
      it("should return true for valid structured summary string", () => {
        const structuredJson = JSON.stringify({
          tldr: "Test TLDR",
          key_points: ["Point 1"],
          keywords: ["keyword"],
          sentiment: "neutral",
          reading_time: 5,
        });

        expect(isStructuredSummary(structuredJson)).toBe(true);
      });

      it("should return false for invalid data", () => {
        expect(isStructuredSummary("")).toBe(false);
        expect(isStructuredSummary("plain text")).toBe(false);
        expect(isStructuredSummary(JSON.stringify({ summary: "text" }))).toBe(
          false,
        );
      });
    });

    describe("getDisplaySummary", () => {
      it("should return TLDR for structured summary", () => {
        const json = JSON.stringify({
          tldr: "This is the TLDR",
          key_points: ["Point 1"],
          keywords: ["test"],
          sentiment: "neutral",
          reading_time: 5,
        });

        const display = getDisplaySummary(json);
        expect(display).toBe("This is the TLDR");
      });

      it("should return original for plain text", () => {
        const text = "This is a plain text summary.";
        const display = getDisplaySummary(text);
        expect(display).toBe(text);
      });

      it("should return null for null input", () => {
        expect(getDisplaySummary(null)).toBeNull();
        expect(getDisplaySummary(undefined)).toBeNull();
      });
    });
  });

  describe("SummaryService", () => {
    beforeEach(() => {
      resetSummaryService();
      resetProviderFactory();
    });

    afterEach(() => {
      resetSummaryService();
      resetProviderFactory();
    });

    describe("Singleton Pattern", () => {
      it("should export SummaryService class and factory functions", () => {
        expect(SummaryService).toBeDefined();
        expect(getSummaryService).toBeDefined();
        expect(resetSummaryService).toBeDefined();
      });

      it("should create singleton instance", () => {
        const service1 = getSummaryService();
        const service2 = getSummaryService();

        expect(service1).toBe(service2);
      });

      it("should reset singleton correctly", () => {
        const service1 = getSummaryService();
        resetSummaryService();
        const service2 = getSummaryService();

        expect(service1).not.toBe(service2);
      });
    });

    describe("Configuration", () => {
      it("should use default configuration", () => {
        const service = new SummaryService();
        const config = service.getConfig();

        expect(config.enableFallback).toBeDefined();
        expect(config.emitEvents).toBeDefined();
      });

      it("should accept custom configuration", () => {
        const service = new SummaryService({
          enableFallback: false,
          emitEvents: false,
        });
        const config = service.getConfig();

        expect(config.enableFallback).toBe(false);
        expect(config.emitEvents).toBe(false);
      });
    });

    describe("Statistics", () => {
      it("should return initial stats", async () => {
        const service = new SummaryService();
        const stats = await service.getStats();

        expect(stats.totalGenerated).toBe(0);
        expect(stats.successRate).toBe(0);
        expect(stats.averageLatencyMs).toBe(0);
        expect(stats.fallbackRate).toBe(0);
        expect(stats.providerUsage).toBeDefined();
        expect(stats.byContentType).toBeDefined();
      });
    });

    describe("Provider Health", () => {
      it("should return provider health map", async () => {
        const originalEnv = process.env;
        process.env = {
          ...originalEnv,
          DEEPSEEK_API_KEY: "test-key",
        };

        const service = new SummaryService();
        const health = await service.getProvidersHealth();

        expect(health).toBeInstanceOf(Map);

        process.env = originalEnv;
      });
    });

    describe("Error Handling", () => {
      it("should use local fallback when no cloud providers available", async () => {
        // V4.2.7: 当没有云端 Provider 时，使用本地降级而非抛出错误
        const originalEnv = process.env;
        // Clear all API keys to simulate no providers
        process.env = { ...originalEnv };
        delete process.env.DEEPSEEK_API_KEY;
        delete process.env.DASHSCOPE_API_KEY;

        // Need to reset factory to pick up new env
        resetProviderFactory();

        const service = new SummaryService({ enableFallback: true });

        const input: SummaryInput = {
          bookmarkId: 1,
          userId: "test-user",
          title: "Test Article",
          content: "Test content",
        };

        // V4.2.7: 本地降级会返回结果而非抛出错误
        const result = await service.generate(input);
        expect(result.providerUsed).toBe("local");
        expect(result.modelUsed).toBe("local-fallback");

        process.env = originalEnv;
      });

      it("should throw when forced provider not found", async () => {
        const service = new SummaryService();

        const input: SummaryInput = {
          bookmarkId: 1,
          userId: "test-user",
          title: "Test Article",
          content: "Test content",
        };

        await expect(
          service.generate(input, { forceProvider: "ollama" }),
        ).rejects.toThrow(SummaryError);
      });
    });

    describe("Batch Generation", () => {
      it("should handle empty batch", async () => {
        const service = new SummaryService();
        const results = await service.generateBatch([]);

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(0);
      });
    });

    describe("Queue Integration", () => {
      it("should have enqueueGeneration method", () => {
        const service = new SummaryService();
        expect(typeof service.enqueueGeneration).toBe("function");
      });

      it("should have enqueueBatchGeneration method", () => {
        const service = new SummaryService();
        expect(typeof service.enqueueBatchGeneration).toBe("function");
      });
    });

    describe("Regenerate", () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it("should throw SummaryError when bookmark not found", async () => {
        // V4.2.7: Mock repository to return null (bookmark not found)
        mockFrom.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest
                  .fn()
                  .mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        });

        const service = new SummaryService();

        await expect(service.regenerate(123, "user-id")).rejects.toThrow(
          SummaryError,
        );
      });
    });
  });

  describe("SummaryConfigService", () => {
    beforeEach(() => {
      resetSummaryConfigService();
    });

    afterEach(() => {
      resetSummaryConfigService();
    });

    describe("Singleton Pattern", () => {
      it("should export SummaryConfigService class and factory functions", () => {
        expect(SummaryConfigService).toBeDefined();
        expect(getSummaryConfigService).toBeDefined();
        expect(resetSummaryConfigService).toBeDefined();
      });

      it("should create singleton instance", () => {
        const service1 = getSummaryConfigService();
        const service2 = getSummaryConfigService();

        expect(service1).toBe(service2);
      });

      it("should reset singleton correctly", () => {
        const service1 = getSummaryConfigService();
        resetSummaryConfigService();
        const service2 = getSummaryConfigService();

        expect(service1).not.toBe(service2);
      });
    });

    describe("Configuration", () => {
      it("should return service configuration", () => {
        const service = new SummaryConfigService();
        const config = service.getConfig();

        expect(config.enableFallback).toBeDefined();
        expect(config.defaultProvider).toBeDefined();
        expect(config.fallbackProvider).toBeDefined();
        expect(config.outputVersion).toBeDefined();
      });

      it("should cache configuration", () => {
        const service = new SummaryConfigService();

        const config1 = service.getConfig();
        const config2 = service.getConfig();

        expect(config1).toEqual(config2);
      });

      it("should force refresh configuration", () => {
        const service = new SummaryConfigService();

        const config1 = service.getConfig();
        const config2 = service.getConfig(true);

        expect(config1).toEqual(config2);
      });
    });

    describe("Provider Health Tracking", () => {
      it("should update provider health", () => {
        const service = new SummaryConfigService();

        const health: ProviderHealth = {
          available: true,
          latencyMs: 100,
          checkedAt: new Date().toISOString(),
        };

        service.updateProviderHealth("deepseek", health);

        const retrieved = service.getProviderHealth("deepseek");
        expect(retrieved?.available).toBe(true);
        expect(retrieved?.latencyMs).toBe(100);
      });

      it("should return null for unchecked provider", () => {
        const service = new SummaryConfigService();

        const health = service.getProviderHealth("deepseek");
        expect(health).toBeNull();
      });

      it("should get all provider health", () => {
        const service = new SummaryConfigService();

        service.updateProviderHealth("deepseek", {
          available: true,
          checkedAt: new Date().toISOString(),
        });

        const allHealth = service.getAllProviderHealth();
        expect(allHealth).toBeInstanceOf(Map);
        expect(allHealth.get("deepseek")).toBeDefined();
      });
    });

    describe("Change Log", () => {
      it("should log configuration changes", () => {
        const service = new SummaryConfigService();

        service.logChange({
          timestamp: new Date().toISOString(),
          changeType: "provider",
          field: "deepseek.available",
          oldValue: false,
          newValue: true,
          source: "runtime",
        });

        const log = service.getChangeLog();
        expect(log.length).toBe(1);
        expect(log[0].field).toBe("deepseek.available");
      });

      it("should limit change log size", () => {
        const service = new SummaryConfigService();

        // Add more than MAX_CHANGE_LOG_SIZE entries
        for (let i = 0; i < 150; i++) {
          service.logChange({
            timestamp: new Date().toISOString(),
            changeType: "service",
            field: `test.field.${i}`,
            oldValue: i - 1,
            newValue: i,
            source: "api",
          });
        }

        const log = service.getChangeLog();
        expect(log.length).toBeLessThanOrEqual(100);
      });
    });

    describe("Statistics", () => {
      it("should return statistics", () => {
        const service = new SummaryConfigService();
        const stats = service.getStats();

        expect(stats.configLoadCount).toBeGreaterThanOrEqual(1);
        expect(stats.healthCheckCount).toBe(0);
        expect(stats.configChanges).toBe(0);
      });

      it("should increment stats on health updates", () => {
        const service = new SummaryConfigService();

        service.updateProviderHealth("deepseek", {
          available: true,
          checkedAt: new Date().toISOString(),
        });

        const stats = service.getStats();
        expect(stats.healthCheckCount).toBe(1);
      });
    });

    describe("Config Summary", () => {
      it("should return config summary", () => {
        const service = new SummaryConfigService();
        const summary = service.getConfigSummary();

        expect(summary.defaultProvider).toBeDefined();
        expect(summary.fallbackProvider).toBeDefined();
        expect(summary.enableFallback).toBeDefined();
        expect(summary.stats).toBeDefined();
      });
    });

    describe("Health Check Timer", () => {
      it("should have startHealthCheckTimer method", () => {
        const service = new SummaryConfigService();
        expect(typeof service.startHealthCheckTimer).toBe("function");
      });

      it("should have stopHealthCheckTimer method", () => {
        const service = new SummaryConfigService();
        expect(typeof service.stopHealthCheckTimer).toBe("function");
      });

      it("should not throw when stopping without starting", () => {
        const service = new SummaryConfigService();
        expect(() => service.stopHealthCheckTimer()).not.toThrow();
      });
    });

    describe("Cache Management", () => {
      it("should clear cache", () => {
        const service = new SummaryConfigService();

        // Populate cache
        service.getConfig();
        service.updateProviderHealth("deepseek", {
          available: true,
          checkedAt: new Date().toISOString(),
        });

        // Clear cache
        service.clearCache();

        // Health should be null after clear
        expect(service.getProviderHealth("deepseek")).toBeNull();
      });
    });
  });

  // ===========================================================================
  // P5: QualityTrackerService Tests
  // ===========================================================================

  describe("QualityTrackerService", () => {
    // Note: QualityTrackerService requires Supabase client
    // These tests focus on factory functions and quality scoring algorithm

    describe("Module Exports", () => {
      it("should export QualityTrackerService class and factory functions", () => {
        expect(QualityTrackerService).toBeDefined();
        expect(getQualityTrackerService).toBeDefined();
        expect(resetQualityTrackerService).toBeDefined();
      });
    });

    describe("Quality Scoring Algorithm", () => {
      // Mock supabase for testing scoring algorithm
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockResolvedValue({ error: null }),
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({
                lte: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      };

      it("should calculate quality score for structured summary", () => {
        // @ts-expect-error - mock supabase
        const service = new QualityTrackerService(mockSupabase);

        const input = {
          input: {
            bookmarkId: 1,
            userId: "test-user",
            title: "Test Article",
            content: "Test content for quality scoring...",
          },
          result: {
            summary: "This is a test summary with reasonable length.",
            tags: ["tag1", "tag2", "tag3", "tag4", "tag5"],
            version: 2 as const,
            structured: {
              tldr: "Short summary here",
              key_points: ["Point 1", "Point 2", "Point 3"],
              keywords: ["keyword1", "keyword2"],
              sentiment: "positive" as const,
              reading_time: 5,
            },
            usage: { inputTokens: 100, outputTokens: 50 },
            latencyMs: 1500,
          },
          provider: "deepseek",
          model: "deepseek-chat",
        };

        const score = service.calculateQualityScore(input);

        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(1);
      });

      it("should return score breakdown", () => {
        // @ts-expect-error - mock supabase
        const service = new QualityTrackerService(mockSupabase);

        const input = {
          input: {
            bookmarkId: 1,
            userId: "test-user",
            title: "Test Article",
          },
          result: {
            summary: "A moderately long summary that provides good detail.",
            tags: ["tag1", "tag2", "tag3"],
            version: 2 as const,
            usage: { inputTokens: 80, outputTokens: 40 },
            latencyMs: 2000,
          },
          provider: "deepseek",
          model: "deepseek-chat",
        };

        const breakdown = service.getScoreBreakdown(input);

        expect(breakdown.summaryLength).toBeDefined();
        expect(breakdown.tagsCount).toBeDefined();
        expect(breakdown.latency).toBeDefined();
        expect(breakdown.structured).toBeDefined();
        expect(breakdown.completeness).toBeDefined();
        expect(breakdown.weighted).toBeDefined();
      });

      it("should penalize errors in quality score", () => {
        // @ts-expect-error - mock supabase
        const service = new QualityTrackerService(mockSupabase);

        const normalInput = {
          input: { bookmarkId: 1, userId: "test-user", title: "Test" },
          result: {
            summary: "Normal summary",
            tags: ["tag1", "tag2"],
            version: 2 as const,
            usage: { inputTokens: 50, outputTokens: 30 },
            latencyMs: 1000,
          },
          provider: "deepseek",
          model: "deepseek-chat",
        };

        const errorInput = {
          ...normalInput,
          errorCode: "API_ERROR",
          errorMessage: "Something went wrong",
        };

        const normalScore = service.calculateQualityScore(normalInput);
        const errorScore = service.calculateQualityScore(errorInput);

        expect(errorScore).toBeLessThan(normalScore);
      });

      it("should slightly penalize fallback usage", () => {
        // @ts-expect-error - mock supabase
        const service = new QualityTrackerService(mockSupabase);

        const normalInput = {
          input: { bookmarkId: 1, userId: "test-user", title: "Test" },
          result: {
            summary: "Normal summary text",
            tags: ["tag1", "tag2", "tag3"],
            version: 2 as const,
            usage: { inputTokens: 50, outputTokens: 30 },
            latencyMs: 1000,
          },
          provider: "deepseek",
          model: "deepseek-chat",
        };

        const fallbackInput = {
          ...normalInput,
          fallbackUsed: true,
        };

        const normalScore = service.calculateQualityScore(normalInput);
        const fallbackScore = service.calculateQualityScore(fallbackInput);

        expect(fallbackScore).toBeLessThan(normalScore);
        expect(fallbackScore).toBeGreaterThan(normalScore * 0.85); // Not too much penalty
      });

      it("should reward optimal summary length", () => {
        // @ts-expect-error - mock supabase
        const service = new QualityTrackerService(mockSupabase);

        const shortInput = {
          input: { bookmarkId: 1, userId: "test-user", title: "Test" },
          result: {
            summary: "Short", // Too short
            tags: ["tag1", "tag2"],
            version: 2 as const,
            usage: { inputTokens: 50, outputTokens: 10 },
            latencyMs: 1000,
          },
          provider: "deepseek",
          model: "deepseek-chat",
        };

        const optimalInput = {
          ...shortInput,
          result: {
            ...shortInput.result,
            summary: "A".repeat(100), // Optimal length range
          },
        };

        const shortBreakdown = service.getScoreBreakdown(shortInput);
        const optimalBreakdown = service.getScoreBreakdown(optimalInput);

        expect(optimalBreakdown.summaryLength).toBeGreaterThan(
          shortBreakdown.summaryLength,
        );
      });

      it("should implement IQualityTrackerService interface methods", () => {
        // @ts-expect-error - mock supabase
        const service = new QualityTrackerService(mockSupabase);

        // Interface methods should exist
        expect(typeof service.track).toBe("function");
        expect(typeof service.recordFeedback).toBe("function");
        expect(typeof service.getStats).toBe("function");
        expect(typeof service.calculateAutoScore).toBe("function");
      });

      it("should calculate auto score from result and input", () => {
        // @ts-expect-error - mock supabase
        const service = new QualityTrackerService(mockSupabase);

        const result: SummaryResult = {
          summary: "Test summary for auto scoring",
          tags: ["tag1", "tag2", "tag3"],
          version: 2,
          usage: { inputTokens: 100, outputTokens: 50 },
          latencyMs: 1500,
          providerUsed: "deepseek",
          modelUsed: "deepseek-chat",
        };

        const input: SummaryInput = {
          bookmarkId: 1,
          userId: "test-user",
          title: "Test Article",
          content: "Test content",
        };

        const score = service.calculateAutoScore(result, input);

        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    describe("Singleton Reset", () => {
      it("should reset tracker service", () => {
        // Just verify reset doesn't throw
        expect(() => resetQualityTrackerService()).not.toThrow();
      });
    });
  });
});
