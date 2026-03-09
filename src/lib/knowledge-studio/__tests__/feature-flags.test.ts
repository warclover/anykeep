/**
 * Knowledge Studio Feature Flag 集成测试
 *
 * 测试 Knowledge Studio 功能开关的正确行为:
 * - Pro 功能门控
 * - 蓝图类型可用性
 * - 功能开关与 UI 行为
 *
 * @module tests/knowledge-studio/feature-flags
 * @version 1.0.0
 * @since 2025-01-02
 */

// Jest provides describe, it, expect as globals
import {
  PRO_FEATURES,
  FREE_BLUEPRINTS,
  PRO_BLUEPRINTS,
  MATERIAL_LIMITS,
  GENERATION_LIMITS,
} from "../constants";

// ============================================================================
// 常量配置测试
// ============================================================================

describe("Knowledge Studio Constants", () => {
  describe("PRO_FEATURES", () => {
    it("应该定义所有 Pro 功能标识", () => {
      expect(PRO_FEATURES.BLUEPRINT_BLOGGER).toBe("blueprint_blogger");
      expect(PRO_FEATURES.BLUEPRINT_THREAD).toBe("blueprint_thread");
      expect(PRO_FEATURES.BLUEPRINT_TUTORIAL).toBe("blueprint_tutorial");
      expect(PRO_FEATURES.BLUEPRINT_FEYNMAN).toBe("blueprint_feynman");
      expect(PRO_FEATURES.CHAT_TO_EDIT).toBe("chat_to_edit");
      expect(PRO_FEATURES.CITATION_HOVER_LINK).toBe("citation_hover_link");
      expect(PRO_FEATURES.OBSIDIAN_EXPORT).toBe("obsidian_export");
      expect(PRO_FEATURES.UNLIMITED_SYNTHESIS).toBe("unlimited_synthesis");
    });
  });

  describe("Blueprint Availability", () => {
    it("免费用户只能使用 debater 蓝图", () => {
      expect(FREE_BLUEPRINTS).toContain("debater");
      expect(FREE_BLUEPRINTS).toHaveLength(1);
    });

    it("Pro 用户可以使用所有高级蓝图", () => {
      expect(PRO_BLUEPRINTS).toContain("blogger");
      expect(PRO_BLUEPRINTS).toContain("thread");
      expect(PRO_BLUEPRINTS).toContain("tutorial");
      expect(PRO_BLUEPRINTS).toContain("feynman");
      expect(PRO_BLUEPRINTS).toHaveLength(4);
    });

    it("Pro 蓝图与免费蓝图不重叠", () => {
      const proBlueprintsSet = new Set(PRO_BLUEPRINTS);
      for (const freeBlueprint of FREE_BLUEPRINTS) {
        expect(
          proBlueprintsSet.has(
            freeBlueprint as (typeof PRO_BLUEPRINTS)[number],
          ),
        ).toBe(false);
      }
    });
  });

  describe("MATERIAL_LIMITS", () => {
    it("应该定义正确的素材数量限制", () => {
      expect(MATERIAL_LIMITS.FREE_MAX_BOOKMARKS).toBe(5);
      expect(MATERIAL_LIMITS.PRO_MAX_BOOKMARKS).toBe(200);
      expect(MATERIAL_LIMITS.MIN_BOOKMARKS).toBe(1);
    });

    it("Pro 限制应该大于免费限制", () => {
      expect(MATERIAL_LIMITS.PRO_MAX_BOOKMARKS).toBeGreaterThan(
        MATERIAL_LIMITS.FREE_MAX_BOOKMARKS,
      );
    });
  });

  describe("GENERATION_LIMITS", () => {
    it("应该定义正确的生成次数限制", () => {
      expect(GENERATION_LIMITS.FREE_MONTHLY_GENERATIONS).toBe(3);
      expect(GENERATION_LIMITS.PRO_MONTHLY_CHAT_EDITS).toBe(50);
      expect(GENERATION_LIMITS.OVERAGE_PRICE_PER_EDIT).toBe(0.5);
    });
  });
});

// ============================================================================
// 功能门控逻辑测试
// ============================================================================

