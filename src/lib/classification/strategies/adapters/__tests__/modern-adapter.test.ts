import { ModernStrategyAdapter } from "../modern-adapter";
import type { ClassificationPipelineService } from "../../modern/classification-pipeline.service";

// Mock dependencies
jest.mock("../../modern/classification-pipeline.service");
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

describe("ModernStrategyAdapter", () => {
  let adapter: ModernStrategyAdapter;
  let mockPipelineService: jest.Mocked<ClassificationPipelineService>;
  let mockSupabase: any;

  beforeEach(() => {
    // Setup Pipeline Service Mock
    mockPipelineService = {
      classify: jest.fn(),
      classifyBatch: jest.fn(),
      classifyT0Only: jest.fn(),
    } as any;

    // Setup Supabase Mock
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    adapter = new ModernStrategyAdapter(mockPipelineService, mockSupabase);
  });

  describe("normalizeConfidence", () => {
    // Since normalizeConfidence is private, we test it via classify()

    it("should normalize 0-1 confidence to 0-100", async () => {
      const mockRequest = {
        userId: "user-123",
        bookmarkId: 1,
        title: "Test Bookmark",
      };

      const mockV5Result = {
        folderId: 10,
        confidence: 0.85, // 0-1 scale
        reasoning: "AI reasoning",
        usedT1: false,
        totalLatencyMs: 100,
        t0LatencyMs: 50,
      };

      mockPipelineService.classify.mockResolvedValue(mockV5Result as any);
      mockSupabase.single.mockResolvedValue({
        data: { name: "Folder A" },
        error: null,
      });

      const result = await adapter.classify(mockRequest as any);

      expect(result.confidence).toBe(85); // 0.85 * 100
    });

    it("should keep 0-100 confidence as is", async () => {
      const mockRequest = {
        userId: "user-123",
        bookmarkId: 1,
        title: "Test Bookmark",
      };

      const mockV5Result = {
        folderId: 10,
        confidence: 90, // Already 0-100 scale
        reasoning: "AI reasoning",
        usedT1: false,
        totalLatencyMs: 100,
        t0LatencyMs: 50,
      };

      mockPipelineService.classify.mockResolvedValue(mockV5Result as any);
      mockSupabase.single.mockResolvedValue({
        data: { name: "Folder A" },
        error: null,
      });

      const result = await adapter.classify(mockRequest as any);

      expect(result.confidence).toBe(90); // Unchanged
    });
  });

  describe("folder name resolution", () => {
    it("should resolve folder name when folderId is present", async () => {
      const mockRequest = { userId: "u1", bookmarkId: 1 };
      const mockV5Result = { folderId: 123, confidence: 0.9 };

      mockPipelineService.classify.mockResolvedValue(mockV5Result as any);

      // Mock Supabase response
      mockSupabase.single.mockResolvedValue({
        data: { name: "Target Folder" },
        error: null,
      });

      const result = await adapter.classify(mockRequest as any);

      expect(result.folderName).toBe("Target Folder");
      expect(mockSupabase.from).toHaveBeenCalledWith("folders");
      expect(mockSupabase.eq).toHaveBeenCalledWith("id", 123);
    });

    it("should handle missing folder name gracefully", async () => {
      const mockRequest = { userId: "u1", bookmarkId: 1 };
      const mockV5Result = { folderId: 123, confidence: 0.9 };

      mockPipelineService.classify.mockResolvedValue(mockV5Result as any);

      // Mock error or empty data
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: "Not found" },
      });

      const result = await adapter.classify(mockRequest as any);

      expect(result.folderName).toBeNull();
    });
  });
});
