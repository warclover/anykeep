/**
 * QuotaManager - 单元测试
 * @module knowledge-studio/quota
 */

import { QuotaManager } from "../quota-manager";
import { DEFAULT_OPERATION_COSTS, MEMBERSHIP_QUOTA_LIMITS } from "../types";

// Mock Supabase
jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({ data: { membership_type: "free" }, error: null }),
          ),
        })),
      })),
    })),
    rpc: jest.fn(() =>
      Promise.resolve({ data: "test-operation-id", error: null }),
    ),
  })),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe("QuotaManager", () => {
  let quotaManager: QuotaManager;

  beforeEach(() => {
    jest.clearAllMocks();
    quotaManager = new QuotaManager();
  });

  describe("getOperationCost", () => {
    it("should return correct cost for blueprint_generation", () => {
      const cost = quotaManager.getOperationCost("blueprint_generation");
      expect(cost).toBe(DEFAULT_OPERATION_COSTS.blueprint_generation);
    });

    it("should return correct cost for chat_edit", () => {
      const cost = quotaManager.getOperationCost("chat_edit");
      expect(cost).toBe(DEFAULT_OPERATION_COSTS.chat_edit);
    });

    it("should return correct cost for material_analysis", () => {
      const cost = quotaManager.getOperationCost("material_analysis");
      expect(cost).toBe(DEFAULT_OPERATION_COSTS.material_analysis);
    });

    it("should return default cost 1 for unknown operation", () => {
      // @ts-expect-error - Testing unknown operation
      const cost = quotaManager.getOperationCost("unknown");
      expect(cost).toBe(1);
    });
  });

  describe("MEMBERSHIP_QUOTA_LIMITS", () => {
    it("should have correct limits for free tier", () => {
      expect(MEMBERSHIP_QUOTA_LIMITS.free).toBe(100);
    });

    it("should have correct limits for pro tier", () => {
      expect(MEMBERSHIP_QUOTA_LIMITS.pro).toBe(1000);
    });

    it("should have unlimited for enterprise tier", () => {
      expect(MEMBERSHIP_QUOTA_LIMITS.enterprise).toBe(-1);
    });
  });

  describe("DEFAULT_OPERATION_COSTS", () => {
    it("should have blueprint_generation cost of 5", () => {
      expect(DEFAULT_OPERATION_COSTS.blueprint_generation).toBe(5);
    });

    it("should have chat_edit cost of 1", () => {
      expect(DEFAULT_OPERATION_COSTS.chat_edit).toBe(1);
    });

    it("should have material_analysis cost of 2", () => {
      expect(DEFAULT_OPERATION_COSTS.material_analysis).toBe(2);
    });
  });
});
