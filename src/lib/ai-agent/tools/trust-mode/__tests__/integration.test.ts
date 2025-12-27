/**
 * Trust Mode Tools 集成测试
 *
 * 验证 trust-mode tools 正确注册到 Tool Registry
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { trustModeTools } from "../index";
import { getTrustModeTool } from "../get-trust-mode.tool";
import { recommendTrustModeTool } from "../recommend-trust-mode.tool";

describe("Trust Mode Tools Integration", () => {
  describe("tools export", () => {
    it("should export trustModeTools array with 2 tools", () => {
      expect(trustModeTools).toHaveLength(2);
    });

    it("should include get_trust_mode tool", () => {
      const tool = trustModeTools.find(
        (t) => t.definition.name === "get_trust_mode",
      );
      expect(tool).toBeDefined();
      expect(tool).toBe(getTrustModeTool);
    });

    it("should include recommend_trust_mode tool", () => {
      const tool = trustModeTools.find(
        (t) => t.definition.name === "recommend_trust_mode",
      );
      expect(tool).toBeDefined();
      expect(tool).toBe(recommendTrustModeTool);
    });
  });

  describe("tool definitions", () => {
    it("get_trust_mode should have correct category", () => {
      expect(getTrustModeTool.definition.category).toBe("query");
    });

    it("recommend_trust_mode should have correct category", () => {
      expect(recommendTrustModeTool.definition.category).toBe("query");
    });

    it("both tools should not require confirmation", () => {
      expect(getTrustModeTool.definition.requiresConfirmation).toBe(false);
      expect(recommendTrustModeTool.definition.requiresConfirmation).toBe(
        false,
      );
    });
  });

  describe("tool parameters", () => {
    it("get_trust_mode should accept empty params with defaults", () => {
      const schema = getTrustModeTool.definition.parameters;
      const result = schema.parse({});
      expect(result.includeStats).toBe(false);
    });

    it("recommend_trust_mode should accept empty params with defaults", () => {
      const schema = recommendTrustModeTool.definition.parameters;
      const result = schema.parse({});
      expect(result.considerHistory).toBe(true);
    });
  });
});
