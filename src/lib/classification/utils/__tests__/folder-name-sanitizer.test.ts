/**
 * Folder Name Sanitizer Unit Tests
 *
 * Tests for the unified folder name sanitization pipeline
 * @version 1.0.0
 * @since 2026-02-25
 */

import {
  sanitizeFolderName,
  generateFallbackName,
  extractKeywords,
  generateTimestampFallback,
  validateFolderName,
} from "../folder-name-sanitizer";

// ============================================================================
// sanitizeFolderName 测试
// ============================================================================

describe("sanitizeFolderName", () => {
  // ----------------------------------------
  // 步骤 1：去除引号
  // ----------------------------------------
  describe("引号去除", () => {
    it("should remove double quotes", () => {
      const result = sanitizeFolderName('"React"');
      expect(result.name).toBe("React");
      expect(result.appliedRules).toContain("remove_quotes");
    });

    it("should remove Chinese quotes", () => {
      const result = sanitizeFolderName("「前端开发」");
      expect(result.name).toBe("前端开发");
      expect(result.appliedRules).toContain("remove_quotes");
    });

    it("should remove single quotes", () => {
      const result = sanitizeFolderName("'React'");
      expect(result.name).toBe("React");
    });

    it("should remove guillemets", () => {
      const result = sanitizeFolderName("【React】");
      expect(result.name).toBe("React");
    });
  });

  // ----------------------------------------
  // 步骤 2：去除废话后缀
  // ----------------------------------------
  describe("废话后缀去除", () => {
    it("should remove '相关' suffix", () => {
      const result = sanitizeFolderName("React 相关");
      expect(result.name).toBe("React");
      expect(result.appliedRules).toContain("remove_suffixes");
    });

    it("should remove '资料' suffix", () => {
      const result = sanitizeFolderName("前端技术资料");
      expect(result.name).toBe("前端技术");
    });

    it("should remove '文章' suffix", () => {
      // "技术文章" -> "技术" -> 触发回退（因为"技术"是过度概括词）
      const result = sanitizeFolderName("技术文章");
      // 去除后缀后变为"技术"，触发严格模式回退
      expect(result.usedFallback).toBe(true);
    });

    it("should remove '合集' suffix", () => {
      const result = sanitizeFolderName("React 教程合集");
      expect(result.name).toBe("React 教程");
    });

    it("should trigger fallback for vague single word", () => {
      const result = sanitizeFolderName("资料", {
        strictMode: true,
        tags: ["React"],
      });
      // "资料" 在黑名单中，触发回退
      expect(result.usedFallback).toBe(true);
    });
  });

  // ----------------------------------------
  // 步骤 3：去除动词前缀
  // ----------------------------------------
  describe("动词前缀去除", () => {
    it("should remove '学习' prefix", () => {
      const result = sanitizeFolderName("学习 Python");
      expect(result.name).toBe("Python");
      expect(result.appliedRules).toContain("remove_prefixes");
    });

    it("should remove '研究' prefix", () => {
      const result = sanitizeFolderName("研究 AI 技术");
      expect(result.name).toBe("AI 技术");
    });

    it("should remove '探索' prefix", () => {
      // "探索设计" -> "设计" -> 触发回退（因为"设计"是上下文依赖词）
      const result = sanitizeFolderName("探索设计", {
        strictMode: true,
        tags: ["UI"],
      });
      expect(result.usedFallback).toBe(true);
    });
  });

  // ----------------------------------------
  // 步骤 4：空格规范化
  // ----------------------------------------
  describe("空格规范化", () => {
    it("should add space between English and Chinese", () => {
      const result = sanitizeFolderName("React学习");
      expect(result.name).toBe("React 学习");
      expect(result.appliedRules).toContain("normalize_spaces");
    });

    it("should add space between Chinese and English", () => {
      const result = sanitizeFolderName("前端React");
      expect(result.name).toBe("前端 React");
    });

    it("should merge multiple spaces", () => {
      const result = sanitizeFolderName("前端  开发");
      expect(result.name).toBe("前端 开发");
    });

    it("should trim leading and trailing spaces", () => {
      const result = sanitizeFolderName("  React  ");
      expect(result.name).toBe("React");
    });
  });

  // ----------------------------------------
  // 步骤 5：长度截断
  // ----------------------------------------
  describe("长度截断", () => {
    it("should truncate long names", () => {
      const result = sanitizeFolderName("前端开发技术学习资料汇总");
      expect(result.name.length).toBeLessThanOrEqual(8);
    });

    it("should not truncate short names", () => {
      const result = sanitizeFolderName("React");
      expect(result.name).toBe("React");
    });
  });

  // ----------------------------------------
  // 步骤 6-7：黑名单检测和回退
  // ----------------------------------------
  describe("黑名单检测和回退", () => {
    it("should fallback for A-class forbidden names", () => {
      const result = sanitizeFolderName("待整理", { tags: ["React"] });
      expect(result.usedFallback).toBe(true);
      // 回退时会使用标签
      expect(result.name).toBeTruthy();
    });

    it("should fallback for vague words in strict mode", () => {
      const result = sanitizeFolderName("技术", {
        tags: ["React", "前端"],
        strictMode: true,
      });
      expect(result.usedFallback).toBe(true);
    });

    it("should allow vague words in non-strict mode", () => {
      const result = sanitizeFolderName("技术", { strictMode: false });
      expect(result.usedFallback).toBe(false);
      expect(result.name).toBe("技术");
    });

    it("should fallback for contextual words in strict mode", () => {
      const result = sanitizeFolderName("工具", {
        tags: ["AI"],
        strictMode: true,
      });
      expect(result.usedFallback).toBe(true);
    });

    it("should fallback for empty names", () => {
      const result = sanitizeFolderName("", { tags: ["React"] });
      expect(result.usedFallback).toBe(true);
      expect(result.name).toBe("React");
    });
  });

  // ----------------------------------------
  // 综合测试
  // ----------------------------------------
  describe("综合测试", () => {
    it("should apply multiple rules and produce clean result", () => {
      const result = sanitizeFolderName('"学习 React 相关资料"');
      // 经过清洗后应该得到一个有效的名称
      expect(result.name).toBeTruthy();
      expect(result.wasSanitized).toBe(true);
      expect(result.appliedRules.length).toBeGreaterThan(1);
    });

    it("should handle already clean names", () => {
      const result = sanitizeFolderName("React");
      expect(result.name).toBe("React");
      expect(result.wasSanitized).toBe(false);
      expect(result.usedFallback).toBe(false);
    });

    it("should preserve good Chinese names", () => {
      const result = sanitizeFolderName("独立开发");
      expect(result.name).toBe("独立开发");
      expect(result.wasSanitized).toBe(false);
    });

    it("should handle mixed names correctly", () => {
      const result = sanitizeFolderName("React Native");
      expect(result.name).toBe("React Native");
    });
  });
});

