/**
 * 智能分类 v5.0 - LLM Service 测试
 */

import { LLMService } from "./llm.service";
import { LLMError } from "./types";
import { createLogger } from "../logger";
import type { LoggerService } from "../logger";
import type { LLMClassificationRequest } from "./types";

// Mock OpenAI
jest.mock("openai");

describe("LLMService", () => {
  let logger: LoggerService;
  let mockOpenAI: jest.Mocked<any>;

  beforeEach(() => {
    logger = createLogger();
    jest.spyOn(logger, "debug").mockImplementation();
    jest.spyOn(logger, "warn").mockImplementation();
    jest.spyOn(logger, "error").mockImplementation();

    // Mock OpenAI client
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenAI = require("openai");
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };
    OpenAI.mockImplementation(() => mockOpenAI);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("构造函数", () => {
    it("应该使用默认配置创建实例", () => {
      const service = new LLMService(logger, {
        apiKey: "test-key",
      });
      expect(service).toBeInstanceOf(LLMService);
    });

    it("应该在缺少 API Key 时抛出错误", () => {
      expect(() => {
        new LLMService(logger, { apiKey: "" });
      }).toThrow(LLMError);
    });
  });

  describe("classify", () => {
    const mockRequest: LLMClassificationRequest = {
      title: "测试书签",
      description: "测试描述",
      url: "https://example.com",
      summary: "测试摘要",
      candidates: [
        { id: "1", name: "技术文档", description: "技术相关" },
        { id: "2", name: "新闻资讯", description: "新闻相关" },
      ],
    };

    it("应该成功执行分类", async () => {
      const service = new LLMService(logger, {
        apiKey: "test-key",
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                folderId: 1,
                confidence: 0.95,
                reasoning: "这是技术相关内容",
              }),
            },
          },
        ],
      });

      const result = await service.classify(mockRequest);

      expect(result.folderId).toBe(1);
      expect(result.confidence).toBe(0.95);
      expect(result.reasoning).toBe("这是技术相关内容");
    });

    it("应该处理 markdown 代码块包裹的 JSON", async () => {
      const service = new LLMService(logger, {
        apiKey: "test-key",
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content:
                '```json\n{"folderId": 1, "confidence": 0.95, "reasoning": "测试"}\n```',
            },
          },
        ],
      });

      const result = await service.classify(mockRequest);

      expect(result.folderId).toBe(1);
    });

    it("应该限制置信度在 0-1 范围内", async () => {
      const service = new LLMService(logger, {
        apiKey: "test-key",
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                folderId: 1,
                confidence: 1.5,
                reasoning: "测试",
              }),
            },
          },
        ],
      });

      const result = await service.classify(mockRequest);

      expect(result.confidence).toBe(1.0);
    });

    it("应该在 folderId 无效时抛出错误", async () => {
      const service = new LLMService(logger, {
        apiKey: "test-key",
      });

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                folderId: 999,
                confidence: 0.95,
                reasoning: "测试",
              }),
            },
          },
        ],
      });

      await expect(service.classify(mockRequest)).rejects.toThrow(LLMError);
    });
  });

  describe("重试机制", () => {
    const mockRequest: LLMClassificationRequest = {
      title: "测试",
      url: "https://example.com",
      candidates: [{ id: "1", name: "测试" }],
    };

    it("应该在可重试错误时重试", async () => {
      const service = new LLMService(logger, {
        apiKey: "test-key",
        maxRetries: 2,
      });

      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(new Error("Rate limit exceeded"))
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  folderId: 1,
                  confidence: 0.95,
                  reasoning: "测试",
                }),
              },
            },
          ],
        });

      const result = await service.classify(mockRequest);

      expect(result.folderId).toBe(1);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
    });
  });
});
