/**
 * 响应模板模块测试
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import {
  CONFIDENCE_THRESHOLDS,
  RISK_OPERATIONS,
  BATCH_CONFIRMATION_THRESHOLD,
  getConfidenceLevel,
  getOperationRiskLevel,
  requiresConfirmation,
} from "../response-templates";

describe("response-templates", () => {
  describe("CONFIDENCE_THRESHOLDS", () => {
    it("should have correct threshold values", () => {
      expect(CONFIDENCE_THRESHOLDS.HIGH).toBe(0.85);
      expect(CONFIDENCE_THRESHOLDS.MEDIUM).toBe(0.6);
    });
  });

  describe("RISK_OPERATIONS", () => {
    it("should categorize operations correctly", () => {
      expect(RISK_OPERATIONS.LOW).toContain("search");
      expect(RISK_OPERATIONS.LOW).toContain("list");
      expect(RISK_OPERATIONS.MEDIUM).toContain("add_tag");
      expect(RISK_OPERATIONS.MEDIUM).toContain("move");
      expect(RISK_OPERATIONS.HIGH).toContain("delete");
      expect(RISK_OPERATIONS.HIGH).toContain("batch_delete");
    });
  });

  describe("BATCH_CONFIRMATION_THRESHOLD", () => {
    it("should be 20", () => {
      expect(BATCH_CONFIRMATION_THRESHOLD).toBe(20);
    });
  });

  describe("getConfidenceLevel", () => {
    it("should return 'high' for confidence >= 0.85", () => {
      expect(getConfidenceLevel(0.85)).toBe("high");
      expect(getConfidenceLevel(0.9)).toBe("high");
      expect(getConfidenceLevel(1.0)).toBe("high");
    });

    it("should return 'medium' for confidence >= 0.6 and < 0.85", () => {
      expect(getConfidenceLevel(0.6)).toBe("medium");
      expect(getConfidenceLevel(0.7)).toBe("medium");
      expect(getConfidenceLevel(0.84)).toBe("medium");
    });

    it("should return 'low' for confidence < 0.6", () => {
      expect(getConfidenceLevel(0.59)).toBe("low");
      expect(getConfidenceLevel(0.3)).toBe("low");
      expect(getConfidenceLevel(0)).toBe("low");
    });
  });

  describe("getOperationRiskLevel", () => {
    it("should return 'high' for delete operations", () => {
      expect(getOperationRiskLevel("delete")).toBe("high");
      expect(getOperationRiskLevel("DELETE")).toBe("high");
      expect(getOperationRiskLevel("batch_delete")).toBe("high");
      expect(getOperationRiskLevel("remove")).toBe("high");
    });

    it("should return 'medium' for modify operations", () => {
      expect(getOperationRiskLevel("add_tag")).toBe("medium");
      expect(getOperationRiskLevel("move")).toBe("medium");
      expect(getOperationRiskLevel("classify")).toBe("medium");
      expect(getOperationRiskLevel("export")).toBe("medium");
    });

    it("should return 'low' for query operations", () => {
      expect(getOperationRiskLevel("search")).toBe("low");
      expect(getOperationRiskLevel("list")).toBe("low");
      expect(getOperationRiskLevel("count")).toBe("low");
      expect(getOperationRiskLevel("get")).toBe("low");
    });

    it("should return 'low' for unknown operations", () => {
      expect(getOperationRiskLevel("unknown_operation")).toBe("low");
    });
  });

  describe("requiresConfirmation", () => {
    it("should return true for high-risk operations", () => {
      expect(requiresConfirmation("delete")).toBe(true);
      expect(requiresConfirmation("batch_delete")).toBe(true);
      expect(requiresConfirmation("remove")).toBe(true);
    });

    it("should return false for low/medium-risk operations with small count", () => {
      expect(requiresConfirmation("search", 1)).toBe(false);
      expect(requiresConfirmation("add_tag", 10)).toBe(false);
      expect(requiresConfirmation("move", 20)).toBe(false);
    });

    it("should return true for batch operations exceeding threshold", () => {
      expect(requiresConfirmation("add_tag", 21)).toBe(true);
      expect(requiresConfirmation("move", 50)).toBe(true);
      expect(requiresConfirmation("search", 100)).toBe(true);
    });

    it("should use default count of 1", () => {
      expect(requiresConfirmation("add_tag")).toBe(false);
    });
  });
});
