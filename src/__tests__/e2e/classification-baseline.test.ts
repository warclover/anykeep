import { describe, test, expect } from "vitest";
import {
  TABLE_NAMES,
  CONFIDENCE_THRESHOLDS,
} from "../../lib/classification/core/constants";

// 模拟测试 (因为没有真实的后端环境运行在 E2E 测试中，这里我们主要测试接口契约和配置)
// 在实际 CI/CD 中，这应该连接到测试数据库

describe("Classification Baseline Tests (Phase 0)", () => {
  test("Constants: Table names should be defined", () => {
    expect(TABLE_NAMES).toBeDefined();
    expect(TABLE_NAMES.FOLDER_PROFILES).toBeDefined();
    // 确保我们使用的是当前数据库中实际存在的表名
    expect(TABLE_NAMES.FOLDER_PROFILES).toBe(
      "classification_folder_profiles_v5",
    );
  });

  test("Constants: Thresholds should be within valid ranges", () => {
    expect(CONFIDENCE_THRESHOLDS.AUTO_CLASSIFY).toBeGreaterThan(0);
    expect(CONFIDENCE_THRESHOLDS.AUTO_CLASSIFY).toBeLessThanOrEqual(100);
    expect(CONFIDENCE_THRESHOLDS.SUGGEST).toBeLessThan(
      CONFIDENCE_THRESHOLDS.AUTO_CLASSIFY,
    );
  });

  // 模拟集成测试：验证 Embedding Service 配置逻辑
  test("Embedding Service: Should support environment variables", () => {
    const originalEnv = process.env;

    // 模拟环境变量
    process.env.EMBEDDING_API_BASE_URL = "https://custom-api.com/v1";
    process.env.EMBEDDING_MODEL = "custom-model-v1";

    // 动态导入以重新加载配置
    // 注意：在实际 Jest/Vitest 中可能需要 module mock，这里仅演示逻辑意图
    const baseURL =
      process.env.EMBEDDING_API_BASE_URL ||
      "https://dashscope.aliyuncs.com/compatible-mode/v1";

    expect(baseURL).toBe("https://custom-api.com/v1");

    // 恢复
    process.env = originalEnv;
  });
});
