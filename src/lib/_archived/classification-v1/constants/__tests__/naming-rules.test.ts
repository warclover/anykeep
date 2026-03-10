/**
 * Naming Rules Constants Unit Tests
 *
 * Tests for the unified folder naming rules
 * @version 1.0.0
 * @since 2026-02-25
 */

import {
  FORBIDDEN_NAMES_A,
  FILLER_SUFFIXES,
  VAGUE_WORDS,
  VERB_PREFIXES,
  CONTEXTUAL_WORDS,
  NAME_LENGTH_CONFIG,
  GRANULARITY_CONFIG,
  FOLDER_NAMING_RULES,
  isForbiddenNameA,
  isVagueWord,
  isContextualWord,
  getGranularityLevel,
  getGranularityHint,
  calculateEffectiveLength,
  isNameLengthValid,
} from "../naming-rules";

// ============================================================================
// A 类黑名单测试
// ============================================================================

describe("FORBIDDEN_NAMES_A", () => {
  it("should contain system reserved names", () => {
    expect(FORBIDDEN_NAMES_A.has("待整理")).toBe(true);
    expect(FORBIDDEN_NAMES_A.has("未分类")).toBe(true);
    expect(FORBIDDEN_NAMES_A.has("收藏夹")).toBe(true);
    expect(FORBIDDEN_NAMES_A.has("内容分类")).toBe(true);
  });

  it("should contain meaningless names", () => {
    expect(FORBIDDEN_NAMES_A.has("新建文件夹")).toBe(true);
    expect(FORBIDDEN_NAMES_A.has("New Folder")).toBe(true);
    expect(FORBIDDEN_NAMES_A.has("临时")).toBe(true);
    expect(FORBIDDEN_NAMES_A.has("无标题")).toBe(true);
  });
});

// ============================================================================
// B 类模式测试
// ============================================================================

describe("B类模式", () => {
  describe("FILLER_SUFFIXES", () => {
    it("should contain common filler suffixes", () => {
      expect(FILLER_SUFFIXES).toContain("相关");
      expect(FILLER_SUFFIXES).toContain("资料");
      expect(FILLER_SUFFIXES).toContain("内容");
      expect(FILLER_SUFFIXES).toContain("文章");
      expect(FILLER_SUFFIXES).toContain("收藏");
      expect(FILLER_SUFFIXES).toContain("合集");
    });
  });

  describe("VAGUE_WORDS", () => {
    it("should contain overly broad words", () => {
      expect(VAGUE_WORDS).toContain("技术");
      expect(VAGUE_WORDS).toContain("学习");
      expect(VAGUE_WORDS).toContain("工作");
      expect(VAGUE_WORDS).toContain("生活");
      expect(VAGUE_WORDS).toContain("资源");
    });
  });

  describe("VERB_PREFIXES", () => {
    it("should contain verb prefixes", () => {
      expect(VERB_PREFIXES).toContain("学习");
      expect(VERB_PREFIXES).toContain("研究");
      expect(VERB_PREFIXES).toContain("探索");
    });
  });
});

// ============================================================================
// C 类上下文依赖词测试
// ============================================================================

describe("CONTEXTUAL_WORDS", () => {
  it("should contain words that need context", () => {
    expect(CONTEXTUAL_WORDS.has("技术")).toBe(true);
    expect(CONTEXTUAL_WORDS.has("工具")).toBe(true);
    expect(CONTEXTUAL_WORDS.has("设计")).toBe(true);
    expect(CONTEXTUAL_WORDS.has("开发")).toBe(true);
  });
});

// ============================================================================
// 长度配置测试
// ============================================================================

describe("NAME_LENGTH_CONFIG", () => {
  it("should have optimal length of 2-4", () => {
    expect(NAME_LENGTH_CONFIG.optimal.min).toBe(2);
    expect(NAME_LENGTH_CONFIG.optimal.max).toBe(4);
  });

  it("should have max length of 8", () => {
    expect(NAME_LENGTH_CONFIG.max).toBe(8);
  });
});

// ============================================================================
// 颗粒度配置测试
// ============================================================================

describe("GRANULARITY_CONFIG", () => {
  it("should have correct thresholds", () => {
    expect(GRANULARITY_CONFIG.low.threshold).toBe(10);
    expect(GRANULARITY_CONFIG.medium.threshold).toBe(30);
  });
});

// ============================================================================
// 辅助函数测试
// ============================================================================

describe("isForbiddenNameA", () => {
  it("should return true for forbidden names", () => {
    expect(isForbiddenNameA("待整理")).toBe(true);
    expect(isForbiddenNameA("未分类")).toBe(true);
    expect(isForbiddenNameA("New Folder")).toBe(true);
  });

  it("should return false for valid names", () => {
    expect(isForbiddenNameA("前端开发")).toBe(false);
    expect(isForbiddenNameA("React")).toBe(false);
    expect(isForbiddenNameA("个人理财")).toBe(false);
  });

  it("should handle whitespace", () => {
    expect(isForbiddenNameA("  待整理  ")).toBe(true);
  });
});

