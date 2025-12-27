/**
 * IntentSkillRouter 测试
 *
 * @version 2.0.0
 * @since 2025-12-27
 */

import {
  IntentSkillRouter,
  createIntentSkillRouter,
  getDefaultRouter,
  resetDefaultRouter,
} from "../intent-skill-router";
import { resetMappingIndex } from "../../config";

describe("IntentSkillRouter", () => {
  let router: IntentSkillRouter;

  beforeEach(() => {
    resetMappingIndex();
    resetDefaultRouter();
    router = new IntentSkillRouter();
  });

  describe("route", () => {
    describe("学习类意图", () => {
      it("should route 复习 to knowledge_review", () => {
        const result = router.route("帮我复习一下收藏");

        expect(result.intentType).toBe("learn");
        expect(result.subType).toBe("review");
        expect(result.skillId).toBe("knowledge_review");
        expect(result.mode).toBe("orchestration");
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it("should route 回顾 to knowledge_review", () => {
        const result = router.route("回顾今天的内容");

        expect(result.intentType).toBe("learn");
        expect(result.subType).toBe("review");
        expect(result.skillId).toBe("knowledge_review");
      });

      it("should route 学习路径 to learning_path", () => {
        const result = router.route("给我制定一个学习路径");

        expect(result.intentType).toBe("learn");
        expect(result.subType).toBe("path");
        expect(result.skillId).toBe("learning_path");
        expect(result.mode).toBe("orchestration");
      });
    });

    describe("整理类意图", () => {
      it("should route 整理 to batch_organize", () => {
        const result = router.route("整理一下我的收藏");

        expect(result.intentType).toBe("organize");
        expect(result.subType).toBe("cleanup");
        expect(result.skillId).toBe("batch_organize");
        expect(result.mode).toBe("orchestration");
      });

      it("should route 去重 to duplicate_cleanup", () => {
        const result = router.route("清理重复的收藏");

        expect(result.intentType).toBe("organize");
        expect(result.subType).toBe("dedupe");
        expect(result.skillId).toBe("duplicate_cleanup");
      });

      it("should route 分类 to smart_tagging", () => {
        const result = router.route("帮我分类收藏");

        expect(result.intentType).toBe("organize");
        expect(result.subType).toBe("classify");
        expect(result.skillId).toBe("smart_tagging");
      });
    });

    describe("分析类意图", () => {
      it("should route 分析 to insight_report", () => {
        const result = router.route("分析一下我的收藏趋势");

        expect(result.intentType).toBe("analyze");
        expect(result.subType).toBe("insight");
        expect(result.skillId).toBe("insight_report");
        expect(result.mode).toBe("orchestration");
      });

      it("should route 周报 to periodic_report", () => {
        const result = router.route("生成本周报告");

        expect(result.intentType).toBe("analyze");
        expect(result.subType).toBe("report");
        expect(result.skillId).toBe("periodic_report");
      });
    });

    describe("创建类意图", () => {
      it("should route 摘要 to quick_digest", () => {
        const result = router.route("生成这些内容的摘要");

        expect(result.intentType).toBe("create");
        expect(result.subType).toBe("digest");
        expect(result.skillId).toBe("quick_digest");
      });

      it("should route 导出 to data_export", () => {
        const result = router.route("导出我的收藏");

        expect(result.intentType).toBe("create");
        expect(result.subType).toBe("export");
        expect(result.skillId).toBe("data_export");
      });
    });

    describe("查询类意图", () => {
      it("should route 搜索 to atomic search", () => {
        const result = router.route("搜索Python教程");

        expect(result.intentType).toBe("query");
        expect(result.subType).toBe("search");
        expect(result.skillId).toBe("search");
        expect(result.mode).toBe("atomic");
      });

      it("should route 找 to atomic search", () => {
        const result = router.route("找一下React教程");

        expect(result.intentType).toBe("query");
        expect(result.subType).toBe("search");
        expect(result.mode).toBe("atomic");
      });

      it("should route 列出 to atomic search", () => {
        const result = router.route("列出所有收藏");

        expect(result.intentType).toBe("query");
        expect(result.subType).toBe("list");
        expect(result.mode).toBe("atomic");
      });
    });

    describe("操作类意图", () => {
      it("should route 删除 to atomic delete", () => {
        const result = router.route("删除这条收藏");

        expect(result.intentType).toBe("action");
        expect(result.subType).toBe("delete");
        expect(result.mode).toBe("atomic");
      });

      it("should route 移动 to atomic move", () => {
        const result = router.route("移动到工作文件夹");

        expect(result.intentType).toBe("action");
        expect(result.subType).toBe("move");
        expect(result.mode).toBe("atomic");
      });
    });

    describe("未知意图", () => {
      it("should return chitchat for unknown input", () => {
        const result = router.route("今天天气怎么样");

        expect(result.intentType).toBe("chitchat");
        expect(result.confidence).toBeLessThan(0.5);
      });

      it("should handle empty input", () => {
        const result = router.route("");

        expect(result.intentType).toBe("chitchat");
        expect(result.subType).toBe("unknown");
      });
    });

    describe("置信度计算", () => {
      it("should have higher confidence for clear intents", () => {
        const clearResult = router.route("复习");
        const vagueResult = router.route("看看");

        expect(clearResult.confidence).toBeGreaterThan(vagueResult.confidence);
      });

      it("should have confidence between 0 and 1", () => {
        const inputs = ["复习收藏", "整理一下", "搜索Python", "随便聊聊"];

        for (const input of inputs) {
          const result = router.route(input);
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
        }
      });
    });

    describe("复杂度判断", () => {
      it("should mark learn:review as complex", () => {
        const result = router.route("复习一下");
        expect(result.complexity).toBe("complex");
      });

      it("should mark query:search as simple", () => {
        const result = router.route("搜索Python");
        expect(result.complexity).toBe("simple");
      });

      it("should mark organize:cleanup as complex", () => {
        const result = router.route("整理收藏");
        expect(result.complexity).toBe("complex");
      });
    });
  });

  describe("routeExplicit", () => {
    it("should return result for valid tool", () => {
      const result = router.routeExplicit("search");

      expect(result).not.toBeNull();
      expect(result?.skillId).toBe("search");
      expect(result?.mode).toBe("atomic");
      expect(result?.confidence).toBe(1.0);
      expect(result?.explicit).toBe(true);
    });

    it("should return null for unknown tool", () => {
      const result = router.routeExplicit("nonexistent");
      expect(result).toBeNull();
    });

    it("should return orchestration mode for complex tools", () => {
      const result = router.routeExplicit("organize");

      expect(result).not.toBeNull();
      expect(result?.skillId).toBe("batch_organize");
      expect(result?.mode).toBe("orchestration");
    });

    it("should skip intent classification", () => {
      const result = router.routeExplicit("review");

      expect(result).not.toBeNull();
      expect(result?.skillId).toBe("knowledge_review");
      expect(result?.reason).toBe("显式工具选择");
    });
  });

  describe("用户偏好", () => {
    it("should apply custom mapping", () => {
      router.updateUserPreferences({
        customMappings: {
          "learn:review": "custom_review_skill",
        },
      });

      const result = router.route("复习一下");
      expect(result.skillId).toBe("custom_review_skill");
    });

    it("should respect disabled skills", () => {
      router.updateUserPreferences({
        disabledSkills: ["knowledge_review"],
      });

      const result = router.route("复习一下");
      // 应该使用通配符映射或默认值
      expect(result.skillId).not.toBe("knowledge_review");
    });
  });

  describe("调试模式", () => {
    it("should include reason in result", () => {
      const result = router.route("复习收藏");
      expect(result.reason).toBeDefined();
      expect(result.reason.length).toBeGreaterThan(0);
    });

    it("should work with debug context", () => {
      const result = router.route("搜索Python", { debug: true });
      expect(result).toBeDefined();
    });
  });
});

describe("createIntentSkillRouter", () => {
  it("should create router with default config", () => {
    const router = createIntentSkillRouter();
    expect(router).toBeInstanceOf(IntentSkillRouter);
  });

  it("should create router with custom config", () => {
    const router = createIntentSkillRouter({
      minConfidenceThreshold: 0.6,
      debug: true,
    });

    const config = router.getConfig();
    expect(config.minConfidenceThreshold).toBe(0.6);
    expect(config.debug).toBe(true);
  });
});

describe("getDefaultRouter", () => {
  beforeEach(() => {
    resetDefaultRouter();
  });

  it("should return singleton instance", () => {
    const router1 = getDefaultRouter();
    const router2 = getDefaultRouter();
    expect(router1).toBe(router2);
  });

  it("should reset when resetDefaultRouter called", () => {
    const router1 = getDefaultRouter();
    resetDefaultRouter();
    const router2 = getDefaultRouter();
    expect(router1).not.toBe(router2);
  });
});

describe("性能", () => {
  let router: IntentSkillRouter;

  beforeEach(() => {
    router = new IntentSkillRouter();
  });

  it("should route quickly", () => {
    const inputs = [
      "复习一下",
      "整理收藏",
      "搜索Python",
      "分析趋势",
      "导出数据",
    ];

    const startTime = Date.now();
    for (let i = 0; i < 100; i++) {
      for (const input of inputs) {
        router.route(input);
      }
    }
    const duration = Date.now() - startTime;

    // 500 次路由应该在 100ms 内完成
    expect(duration).toBeLessThan(100);
  });
});