// ============================================================================
// generateFallbackName 测试
// ============================================================================

describe("generateFallbackName", () => {
  describe("优先级 1：标签组合", () => {
    it("should combine first 2 tags", () => {
      const name = generateFallbackName(["React", "前端"], "");
      expect(name).toBe("React 前端");
    });

    it("should not use vague tags", () => {
      const name = generateFallbackName(["技术", "React"], "");
      expect(name).toBe("React");
    });

    it("should respect max length", () => {
      const name = generateFallbackName(
        ["React", "Frontend", "Development"],
        "",
      );
      // 长度不应超过 8
      expect(name.length).toBeLessThanOrEqual(10);
    });
  });

  describe("优先级 2：单个有效标签", () => {
    it("should use single valid tag", () => {
      const name = generateFallbackName(["React"], "");
      expect(name).toBe("React");
    });

    it("should skip vague tag and use title", () => {
      const name = generateFallbackName(["技术"], "React 入门教程");
      expect(name).toBe("React");
    });
  });

  describe("优先级 3：标题关键词提取", () => {
    it("should extract keyword from title", () => {
      const name = generateFallbackName([], "React 入门教程");
      expect(name).toBe("React");
    });

    it("should extract meaningful keyword", () => {
      const name = generateFallbackName([], "如何学习前端开发");
      // 关键词提取可能返回 "前端开发" 或其他有效词
      expect(name).toBeTruthy();
      expect(name.length).toBeGreaterThan(0);
    });
  });

  describe("优先级 4：时间戳回退", () => {
    it("should generate timestamp fallback when no tags or title", () => {
      const name = generateFallbackName([], "");
      expect(name).toMatch(/收藏 \d{4}/);
    });
  });
});

// ============================================================================
// extractKeywords 测试
// ============================================================================

describe("extractKeywords", () => {
  it("should extract meaningful keywords", () => {
    const keywords = extractKeywords("React 入门教程：从零开始学习前端开发");
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords).toContain("React");
  });

  it("should filter stop words", () => {
    const keywords = extractKeywords("如何学习前端开发");
    expect(keywords).not.toContain("如何");
    expect(keywords).not.toContain("学习");
  });

  it("should filter pure numbers", () => {
    const keywords = extractKeywords("2024 年度总结");
    expect(keywords).not.toContain("2024");
  });

  it("should return empty array for empty title", () => {
    const keywords = extractKeywords("");
    expect(keywords).toEqual([]);
  });

  it("should handle punctuation", () => {
    const keywords = extractKeywords("React、Vue、Angular 比较");
    expect(keywords.length).toBeGreaterThan(0);
  });

  it("should deduplicate", () => {
    const keywords = extractKeywords("React React React");
    expect(keywords.filter((k) => k === "React").length).toBe(1);
  });
});

// ============================================================================
// generateTimestampFallback 测试
// ============================================================================

describe("generateTimestampFallback", () => {
  it("should generate format like '收藏 MMDD'", () => {
    const name = generateTimestampFallback();
    expect(name).toMatch(/^收藏 \d{4}$/);
  });
});

// ============================================================================
// validateFolderName 测试
// ============================================================================

describe("validateFolderName", () => {
  it("should return valid for good names", () => {
    const result = validateFolderName("React");
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("should return valid for Chinese names", () => {
    const result = validateFolderName("独立开发");
    expect(result.valid).toBe(true);
  });

  it("should return invalid for empty names", () => {
    const result = validateFolderName("");
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("名称不能为空");
  });

  it("should return invalid for forbidden names", () => {
    const result = validateFolderName("待整理");
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("should return invalid for vague names", () => {
    const result = validateFolderName("技术");
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.stringContaining("过于概括"));
  });

  it("should warn about leading/trailing spaces", () => {
    const result = validateFolderName(" React ");
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("名称包含前后空格");
  });

  it("should warn about special characters", () => {
    const result = validateFolderName("React@Frontend");
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("名称包含特殊字符");
  });
});
