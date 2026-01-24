/**
 * 智能分类 v5.0 - VectorSearch Service 测试
 */

import { VectorSearchService } from "./vector-search.service";
import { VectorSearchError } from "./types";
import type { LoggerService } from "../logger";
import type { VectorSearchRequest } from "./types";

// Mock Supabase Client
const mockSupabaseClient = {
  rpc: jest.fn(),
};

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

describe("VectorSearchService", () => {
  let service: VectorSearchService;
  const testUserId = "test-user-123";
  const testEmbedding = new Array(1024).fill(0.1);

  beforeEach(() => {
    jest.clearAllMocks();

    // 设置环境变量
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

    service = new VectorSearchService(mockLogger);
  });

  describe("构造函数", () => {
    it("应该成功创建实例", () => {
      expect(service).toBeInstanceOf(VectorSearchService);
      expect(mockLogger.child).toHaveBeenCalledWith({
        service: "VectorSearchService",
      });
    });

    it("缺少 Supabase URL 时应该抛出错误", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      expect(() => new VectorSearchService(mockLogger)).toThrow(
        "Supabase URL and Service Role Key are required",
      );
    });

    it("缺少 Service Role Key 时应该抛出错误", () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(() => new VectorSearchService(mockLogger)).toThrow(
        "Supabase URL and Service Role Key are required",
      );
    });

    it("应该接受自定义配置", () => {
      const customConfig = {
        defaultLimit: 10,
        minSimilarity: 0.8,
        maxRetries: 5,
      };

      const customService = new VectorSearchService(mockLogger, customConfig);
      expect(customService).toBeInstanceOf(VectorSearchService);
    });
  });

  describe("内容向量搜索", () => {
    it("应该成功执行内容搜索", async () => {
      const mockResults = [
        {
          profile_id: "profile-1",
          folder_id: "folder-1",
          folder_name: "Test Folder 1",
          similarity: 0.95,
        },
        {
          profile_id: "profile-2",
          folder_id: "folder-2",
          folder_name: "Test Folder 2",
          similarity: 0.85,
        },
      ];

      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: mockResults,
        error: null,
      });

      const request: VectorSearchRequest = {
        userId: testUserId,
        contentEmbedding: testEmbedding,
      };

      const results = await service.search(request);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        profileId: "profile-1",
        folderId: "folder-1",
        folderName: "Test Folder 1",
        similarity: 0.95,
        matchType: "content",
      });
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "match_folder_profiles_v5",
        {
          p_user_id: testUserId,
          p_content_embedding: testEmbedding,
          p_behavior_embedding: null,
          p_alpha: 0,
          p_match_threshold: 0.5,
          p_match_count: 5,
        },
      );
    });

    it("搜索失败时应该抛出错误", async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Database error" },
      });

      const request: VectorSearchRequest = {
        userId: testUserId,
        contentEmbedding: testEmbedding,
      };

      await expect(service.search(request)).rejects.toThrow(VectorSearchError);
    });
  });

  describe("行为向量搜索", () => {
    it("应该成功执行行为搜索", async () => {
      const mockResults = [
        {
          profile_id: "profile-3",
          folder_id: "folder-3",
          folder_name: "Behavior Folder",
          similarity: 0.88,
        },
      ];

      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: mockResults,
        error: null,
      });

      const request: VectorSearchRequest = {
        userId: testUserId,
        behaviorEmbedding: testEmbedding,
      };

      const results = await service.search(request);

      expect(results).toHaveLength(1);
      expect(results[0].matchType).toBe("behavior");
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "match_folder_profiles_v5",
        {
          p_user_id: testUserId,
          p_content_embedding: null,
          p_behavior_embedding: testEmbedding,
          p_alpha: 1,
          p_match_threshold: 0.5,
          p_match_count: 5,
        },
      );
    });
  });

  describe("混合向量搜索", () => {
    it("应该成功执行混合搜索（默认 alpha=0.5）", async () => {
      const mockResults = [
        {
          profile_id: "profile-4",
          folder_id: "folder-4",
          folder_name: "Hybrid Folder",
          similarity: 0.92,
        },
      ];

      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: mockResults,
        error: null,
      });

      const request: VectorSearchRequest = {
        userId: testUserId,
        contentEmbedding: testEmbedding,
        behaviorEmbedding: testEmbedding,
      };

      const results = await service.search(request);

      expect(results).toHaveLength(1);
      expect(results[0].matchType).toBe("hybrid");
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "match_folder_profiles_v5",
        {
          p_user_id: testUserId,
          p_content_embedding: testEmbedding,
          p_behavior_embedding: testEmbedding,
          p_alpha: 0.5,
          p_match_threshold: 0.5,
          p_match_count: 5,
        },
      );
    });

    it("应该支持自定义 alpha 系数", async () => {
      mockSupabaseClient.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const request: VectorSearchRequest = {
        userId: testUserId,
        contentEmbedding: testEmbedding,
        behaviorEmbedding: testEmbedding,
        alpha: 0.7,
      };

      await service.search(request);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "match_folder_profiles_v5",
        expect.objectContaining({
          p_alpha: 0.7,
        }),
      );
    });
  });

  describe("请求验证", () => {
    it("缺少 userId 时应该抛出错误", async () => {
      const request: VectorSearchRequest = {
        userId: "",
        contentEmbedding: testEmbedding,
      };

      await expect(service.search(request)).rejects.toThrow(
        "User ID is required",
      );
    });

    it("缺少向量时应该抛出错误", async () => {
      const request: VectorSearchRequest = {
        userId: testUserId,
      };

      await expect(service.search(request)).rejects.toThrow(
        "At least one embedding (content or behavior) is required",
      );
    });

    it("内容向量维度错误时应该抛出错误", async () => {
      const request: VectorSearchRequest = {
        userId: testUserId,
        contentEmbedding: [0.1, 0.2], // 错误的维度
      };

      await expect(service.search(request)).rejects.toThrow(
        "Content embedding must be 1024 dimensions",
      );
    });

    it("行为向量维度错误时应该抛出错误", async () => {
      const request: VectorSearchRequest = {
        userId: testUserId,
        behaviorEmbedding: [0.1, 0.2], // 错误的维度
      };

      await expect(service.search(request)).rejects.toThrow(
        "Behavior embedding must be 1024 dimensions",
      );
    });

    it("alpha 系数超出范围时应该抛出错误", async () => {
      const request: VectorSearchRequest = {
        userId: testUserId,
        contentEmbedding: testEmbedding,
        alpha: 1.5, // 超出 [0, 1] 范围
      };

      await expect(service.search(request)).rejects.toThrow(
        "Alpha coefficient must be between 0 and 1",
      );
    });

    it("limit 为负数时应该抛出错误", async () => {
      const request: VectorSearchRequest = {
        userId: testUserId,
        contentEmbedding: testEmbedding,
        limit: -1,
      };

      await expect(service.search(request)).rejects.toThrow(
        "Limit must be greater than 0",
      );
    });

    it("minSimilarity 超出范围时应该抛出错误", async () => {
      const request: VectorSearchRequest = {
        userId: testUserId,
        contentEmbedding: testEmbedding,
        minSimilarity: 1.5,
      };

      await expect(service.search(request)).rejects.toThrow(
        "Min similarity must be between 0 and 1",
      );
    });
  });

  describe("重试机制", () => {
    it("应该在失败时自动重试", async () => {
      // 前两次失败，第三次成功
      mockSupabaseClient.rpc
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          data: [],
          error: null,
        });

      const request: VectorSearchRequest = {
        userId: testUserId,
        contentEmbedding: testEmbedding,
      };

      const results = await service.search(request);

      expect(results).toEqual([]);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });

    it("达到最大重试次数后应该抛出错误", async () => {
      mockSupabaseClient.rpc.mockRejectedValue(new Error("Persistent error"));

      const request: VectorSearchRequest = {
        userId: testUserId,
        contentEmbedding: testEmbedding,
      };

      await expect(service.search(request)).rejects.toThrow("Persistent error");
      expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(3); // maxRetries = 3
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
