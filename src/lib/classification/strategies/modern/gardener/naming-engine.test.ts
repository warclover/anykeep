/**
 * 智能分类 v5.0 - 命名引擎测试
 */

import { NamingEngine } from "./naming-engine";
import type { LoggerService } from "@/lib/classification/infrastructure/shared-services/logger";

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

describe("NamingEngine", () => {
  let engine: NamingEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new NamingEngine(mockLogger);
  });

  describe("构造函数", () => {
    it("应该正确初始化", () => {
      expect(engine).toBeDefined();
      expect(mockLogger.child).toHaveBeenCalledWith({
        service: "NamingEngine",
      });
    });
  });

  describe("suggest", () => {
    it("规范名称应该返回 null", () => {
      const result = engine.suggest("folder-1", "JavaScript");

      expect(result).toBeNull();
    });

    it("应该移除前后空格", () => {
      const result = engine.suggest("folder-1", "  Test Folder  ");

      expect(result).not.toBeNull();
      expect(result!.suggestedName).toBe("Test Folder");
      expect(result!.reason).toContain("移除前后空格");
    });

    it("应该合并多余空格", () => {
      const result = engine.suggest("folder-1", "Test    Folder");

      expect(result).not.toBeNull();
      expect(result!.suggestedName).toBe("Test Folder");
      expect(result!.reason).toContain("合并多余空格");
    });

    it("应该移除特殊字符", () => {
      const result = engine.suggest("folder-1", "Test!! Folder##");

      expect(result).not.toBeNull();
      expect(result!.suggestedName).toBe("Test Folder");
      expect(result!.reason).toContain("移除特殊字符");
    });

    it("应该首字母大写", () => {
      const result = engine.suggest("folder-1", "test folder");

      expect(result).not.toBeNull();
      expect(result!.suggestedName).toBe("Test folder");
      expect(result!.reason).toContain("首字母大写");
    });

    it("应该统一分隔符", () => {
      const result = engine.suggest("folder-1", "test_folder");

      expect(result).not.toBeNull();
      expect(result!.suggestedName).toBe("Test-folder");
    });

    it("应该移除冗余词汇", () => {
      const result = engine.suggest("folder-1", "JavaScript文件夹");

      expect(result).not.toBeNull();
      expect(result!.suggestedName).toBe("JavaScript");
      expect(result!.reason).toContain("移除冗余词汇");
    });

    it("应该统一技术术语", () => {
      const result = engine.suggest("folder-1", "javascript tutorial");

      expect(result).not.toBeNull();
      expect(result!.suggestedName).toBe("JavaScript tutorial");
    });

    it("应该应用多个规则", () => {
      const result = engine.suggest("folder-1", "  javascript文件夹!!  ");

      expect(result).not.toBeNull();
      expect(result!.suggestedName).toBe("JavaScript");
      expect(result!.confidence).toBeGreaterThan(0);
    });
  });

  describe("suggestBatch", () => {
    it("应该批量生成建议", () => {
      const folders = [
        { folderId: "folder-1", folderName: "  Test  " },
        { folderId: "folder-2", folderName: "javascript" },
        { folderId: "folder-3", folderName: "Valid Name" },
      ];

      const results = engine.suggestBatch(folders);

      expect(results).toHaveLength(2); // 只有前两个需要修复
      expect(results[0].folderId).toBe("folder-1");
      expect(results[1].folderId).toBe("folder-2");
    });
  });

  describe("validate", () => {
    it("应该验证规范名称", () => {
      const result = engine.validate("JavaScript");

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("应该检测空名称", () => {
      const result = engine.validate("");

      expect(result.valid).toBe(false);
      expect(result.issues).toContain("名称不能为空");
    });

    it("应该检测过长名称", () => {
      const longName = "a".repeat(101);
      const result = engine.validate(longName);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain("名称过长（超过100字符）");
    });

    it("应该检测前后空格", () => {
      const result = engine.validate("  Test  ");

      expect(result.valid).toBe(false);
      expect(result.issues).toContain("名称包含前后空格");
    });

    it("应该检测多余空格", () => {
      const result = engine.validate("Test    Folder");

      expect(result.valid).toBe(false);
      expect(result.issues).toContain("名称包含多余空格");
    });

    it("应该检测特殊字符", () => {
      const result = engine.validate("Test!!");

      expect(result.valid).toBe(false);
      expect(result.issues).toContain("名称包含特殊字符");
    });
  });
});
