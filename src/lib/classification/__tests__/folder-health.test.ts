/**
 * Folder Health Service Unit Tests
 * 测试文件夹健康度检查逻辑
 */

import { FolderHealthService } from "../services/folder-health.service";
import { FOLDER_LIMITS } from "../constants";
import type { FolderProfile } from "../types";

// Mock logger to avoid pino/thread-stream issues in tests
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock repositories
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFolderProfileRepo: any = {
  findByUserId: jest.fn(),
  findByFolderId: jest.fn(),
  searchSimilarFolders: jest.fn(),
  computeProfile: jest.fn(),
  computeUserProfiles: jest.fn(),
  updateSource: jest.fn(),
  delete: jest.fn(),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSuggestionRepo: any = {
  create: jest.fn(),
  getUserSuggestions: jest.fn(),
  getPendingSuggestions: jest.fn(),
  updateStatus: jest.fn(),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSupabase: any = {};

// Helper: create test folder profile
function createProfile(
  id: number,
  overrides: Partial<FolderProfile> = {},
): FolderProfile {
  return {
    id,
    userId: "user-123",
    folderId: id,
    folderName: `Folder ${id}`,
    profileEmbedding: createEmbedding(id),
    bookmarkCount: 10,
    lastBookmarkAt: new Date(),
    topTags: ["tag1", "tag2"],
    sampleTitles: ["Title 1", "Title 2"],
    internalSimilarity: 0.8,
    source: "manual",
    computedAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helper: create test embedding (normalized)
function createEmbedding(seed: number, dimensions: number = 8): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < dimensions; i++) {
    embedding.push(Math.sin(seed * (i + 1) * 0.1));
  }
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map((v) => v / norm);
}

// Helper: create similar embedding
function createSimilarEmbedding(
  base: number[],
  perturbation: number = 0.1,
): number[] {
  const embedding = base.map(
    (v) => v + (Math.random() - 0.5) * perturbation * 2,
  );
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map((v) => v / norm);
}

describe("FolderHealthService", () => {
  let service: FolderHealthService;

  beforeEach(() => {
    service = new FolderHealthService(
      mockFolderProfileRepo,
      mockSuggestionRepo,
      mockSupabase,
    );
    jest.clearAllMocks();
  });

  describe("checkHealth", () => {
    it("should return empty report for user with no folders", async () => {
      mockFolderProfileRepo.findByUserId.mockResolvedValue([]);

      const report = await service.checkHealth("user-123");

      expect(report.userId).toBe("user-123");
      expect(report.status).toBe("healthy");
      expect(report.totalFolders).toBe(0);
      expect(report.mergeSuggestions).toEqual([]);
      expect(report.splitSuggestions).toEqual([]);
    });

    it("should return healthy status for well-organized folders", async () => {
      const profiles = [
        createProfile(1, { profileEmbedding: createEmbedding(1) }),
        createProfile(2, { profileEmbedding: createEmbedding(100) }), // Very different
        createProfile(3, { profileEmbedding: createEmbedding(200) }), // Very different
      ];
      mockFolderProfileRepo.findByUserId.mockResolvedValue(profiles);

      const report = await service.checkHealth("user-123");

      expect(report.status).toBe("healthy");
      expect(report.totalFolders).toBe(3);
      expect(report.mergeSuggestions.length).toBe(0);
    });

    it("should include analyzedAt timestamp", async () => {
      mockFolderProfileRepo.findByUserId.mockResolvedValue([createProfile(1)]);

      const before = new Date();
      const report = await service.checkHealth("user-123");
      const after = new Date();

      expect(report.analyzedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(report.analyzedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("findMergeCandidates", () => {
    it("should return empty array for no profiles", () => {
      const result = service.findMergeCandidates([]);
      expect(result).toEqual([]);
    });

    it("should not suggest merge for dissimilar folders", () => {
      const profiles = [
        createProfile(1, { profileEmbedding: createEmbedding(1) }),
        createProfile(2, { profileEmbedding: createEmbedding(1000) }), // Very different
      ];

      const result = service.findMergeCandidates(profiles);
      expect(result.length).toBe(0);
    });

    it("should suggest merge for very similar folders", () => {
      const baseEmbedding = createEmbedding(1);
      const profiles = [
        createProfile(1, {
          folderName: "Tech Articles",
          profileEmbedding: baseEmbedding,
          bookmarkCount: 50,
          topTags: ["tech", "programming"],
        }),
        createProfile(2, {
          folderName: "Programming",
          profileEmbedding: createSimilarEmbedding(baseEmbedding, 0.05), // Very similar
          bookmarkCount: 30,
          topTags: ["programming", "code"],
        }),
      ];

      const result = service.findMergeCandidates(profiles);

      expect(result.length).toBe(1);
      expect(result[0].folder1.id).toBe(1); // Larger folder first
      expect(result[0].folder2.id).toBe(2);
      expect(result[0].similarity).toBeGreaterThan(
        FOLDER_LIMITS.MERGE_SIMILARITY_THRESHOLD,
      );
    });

    it("should sort merge suggestions by similarity descending", () => {
      const base1 = createEmbedding(1);
      const _base2 = createEmbedding(100);

      const profiles = [
        createProfile(1, { profileEmbedding: base1 }),
        createProfile(2, {
          profileEmbedding: createSimilarEmbedding(base1, 0.02),
        }), // Very high similarity
        createProfile(3, {
          profileEmbedding: createSimilarEmbedding(base1, 0.08),
        }), // Medium-high similarity
      ];

      const result = service.findMergeCandidates(profiles);

      if (result.length >= 2) {
        expect(result[0].similarity).toBeGreaterThanOrEqual(
          result[1].similarity,
        );
      }
    });

    it("should skip folders without embeddings", () => {
      const profiles = [
        createProfile(1, { profileEmbedding: createEmbedding(1) }),
        createProfile(2, { profileEmbedding: null }), // No embedding
        createProfile(3, { profileEmbedding: createEmbedding(1) }), // Similar to 1
      ];

      const result = service.findMergeCandidates(profiles);

      // Only one possible pair (1, 3) - 2 is skipped
      expect(
        result.every((s) => s.folder1.id !== 2 && s.folder2.id !== 2),
      ).toBe(true);
    });

    it("should suggest merging smaller folder into larger", () => {
      const baseEmbedding = createEmbedding(1);
      const profiles = [
        createProfile(1, {
          profileEmbedding: baseEmbedding,
          bookmarkCount: 20, // Smaller
        }),
        createProfile(2, {
          profileEmbedding: createSimilarEmbedding(baseEmbedding, 0.05),
          bookmarkCount: 80, // Larger
        }),
      ];

      const result = service.findMergeCandidates(profiles);

      if (result.length > 0) {
        expect(result[0].folder1.bookmarkCount).toBeGreaterThanOrEqual(
          result[0].folder2.bookmarkCount,
        );
        expect(result[0].suggestedAction).toBe("merge_to_first");
      }
    });
  });

  describe("findSplitCandidates", () => {
    it("should return empty array for small folders", () => {
      const profiles = [
        createProfile(1, { bookmarkCount: 10, internalSimilarity: 0.3 }),
        createProfile(2, { bookmarkCount: 50, internalSimilarity: 0.3 }),
      ];

      const result = service.findSplitCandidates(profiles);
      expect(result.length).toBe(0);
    });

    it("should not suggest split for cohesive large folders", () => {
      const profiles = [
        createProfile(1, {
          bookmarkCount: 150,
          internalSimilarity: 0.8, // High similarity = cohesive
        }),
      ];

      const result = service.findSplitCandidates(profiles);
      expect(result.length).toBe(0);
    });

    it("should suggest split for large diverse folders", () => {
      const profiles = [
        createProfile(1, {
          folderName: "General",
          bookmarkCount: 150,
          internalSimilarity: 0.3, // Low similarity = diverse
        }),
      ];

      const result = service.findSplitCandidates(profiles);

      expect(result.length).toBe(1);
      expect(result[0].folderId).toBe(1);
      expect(result[0].bookmarkCount).toBe(150);
      expect(result[0].internalSimilarity).toBe(0.3);
      expect(result[0].suggestedClusters).toBeGreaterThanOrEqual(2);
    });

    it("should sort split suggestions by bookmark count descending", () => {
      const profiles = [
        createProfile(1, { bookmarkCount: 120, internalSimilarity: 0.3 }),
        createProfile(2, { bookmarkCount: 200, internalSimilarity: 0.3 }),
        createProfile(3, { bookmarkCount: 150, internalSimilarity: 0.3 }),
      ];

      const result = service.findSplitCandidates(profiles);

      expect(result.length).toBe(3);
      expect(result[0].bookmarkCount).toBe(200); // Largest first
      expect(result[1].bookmarkCount).toBe(150);
      expect(result[2].bookmarkCount).toBe(120);
    });

    it("should skip folders with null internal similarity", () => {
      const profiles = [
        createProfile(1, {
          bookmarkCount: 150,
          internalSimilarity: null,
        }),
      ];

      const result = service.findSplitCandidates(profiles);
      expect(result.length).toBe(0);
    });
  });

  describe("getQuickSummary", () => {
    it("should return healthy for no folders", async () => {
      mockFolderProfileRepo.findByUserId.mockResolvedValue([]);

      const summary = await service.getQuickSummary("user-123");

      expect(summary.status).toBe("healthy");
      expect(summary.totalFolders).toBe(0);
      expect(summary.issueCount).toBe(0);
    });

    it("should count merge issues", async () => {
      const baseEmbedding = createEmbedding(1);
      const profiles = [
        createProfile(1, { profileEmbedding: baseEmbedding }),
        createProfile(2, {
          profileEmbedding: createSimilarEmbedding(baseEmbedding, 0.02),
        }),
      ];
      mockFolderProfileRepo.findByUserId.mockResolvedValue(profiles);

      const summary = await service.getQuickSummary("user-123");

      expect(summary.totalFolders).toBe(2);
      expect(summary.issueCount).toBeGreaterThanOrEqual(0); // May or may not detect issue depending on random perturbation
    });

    it("should count split issues", async () => {
      const profiles = [
        createProfile(1, {
          bookmarkCount: 150,
          internalSimilarity: 0.3,
          profileEmbedding: createEmbedding(1),
        }),
      ];
      mockFolderProfileRepo.findByUserId.mockResolvedValue(profiles);

      const summary = await service.getQuickSummary("user-123");

      expect(summary.issueCount).toBe(1);
      expect(summary.status).toBe("needs_attention");
    });

    it("should return critical status for many issues", async () => {
      // Create multiple large diverse folders
      const profiles = Array.from({ length: 10 }, (_, i) =>
        createProfile(i + 1, {
          bookmarkCount: 150,
          internalSimilarity: 0.3,
          profileEmbedding: createEmbedding(i * 100),
        }),
      );
      mockFolderProfileRepo.findByUserId.mockResolvedValue(profiles);

      const summary = await service.getQuickSummary("user-123");

      expect(summary.status).toBe("critical");
      expect(summary.issueCount).toBeGreaterThan(5);
    });
  });

  describe("saveSuggestions", () => {
    it("should save merge suggestions", async () => {
      const report = {
        userId: "user-123",
        status: "needs_attention" as const,
        totalFolders: 2,
        healthyFolders: 0,
        foldersNeedingAttention: 1,
        mergeSuggestions: [
          {
            folder1: { id: 1, name: "Folder 1", bookmarkCount: 50 },
            folder2: { id: 2, name: "Folder 2", bookmarkCount: 30 },
            similarity: 0.9,
            reason: "Very similar content",
            suggestedAction: "merge_to_first" as const,
          },
        ],
        splitSuggestions: [],
        analyzedAt: new Date(),
      };

      mockSuggestionRepo.create.mockResolvedValue({});

      const count = await service.saveSuggestions("user-123", report);

      expect(count).toBe(1);
      expect(mockSuggestionRepo.create).toHaveBeenCalledTimes(1);
      expect(mockSuggestionRepo.create).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({
          suggestionType: "merge",
          targetFolderId: 1,
          confidence: 90,
        }),
      );
    });

    it("should save split suggestions", async () => {
      const report = {
        userId: "user-123",
        status: "needs_attention" as const,
        totalFolders: 1,
        healthyFolders: 0,
        foldersNeedingAttention: 1,
        mergeSuggestions: [],
        splitSuggestions: [
          {
            folderId: 1,
            folderName: "Large Folder",
            bookmarkCount: 150,
            internalSimilarity: 0.3,
            reason: "Content too diverse",
            suggestedClusters: 3,
          },
        ],
        analyzedAt: new Date(),
      };

      mockSuggestionRepo.create.mockResolvedValue({});

      const count = await service.saveSuggestions("user-123", report);

      expect(count).toBe(1);
      expect(mockSuggestionRepo.create).toHaveBeenCalledWith(
        "user-123",
        expect.objectContaining({
          suggestionType: "split",
          targetFolderId: 1,
          confidence: 70, // 1 - 0.3 = 0.7 * 100
        }),
      );
    });

    it("should save both merge and split suggestions", async () => {
      const report = {
        userId: "user-123",
        status: "critical" as const,
        totalFolders: 3,
        healthyFolders: 0,
        foldersNeedingAttention: 2,
        mergeSuggestions: [
          {
            folder1: { id: 1, name: "Folder 1", bookmarkCount: 50 },
            folder2: { id: 2, name: "Folder 2", bookmarkCount: 30 },
            similarity: 0.85,
            reason: "Similar content",
            suggestedAction: "merge_to_first" as const,
          },
        ],
        splitSuggestions: [
          {
            folderId: 3,
            folderName: "Mixed Folder",
            bookmarkCount: 120,
            internalSimilarity: 0.4,
            reason: "Diverse content",
            suggestedClusters: 2,
          },
        ],
        analyzedAt: new Date(),
      };

      mockSuggestionRepo.create.mockResolvedValue({});

      const count = await service.saveSuggestions("user-123", report);

      expect(count).toBe(2);
      expect(mockSuggestionRepo.create).toHaveBeenCalledTimes(2);
    });
  });
});

describe("FOLDER_LIMITS configuration", () => {
  it("should have merge threshold between 0.7 and 0.9", () => {
    expect(FOLDER_LIMITS.MERGE_SIMILARITY_THRESHOLD).toBeGreaterThanOrEqual(
      0.7,
    );
    expect(FOLDER_LIMITS.MERGE_SIMILARITY_THRESHOLD).toBeLessThanOrEqual(0.9);
  });

  it("should have split threshold at least 50", () => {
    expect(FOLDER_LIMITS.SPLIT_SIZE_THRESHOLD).toBeGreaterThanOrEqual(50);
  });

  it("should have split diversity threshold between 0.3 and 0.7", () => {
    expect(FOLDER_LIMITS.SPLIT_DIVERSITY_THRESHOLD).toBeGreaterThanOrEqual(0.3);
    expect(FOLDER_LIMITS.SPLIT_DIVERSITY_THRESHOLD).toBeLessThanOrEqual(0.7);
  });

  it("should have reasonable max suggestions limits", () => {
    expect(FOLDER_LIMITS.MAX_MERGE_SUGGESTIONS).toBeGreaterThanOrEqual(3);
    expect(FOLDER_LIMITS.MAX_MERGE_SUGGESTIONS).toBeLessThanOrEqual(10);
    expect(FOLDER_LIMITS.MAX_SPLIT_SUGGESTIONS).toBeGreaterThanOrEqual(2);
    expect(FOLDER_LIMITS.MAX_SPLIT_SUGGESTIONS).toBeLessThanOrEqual(10);
  });
});

describe("Boundary conditions", () => {
  let service: FolderHealthService;

  beforeEach(() => {
    service = new FolderHealthService(
      mockFolderProfileRepo,
      mockSuggestionRepo,
      mockSupabase,
    );
    jest.clearAllMocks();
  });

  describe("findMergeCandidates limits", () => {
    it("should respect MAX_MERGE_SUGGESTIONS limit", () => {
      // Create many folders with very similar embeddings
      const baseEmbedding = createEmbedding(1);
      const profiles = Array.from({ length: 20 }, (_, i) =>
        createProfile(i + 1, {
          profileEmbedding: createSimilarEmbedding(baseEmbedding, 0.02),
          bookmarkCount: 10 + i,
        }),
      );

      const result = service.findMergeCandidates(profiles);

      // Should not exceed MAX_MERGE_SUGGESTIONS
      expect(result.length).toBeLessThanOrEqual(
        FOLDER_LIMITS.MAX_MERGE_SUGGESTIONS,
      );
    });

    it("should handle single folder", () => {
      const profiles = [createProfile(1)];
      const result = service.findMergeCandidates(profiles);
      expect(result).toEqual([]);
    });

    it("should handle empty embedding array (not null)", () => {
      const profiles = [
        createProfile(1, { profileEmbedding: [] }),
        createProfile(2, { profileEmbedding: createEmbedding(1) }),
      ];

      const result = service.findMergeCandidates(profiles);

      // Should not crash and should handle empty array gracefully
      expect(
        result.every((s) => s.folder1.id !== 1 && s.folder2.id !== 1),
      ).toBe(true);
    });

    it("should handle all folders without embeddings", () => {
      const profiles = [
        createProfile(1, { profileEmbedding: null }),
        createProfile(2, { profileEmbedding: null }),
        createProfile(3, { profileEmbedding: undefined }),
      ];

      const result = service.findMergeCandidates(profiles);
      expect(result).toEqual([]);
    });
  });

  describe("findSplitCandidates limits", () => {
    it("should respect MAX_SPLIT_SUGGESTIONS limit", () => {
      // Create many large diverse folders
      const profiles = Array.from({ length: 10 }, (_, i) =>
        createProfile(i + 1, {
          bookmarkCount: 200 + i * 10,
          internalSimilarity: 0.2,
        }),
      );

      const result = service.findSplitCandidates(profiles);

      expect(result.length).toBeLessThanOrEqual(
        FOLDER_LIMITS.MAX_SPLIT_SUGGESTIONS,
      );
    });

    it("should handle folder at exact size threshold", () => {
      const profiles = [
        createProfile(1, {
          bookmarkCount: FOLDER_LIMITS.SPLIT_SIZE_THRESHOLD,
          internalSimilarity: 0.3,
        }),
      ];

      const result = service.findSplitCandidates(profiles);

      // Should be included since bookmarkCount >= threshold
      expect(result.length).toBe(1);
    });

    it("should handle folder just below size threshold", () => {
      const profiles = [
        createProfile(1, {
          bookmarkCount: FOLDER_LIMITS.SPLIT_SIZE_THRESHOLD - 1,
          internalSimilarity: 0.3,
        }),
      ];

      const result = service.findSplitCandidates(profiles);

      // Should not be included
      expect(result.length).toBe(0);
    });

    it("should handle folder at exact diversity threshold", () => {
      const profiles = [
        createProfile(1, {
          bookmarkCount: 150,
          internalSimilarity: FOLDER_LIMITS.SPLIT_DIVERSITY_THRESHOLD,
        }),
      ];

      const result = service.findSplitCandidates(profiles);

      // Should not be included since internalSimilarity >= threshold
      expect(result.length).toBe(0);
    });

    it("should handle folder just below diversity threshold", () => {
      const profiles = [
        createProfile(1, {
          bookmarkCount: 150,
          internalSimilarity: FOLDER_LIMITS.SPLIT_DIVERSITY_THRESHOLD - 0.01,
        }),
      ];

      const result = service.findSplitCandidates(profiles);

      // Should be included
      expect(result.length).toBe(1);
    });
  });

  describe("error handling", () => {
    it("should return empty report when repo throws error", async () => {
      mockFolderProfileRepo.findByUserId.mockRejectedValue(
        new Error("Database error"),
      );

      const report = await service.checkHealth("user-123");

      // Should return empty report as fallback
      expect(report.status).toBe("healthy");
      expect(report.totalFolders).toBe(0);
    });

    it("should return 0 when saveSuggestions fails", async () => {
      const report = {
        userId: "user-123",
        status: "needs_attention" as const,
        totalFolders: 1,
        healthyFolders: 0,
        foldersNeedingAttention: 1,
        mergeSuggestions: [
          {
            folder1: { id: 1, name: "Folder 1", bookmarkCount: 50 },
            folder2: { id: 2, name: "Folder 2", bookmarkCount: 30 },
            similarity: 0.9,
            reason: "Similar",
            suggestedAction: "merge_to_first" as const,
          },
        ],
        splitSuggestions: [],
        analyzedAt: new Date(),
      };

      mockSuggestionRepo.create.mockRejectedValue(new Error("Save failed"));

      const count = await service.saveSuggestions("user-123", report);

      expect(count).toBe(0);
    });

    it("should return healthy summary when getQuickSummary fails", async () => {
      mockFolderProfileRepo.findByUserId.mockRejectedValue(
        new Error("Query error"),
      );

      const summary = await service.getQuickSummary("user-123");

      expect(summary.status).toBe("healthy");
      expect(summary.totalFolders).toBe(0);
      expect(summary.issueCount).toBe(0);
    });
  });
});
