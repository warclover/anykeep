/**
 * Brain-Sync API 验证和业务逻辑测试
 *
 * 测试验证 Schema、辅助函数和 SM-2 算法集成
 *
 * @module api/brain-sync/__tests__/brain-sync-api.test
 * @version 1.0.0
 * @since 2025-12-29
 */

import { z } from "zod";
import { SM2Algorithm } from "@/lib/ai-skills/shared/review";
import type { ReviewResponse, SM2Input } from "@/lib/ai-skills/shared/review";

// =============================================================================
// 验证 Schema（从 response/route.ts 提取）
// =============================================================================

const submitResponseSchema = z.object({
  flashcardId: z.number().int().positive(),
  response: z.enum(["mastered", "fuzzy", "forgotten", "archived"]),
  responseTimeMs: z.number().int().positive().optional(),
});

// =============================================================================
// 辅助函数（从 response/route.ts 复制用于测试）
// =============================================================================

/**
 * 根据反馈类型确定 SM-2 质量分数
 */
function getQualityFromResponse(response: ReviewResponse): number {
  switch (response) {
    case "mastered":
      return 5;
    case "fuzzy":
      return 3;
    case "forgotten":
      return 1;
    case "archived":
      return 5;
    default:
      return 3;
  }
}

/**
 * 生成复习反馈提示
 */
function getGuidance(response: ReviewResponse, newInterval: number): string {
  switch (response) {
    case "mastered":
      if (newInterval >= 21) {
        return "太棒了！这个知识点已经牢固掌握，下次复习在三周后。";
      } else if (newInterval >= 7) {
        return "很好！这个知识点掌握得不错，下次复习在一周后。";
      } else {
        return "继续保持！再复习几次就能完全掌握了。";
      }
    case "fuzzy":
      return "没关系，模糊记忆是正常的。明天再复习一次会更清晰。";
    case "forgotten":
      return "别担心，遗忘是记忆的一部分。今天再看一遍，明天继续复习。";
    case "archived":
      return "🎉 恭喜！这个知识点已永久归档，不再出现在复习队列中。如需恢复，可在卡片管理中操作。";
    default:
      return "";
  }
}

// =============================================================================
// submitResponseSchema 测试
// =============================================================================

