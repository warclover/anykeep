/**
 * ActiveRecallSkill 单元测试
 *
 * 测试 Brain-Sync 主动复习功能
 *
 * @version 1.0.0
 * @since 2026-01-01
 */

import { ActiveRecallSkill, activeRecallSkill } from "../active-recall.skill";
import type { OrchestrationContext } from "../../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../../output/types";

// Mock 数据
const mockBookmark = {
  id: 1,
  title: "React 入门教程",
  summary: "React 是一个用于构建用户界面的 JavaScript 库",
  content:
    "React 是一个声明式、高效且灵活的用于构建用户界面的 JavaScript 库。" +
    "它让你可以使用称为「组件」的小而独立的代码片段来构建复杂的 UI。" +
    "React 拥有大量的生态系统支持，包括 React Router、Redux 等。",
};

const mockFlashcards = [
  {
    question: "React 的核心特点是什么？",
    answer: "声明式、高效且灵活",
    sourceParagraph:
      "React 是一个声明式、高效且灵活的用于构建用户界面的 JavaScript 库。",
  },
];

const mockPendingCards = [
  {
    flashcard_id: 1,
    bookmark_id: 1,
    bookmark_title: "React 入门教程",
    bookmark_url: "https://example.com/react",
    question: "React 的核心特点是什么？",
    answer: "声明式、高效且灵活",
    source_paragraph: null,
    status: "learning",
    ease_factor: 2.5,
    interval_days: 1,
    repetitions: 0,
    next_review_at: new Date().toISOString(),
  },
];

const mockReviewStats = {
  total_flashcards: 10,
  mastered_count: 3,
  learning_count: 5,
  pending_count: 2,
  sessions_in_period: 15,
  mastered_sessions: 5,
  fuzzy_sessions: 7,
  forgotten_sessions: 3,
  avg_response_time_ms: 5000,
  streak_days: 3,
};

const mockPreferences = {
  enabled: true,
  preferred_day: "monday",
  preferred_time: "09:00",
  weekly_limit: 20,
  notification_channel: "sidebar",
};

// Mock 结果存储
let mockBookmarkResult: { data: unknown; error: unknown } = {
  data: mockBookmark,
  error: null,
};
let mockPendingCardsResult: { data: unknown; error: unknown } = {
  data: mockPendingCards,
  error: null,
};
let mockStatsResult: { data: unknown; error: unknown } = {
  data: mockReviewStats,
  error: null,
};
let mockPrefsResult: { data: unknown; error: unknown } = {
  data: mockPreferences,
  error: null,
};
const mockBatchCreateResult: { data: unknown; error: unknown } = {
  data: { inserted_count: 3 },
  error: null,
};
const mockUpdateReviewResult: { data: unknown; error: unknown } = {
  data: { new_interval: 3 },
  error: null,
};

// Mock Supabase client
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              is: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve(mockBookmarkResult)),
              })),
            })),
          })),
        })),
      })),
      rpc: jest.fn((funcName: string) => {
        if (funcName === "batch_create_flashcards") {
          return Promise.resolve(mockBatchCreateResult);
        }
        if (funcName === "get_pending_flashcards") {
          return Promise.resolve(mockPendingCardsResult);
        }
        if (funcName === "update_flashcard_review") {
          return Promise.resolve(mockUpdateReviewResult);
        }
        if (funcName === "get_review_stats") {
          return Promise.resolve(mockStatsResult);
        }
        if (funcName === "get_or_create_review_preferences") {
          return Promise.resolve(mockPrefsResult);
        }
        return Promise.resolve({ data: null, error: null });
      }),
    }),
  ),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock generateFlashcards
jest.mock("../../../shared/review", () => ({
  generateFlashcards: jest.fn(() =>
    Promise.resolve({
      success: true,
      flashcards: mockFlashcards,
    }),
  ),
  filterValidFlashcards: jest.fn((cards) => cards),
  calculatePriority: jest.fn(() => 50),
  sortByPriority: jest.fn((items) => items),
  calculateQueueStats: jest.fn(() => ({
    total: 1,
    overdue: 0,
    dueToday: 1,
    avgPriority: 50,
  })),
}));

