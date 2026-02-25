/**
 * AutoCreateEvaluatorService Unit Tests
 *
 * 覆盖：近期文件夹名称/语义相似度、拒建并返回 similarFolder
 * @see docs/文件夹创建优化方案0225.md 10.5
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { AutoCreateEvaluatorService } from "../auto-create-evaluator.service";

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("@/lib/classification/config/feature-flags", () => ({
  FEATURE_FLAGS: {
    enableAutoCreateEnhanced: true,
    highConfidenceThreshold: 80,
    mediumConfidenceThreshold: 60,
  },
}));

jest.mock("@/lib/utils/embedding-generator", () => ({
  generateEmbedding: jest.fn().mockResolvedValue(null),
}));

function createMockSupabase(folders: { id: number; name: string }[]) {
  let fromCallIndex = 0;
  const from = jest.fn().mockImplementation((table: string) => {
    if (table !== "folders" && table !== "folder_profiles") {
      return {};
    }
    if (table === "folder_profiles") {
      return {
        select: () => ({
          in: () => ({ not: () => Promise.resolve({ data: [], error: null }) }),
        }),
      };
    }
    fromCallIndex += 1;
    if (fromCallIndex === 1) {
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              eq: () => Promise.resolve({ data: folders, error: null }),
            }),
          }),
        }),
      };
    }
    if (fromCallIndex === 2) {
      return {
        select: () => ({
          eq: () => ({
            gte: () => ({
              lt: () => Promise.resolve({ count: 0, error: null }),
            }),
          }),
        }),
      };
    }
    if (fromCallIndex === 3) {
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              eq: () => ({
                gte: () => ({
                  order: () => Promise.resolve({ data: folders, error: null }),
                }),
              }),
            }),
          }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          is: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
        }),
      }),
    };
  });
  return { from } as unknown as SupabaseClient<Database>;
}

describe("AutoCreateEvaluatorService", () => {
  const userId = "user-123";

  it("recent folder name similarity >= 0.65 should reject create and return similarFolder", async () => {
    const folders = [{ id: 1, name: "一人公司" }];
    const supabase = createMockSupabase(folders);
    const evaluator = new AutoCreateEvaluatorService(supabase);
    const result = await evaluator.evaluate(userId, "一人公司经营", 85, [
      "OPC",
      "一人公司",
    ]);
    expect(result.shouldCreate).toBe(false);
    expect(result.similarFolder).toBeDefined();
    expect(result.similarFolder?.id).toBe(1);
    expect(result.similarFolder?.name).toBe("一人公司");
    expect((result.similarFolder?.similarity ?? 0) >= 0.65).toBe(true);
  });

  it("when no similar recent folder, should allow create", async () => {
    const folders = [{ id: 1, name: "前端开发" }];
    const supabase = createMockSupabase(folders);
    const evaluator = new AutoCreateEvaluatorService(supabase);
    const result = await evaluator.evaluate(userId, "一人公司", 85, ["OPC"]);
    expect(result.shouldCreate).toBe(true);
    expect(result.similarFolder).toBeUndefined();
  });

  it("high confidence and no folders should allow create", async () => {
    const supabase = createMockSupabase([]);
    const evaluator = new AutoCreateEvaluatorService(supabase);
    const result = await evaluator.evaluate(userId, "投资理财", 85, ["理财"]);
    expect(result.shouldCreate).toBe(true);
    expect(result.recommendedName).toBeDefined();
  });
});
