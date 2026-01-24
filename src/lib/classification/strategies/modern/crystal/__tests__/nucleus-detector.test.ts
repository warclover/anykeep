/**
 * NucleusDetector 单元测试
 */

import { NucleusDetector } from "../crystal-growth/nucleus-detector";

// Mock Supabase client
const mockSupabase = {
  rpc: jest.fn(),
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        maybeSingle: jest.fn(),
      })),
    })),
  })),
};

describe("NucleusDetector", () => {
  let detector: NucleusDetector;

  beforeEach(() => {
    jest.clearAllMocks();
    detector = new NucleusDetector(mockSupabase as any);
  });

  describe("detect", () => {
    it("should return formed=true when enough neighbors found", async () => {
      // Mock bookmark info
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 1, title: "React Hooks 入门" },
              error: null,
            }),
          }),
        }),
      });

      // Mock neighbors
      mockSupabase.rpc.mockResolvedValue({
        data: [
          { bookmark_id: 2, title: "React 状态管理", similarity: 0.85 },
          { bookmark_id: 3, title: "React 组件设计", similarity: 0.82 },
        ],
        error: null,
      });

      const result = await detector.detect("user-123", 1, 3);

      expect(result.formed).toBe(true);
      expect(result.neighborsCount).toBe(2);
      expect(result.clusterBookmarkIds).toEqual([1, 2, 3]);
      expect(result.clusterTitles).toHaveLength(3);
    });

    it("should return formed=false when insufficient neighbors", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 1, title: "孤立书签" },
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.rpc.mockResolvedValue({
        data: [{ bookmark_id: 2, title: "只有一个邻居", similarity: 0.75 }],
        error: null,
      });

      const result = await detector.detect("user-123", 1, 3);

      expect(result.formed).toBe(false);
      expect(result.neighborsCount).toBe(1);
      expect(result.clusterBookmarkIds).toEqual([]);
    });

    it("should return empty result when bookmark not found", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const result = await detector.detect("user-123", 999, 3);

      expect(result.formed).toBe(false);
      expect(result.neighborsCount).toBe(0);
    });
  });
});