describe("ActiveRecallSkill", () => {
  let skill: ActiveRecallSkill;

  beforeEach(() => {
    skill = new ActiveRecallSkill();
    // Reset mocks
    mockBookmarkResult = { data: mockBookmark, error: null };
    mockPendingCardsResult = { data: mockPendingCards, error: null };
    mockStatsResult = { data: mockReviewStats, error: null };
    mockPrefsResult = { data: mockPreferences, error: null };
    jest.clearAllMocks();
  });

  // 辅助函数：收集所有流式输出
  async function collectChunks(
    generator: AsyncGenerator<OrchestrationStreamChunk>,
  ): Promise<OrchestrationStreamChunk[]> {
    const chunks: OrchestrationStreamChunk[] = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }
    return chunks;
  }

  describe("metadata", () => {
    it("should have correct skill ID", () => {
      expect(skill.metadata.id).toBe("active_recall");
    });

    it("should have correct category", () => {
      expect(skill.metadata.category).toBe("understanding");
    });

    it("should have expected capabilities", () => {
      expect(skill.metadata.capabilities).toContain("flashcard-generation");
      expect(skill.metadata.capabilities).toContain("sm2-scheduling");
      expect(skill.metadata.capabilities).toContain("spaced-repetition");
    });

    it("should have version 1.0.0", () => {
      expect(skill.metadata.version).toBe("1.0.0");
    });
  });

  describe("parseInput", () => {
    const mockContext: OrchestrationContext = {
      userId: "test-user",
      originalMessage: "",
      params: {},
    };

    it("should parse generate action from message", async () => {
      const result = await skill.parseInput("帮我生成复习卡片", mockContext);
      expect(result.action).toBe("generate");
    });

    it("should parse stats action from message", async () => {
      const result = await skill.parseInput("查看我的复习统计", mockContext);
      expect(result.action).toBe("stats");
    });

    it("should parse preferences action from message", async () => {
      const result = await skill.parseInput("设置复习偏好", mockContext);
      expect(result.action).toBe("preferences");
    });

    it("should default to review action", async () => {
      const result = await skill.parseInput("开始复习", mockContext);
      expect(result.action).toBe("review");
    });

    it("should parse difficulty from message", async () => {
      const easyResult = await skill.parseInput("生成简单的卡片", mockContext);
      expect(easyResult.difficulty).toBe("easy");

      const hardResult = await skill.parseInput("生成困难的卡片", mockContext);
      expect(hardResult.difficulty).toBe("hard");
    });

    it("should parse count from message", async () => {
      const result = await skill.parseInput("生成5个卡片", mockContext);
      expect(result.count).toBe(5);
    });

    it("should limit count to 10", async () => {
      const result = await skill.parseInput("生成20个卡片", mockContext);
      expect(result.count).toBe(10);
    });

    it("should parse time range from message", async () => {
      const monthResult = await skill.parseInput("查看本月统计", mockContext);
      expect(monthResult.timeRange).toBe("month");

      const allResult = await skill.parseInput("查看全部统计", mockContext);
      expect(allResult.timeRange).toBe("all");
    });
  });

  describe("executeStream - review action", () => {
    it("should emit progress and text chunks", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "开始复习",
        params: { action: "review" },
      };

      const chunks = await collectChunks(skill.executeStream(context));

      // Should have progress chunks
      const progressChunks = chunks.filter((c) => c.type === "progress");
      expect(progressChunks.length).toBeGreaterThan(0);

      // Should have text chunks
      const textChunks = chunks.filter((c) => c.type === "text");
      expect(textChunks.length).toBeGreaterThan(0);
    });

    it("should show empty queue message when no cards", async () => {
      mockPendingCardsResult = { data: [], error: null };

      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "开始复习",
        params: { action: "review" },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const textContent = chunks
        .filter((c) => c.type === "text")
        .map((c) => c.data.text)
        .join("");

      expect(textContent).toContain("太棒了");
      expect(textContent).toContain("没有待复习的卡片");
    });

    it("should display current card and options", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "开始复习",
        params: { action: "review" },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const textContent = chunks
        .filter((c) => c.type === "text")
        .map((c) => c.data.text)
        .join("");

      expect(textContent).toContain("当前卡片");
      expect(textContent).toContain("掌握");
      expect(textContent).toContain("模糊");
      expect(textContent).toContain("遗忘");
    });

    it("should emit deliverable with queue data", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "开始复习",
        params: { action: "review" },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const deliverableChunks = chunks.filter((c) => c.type === "deliverable");

      expect(deliverableChunks.length).toBe(1);
      expect(deliverableChunks[0].data.content).toHaveProperty("currentCard");
      expect(deliverableChunks[0].data.content).toHaveProperty("stats");
    });
  });

  describe("executeStream - stats action", () => {
    it("should display mastery statistics", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "查看统计",
        params: { action: "stats", timeRange: "week" },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const textContent = chunks
        .filter((c) => c.type === "text")
        .map((c) => c.data.text)
        .join("");

      expect(textContent).toContain("学习统计");
      expect(textContent).toContain("已掌握");
      expect(textContent).toContain("学习中");
      expect(textContent).toContain("待学习");
    });

    it("should display streak information", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "查看统计",
        params: { action: "stats", timeRange: "week" },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const textContent = chunks
        .filter((c) => c.type === "text")
        .map((c) => c.data.text)
        .join("");

      expect(textContent).toContain("连续复习");
      expect(textContent).toContain("3");
    });

    it("should handle stats error gracefully", async () => {
      mockStatsResult = { data: null, error: { message: "Database error" } };

      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "查看统计",
        params: { action: "stats" },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const textContent = chunks
        .filter((c) => c.type === "text")
        .map((c) => c.data.text)
        .join("");

      expect(textContent).toContain("获取统计失败");
    });
  });

  describe("executeStream - preferences action", () => {
    it("should display current preferences", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "查看复习设置",
        params: { action: "preferences" },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const textContent = chunks
        .filter((c) => c.type === "text")
        .map((c) => c.data.text)
        .join("");

      expect(textContent).toContain("复习偏好设置");
      expect(textContent).toContain("已开启");
      expect(textContent).toContain("周一");
      expect(textContent).toContain("20");
    });

    it("should handle preferences error gracefully", async () => {
      mockPrefsResult = { data: null, error: { message: "Database error" } };

      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "查看复习设置",
        params: { action: "preferences" },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const textContent = chunks
        .filter((c) => c.type === "text")
        .map((c) => c.data.text)
        .join("");

      expect(textContent).toContain("获取设置失败");
    });
  });

  describe("executeStream - generate action", () => {
    it("should require bookmarkId for generate action", async () => {
      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "生成卡片",
        params: { action: "generate" },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const textContent = chunks
        .filter((c) => c.type === "text")
        .map((c) => c.data.text)
        .join("");

      expect(textContent).toContain("请提供要生成卡片的书签 ID");
    });

    it("should handle bookmark not found", async () => {
      mockBookmarkResult = { data: null, error: { message: "Not found" } };

      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "生成卡片",
        params: { action: "generate", bookmarkId: 999 },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const textContent = chunks
        .filter((c) => c.type === "text")
        .map((c) => c.data.text)
        .join("");

      expect(textContent).toContain("未找到该书签");
    });

    it("should handle insufficient content", async () => {
      mockBookmarkResult = {
        data: { ...mockBookmark, content: "短" },
        error: null,
      };

      const context: OrchestrationContext = {
        userId: "test-user",
        originalMessage: "生成卡片",
        params: { action: "generate", bookmarkId: 1 },
      };

      const chunks = await collectChunks(skill.executeStream(context));
      const textContent = chunks
        .filter((c) => c.type === "text")
        .map((c) => c.data.text)
        .join("");

      expect(textContent).toContain("内容不足");
    });
  });

  describe("singleton export", () => {
    it("should export activeRecallSkill instance", () => {
      expect(activeRecallSkill).toBeInstanceOf(ActiveRecallSkill);
    });

    it("should have same metadata as new instance", () => {
      expect(activeRecallSkill.metadata.id).toBe(skill.metadata.id);
    });
  });
});
