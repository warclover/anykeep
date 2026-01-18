/**
 * T1 Stream API 集成测试
 *
 * 测试 SSE 实时推送功能、错误处理和数据格式
 *
 * @module api/classification/v5/t1-stream/__tests__/route.test
 * @version 1.0.0
 * @since 2026-01-18
 */

import { NextRequest } from "next/server";
import { GET } from "../route";

// =============================================================================
// Mock Supabase
// =============================================================================

const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// =============================================================================
// 测试辅助函数
// =============================================================================

/**
 * 创建测试用的 NextRequest
 */
function createTestRequest(bookmarkId?: string): NextRequest {
  const url = bookmarkId
    ? `http://localhost:3000/api/classification/v5/t1-stream?bookmarkId=${bookmarkId}`
    : "http://localhost:3000/api/classification/v5/t1-stream";

  return new NextRequest(url);
}

/**
 * 读取 SSE 流数据
 */
async function _readSSEStream(response: Response): Promise<string[]> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No reader available");

  const decoder = new TextDecoder();
  const chunks: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }

  return chunks;
}

/**
 * 解析 SSE 事件
 */
function _parseSSEEvents(
  chunks: string[],
): Array<{ type: string; data: unknown }> {
  const events: Array<{ type: string; data: unknown }> = [];

  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.substring(6);
        try {
          const event = JSON.parse(jsonStr);
          events.push(event);
        } catch {
          // 忽略解析错误
        }
      }
    }
  }

  return events;
}

// =============================================================================
// 参数验证测试
// =============================================================================

describe("T1 Stream API - Parameter Validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if bookmarkId is missing", async () => {
    const request = createTestRequest();
    const response = await GET(request);

    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toBe("Missing bookmarkId parameter");
  });

  it("should return 400 if bookmarkId is not a number", async () => {
    const request = createTestRequest("invalid");
    const response = await GET(request);

    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toBe("Invalid bookmarkId parameter");
  });

  it("should return 400 if bookmarkId is negative", async () => {
    const request = createTestRequest("-1");
    const response = await GET(request);

    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toBe("Invalid bookmarkId parameter");
  });

  it("should return 400 if bookmarkId is zero", async () => {
    const request = createTestRequest("0");
    const response = await GET(request);

    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toBe("Invalid bookmarkId parameter");
  });
});

// =============================================================================
// 认证测试
// =============================================================================

describe("T1 Stream API - Authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 if user is not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Not authenticated"),
    });

    const request = createTestRequest("123");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const text = await response.text();
    expect(text).toBe("Unauthorized");
  });

  it("should return 401 if auth error occurs", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const request = createTestRequest("123");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});

// =============================================================================
// SSE 流测试
// =============================================================================

describe("T1 Stream API - SSE Stream", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return SSE response with correct headers", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });

    mockSupabaseClient.from = mockFrom;

    const request = createTestRequest("123");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe(
      "no-cache, no-transform",
    );
    expect(response.headers.get("Connection")).toBe("keep-alive");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");
  });

  it("should send initial connection event", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });

    mockSupabaseClient.from = mockFrom;

    const request = createTestRequest("123");
    const response = await GET(request);

    // 读取流的第一个事件
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    if (reader) {
      const { value } = await reader.read();
      const decoder = new TextDecoder();
      const chunk = decoder.decode(value);

      expect(chunk).toContain("data:");
      expect(chunk).toContain('"type":"status"');
      expect(chunk).toContain('"status":"connected"');

      reader.releaseLock();
    }
  });
});

// =============================================================================
// T1 队列状态测试
// =============================================================================

describe("T1 Stream API - Queue Status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle processing status", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });

    const mockT1Record = {
      bookmark_id: 123,
      status: "processing",
      t1_folder_id: null,
      t1_confidence: null,
      t1_reasoning: null,
      error_message: null,
    };

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockT1Record,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });

    mockSupabaseClient.from = mockFrom;

    const request = createTestRequest("123");
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it("should handle completed status with results", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });

    const mockT1Record = {
      bookmark_id: 123,
      status: "completed",
      t1_folder_id: 456,
      t1_confidence: 0.92,
      t1_reasoning: "Test reasoning",
      error_message: null,
    };

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockT1Record,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });

    mockSupabaseClient.from = mockFrom;

    const request = createTestRequest("123");
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it("should handle failed status with error message", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });

    const mockT1Record = {
      bookmark_id: 123,
      status: "failed",
      t1_folder_id: null,
      t1_confidence: null,
      t1_reasoning: null,
      error_message: "Test error message",
    };

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockT1Record,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });

    mockSupabaseClient.from = mockFrom;

    const request = createTestRequest("123");
    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});

// =============================================================================
// 错误处理测试
// =============================================================================

describe("T1 Stream API - Error Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle database query errors gracefully", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "test-user-id" } },
      error: null,
    });

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: new Error("Database error"),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    mockSupabaseClient.from = mockFrom;

    const request = createTestRequest("123");
    const response = await GET(request);

    // 应该返回 SSE 流,但不会发送错误事件
    expect(response.status).toBe(200);
  });

  it("should handle unexpected errors", async () => {
    mockSupabaseClient.auth.getUser.mockRejectedValue(
      new Error("Unexpected error"),
    );

    const request = createTestRequest("123");
    const response = await GET(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toHaveProperty("error");
  });
});
