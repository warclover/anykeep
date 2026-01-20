/**
 * 智能分类 v5.0 - FolderProfiler Service 测试
 */

import { FolderProfilerService } from "./folder-profiler.service";
import type { LoggerService } from "../shared/logger";
import type { IEmbeddingService } from "../shared/embedding";
import type { FolderStats } from "./types";
import type { BookmarkData, BehaviorData } from "./dual-source-builder";

// Mock Logger
const mockLogger: LoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => mockLogger),
} as any;

// Mock Supabase - 使用持久化的链式对象以支持正确的 mock 设置
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  upsert: jest.fn().mockReturnThis(),
};

const mockSupabase = {
  from: jest.fn(() => mockQueryBuilder),
} as any;

// Mock Embedding Service - 返回 { embedding: [...] } 格式
const mockEmbeddingService: IEmbeddingService = {
  generateEmbedding: jest.fn().mockResolvedValue({
    embedding: new Array(1024).fill(0.1),
  }),
} as any;

describe("FolderProfilerService", () => {
  let service: FolderProfilerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FolderProfilerService(
      mockLogger,
      mockSupabase,
      mockEmbeddingService,
    );
  });

  const mockBookmarks: BookmarkData[] = [
    {
      id: "1",
      title: "Test Bookmark 1",
      description: "Description 1",
      summary: "Summary 1",
      tags: ["tag1"],
    },
  ];

  const mockBehaviors: BehaviorData[] = [
    {
      bookmarkId: "1",
      actionType: "view",
      timestamp: new Date(),
      weight: 1,
    },
  ];

  const mockStats: FolderStats = {
    folderId: "folder-1",
    lastUsed: new Date(),
    behaviorCount: 10,
    contentCount: 20,
    contentDiversity: 0.5,
    recentActivity: 0.8,
  };

  describe("getProfile", () => {
    it("应该成功获取文件夹画像", async () => {
      const mockData = {
        id: "profile-1",
        user_id: "user-1",
        folder_id: "folder-1",
        content_embedding: new Array(1024).fill(0.1),
        behavior_embedding: new Array(1024).fill(0.2),
        alpha_coefficient: 0.5,
        last_updated_at: new Date().toISOString(),
        bookmark_count: 10,
        needs_update: false,
        avg_classification_score: 0.9,
        total_classifications: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      const profile = await service.getProfile("user-1", "folder-1");

      expect(profile).toBeDefined();
      expect(profile?.folderId).toBe("folder-1");
      expect(mockSupabase.from).toHaveBeenCalledWith(
        "classification_folder_profiles_v5",
      );
    });

    it("画像不存在时应该返回 null", async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });

      const profile = await service.getProfile("user-1", "folder-1");

      expect(profile).toBeNull();
    });
  });

  describe("upsertProfile", () => {
    it("应该成功创建/更新文件夹画像", async () => {
      const mockData = {
        id: "profile-1",
        user_id: "user-1",
        folder_id: "folder-1",
        content_embedding: new Array(1024).fill(0.1),
        behavior_embedding: new Array(1024).fill(0.1),
        alpha_coefficient: 0.5,
        last_updated_at: new Date().toISOString(),
        bookmark_count: 1,
        needs_update: false,
        total_classifications: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      const profile = await service.upsertProfile(
        "user-1",
        "folder-1",
        "Test Folder",
        "Test folder description",
        mockBookmarks,
        mockBehaviors,
        mockStats,
      );

      expect(profile).toBeDefined();
      expect(profile.folderId).toBe("folder-1");
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
    });
  });

  describe("checkNeedsUpdate", () => {
    it("画像不存在时应该返回 true", async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });

      const needsUpdate = await service.checkNeedsUpdate(
        "user-1",
        "folder-1",
        10,
      );

      expect(needsUpdate).toBe(true);
    });
  });
});
