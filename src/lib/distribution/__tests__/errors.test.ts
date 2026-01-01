/**
 * 分发模块错误测试
 *
 * @description 测试自定义错误类
 */

import {
  DistributionError,
  TargetNotFoundError,
  AdapterNotFoundError,
  TargetDisabledError,
  PlatformNotSupportedError,
  ConfigValidationError,
  ConnectionTestError,
  DistributionTimeoutError,
  DistributionInProgressError,
  OAuthError,
  OAuthTokenExpiredError,
  FileSystemError,
  RateLimitError,
  WebhookError,
} from "../errors";

describe("distribution/errors", () => {
  describe("DistributionError", () => {
    it("should create error with message and code", () => {
      const error = new DistributionError("Test error", "TEST_CODE");

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.name).toBe("DistributionError");
      expect(error instanceof Error).toBe(true);
    });
  });

  describe("TargetNotFoundError", () => {
    it("should create error with target ID", () => {
      const error = new TargetNotFoundError("target-123");

      expect(error.message).toContain("target-123");
      expect(error.code).toBe("TARGET_NOT_FOUND");
      expect(error.name).toBe("TargetNotFoundError");
    });
  });

  describe("AdapterNotFoundError", () => {
    it("should create error with adapter type", () => {
      const error = new AdapterNotFoundError("obsidian");

      expect(error.message).toContain("obsidian");
      expect(error.code).toBe("ADAPTER_NOT_FOUND");
      expect(error.name).toBe("AdapterNotFoundError");
    });
  });

  describe("TargetDisabledError", () => {
    it("should create error with target ID", () => {
      const error = new TargetDisabledError("target-123");

      expect(error.message).toContain("target-123");
      expect(error.code).toBe("TARGET_DISABLED");
      expect(error.name).toBe("TargetDisabledError");
    });
  });

  describe("PlatformNotSupportedError", () => {
    it("should create error with adapter type and supported platforms", () => {
      const error = new PlatformNotSupportedError("obsidian", ["desktop"]);

      expect(error.message).toContain("obsidian");
      expect(error.message).toContain("desktop");
      expect(error.code).toBe("PLATFORM_NOT_SUPPORTED");
      expect(error.name).toBe("PlatformNotSupportedError");
    });

    it("should list multiple supported platforms", () => {
      const error = new PlatformNotSupportedError("webhook", ["web", "mobile"]);

      expect(error.message).toContain("web");
      expect(error.message).toContain("mobile");
    });
  });

  describe("ConfigValidationError", () => {
    it("should create error with error list", () => {
      const errors = ["路径不能为空", "格式无效"];
      const error = new ConfigValidationError(errors);

      expect(error.message).toContain("路径不能为空");
      expect(error.message).toContain("格式无效");
      expect(error.errors).toEqual(errors);
      expect(error.code).toBe("CONFIG_VALIDATION_FAILED");
      expect(error.name).toBe("ConfigValidationError");
    });
  });

  describe("ConnectionTestError", () => {
    it("should create error with message", () => {
      const error = new ConnectionTestError("无法连接到服务器");

      expect(error.message).toContain("无法连接到服务器");
      expect(error.code).toBe("CONNECTION_TEST_FAILED");
      expect(error.name).toBe("ConnectionTestError");
    });
  });

  describe("DistributionTimeoutError", () => {
    it("should create error with target ID and timeout", () => {
      const error = new DistributionTimeoutError("target-123", 30000);

      expect(error.message).toContain("target-123");
      expect(error.message).toContain("30000");
      expect(error.code).toBe("DISTRIBUTION_TIMEOUT");
      expect(error.name).toBe("DistributionTimeoutError");
    });
  });

  describe("DistributionInProgressError", () => {
    it("should create error with target ID", () => {
      const error = new DistributionInProgressError("target-123");

      expect(error.message).toContain("target-123");
      expect(error.code).toBe("DISTRIBUTION_IN_PROGRESS");
      expect(error.name).toBe("DistributionInProgressError");
    });
  });

  describe("OAuthError", () => {
    it("should create error with provider and message", () => {
      const error = new OAuthError("Notion", "授权被拒绝");

      expect(error.message).toContain("Notion");
      expect(error.message).toContain("授权被拒绝");
      expect(error.code).toBe("OAUTH_ERROR");
      expect(error.name).toBe("OAuthError");
    });
  });

  describe("OAuthTokenExpiredError", () => {
    it("should create error with provider", () => {
      const error = new OAuthTokenExpiredError("Notion");

      expect(error.message).toContain("Notion");
      expect(error.message).toContain("过期");
      expect(error.code).toBe("OAUTH_TOKEN_EXPIRED");
      expect(error.name).toBe("OAuthTokenExpiredError");
    });
  });

  describe("FileSystemError", () => {
    it("should create error with operation and path", () => {
      const error = new FileSystemError("write", "/path/to/file.md");

      expect(error.message).toContain("write");
      expect(error.message).toContain("/path/to/file.md");
      expect(error.code).toBe("FILE_SYSTEM_ERROR");
      expect(error.name).toBe("FileSystemError");
    });

    it("should include original error message when provided", () => {
      const originalError = new Error("Permission denied");
      const error = new FileSystemError(
        "write",
        "/path/to/file.md",
        originalError,
      );

      expect(error.message).toContain("Permission denied");
    });
  });

  describe("RateLimitError", () => {
    it("should create error with provider", () => {
      const error = new RateLimitError("Notion");

      expect(error.message).toContain("Notion");
      expect(error.message).toContain("限流");
      expect(error.code).toBe("RATE_LIMIT_ERROR");
      expect(error.name).toBe("RateLimitError");
    });

    it("should include retry time when provided", () => {
      const error = new RateLimitError("Notion", 60);

      expect(error.message).toContain("60");
    });
  });

  describe("WebhookError", () => {
    it("should create error with URL and status code", () => {
      const error = new WebhookError("https://example.com/webhook", 500);

      expect(error.message).toContain("https://example.com/webhook");
      expect(error.message).toContain("500");
      expect(error.code).toBe("WEBHOOK_ERROR");
      expect(error.name).toBe("WebhookError");
    });

    it("should include message when provided", () => {
      const error = new WebhookError(
        "https://example.com/webhook",
        500,
        "Internal Server Error",
      );

      expect(error.message).toContain("Internal Server Error");
    });
  });

  describe("Error inheritance", () => {
    it("all errors should be instances of Error", () => {
      const errors = [
        new DistributionError("test", "TEST"),
        new TargetNotFoundError("id"),
        new AdapterNotFoundError("obsidian"),
        new TargetDisabledError("id"),
        new PlatformNotSupportedError("obsidian", ["desktop"]),
        new ConfigValidationError(["error"]),
        new ConnectionTestError("message"),
        new DistributionTimeoutError("id", 1000),
        new DistributionInProgressError("id"),
        new OAuthError("provider", "message"),
        new OAuthTokenExpiredError("provider"),
        new FileSystemError("op", "path"),
        new RateLimitError("provider"),
        new WebhookError("url", 500),
      ];

      errors.forEach((error) => {
        expect(error instanceof Error).toBe(true);
        expect(error instanceof DistributionError).toBe(true);
      });
    });
  });
});
