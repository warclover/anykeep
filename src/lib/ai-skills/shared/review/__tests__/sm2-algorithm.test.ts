/**
 * SM-2 Algorithm Unit Tests
 *
 * Tests for SuperMemo SM-2 spaced repetition algorithm implementation
 *
 * @module shared/review/__tests__/sm2-algorithm.test
 */

import { SM2Algorithm } from "../sm2-algorithm";
import type { SM2Input } from "../types";

describe("SM2Algorithm", () => {
  // ============================================
  // calculate() method tests
  // ============================================
  describe("calculate()", () => {
    describe("input validation", () => {
      it("should throw error for quality < 0", () => {
        const input: SM2Input = {
          quality: -1,
          repetitions: 0,
          easeFactor: 2.5,
          interval: 1,
        };
        expect(() => SM2Algorithm.calculate(input)).toThrow(
          "Invalid quality: -1. Must be 0-5.",
        );
      });

      it("should throw error for quality > 5", () => {
        const input: SM2Input = {
          quality: 6,
          repetitions: 0,
          easeFactor: 2.5,
          interval: 1,
        };
        expect(() => SM2Algorithm.calculate(input)).toThrow(
          "Invalid quality: 6. Must be 0-5.",
        );
      });

      it("should accept quality = 0", () => {
        const input: SM2Input = {
          quality: 0,
          repetitions: 3,
          easeFactor: 2.5,
          interval: 7,
        };
        expect(() => SM2Algorithm.calculate(input)).not.toThrow();
      });

      it("should accept quality = 5", () => {
        const input: SM2Input = {
          quality: 5,
          repetitions: 0,
          easeFactor: 2.5,
          interval: 1,
        };
        expect(() => SM2Algorithm.calculate(input)).not.toThrow();
      });
    });

    describe("quality < 3 (forgotten)", () => {
      it("should reset interval to 1 day", () => {
        const input: SM2Input = {
          quality: 0,
          repetitions: 5,
          easeFactor: 2.5,
          interval: 30,
        };
        const result = SM2Algorithm.calculate(input);
        expect(result.interval).toBe(1);
      });

      it("should reset repetitions to 0", () => {
        const input: SM2Input = {
          quality: 2,
          repetitions: 10,
          easeFactor: 2.0,
          interval: 60,
        };
        const result = SM2Algorithm.calculate(input);
        expect(result.repetitions).toBe(0);
      });

      it("should decrease ease factor by 0.2", () => {
        const input: SM2Input = {
          quality: 1,
          repetitions: 3,
          easeFactor: 2.5,
          interval: 7,
        };
        const result = SM2Algorithm.calculate(input);
        expect(result.easeFactor).toBe(2.3);
      });

      it("should not decrease ease factor below 1.3", () => {
        const input: SM2Input = {
          quality: 0,
          repetitions: 2,
          easeFactor: 1.4,
          interval: 3,
        };
        const result = SM2Algorithm.calculate(input);
        expect(result.easeFactor).toBe(1.3);
      });
    });

    describe("quality >= 3 (remembered)", () => {
      describe("first repetition (rep = 0)", () => {
        it("should set interval to 1 day", () => {
          const input: SM2Input = {
            quality: 4,
            repetitions: 0,
            easeFactor: 2.5,
            interval: 0,
          };
          const result = SM2Algorithm.calculate(input);
          expect(result.interval).toBe(1);
        });

        it("should increment repetitions to 1", () => {
          const input: SM2Input = {
            quality: 5,
            repetitions: 0,
            easeFactor: 2.5,
            interval: 0,
          };
          const result = SM2Algorithm.calculate(input);
          expect(result.repetitions).toBe(1);
        });
      });

      describe("second repetition (rep = 1)", () => {
        it("should set interval to 3 days", () => {
          const input: SM2Input = {
            quality: 4,
            repetitions: 1,
            easeFactor: 2.5,
            interval: 1,
          };
          const result = SM2Algorithm.calculate(input);
          expect(result.interval).toBe(3);
        });

        it("should increment repetitions to 2", () => {
          const input: SM2Input = {
            quality: 3,
            repetitions: 1,
            easeFactor: 2.5,
            interval: 1,
          };
          const result = SM2Algorithm.calculate(input);
          expect(result.repetitions).toBe(2);
        });
      });

      describe("third repetition (rep = 2)", () => {
        it("should set interval to 7 days", () => {
          const input: SM2Input = {
            quality: 5,
            repetitions: 2,
            easeFactor: 2.5,
            interval: 3,
          };
          const result = SM2Algorithm.calculate(input);
          expect(result.interval).toBe(7);
        });

        it("should increment repetitions to 3", () => {
          const input: SM2Input = {
            quality: 4,
            repetitions: 2,
            easeFactor: 2.5,
            interval: 3,
          };
          const result = SM2Algorithm.calculate(input);
          expect(result.repetitions).toBe(3);
        });
      });

      describe("subsequent repetitions (rep >= 3)", () => {
        it("should multiply interval by ease factor", () => {
          const input: SM2Input = {
            quality: 4,
            repetitions: 3,
            easeFactor: 2.0,
            interval: 7,
          };
          const result = SM2Algorithm.calculate(input);
          // 7 * 2.0 = 14, rounded
          expect(result.interval).toBe(14);
        });

        it("should round to nearest integer", () => {
          const input: SM2Input = {
            quality: 5,
            repetitions: 4,
            easeFactor: 2.3,
            interval: 14,
          };
          const result = SM2Algorithm.calculate(input);
          // 14 * 2.5 = 35 (with EF increase)
          expect(Number.isInteger(result.interval)).toBe(true);
        });
      });
    });

    describe("ease factor calculation", () => {
      it("should increase ease factor for quality = 5", () => {
        const input: SM2Input = {
          quality: 5,
          repetitions: 3,
          easeFactor: 2.0,
          interval: 7,
        };
        const result = SM2Algorithm.calculate(input);
        // EF' = 2.0 + (0.1 - 0 * (0.08 + 0 * 0.02)) = 2.1
        expect(result.easeFactor).toBe(2.1);
      });

      it("should keep ease factor stable for quality = 4", () => {
        const input: SM2Input = {
          quality: 4,
          repetitions: 3,
          easeFactor: 2.5,
          interval: 7,
        };
        const result = SM2Algorithm.calculate(input);
        // EF' = 2.5 + (0.1 - 1 * (0.08 + 1 * 0.02)) = 2.5
        expect(result.easeFactor).toBe(2.5);
      });

      it("should decrease ease factor for quality = 3", () => {
        const input: SM2Input = {
          quality: 3,
          repetitions: 3,
          easeFactor: 2.5,
          interval: 7,
        };
        const result = SM2Algorithm.calculate(input);
        // EF' = 2.5 + (0.1 - 2 * (0.08 + 2 * 0.02)) = 2.5 - 0.14 = 2.36
        expect(result.easeFactor).toBe(2.36);
      });

      it("should not exceed max ease factor (2.5)", () => {
        const input: SM2Input = {
          quality: 5,
          repetitions: 10,
          easeFactor: 2.5,
          interval: 60,
        };
        const result = SM2Algorithm.calculate(input);
        expect(result.easeFactor).toBe(2.5);
      });

      it("should not go below min ease factor (1.3)", () => {
        const input: SM2Input = {
          quality: 3,
          repetitions: 3,
          easeFactor: 1.35,
          interval: 7,
        };
        const result = SM2Algorithm.calculate(input);
        expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
      });
    });

    describe("max interval limit", () => {
      it("should cap interval at 90 days", () => {
        const input: SM2Input = {
          quality: 5,
          repetitions: 10,
          easeFactor: 2.5,
          interval: 60,
        };
        const result = SM2Algorithm.calculate(input);
        expect(result.interval).toBeLessThanOrEqual(90);
      });

      it("should apply max interval even with high ease factor", () => {
        const input: SM2Input = {
          quality: 5,
          repetitions: 8,
          easeFactor: 2.5,
          interval: 50,
        };
        const result = SM2Algorithm.calculate(input);
        // 50 * 2.5+ = 125+, should be capped
        expect(result.interval).toBe(90);
      });
    });
  });

  // ============================================
  // responseToQuality() tests
  // ============================================
  describe("responseToQuality()", () => {
    it("should map 'mastered' to quality 5", () => {
      expect(SM2Algorithm.responseToQuality("mastered")).toBe(5);
    });

    it("should map 'fuzzy' to quality 3", () => {
      expect(SM2Algorithm.responseToQuality("fuzzy")).toBe(3);
    });

    it("should map 'forgotten' to quality 0", () => {
      expect(SM2Algorithm.responseToQuality("forgotten")).toBe(0);
    });

    it("should map 'archived' to quality 5", () => {
      expect(SM2Algorithm.responseToQuality("archived")).toBe(5);
    });
  });

  // ============================================
  // qualityToResponse() tests
  // ============================================
  describe("qualityToResponse()", () => {
    it("should return 'mastered' for quality >= 4", () => {
      expect(SM2Algorithm.qualityToResponse(4)).toBe("mastered");
      expect(SM2Algorithm.qualityToResponse(5)).toBe("mastered");
    });

    it("should return 'fuzzy' for quality = 3", () => {
      expect(SM2Algorithm.qualityToResponse(3)).toBe("fuzzy");
    });

    it("should return 'forgotten' for quality < 3", () => {
      expect(SM2Algorithm.qualityToResponse(0)).toBe("forgotten");
      expect(SM2Algorithm.qualityToResponse(1)).toBe("forgotten");
      expect(SM2Algorithm.qualityToResponse(2)).toBe("forgotten");
    });
  });

  // ============================================
  // predictNextReview() tests
  // ============================================
  describe("predictNextReview()", () => {
    it("should return date interval days from now", () => {
      const now = new Date();
      const result = SM2Algorithm.predictNextReview(7);

      const expectedDate = new Date(now);
      expectedDate.setDate(expectedDate.getDate() + 7);

      // Compare day/month/year
      expect(result.getFullYear()).toBe(expectedDate.getFullYear());
      expect(result.getMonth()).toBe(expectedDate.getMonth());
      expect(result.getDate()).toBe(expectedDate.getDate());
    });

    it("should set time to 9:00 AM", () => {
      const result = SM2Algorithm.predictNextReview(1);
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    it("should handle zero interval", () => {
      const now = new Date();
      const result = SM2Algorithm.predictNextReview(0);
      expect(result.getDate()).toBe(now.getDate());
    });
  });

  // ============================================
  // calculateForgettingRisk() tests
  // ============================================
  describe("calculateForgettingRisk()", () => {
    it("should return 0 for null nextReviewAt", () => {
      expect(SM2Algorithm.calculateForgettingRisk(null, 7)).toBe(0);
    });

    describe("overdue items", () => {
      it("should return 0.5 when just overdue", () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const risk = SM2Algorithm.calculateForgettingRisk(yesterday, 7);
        // Overdue ~1 day, risk = 0.5 + 0.5 * (1/7) ≈ 0.57
        expect(risk).toBeGreaterThanOrEqual(0.5);
        expect(risk).toBeLessThan(0.7);
      });

      it("should approach 1 when severely overdue", () => {
        const longAgo = new Date();
        longAgo.setDate(longAgo.getDate() - 14);

        const risk = SM2Algorithm.calculateForgettingRisk(longAgo, 7);
        // Overdue 14 days with 7 day interval = 0.5 + 0.5 * (14/7) = 1.5, capped at 1
        expect(risk).toBe(1);
      });

      it("should cap at 1.0 for extreme overdue", () => {
        const veryOld = new Date();
        veryOld.setDate(veryOld.getDate() - 100);

        const risk = SM2Algorithm.calculateForgettingRisk(veryOld, 7);
        expect(risk).toBe(1);
      });
    });

    describe("future items", () => {
      it("should return 0 when review is far in future", () => {
        const future = new Date();
        future.setDate(future.getDate() + 7);

        const risk = SM2Algorithm.calculateForgettingRisk(future, 7);
        // Remaining = 7, interval = 7, risk = 0.5 * (1 - 7/7) = 0
        expect(risk).toBe(0);
      });

      it("should return low risk for items due tomorrow", () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const risk = SM2Algorithm.calculateForgettingRisk(tomorrow, 7);
        // Remaining ~1, interval = 7, risk = 0.5 * (1 - 1/7) ≈ 0.43
        expect(risk).toBeGreaterThan(0.3);
        expect(risk).toBeLessThan(0.5);
      });
    });
  });

  // ============================================
  // simpleSchedule() tests
  // ============================================
  describe("simpleSchedule()", () => {
    it("should return 1-3-7-14-30-60-90 schedule", () => {
      expect(SM2Algorithm.simpleSchedule(0)).toBe(1);
      expect(SM2Algorithm.simpleSchedule(1)).toBe(3);
      expect(SM2Algorithm.simpleSchedule(2)).toBe(7);
      expect(SM2Algorithm.simpleSchedule(3)).toBe(14);
      expect(SM2Algorithm.simpleSchedule(4)).toBe(30);
      expect(SM2Algorithm.simpleSchedule(5)).toBe(60);
      expect(SM2Algorithm.simpleSchedule(6)).toBe(90);
    });

    it("should cap at 90 for repetitions beyond schedule", () => {
      expect(SM2Algorithm.simpleSchedule(7)).toBe(90);
      expect(SM2Algorithm.simpleSchedule(10)).toBe(90);
      expect(SM2Algorithm.simpleSchedule(100)).toBe(90);
    });
  });

  // ============================================
  // calculateFromResponse() tests
  // ============================================
  describe("calculateFromResponse()", () => {
    it("should handle mastered response correctly", () => {
      const result = SM2Algorithm.calculateFromResponse("mastered", {
        repetitions: 2,
        easeFactor: 2.5,
        intervalDays: 3,
      });

      // quality = 5, should progress to rep 3 with interval 7
      expect(result.repetitions).toBe(3);
      expect(result.interval).toBe(7);
      expect(result.easeFactor).toBeGreaterThanOrEqual(2.5);
    });

    it("should handle fuzzy response correctly", () => {
      const result = SM2Algorithm.calculateFromResponse("fuzzy", {
        repetitions: 3,
        easeFactor: 2.5,
        intervalDays: 7,
      });

      // quality = 3, should progress with decreased EF
      expect(result.repetitions).toBe(4);
      expect(result.easeFactor).toBeLessThan(2.5);
    });

    it("should handle forgotten response correctly", () => {
      const result = SM2Algorithm.calculateFromResponse("forgotten", {
        repetitions: 5,
        easeFactor: 2.0,
        intervalDays: 30,
      });

      // quality = 0, should reset
      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
    });

    it("should handle archived response like mastered", () => {
      const result = SM2Algorithm.calculateFromResponse("archived", {
        repetitions: 0,
        easeFactor: 2.5,
        intervalDays: 0,
      });

      // archived maps to quality 5, same as mastered
      expect(result.repetitions).toBe(1);
      expect(result.interval).toBe(1);
    });
  });

  // ============================================
  // Integration / Scenario tests
  // ============================================
  describe("integration scenarios", () => {
    it("should simulate realistic learning progression", () => {
      let state = {
        repetitions: 0,
        easeFactor: 2.5,
        intervalDays: 0,
      };

      // First review: mastered
      let result = SM2Algorithm.calculateFromResponse("mastered", state);
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);

      // Second review: mastered
      state = {
        repetitions: result.repetitions,
        easeFactor: result.easeFactor,
        intervalDays: result.interval,
      };
      result = SM2Algorithm.calculateFromResponse("mastered", state);
      expect(result.interval).toBe(3);
      expect(result.repetitions).toBe(2);

      // Third review: fuzzy
      state = {
        repetitions: result.repetitions,
        easeFactor: result.easeFactor,
        intervalDays: result.interval,
      };
      result = SM2Algorithm.calculateFromResponse("fuzzy", state);
      expect(result.interval).toBe(7);
      expect(result.repetitions).toBe(3);

      // Fourth review: forgotten (resets)
      state = {
        repetitions: result.repetitions,
        easeFactor: result.easeFactor,
        intervalDays: result.interval,
      };
      result = SM2Algorithm.calculateFromResponse("forgotten", state);
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(0);
    });

    it("should reach max interval with consistent perfect reviews", () => {
      let state = {
        repetitions: 0,
        easeFactor: 2.5,
        intervalDays: 0,
      };

      // Simulate many perfect reviews
      for (let i = 0; i < 15; i++) {
        const result = SM2Algorithm.calculateFromResponse("mastered", state);
        state = {
          repetitions: result.repetitions,
          easeFactor: result.easeFactor,
          intervalDays: result.interval,
        };
      }

      // Should be capped at 90
      expect(state.intervalDays).toBe(90);
    });
  });
});