describe("isVagueWord", () => {
  it("should return true for vague words", () => {
    expect(isVagueWord("技术")).toBe(true);
    expect(isVagueWord("学习")).toBe(true);
    expect(isVagueWord("资源")).toBe(true);
  });

  it("should return false for specific names", () => {
    expect(isVagueWord("React")).toBe(false);
    expect(isVagueWord("前端开发")).toBe(false);
  });
});

describe("isContextualWord", () => {
  it("should return true for contextual words", () => {
    expect(isContextualWord("工具")).toBe(true);
    expect(isContextualWord("设计")).toBe(true);
  });

  it("should return false for other words", () => {
    expect(isContextualWord("React")).toBe(false);
    expect(isContextualWord("前端")).toBe(false);
  });
});

describe("getGranularityLevel", () => {
  it("should return 'low' for less than 10 folders", () => {
    expect(getGranularityLevel(0)).toBe("low");
    expect(getGranularityLevel(5)).toBe("low");
    expect(getGranularityLevel(9)).toBe("low");
  });

  it("should return 'medium' for 10-29 folders", () => {
    expect(getGranularityLevel(10)).toBe("medium");
    expect(getGranularityLevel(20)).toBe("medium");
    expect(getGranularityLevel(29)).toBe("medium");
  });

  it("should return 'high' for 30+ folders", () => {
    expect(getGranularityLevel(30)).toBe("high");
    expect(getGranularityLevel(50)).toBe("high");
    expect(getGranularityLevel(100)).toBe("high");
  });
});

describe("getGranularityHint", () => {
  it("should suggest broad names for low folder count", () => {
    const hint = getGranularityHint(5);
    expect(hint).toContain("5");
    expect(hint).toContain("大类");
  });

  it("should suggest medium names for medium folder count", () => {
    const hint = getGranularityHint(20);
    expect(hint).toContain("20");
    expect(hint).toContain("中类");
  });

  it("should suggest specific names for high folder count", () => {
    const hint = getGranularityHint(50);
    expect(hint).toContain("50");
    expect(hint).toContain("细分");
  });
});

describe("calculateEffectiveLength", () => {
  it("should count Chinese characters as 1", () => {
    expect(calculateEffectiveLength("前端")).toBe(2);
    expect(calculateEffectiveLength("前端开发")).toBe(4);
    expect(calculateEffectiveLength("独立开发")).toBe(4);
  });

  it("should count English words as 2 (equivalent)", () => {
    expect(calculateEffectiveLength("React")).toBe(2);
    expect(calculateEffectiveLength("Docker")).toBe(2);
  });

  it("should handle mixed Chinese-English", () => {
    // "React" = 2, " " = 0, "学习" = 2
    expect(calculateEffectiveLength("React 学习")).toBe(4);
    // "AI" = 2, " " = 0, "工具" = 2
    expect(calculateEffectiveLength("AI 工具")).toBe(4);
  });

  it("should handle multiple English words", () => {
    // Each word = 2
    expect(calculateEffectiveLength("React Native")).toBe(4);
  });
});

describe("isNameLengthValid", () => {
  it("should return true for valid lengths", () => {
    expect(isNameLengthValid("React")).toBe(true); // 2
    expect(isNameLengthValid("前端")).toBe(true); // 2
    expect(isNameLengthValid("独立开发")).toBe(true); // 4
    expect(isNameLengthValid("React Native")).toBe(true); // 4
  });

  it("should return false for too short names", () => {
    // 空字符串有效长度为 0，不在 2-8 范围内
    expect(isNameLengthValid("")).toBe(false);
  });

  it("should return false for too long names", () => {
    // 10 个中文字 = 10 有效长度，超过 8
    expect(isNameLengthValid("前端开发技术学习资料汇总")).toBe(false);
    // 5 个英文单词 = 10 有效长度，超过 8
    expect(isNameLengthValid("React Native Development Tools Guide")).toBe(
      false,
    );
  });
});

// ============================================================================
// Prompt 规则测试
// ============================================================================

describe("FOLDER_NAMING_RULES", () => {
  it("should contain key rules", () => {
    expect(FOLDER_NAMING_RULES).toContain("2-4 个字最佳");
    expect(FOLDER_NAMING_RULES).toContain("不超过 8 个字");
    expect(FOLDER_NAMING_RULES).toContain("名词");
    expect(FOLDER_NAMING_RULES).toContain("禁止");
  });

  it("should contain good examples", () => {
    expect(FOLDER_NAMING_RULES).toContain("独立开发");
    expect(FOLDER_NAMING_RULES).toContain("React");
  });

  it("should contain bad examples", () => {
    expect(FOLDER_NAMING_RULES).toContain("学习 React");
    expect(FOLDER_NAMING_RULES).toContain("各种资料");
  });
});
