/**
 * 阿里云 TTS 服务测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import {
  getTTSService,
  resetTTSService,
  TTSError,
} from "../aliyun-tts.service";
import type { TTSOptions } from "../types";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock AbortSignal.timeout (not available in Jest environment)
if (!AbortSignal.timeout) {
  (AbortSignal as unknown as { timeout: (ms: number) => AbortSignal }).timeout =
    (ms: number) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), ms);
      return controller.signal;
    };
}

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Store original env
const originalEnv = process.env;

describe("AliyunTTSService", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env = { ...originalEnv, DASHSCOPE_API_KEY: "test-api-key" };
    resetTTSService(); // Reset singleton for fresh instance
  });

  afterEach(() => {
    process.env = originalEnv;
    resetTTSService();
  });

  describe("isAvailable", () => {
    it("should return available when API key is configured", () => {
      const service = getTTSService();
      const status = service.isAvailable();
      expect(status.available).toBe(true);
      expect(status.apiKeyConfigured).toBe(true);
    });

    it("should return unavailable when API key is missing", () => {
      delete process.env.DASHSCOPE_API_KEY;
      resetTTSService();
      const service = getTTSService();
      const status = service.isAvailable();
      expect(status.available).toBe(false);
      expect(status.reason).toContain("DASHSCOPE_API_KEY");
    });
  });

  describe("getDefaultVoice", () => {
    it("should return female voice for female gender", () => {
      const service = getTTSService();
      const voice = service.getDefaultVoice("female");
      expect(voice).toBeDefined();
      expect(typeof voice).toBe("string");
    });

    it("should return male voice for male gender", () => {
      const service = getTTSService();
      const voice = service.getDefaultVoice("male");
      expect(voice).toBeDefined();
      expect(typeof voice).toBe("string");
    });

    it("should return different voices for different genders", () => {
      const service = getTTSService();
      const femaleVoice = service.getDefaultVoice("female");
      const maleVoice = service.getDefaultVoice("male");
      expect(femaleVoice).not.toBe(maleVoice);
    });
  });

  describe("preprocessText", () => {
    it("should remove markdown formatting", () => {
      const service = getTTSService();
      const input = "**bold** and *italic* text";
      const result = service.preprocessText(input);
      expect(result).not.toContain("**");
      // Note: single * might remain as it's tricky to distinguish from italic
      expect(result).toContain("bold");
      expect(result).toContain("text");
    });

    it("should remove markdown links", () => {
      const service = getTTSService();
      const input = "Check [this link](https://example.com)";
      const result = service.preprocessText(input);
      expect(result).not.toContain("[");
      expect(result).not.toContain("]");
      expect(result).toContain("this link");
    });

    it("should remove markdown images", () => {
      const service = getTTSService();
      const input = "See ![alt text](image.png)";
      const result = service.preprocessText(input);
      // Image pattern ![text](url) is removed, leaving just "See" and "alt text"
      expect(result).not.toContain("[");
      expect(result).not.toContain("](");
      expect(result).toContain("alt text");
    });

    it("should remove code blocks", () => {
      const service = getTTSService();
      const input = "Text with `inline code` and\n```\nblock code\n```";
      const result = service.preprocessText(input);
      expect(result).not.toContain("`");
    });

    it("should remove HTML tags", () => {
      const service = getTTSService();
      const input = "<p>Paragraph</p> and <strong>bold</strong>";
      const result = service.preprocessText(input);
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
    });

    it("should normalize whitespace", () => {
      const service = getTTSService();
      const input = "Multiple    spaces\n\n\nand newlines";
      const result = service.preprocessText(input);
      expect(result).not.toMatch(/\s{3,}/);
    });

    it("should trim result", () => {
      const service = getTTSService();
      const input = "  text with spaces  ";
      const result = service.preprocessText(input);
      expect(result).toBe("text with spaces");
    });

    it("should handle empty string", () => {
      const service = getTTSService();
      const result = service.preprocessText("");
      expect(result).toBe("");
    });

    it("should remove URLs", () => {
      const service = getTTSService();
      const input = "Visit https://example.com for more info";
      const result = service.preprocessText(input);
      expect(result).not.toContain("https://");
    });
  });

  describe("synthesize", () => {
    const mockSuccessResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        request_id: "test-request-id",
        output: {
          audio: "dGVzdCBhdWRpbyBkYXRh", // Base64 "test audio data"
        },
        usage: {
          characters: 10,
        },
      }),
    };

    it("should call API with correct parameters", async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse);

      const service = getTTSService();
      await service.synthesize("Hello world");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];

      expect(url).toContain("dashscope.aliyuncs.com");
      expect(options.method).toBe("POST");
      expect(options.headers["Authorization"]).toContain("Bearer");
      expect(options.headers["Content-Type"]).toBe("application/json");
    });

    it("should include text in request body", async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse);

      const service = getTTSService();
      await service.synthesize("Test text");

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.input.text).toBe("Test text");
    });

    it("should use default options when not provided", async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse);

      const service = getTTSService();
      await service.synthesize("Test");

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.model).toBeDefined();
      expect(requestBody.parameters.voice).toBeDefined();
      expect(requestBody.parameters.format).toBeDefined();
    });

    it("should apply custom options", async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse);

      const service = getTTSService();
      const options: TTSOptions = {
        voice: "custom-voice",
        speed: 1.5,
        format: "wav",
      };

      await service.synthesize("Test", options);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.parameters.voice).toBe("custom-voice");
      expect(requestBody.parameters.rate).toBe(1.5);
      expect(requestBody.parameters.format).toBe("wav");
    });

    it("should return TTSResult on success", async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse);

      const service = getTTSService();
      const result = await service.synthesize("Test text");

      expect(result).toHaveProperty("audio");
      expect(result).toHaveProperty("format");
      expect(result).toHaveProperty("charCount");
      expect(result).toHaveProperty("requestId");
      expect(result.requestId).toBe("test-request-id");
    });

    it("should throw TTSError on API error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: jest.fn().mockResolvedValue("Invalid API key"),
      });

      const service = getTTSService();
      await expect(service.synthesize("Test")).rejects.toThrow(TTSError);
    });

    it("should throw TTSError on network error", async () => {
      const networkError = new TypeError("fetch failed");
      mockFetch.mockRejectedValue(networkError);

      const service = getTTSService();
      await expect(service.synthesize("Test")).rejects.toThrow(TTSError);
    });

    it("should throw TTSError when API key is missing", async () => {
      delete process.env.DASHSCOPE_API_KEY;
      resetTTSService();
      const service = getTTSService();

      await expect(service.synthesize("Test")).rejects.toThrow(TTSError);
    });

    it("should throw TTSError for empty text", async () => {
      const service = getTTSService();
      await expect(service.synthesize("")).rejects.toThrow(TTSError);
    });

    it("should preprocess text before sending", async () => {
      mockFetch.mockResolvedValue(mockSuccessResponse);

      const service = getTTSService();
      await service.synthesize("**Bold** text");

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.input.text).not.toContain("**");
      expect(requestBody.input.text).toContain("Bold");
    });

    it("should handle API response with error code", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          request_id: "test-request-id",
          code: "InvalidParameter",
          message: "Text is too long",
        }),
      });

      const service = getTTSService();
      await expect(service.synthesize("Test")).rejects.toThrow(TTSError);
    });

    it("should handle API response without audio data", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          request_id: "test-request-id",
          output: {},
        }),
      });

      const service = getTTSService();
      await expect(service.synthesize("Test")).rejects.toThrow(TTSError);
    });
  });

  describe("TTSError", () => {
    it("should have correct name and code", () => {
      const error = new TTSError("TEST_CODE", "Test message");
      expect(error.name).toBe("TTSError");
      expect(error.code).toBe("TEST_CODE");
      expect(error.message).toBe("Test message");
    });

    it("should be instance of Error", () => {
      const error = new TTSError("TEST_CODE", "Test message");
      expect(error).toBeInstanceOf(Error);
    });
  });
});
