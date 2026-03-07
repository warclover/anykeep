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
// Mock auth state
// =============================================================================

let mockAuthUserId: string | null = "test-user-id";
let mockAuthError: Error | null = null;
let mockAuthShouldThrow: Error | null = null;

// =============================================================================
// Mock @/lib/api/middleware - intercept withAuthMiddleware
// =============================================================================

jest.mock("@/lib/api/middleware", () => ({
  withAuthMiddleware: (handler: (...args: unknown[]) => Promise<unknown>) => {
    return async (request: any, context?: any) => {
      const { NextResponse } = await import("next/server");

      if (mockAuthShouldThrow) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: mockAuthShouldThrow.message,
            },
          },
          { status: 500 },
        );
      }

      if (mockAuthError || !mockAuthUserId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Authentication required",
            },
          },
          { status: 401 },
        );
      }
      return handler(request, {
        user: { id: mockAuthUserId },
        userId: mockAuthUserId,
        authResult: {
          user: { id: mockAuthUserId },
          userId: mockAuthUserId,
          error: null,
          method: "token",
          duration: 1,
        },
        params: context?.params ?? Promise.resolve({}),
      });
    };
  },
}));

// =============================================================================
// Mock Supabase
// =============================================================================

const mockSupabaseClient = {
  from: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// =============================================================================
// Mock LoggerService
// =============================================================================

jest.mock("@/lib/classification/infrastructure/shared-services/logger", () => ({
  LoggerService: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

// =============================================================================
// 认证辅助函数
// =============================================================================

function mockAuthenticated(userId = "test-user-id") {
  mockAuthUserId = userId;
  mockAuthError = null;
  mockAuthShouldThrow = null;
}

function mockUnauthenticated() {
  mockAuthUserId = null;
  mockAuthError = new Error("Unauthorized");
  mockAuthShouldThrow = null;
}

function mockAuthThrows(error: Error) {
  mockAuthShouldThrow = error;
}

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
// Mock Response & ReadableStream
// =============================================================================

const originalResponse = global.Response;
const originalReadableStream = global.ReadableStream;

class CustomMockResponse {
  body: any;
  headers: Headers;
  status: number;

  constructor(body: any, init: any = {}) {
    // console.log("CustomMockResponse constructor called with body:", body);
    this.body = body;
    this.headers = new Headers(init.headers);
    this.status = init.status || 200;
  }

  async text() {
    return this.body?.toString() || "";
  }

  async json() {
    return typeof this.body === "string" ? JSON.parse(this.body) : {};
  }
}

// Simple Mock Stream that collects enqueued data
class CustomMockReadableStream {
  public chunks: any[] = [];
  public controller: any;

  constructor(underlyingSource: any) {
    // console.log("CustomMockReadableStream constructor called");
    this.controller = {
      enqueue: (chunk: any) => {
        // console.log("CustomMockReadableStream enqueue:", chunk);
        this.chunks.push(chunk);
      },
      close: () => {
        /* no-op */
      },
      error: () => {
        /* no-op */
      },
    };

    // Execute start immediately to populate data
    if (underlyingSource.start) {
      this.start(underlyingSource);
    }
  }

  async start(source: any) {
    await source.start(this.controller);
  }

  getReader() {
    let index = 0;
    return {
      read: async () => {
        if (index < this.chunks.length) {
          const chunk = this.chunks[index++];
          return {
            value:
              typeof chunk === "string"
                ? new TextEncoder().encode(chunk)
                : chunk,
            done: false,
          };
        }
        return { value: undefined, done: true };
      },
      cancel: () => {
        /* no-op */
      },
      releaseLock: () => {
        /* no-op */
      },
    };
  }

  // Helper to read all text data
  readAllText() {
    const decoder = new TextDecoder();
    return this.chunks
      .map((c) => {
        if (typeof c === "string") return c;
        return decoder.decode(c);
      })
      .join("");
  }
}

// =============================================================================
// 参数验证测试
// =============================================================================

describe("T1 Stream API - Parameter Validation", () => {
  beforeAll(() => {
    // @ts-expect-error - Mocking global Response for testing
    global.Response = CustomMockResponse;
    // @ts-expect-error - Mocking global ReadableStream for testing
    global.ReadableStream = CustomMockReadableStream;
  });

  afterAll(() => {
    global.Response = originalResponse;
    global.ReadableStream = originalReadableStream;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticated();
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
    mockUnauthenticated();

    const request = createTestRequest("123");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("should return 401 if auth error occurs", async () => {
    mockUnauthenticated();

    const request = createTestRequest("123");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});

// =============================================================================
// SSE 流测试
// =============================================================================

describe("T1 Stream API - SSE Stream", () => {
  beforeAll(() => {
    Object.defineProperty(global, "Response", {
      value: CustomMockResponse,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, "ReadableStream", {
      value: CustomMockReadableStream,
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(global, "Response", {
      value: originalResponse,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, "ReadableStream", {
      value: originalReadableStream,
      writable: true,
      configurable: true,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticated();
  });

  it("should return SSE response with correct headers", async () => {
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
    // Debug logging
    console.log("Global Response name:", global.Response.name);
    console.log("Global ReadableStream name:", global.ReadableStream.name);

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

    console.log("Response constructor name:", response.constructor.name);
    console.log("Response body:", response.body);
    if (response.body) {
      console.log(
        "Response body constructor name:",
        response.body.constructor.name,
      );
      console.log(
        "Type of getReader:",
        typeof (response.body as any).getReader,
      );
    }

    // 读取流的第一个事件
    let chunk = "";
    const body = response.body as any;

    if (body) {
      if (typeof body.getReader === "function") {
        const reader = body.getReader();
        const { value } = await reader.read();
        if (value) {
          chunk = new TextDecoder().decode(value);
        }
        await reader.cancel();
      } else {
        // Node.js environment fallback
        try {
          // Check if it's an async iterable
          if (Symbol.asyncIterator in body) {
            for await (const value of body) {
              if (Buffer.isBuffer(value)) {
                chunk = value.toString();
              } else if (value instanceof Uint8Array) {
                chunk = new TextDecoder().decode(value);
              } else {
                chunk = String(value);
              }
              break; // Read only first chunk
            }
          } else if (typeof body.on === "function") {
            // Node stream interface
            await new Promise<void>((resolve) => {
              body.once("data", (data: any) => {
                chunk = data.toString();
                resolve();
              });
            });
          } else {
            console.warn("Unknown response body type:", body);
          }
        } catch (e) {
          console.error("Stream reading failed:", e);
        }
      }
    }

    expect(chunk).toContain("data:");
    expect(chunk).toContain('"type":"status"');
    expect(chunk).toContain('"status":"connected"');
  });
});

// =============================================================================
// T1 队列状态测试
// =============================================================================

describe("T1 Stream API - Queue Status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticated();
  });

  it("should handle processing status", async () => {
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
    mockAuthenticated();
  });

  it("should handle database query errors gracefully", async () => {
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
    mockAuthThrows(new Error("Unexpected error"));

    const request = createTestRequest("123");
    const response = await GET(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toHaveProperty("error");
  });
});