describe("Feature Gating Logic", () => {
  describe("Blueprint Access Control", () => {
    type UserType = "free" | "pro";
    type BlueprintType =
      | "debater"
      | "blogger"
      | "thread"
      | "tutorial"
      | "feynman";

    function canAccessBlueprint(
      userType: UserType,
      blueprint: BlueprintType,
    ): boolean {
      if (userType === "pro") return true;
      return (FREE_BLUEPRINTS as readonly string[]).includes(blueprint);
    }

    it("免费用户可以访问 debater", () => {
      expect(canAccessBlueprint("free", "debater")).toBe(true);
    });

    it("免费用户不能访问 Pro 蓝图", () => {
      expect(canAccessBlueprint("free", "blogger")).toBe(false);
      expect(canAccessBlueprint("free", "thread")).toBe(false);
      expect(canAccessBlueprint("free", "tutorial")).toBe(false);
      expect(canAccessBlueprint("free", "feynman")).toBe(false);
    });

    it("Pro 用户可以访问所有蓝图", () => {
      expect(canAccessBlueprint("pro", "debater")).toBe(true);
      expect(canAccessBlueprint("pro", "blogger")).toBe(true);
      expect(canAccessBlueprint("pro", "thread")).toBe(true);
      expect(canAccessBlueprint("pro", "tutorial")).toBe(true);
      expect(canAccessBlueprint("pro", "feynman")).toBe(true);
    });
  });

  describe("Material Limit Enforcement", () => {
    type UserType = "free" | "pro";

    function getMaterialLimit(userType: UserType): number {
      return userType === "pro"
        ? MATERIAL_LIMITS.PRO_MAX_BOOKMARKS
        : MATERIAL_LIMITS.FREE_MAX_BOOKMARKS;
    }

    function canAddMoreMaterials(
      userType: UserType,
      currentCount: number,
    ): boolean {
      return currentCount < getMaterialLimit(userType);
    }

    it("免费用户可以添加最多 5 个素材", () => {
      expect(canAddMoreMaterials("free", 0)).toBe(true);
      expect(canAddMoreMaterials("free", 4)).toBe(true);
      expect(canAddMoreMaterials("free", 5)).toBe(false);
      expect(canAddMoreMaterials("free", 10)).toBe(false);
    });

    it("Pro 用户可以添加最多 200 个素材", () => {
      expect(canAddMoreMaterials("pro", 0)).toBe(true);
      expect(canAddMoreMaterials("pro", 199)).toBe(true);
      expect(canAddMoreMaterials("pro", 200)).toBe(false);
    });
  });

  describe("Generation Quota Enforcement", () => {
    type UserType = "free" | "pro";

    interface QuotaState {
      used: number;
      limit: number;
    }

    function getMonthlyQuota(userType: UserType): QuotaState {
      return {
        used: 0,
        limit:
          userType === "pro"
            ? Infinity // Pro 用户无限生成（或使用很高的数字）
            : GENERATION_LIMITS.FREE_MONTHLY_GENERATIONS,
      };
    }

    function canGenerate(quota: QuotaState): boolean {
      return quota.used < quota.limit;
    }

    it("免费用户每月限制 3 次生成", () => {
      const freeQuota = getMonthlyQuota("free");
      expect(freeQuota.limit).toBe(3);
      expect(canGenerate({ ...freeQuota, used: 0 })).toBe(true);
      expect(canGenerate({ ...freeQuota, used: 2 })).toBe(true);
      expect(canGenerate({ ...freeQuota, used: 3 })).toBe(false);
    });

    it("Pro 用户没有生成次数限制", () => {
      const proQuota = getMonthlyQuota("pro");
      expect(proQuota.limit).toBe(Infinity);
      expect(canGenerate({ ...proQuota, used: 100 })).toBe(true);
    });
  });
});

// ============================================================================
// Pro 功能检查测试
// ============================================================================

describe("Pro Feature Checks", () => {
  interface UserProfile {
    membershipType: "free" | "pro";
  }

  function hasProFeature(
    user: UserProfile,
    _feature: keyof typeof PRO_FEATURES,
  ): boolean {
    return user.membershipType === "pro";
  }

  describe("Chat-to-Edit 功能", () => {
    it("免费用户不能使用 Chat-to-Edit", () => {
      const freeUser: UserProfile = { membershipType: "free" };
      expect(hasProFeature(freeUser, "CHAT_TO_EDIT")).toBe(false);
    });

    it("Pro 用户可以使用 Chat-to-Edit", () => {
      const proUser: UserProfile = { membershipType: "pro" };
      expect(hasProFeature(proUser, "CHAT_TO_EDIT")).toBe(true);
    });
  });

  describe("Obsidian 导出功能", () => {
    it("免费用户不能使用 Obsidian 导出", () => {
      const freeUser: UserProfile = { membershipType: "free" };
      expect(hasProFeature(freeUser, "OBSIDIAN_EXPORT")).toBe(false);
    });

    it("Pro 用户可以使用 Obsidian 导出", () => {
      const proUser: UserProfile = { membershipType: "pro" };
      expect(hasProFeature(proUser, "OBSIDIAN_EXPORT")).toBe(true);
    });
  });
});

// ============================================================================
// 边界条件测试
// ============================================================================

describe("Edge Cases", () => {
  describe("Material Count Edge Cases", () => {
    it("最小素材数验证", () => {
      expect(MATERIAL_LIMITS.MIN_BOOKMARKS).toBeGreaterThanOrEqual(1);
    });

    it("素材数量不能为负数", () => {
      function validateMaterialCount(count: number): boolean {
        return count >= MATERIAL_LIMITS.MIN_BOOKMARKS;
      }

      expect(validateMaterialCount(-1)).toBe(false);
      expect(validateMaterialCount(0)).toBe(false);
      expect(validateMaterialCount(1)).toBe(true);
    });
  });

  describe("Quota Calculation Edge Cases", () => {
    it("超额计费计算正确", () => {
      const overageCount = 10;
      const expectedCost =
        overageCount * GENERATION_LIMITS.OVERAGE_PRICE_PER_EDIT;
      expect(expectedCost).toBe(5.0);
    });

    it("零超额不产生费用", () => {
      const overageCount = 0;
      const cost = overageCount * GENERATION_LIMITS.OVERAGE_PRICE_PER_EDIT;
      expect(cost).toBe(0);
    });
  });
});