describe("submitResponseSchema", () => {
  describe("valid inputs", () => {
    it("should accept valid mastered response", () => {
      const input = {
        flashcardId: 1,
        response: "mastered",
      };

      const result = submitResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept valid fuzzy response", () => {
      const input = {
        flashcardId: 123,
        response: "fuzzy",
      };

      const result = submitResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept valid forgotten response", () => {
      const input = {
        flashcardId: 456,
        response: "forgotten",
      };

      const result = submitResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept valid archived response", () => {
      const input = {
        flashcardId: 789,
        response: "archived",
      };

      const result = submitResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should accept optional responseTimeMs", () => {
      const input = {
        flashcardId: 1,
        response: "mastered",
        responseTimeMs: 2500,
      };

      const result = submitResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.responseTimeMs).toBe(2500);
      }
    });
  });

  describe("invalid inputs", () => {
    it("should reject missing flashcardId", () => {
      const input = {
        response: "mastered",
      };

      const result = submitResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject negative flashcardId", () => {
      const input = {
        flashcardId: -1,
        response: "mastered",
      };

      const result = submitResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject zero flashcardId", () => {
      const input = {
        flashcardId: 0,
        response: "mastered",
      };

      const result = submitResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject non-integer flashcardId", () => {
      const input = {
        flashcardId: 1.5,
        response: "mastered",
      };

      const result = submitResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject missing response", () => {
      const input = {
        flashcardId: 1,
      };

      const result = submitResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject invalid response type", () => {
      const input = {
        flashcardId: 1,
        response: "invalid",
      };

      const result = submitResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject negative responseTimeMs", () => {
      const input = {
        flashcardId: 1,
        response: "mastered",
        responseTimeMs: -100,
      };

      const result = submitResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject zero responseTimeMs", () => {
      const input = {
        flashcardId: 1,
        response: "mastered",
        responseTimeMs: 0,
      };

      const result = submitResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

// =============================================================================
// getQualityFromResponse 测试
// =============================================================================

describe("getQualityFromResponse", () => {
  it("should return 5 for mastered", () => {
    expect(getQualityFromResponse("mastered")).toBe(5);
  });

  it("should return 3 for fuzzy", () => {
    expect(getQualityFromResponse("fuzzy")).toBe(3);
  });

  it("should return 1 for forgotten", () => {
    expect(getQualityFromResponse("forgotten")).toBe(1);
  });

  it("should return 5 for archived", () => {
    expect(getQualityFromResponse("archived")).toBe(5);
  });

  it("should be consistent with SM2Algorithm.responseToQuality for mastered", () => {
    // Note: getQualityFromResponse uses 1 for forgotten (stricter)
    // while SM2Algorithm uses 0 for forgotten
    expect(getQualityFromResponse("mastered")).toBe(
      SM2Algorithm.responseToQuality("mastered"),
    );
  });

  it("should be consistent with SM2Algorithm.responseToQuality for fuzzy", () => {
    expect(getQualityFromResponse("fuzzy")).toBe(
      SM2Algorithm.responseToQuality("fuzzy"),
    );
  });

  it("should be consistent with SM2Algorithm.responseToQuality for archived", () => {
    expect(getQualityFromResponse("archived")).toBe(
      SM2Algorithm.responseToQuality("archived"),
    );
  });
});

// =============================================================================
// getGuidance 测试
// =============================================================================

describe("getGuidance", () => {
  describe("mastered responses", () => {
    it("should mention three weeks for interval >= 21", () => {
      const guidance = getGuidance("mastered", 21);
      expect(guidance).toContain("三周");
    });

    it("should mention one week for interval >= 7 and < 21", () => {
      const guidance = getGuidance("mastered", 7);
      expect(guidance).toContain("一周");
    });

    it("should encourage for interval < 7", () => {
      const guidance = getGuidance("mastered", 3);
      expect(guidance).toContain("继续保持");
    });

    it("should handle high intervals", () => {
      const guidance = getGuidance("mastered", 90);
      expect(guidance).toContain("三周");
    });
  });

  describe("fuzzy responses", () => {
    it("should provide reassurance", () => {
      const guidance = getGuidance("fuzzy", 1);
      expect(guidance).toContain("没关系");
      expect(guidance).toContain("明天");
    });

    it("should be consistent regardless of interval", () => {
      const guidance1 = getGuidance("fuzzy", 1);
      const guidance7 = getGuidance("fuzzy", 7);
      expect(guidance1).toBe(guidance7);
    });
  });

  describe("forgotten responses", () => {
    it("should provide encouragement", () => {
      const guidance = getGuidance("forgotten", 1);
      expect(guidance).toContain("别担心");
    });

    it("should mention reviewing again", () => {
      const guidance = getGuidance("forgotten", 1);
      expect(guidance).toContain("今天");
      expect(guidance).toContain("明天");
    });
  });

  describe("archived responses", () => {
    it("should include congratulations emoji", () => {
      const guidance = getGuidance("archived", 0);
      expect(guidance).toContain("🎉");
    });

    it("should mention permanent archive", () => {
      const guidance = getGuidance("archived", 0);
      expect(guidance).toContain("永久归档");
    });

    it("should mention recovery option", () => {
      const guidance = getGuidance("archived", 0);
      expect(guidance).toContain("恢复");
    });
  });
});

// =============================================================================
// SM-2 集成测试
// =============================================================================

describe("SM-2 Integration", () => {
  describe("response to SM-2 flow", () => {
    it("should correctly process mastered response", () => {
      const quality = getQualityFromResponse("mastered");
      const sm2Input: SM2Input = {
        quality,
        easeFactor: 2.5,
        interval: 1,
        repetitions: 0,
      };

      const result = SM2Algorithm.calculate(sm2Input);

      expect(result.repetitions).toBe(1);
      expect(result.interval).toBe(1);
      expect(result.easeFactor).toBe(2.5);
    });

    it("should correctly process fuzzy response", () => {
      const quality = getQualityFromResponse("fuzzy");
      const sm2Input: SM2Input = {
        quality,
        easeFactor: 2.5,
        interval: 7,
        repetitions: 3,
      };

      const result = SM2Algorithm.calculate(sm2Input);

      expect(result.repetitions).toBe(4);
      expect(result.easeFactor).toBeLessThan(2.5);
    });

    it("should reset progress on forgotten response", () => {
      const quality = getQualityFromResponse("forgotten");
      const sm2Input: SM2Input = {
        quality,
        easeFactor: 2.0,
        interval: 30,
        repetitions: 10,
      };

      const result = SM2Algorithm.calculate(sm2Input);

      // Quality 1 triggers reset (< 3)
      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
    });

    it("should handle archived like mastered for SM-2", () => {
      const archivedQuality = getQualityFromResponse("archived");
      const masteredQuality = getQualityFromResponse("mastered");

      expect(archivedQuality).toBe(masteredQuality);
    });
  });

  describe("full review cycle simulation", () => {
    it("should progress through learning curve", () => {
      let state = {
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
      };

      // Day 1: mastered
      let result = SM2Algorithm.calculate({
        ...state,
        quality: getQualityFromResponse("mastered"),
      });
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);

      // Day 2: mastered
      state = {
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
      };
      result = SM2Algorithm.calculate({
        ...state,
        quality: getQualityFromResponse("mastered"),
      });
      expect(result.interval).toBe(3);
      expect(result.repetitions).toBe(2);

      // Day 5: fuzzy (still passes but extends less)
      state = {
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
      };
      result = SM2Algorithm.calculate({
        ...state,
        quality: getQualityFromResponse("fuzzy"),
      });
      expect(result.interval).toBe(7);
      expect(result.repetitions).toBe(3);

      // After Week 1: forgotten (resets)
      state = {
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
      };
      result = SM2Algorithm.calculate({
        ...state,
        quality: getQualityFromResponse("forgotten"),
      });
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(0);
    });
  });
});

// =============================================================================
// Response Types 验证
// =============================================================================

describe("ReviewResponse types", () => {
  const validResponses: ReviewResponse[] = [
    "mastered",
    "fuzzy",
    "forgotten",
    "archived",
  ];

  it("should have exactly 4 response types", () => {
    expect(validResponses).toHaveLength(4);
  });

  it("should all be valid in schema", () => {
    for (const response of validResponses) {
      const input = {
        flashcardId: 1,
        response,
      };
      const result = submitResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });

  it("should all map to valid quality scores", () => {
    for (const response of validResponses) {
      const quality = getQualityFromResponse(response);
      expect(quality).toBeGreaterThanOrEqual(0);
      expect(quality).toBeLessThanOrEqual(5);
    }
  });

  it("should all produce guidance text", () => {
    for (const response of validResponses) {
      const guidance = getGuidance(response, 7);
      expect(guidance).toBeTruthy();
      expect(guidance.length).toBeGreaterThan(0);
    }
  });
});
