/**
 * 智能分类 v5.0 - Logger Service 测试
 */

import { LoggerService, createLogger } from "./logger.service";
import { LogLevel } from "./types";

describe("LoggerService", () => {
  let consoleDebugSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleDebugSpy = jest.spyOn(console, "debug").mockImplementation();
    consoleInfoSpy = jest.spyOn(console, "info").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("基本日志功能", () => {
    it("应该输出 debug 日志", () => {
      const logger = new LoggerService({ minLevel: LogLevel.DEBUG });
      logger.debug("测试 debug 消息");

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG] 测试 debug 消息"),
      );
    });

    it("应该输出 info 日志", () => {
      const logger = new LoggerService({ minLevel: LogLevel.INFO });
      logger.info("测试 info 消息");

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("[INFO] 测试 info 消息"),
      );
    });

    it("应该输出 warn 日志", () => {
      const logger = new LoggerService({ minLevel: LogLevel.WARN });
      logger.warn("测试 warn 消息");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[WARN] 测试 warn 消息"),
      );
    });

    it("应该输出 error 日志", () => {
      const logger = new LoggerService({ minLevel: LogLevel.ERROR });
      const error = new Error("测试错误");
      logger.error("测试 error 消息", error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR] 测试 error 消息"),
      );
    });
  });

  describe("日志级别过滤", () => {
    it("应该过滤低于最小级别的日志", () => {
      const logger = new LoggerService({ minLevel: LogLevel.WARN });

      logger.debug("debug 消息");
      logger.info("info 消息");
      logger.warn("warn 消息");

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("应该输出等于或高于最小级别的日志", () => {
      const logger = new LoggerService({ minLevel: LogLevel.INFO });

      logger.debug("debug 消息");
      logger.info("info 消息");
      logger.warn("warn 消息");
      logger.error("error 消息");

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("上下文传递", () => {
    it("应该在日志中包含上下文信息", () => {
      const logger = new LoggerService({ minLevel: LogLevel.INFO });
      logger.info("测试消息", { userId: "user-123", requestId: "req-456" });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("userId"),
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("user-123"),
      );
    });

    it("应该合并构造函数和方法调用的上下文", () => {
      const logger = new LoggerService(
        { minLevel: LogLevel.INFO },
        { userId: "user-123" },
      );
      logger.info("测试消息", { requestId: "req-456" });

      const logMessage = consoleInfoSpy.mock.calls[0][0];
      expect(logMessage).toContain("userId");
      expect(logMessage).toContain("requestId");
    });
  });

  describe("子 Logger", () => {
    it("应该创建带有额外上下文的子 Logger", () => {
      const parentLogger = new LoggerService(
        { minLevel: LogLevel.INFO },
        { userId: "user-123" },
      );
      const childLogger = parentLogger.child({ requestId: "req-456" });

      childLogger.info("测试消息");

      const logMessage = consoleInfoSpy.mock.calls[0][0];
      expect(logMessage).toContain("userId");
      expect(logMessage).toContain("requestId");
    });

    it("子 Logger 应该继承父 Logger 的配置", () => {
      const parentLogger = new LoggerService({ minLevel: LogLevel.WARN });
      const childLogger = parentLogger.child({ requestId: "req-456" });

      childLogger.info("info 消息");
      childLogger.warn("warn 消息");

      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe("createLogger 工厂函数", () => {
    it("应该创建默认配置的 Logger", () => {
      const logger = createLogger();
      logger.info("测试消息");

      expect(consoleInfoSpy).toHaveBeenCalled();
    });

    it("应该创建带上下文的 Logger", () => {
      const logger = createLogger({ userId: "user-123" });
      logger.info("测试消息");

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining("userId"),
      );
    });
  });
});
